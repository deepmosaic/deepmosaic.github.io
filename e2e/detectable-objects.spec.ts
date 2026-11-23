// 検出対象の図 (`_includes/detectable-objects.html` の埋め込み SVG) の表示の検査。
//
//   E2E_SKIP_BUILD=1 npx playwright test e2e/detectable-objects.spec.ts   # ビルド済みの _site を配る
//
// ## 何を見るのか
//
// `/`・`/en/`・`/zh-tw/`・`/docs/` (docs は <details> を開いてから) を 2 つの幅 (desktop = 1280×800、mobile = Pixel 7) で開いて、
//   (1) 図の svg が見えていて role="img"、アクセシブルネームが空でない
//   (2) 各 <text> の getBBox() (viewBox の単位) が枠の中: 左の 2 本は x 29〜469 (矢羽の先の三角より左)、右の 4 本は x 480〜929、
//       y は 0〜540。左右それぞれで隣の行と重ならない
//   (3) 横スクロールが無い
//   (4) en / zh-tw の svg の textContent に仮名が無い
//   (5) en だけは矢羽の境目を左へ寄せて組み直しているので、(2) の枠の代わりに矢羽の点から面を求めて、行 (<tspan> があれば
//       その 1 行ずつ) が左は矢羽の中 (その行の上端と下端の高さでの矢羽の縁より内側)、右は矢羽の先より右で 960 の内側にあることを見る。
//       右の 4 項目の文字の実寸 (font-size × 表示幅 / 960) が desktop で 18px 以上・mobile で 13px 以上・組み直す前の 12.6px より大きい
// 文字の大きさと行の送りは部品の中で言語ごとに決めている (この検査で決めた値)。外部へのリクエストは全部止める (本番の計測を汚さない)。
import { test, expect, devices, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number; text: string };
type Arrow = { x: number; tip: number };

const KANA = /[ぁ-ヿㇰ-ㇿｦ-ﾟ]/u;
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const LEFT = { min: 29, max: 469 };
const RIGHT = { min: 480, max: 929 };
/** en の行と面の縁の間に空ける最小の余白 (viewBox の単位)。 */
const EN_PAD = 8;
/** en の右の 4 項目の実寸の下限 (px)。組み直す前の en は 12.6px だった。 */
const EN_MIN_PX = { desktop: 18, mobile: 13 };
const EN_BEFORE_PX = 12.6;

const PAGES = [
  { path: '/', svg: '#hero-detectable svg', kanaFree: false, en: false },
  { path: '/en/', svg: '#hero-detectable svg', kanaFree: true, en: true },
  { path: '/zh-tw/', svg: '#hero-detectable svg', kanaFree: true, en: false },
  { path: '/docs/', svg: 'details svg[aria-labelledby="docs-detectable-title"]', kanaFree: false, en: false },
] as const;

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin && (url.protocol === 'http:' || url.protocol === 'https:'),
    (route) => route.abort(),
  );
});

async function openPage(page: Page, path: string): Promise<void> {
  const res = await page.goto(path, { waitUntil: 'load' });
  expect(res?.ok(), `${path} が開けない (${res?.status()})`).toBe(true);
  if (path === '/docs/') {
    await page.locator('details:has(svg[aria-labelledby="docs-detectable-title"])').evaluate((d) => {
      (d as HTMLDetailsElement).open = true;
    });
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

const textBoxes = (page: Page, selector: string): Promise<Box[]> =>
  page.locator(selector).evaluate((svg) =>
    [...svg.querySelectorAll('text')].map((t) => {
      const b = (t as SVGTextElement).getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height, text: t.textContent ?? '' };
    }),
  );

/** 枠と重なりの違反の一覧 (空なら合格)。 */
function layoutErrors(boxes: Box[]): string[] {
  const errors: string[] = [];
  if (boxes.length !== 6) return [`<text> が ${boxes.length} 本`];
  boxes.forEach((b, i) => {
    const range = i < 2 ? LEFT : RIGHT;
    if (b.x < range.min || b.x + b.width > range.max) errors.push(`「${b.text}」の x ${b.x.toFixed(1)}〜${(b.x + b.width).toFixed(1)} が ${range.min}〜${range.max} の外`);
    if (b.y < 0 || b.y + b.height > 540) errors.push(`「${b.text}」の y ${b.y.toFixed(1)}〜${(b.y + b.height).toFixed(1)} が 0〜540 の外`);
  });
  for (const group of [boxes.slice(0, 2), boxes.slice(2)]) {
    for (let i = 1; i < group.length; i += 1) {
      const prev = group[i - 1];
      if (prev.y + prev.height > group[i].y) errors.push(`「${prev.text}」と「${group[i].text}」が重なる`);
    }
  }
  return errors;
}

/** 矢羽の点の列 `0,0 X,0 T,270 X,540 0,540` の X と T。 */
function parseArrow(points: string): Arrow | null {
  const p = points.trim().split(/\s+/).map((xy) => xy.split(',').map(Number));
  if (p.length !== 5 || p[2][1] !== 270) return null;
  return { x: p[1][0], tip: p[2][0] };
}

/** 高さ y での矢羽の右の縁の x (矩形の右端から先の三角へ)。 */
const arrowEdge = (a: Arrow, y: number): number => a.x + (a.tip - a.x) * (1 - Math.abs(y - 270) / 270);

/** en の行の違反の一覧 (空なら合格)。lines は [左の行..., 右の行...] で、left は左の行の本数。 */
function enLayoutErrors(a: Arrow, lines: Box[], left: number): string[] {
  const errors: string[] = [];
  lines.forEach((b, i) => {
    const right = b.x + b.width;
    if (b.y < 0 || b.y + b.height > 540) errors.push(`「${b.text}」の y が 0〜540 の外`);
    if (i < left) {
      const edge = Math.min(arrowEdge(a, b.y), arrowEdge(a, b.y + b.height));
      if (b.x < EN_PAD || right > edge - EN_PAD) errors.push(`「${b.text}」の x ${b.x.toFixed(1)}〜${right.toFixed(1)} が矢羽 (縁 ${edge.toFixed(1)}) の外`);
    } else if (b.x < a.tip + EN_PAD || right > 960 - EN_PAD) {
      errors.push(`「${b.text}」の x ${b.x.toFixed(1)}〜${right.toFixed(1)} が右の面 (${a.tip}〜960) の外`);
    }
  });
  for (const group of [lines.slice(0, left), lines.slice(left)]) {
    for (let i = 1; i < group.length; i += 1) {
      if (group[i - 1].y + group[i - 1].height > group[i].y) errors.push(`「${group[i - 1].text}」と「${group[i].text}」が重なる`);
    }
  }
  return errors;
}

/** en の図: 矢羽の点・行の箱 (<tspan> があれば 1 行ずつ)・右の 4 項目の実寸 (px)。 */
const enMeasure = (page: Page, selector: string) =>
  page.locator(selector).evaluate((svg) => {
    const texts = [...svg.querySelectorAll('text')];
    const boxOf = (el: SVGGraphicsElement) => {
      const b = el.getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height, text: el.textContent ?? '' };
    };
    const linesOf = (t: SVGTextElement) => {
      const spans = [...t.querySelectorAll('tspan')].filter((s) => s.getAttribute('font-size') !== '0');
      return spans.length ? spans.map(boxOf) : [boxOf(t)];
    };
    const scale = svg.getBoundingClientRect().width / 960;
    return {
      points: svg.querySelector('polygon')?.getAttribute('points') ?? '',
      leftLines: texts.slice(0, 2).flatMap(linesOf),
      rightLines: texts.slice(2).flatMap(linesOf),
      itemPx: texts.slice(2).map((t) => parseFloat(getComputedStyle(t).fontSize) * scale),
    };
  });

async function verifyEn(page: Page, selector: string, minPx: number): Promise<void> {
  const m = await enMeasure(page, selector);
  const arrow = parseArrow(m.points);
  expect(arrow, `矢羽の点が読めない: ${m.points}`).not.toBeNull();
  expect(m.leftLines.length, '左の見出しが 3 行でない').toBe(3);
  const errors = enLayoutErrors(arrow!, [...m.leftLines, ...m.rightLines], m.leftLines.length);
  expect(errors, JSON.stringify(m)).toEqual([]);
  for (const px of m.itemPx) {
    expect(px, `右の項目の実寸 ${px.toFixed(1)}px が ${minPx}px 未満`).toBeGreaterThanOrEqual(minPx);
    expect(px, '組み直す前の 12.6px より大きくない').toBeGreaterThan(EN_BEFORE_PX);
  }
}

async function verify(page: Page, path: string, selector: string, kanaFree: boolean, en = false): Promise<void> {
  await openPage(page, path);
  const svg = page.locator(selector);
  await expect(svg).toHaveCount(1);
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('role', 'img');
  const name = await svg.evaluate((el) => document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? '');
  expect(name, `${path}: アクセシブルネームが空`).not.toBe('');
  await expect(svg).toHaveAccessibleName(name);

  const boxes = await textBoxes(page, selector);
  expect(boxes.length, `${path}: <text> が 6 本でない`).toBe(6);
  // en は矢羽の境目が違うので固定の枠ではなく verifyEn で見る
  if (!en) expect(layoutErrors(boxes), `${path}: ${JSON.stringify(boxes)}`).toEqual([]);

  if (kanaFree) {
    const text = (await svg.textContent()) ?? '';
    expect(KANA.test(text), `${path}: 図に仮名が残っている: ${text}`).toBe(false);
  }
  const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(scroll.sw, `${path}: 横スクロールがある`).toBeLessThanOrEqual(scroll.iw);
}

test('layoutErrors: 陰性対照 (枠の外・重なり・本数)', () => {
  const good: Box[] = [
    { x: 100, y: 180, width: 300, height: 90, text: 'a' },
    { x: 100, y: 280, width: 300, height: 90, text: 'b' },
    { x: 550, y: 60, width: 300, height: 90, text: 'c' },
    { x: 550, y: 160, width: 300, height: 90, text: 'd' },
    { x: 550, y: 260, width: 300, height: 90, text: 'e' },
    { x: 550, y: 360, width: 300, height: 90, text: 'f' },
  ];
  expect(layoutErrors(good)).toEqual([]);
  expect(layoutErrors(good.slice(0, 5)).length).toBeGreaterThan(0);
  expect(layoutErrors(good.map((b, i) => (i === 1 ? { ...b, width: 400 } : b))).length).toBeGreaterThan(0);
  expect(layoutErrors(good.map((b, i) => (i === 3 ? { ...b, y: 100 } : b))).length).toBeGreaterThan(0);
  expect(layoutErrors(good.map((b, i) => (i === 5 ? { ...b, y: 460 } : b))).length).toBeGreaterThan(0);
});

test('enLayoutErrors: 陰性対照 (矢羽の縁をはみ出す・右の面の外・重なり)', () => {
  const arrow = parseArrow('0,0 245.2,0 348,270 245.2,540 0,540')!;
  expect(arrow).toEqual({ x: 245.2, tip: 348 });
  const good: Box[] = [
    { x: 70, y: 150, width: 210, height: 76, text: 'a' },
    { x: 30, y: 232, width: 288, height: 76, text: 'b' },
    { x: 86, y: 314, width: 176, height: 76, text: 'c' },
    { x: 425, y: 76, width: 458, height: 76, text: 'd' },
    { x: 392, y: 180, width: 525, height: 76, text: 'e' },
    { x: 369, y: 284, width: 570, height: 76, text: 'f' },
    { x: 434, y: 388, width: 441, height: 76, text: 'g' },
  ];
  expect(enLayoutErrors(arrow, good, 3)).toEqual([]);
  // 上の行は矢羽の縁が内側に入るので、真ん中の行の幅では縁をはみ出す
  expect(enLayoutErrors(arrow, good.map((b, i) => (i === 0 ? { ...b, x: 30, width: 288 } : b)), 3).length).toBeGreaterThan(0);
  expect(enLayoutErrors(arrow, good.map((b, i) => (i === 5 ? { ...b, x: 340 } : b)), 3).length).toBeGreaterThan(0);
  expect(enLayoutErrors(arrow, good.map((b, i) => (i === 5 ? { ...b, width: 620 } : b)), 3).length).toBeGreaterThan(0);
  expect(enLayoutErrors(arrow, good.map((b, i) => (i === 4 ? { ...b, y: 100 } : b)), 3).length).toBeGreaterThan(0);
  expect(parseArrow('0,0 411.2,0 514,200 411.2,540 0,540')).toBeNull();
});

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });
  for (const p of PAGES) {
    test(`${p.path} の検出対象の図`, async ({ page }) => {
      await verify(page, p.path, p.svg, p.kanaFree, p.en);
      if (p.en) await verifyEn(page, p.svg, EN_MIN_PX.desktop);
    });
  }
});

test.describe('mobile', () => {
  const { defaultBrowserType: _ignored, ...pixel7 } = devices['Pixel 7'];
  test.use(pixel7);
  for (const p of PAGES) {
    test(`${p.path} の検出対象の図`, async ({ page }) => {
      await verify(page, p.path, p.svg, p.kanaFree, p.en);
      if (p.en) await verifyEn(page, p.svg, EN_MIN_PX.mobile);
    });
  }
});
