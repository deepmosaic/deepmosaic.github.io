// T-2215 (i18n1112 I18N-804): 公式サイトの英中のページのはみ出し・日本語の残り (漏れ) の検査とスクリーンショット。
//
//   E2E_SKIP_BUILD=1 npx playwright test e2e/i18n-layout.spec.ts                  # はみ出し・漏れ (ビルド済みの _site を配る)
//   E2E_SKIP_BUILD=1 DM_I18N_SHOTS=1 npx playwright test e2e/i18n-layout.spec.ts  # + 全ページの全面のスクリーンショット
//
// ## 何を見るのか
//
// 訳の台帳 `_data/i18n_pages.yml` の鍵 (ja のパス 9 本) の英中のページ (`/en` + ja のパス、`/zh-tw` + ja のパス) を、
// 2 つの幅 (desktop = 1280×800、mobile = Pixel 7) で開いて、
//   (1) 横スクロールが無い
//   (2) ja の対応ページの採取と比べて、はみ出しのエラーが 0 (規則は `src/lib/i18n-overflow.js` の diffOverflow)
//   (3) 日本語の残り (漏れ) が 0 (本文と alt・aria-label・title・placeholder・ボタンの value)
//   (4) mobile ではドロワーを開いた状態も (1)〜(3)
//   (5) `<html lang>` が en / zh-Hant-TW
// `/join/` はフラグメントで 3 つの表示が切り替わるので、#code=… / #admin / フラグメント無しをそれぞれ 1 ページとして見る。
// 「アプリで開く」(deepmosaic://…) とコピーのボタンは押さない (OS のプロトコルの処理でアプリが起動しうる)。
//
// - 対象の一覧は spec の読み込みのときに台帳 (ソース) から作る。Playwright は webServer (ビルド) の前に spec を読むので、
//   `_site` を列挙すると古い / 無い `_site` から一覧を作ってしまう。404・法務・docs は台帳に無いので対象外。
// - 結果は test ごとに `e2e/.artifacts/i18n/report/<lang>-<slug>-<desktop|mobile>.json` (fullyParallel で並ぶので 1 本にまとめない)。
// - 許可の一覧 `e2e/i18n-allow.json` に足してよいのは検査の誤検出だけ (reason 必須)。
// - 外部へのリクエスト (Google tag・Cloudflare Web Analytics など) は全部止める。本番の計測を汚さない。
import { test, expect, devices, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEAK_PROBE_SOURCE,
  OVERFLOW_PROBE_SOURCE,
  diffLeaks,
  diffOverflow,
  jaCounterpart,
  listI18nPages,
  pageHasHorizontalScroll,
  pageSlug,
  parseAllow,
} from '../src/lib/i18n-overflow.js';

type Lang = 'en' | 'zh-tw';
type Width = 'desktop' | 'mobile';
type OverflowItem = { path: string; tag: string; text: string; kinds: string[] };
type LeakItem = { path: string; kind: string; text: string };

const HTML_LANG: Record<Lang, string> = { en: 'en', 'zh-tw': 'zh-Hant-TW' };
const HAMBURGER = '[data-island="mobile-nav"] button';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

const ARTIFACTS = fileURLToPath(new URL('./.artifacts/i18n/', import.meta.url));
const ALLOW = parseAllow(JSON.parse(readFileSync(new URL('./i18n-allow.json', import.meta.url), 'utf8')));
const SHOTS = process.env.DM_I18N_SHOTS === '1';

/** 採取する状態。`/join/` だけフラグメントで 3 つ (表示の印 `[data-join-view]` が見えるまで待つ)。 */
interface Target {
  jaPath: string;
  lang: Lang;
  hash: string;
  slug: string;
  joinView?: 'code' | 'admin' | 'invalid';
}

const JOIN_STATES = [
  { hash: '#code=ABCD-EFGH-2345', slug: 'join-code', joinView: 'code' },
  { hash: '#admin', slug: 'join-admin', joinView: 'admin' },
  { hash: '', slug: 'join-invalid', joinView: 'invalid' },
] as const;

function listTargets(): Target[] {
  const yml = readFileSync(new URL('../_data/i18n_pages.yml', import.meta.url), 'utf8');
  const out: Target[] = [];
  for (const { jaPath, langs } of listI18nPages(yml)) {
    for (const lang of langs as Lang[]) {
      if (jaPath === '/join/') {
        for (const s of JOIN_STATES) out.push({ jaPath, lang, ...s });
      } else {
        out.push({ jaPath, lang, hash: '', slug: pageSlug(jaPath) });
      }
    }
  }
  return out;
}

const TARGETS = listTargets();

function langUrl(t: Target): string {
  const path = `/${t.lang}${t.jaPath}`;
  // 取り違えの検出 (台帳の鍵 → 英中の URL → ja のパス が元に戻る)
  if (jaCounterpart(path) !== t.jaPath) throw new Error(`英中の URL の組み立ての誤り: ${path}`);
  return path;
}

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin && (url.protocol === 'http:' || url.protocol === 'https:'),
    (route) => route.abort(),
  );
  // ja のページで英中への案内の帯 (.lang-suggest) を出さない (保存値が ja なら出ない)
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dm-site-lang', 'ja');
    } catch {
      /* 保存できない環境では帯の有無は ja のページの採取にしか効かない */
    }
  });
});

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function open(page: Page, path: string, t: Target): Promise<void> {
  const res = await page.goto(`${path}${t.hash}`, { waitUntil: 'load' });
  expect(res?.ok(), `${path} が開けない (${res?.status()})`).toBe(true);
  if (t.joinView) await expect(page.locator(`[data-join-view="${t.joinView}"]`)).toBeVisible();
  await settle(page);
}

async function openDrawer(page: Page): Promise<void> {
  const button = page.locator(HAMBURGER).first();
  await button.waitFor({ state: 'visible' }); // 島のマウント待ち
  await button.tap();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  // 開く動き (transition) が終わってから測る。無限に回るアニメーション (読み込み中の印など) は終わらないので待たない
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== 'running'),
  );
  await settle(page);
}

interface Sample {
  overflow: OverflowItem[];
  leaks: LeakItem[];
  scroll: { scrollWidth: number; innerWidth: number };
  /** ページの `<details>` の数 (採取の前に全部開く。閉じた中身は矩形が無く、FAQ の回答を見逃すため)。 */
  details: number;
}

async function sample(page: Page): Promise<Sample> {
  // ja と英中で同じ操作をするので path は揃う。開いた状態はスクリーンショットにも写る
  const details = await page.evaluate(() => {
    const all = [...document.querySelectorAll('details')];
    for (const d of all) d.open = true;
    return all.length;
  });
  if (details) await settle(page);
  const overflow = (await page.evaluate(OVERFLOW_PROBE_SOURCE)) as OverflowItem[];
  const leaks = (await page.evaluate(LEAK_PROBE_SOURCE)) as LeakItem[];
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  return { overflow, leaks, scroll, details };
}

/**
 * 全面のスクリーンショット (DM_I18N_SHOTS=1 のときだけ)。ja の対応ページは en の test だけが撮る
 * (en と zh-tw の test が並んで同じ ja/<name>.png に書くと壊れうるため)。
 */
async function shot(page: Page, lang: Lang | 'ja', name: string, owner: Lang): Promise<void> {
  if (!SHOTS || (lang === 'ja' && owner !== 'en')) return;
  const file = `${ARTIFACTS}${lang}/${name}.png`;
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: true });
}

interface StateResult {
  state: 'page' | 'drawer';
  /** 採った項目の数 (0 なら採取が壊れていて、検査が空振りしている)。 */
  sampled: {
    jaOverflow: number;
    overflow: number;
    leaks: number;
    jaLeaksAsLang: number;
    /** `<details>` の数と、その配下で採った漏れの候補の数 (details > 0 なのに 0 なら回答を採れていない)。 */
    details: number;
    leaksInDetails: number;
  };
  horizontalScroll: boolean;
  scroll: Sample['scroll'];
  overflow: ReturnType<typeof diffOverflow>;
  leaks: ReturnType<typeof diffLeaks>;
}

function judge(ja: Sample, lang: Sample, t: Target, width: Width, state: StateResult['state']): StateResult {
  const ctx = { page: t.jaPath, lang: t.lang, width };
  return {
    state,
    sampled: {
      jaOverflow: ja.overflow.length,
      overflow: lang.overflow.length,
      leaks: lang.leaks.length,
      // 陽性対照: ja の対応ページの文を同じ言語の基準で判定すると漏れが出る (採取と判定が働いている)
      jaLeaksAsLang: diffLeaks(ja.leaks, null, ctx).errors.length,
      details: lang.details,
      leaksInDetails: lang.leaks.filter((i) => i.path.includes('>details:')).length,
    },
    horizontalScroll: pageHasHorizontalScroll(lang.scroll),
    scroll: lang.scroll,
    overflow: diffOverflow(ja.overflow, lang.overflow, ALLOW, ctx),
    leaks: diffLeaks(lang.leaks, ALLOW, ctx),
  };
}

function writeReport(t: Target, width: Width, url: string, htmlLang: string | null, states: StateResult[]): void {
  const file = `${ARTIFACTS}report/${t.lang}-${t.slug}-${width}.json`;
  mkdirSync(dirname(file), { recursive: true });
  const report = { lang: t.lang, page: t.jaPath, hash: t.hash, slug: t.slug, width, url, htmlLang, states };
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
}

/** 1 つの対象を 1 つの幅で見る。結果を書いてから判定する (失敗しても report は残る)。 */
async function inspect(page: Page, t: Target, width: Width): Promise<void> {
  const url = langUrl(t);
  const name = `${t.slug}-${width}`;

  await open(page, t.jaPath, t);
  const jaPage = await sample(page);
  await shot(page, 'ja', name, t.lang);
  let jaDrawer: Sample | null = null;
  if (width === 'mobile') {
    await openDrawer(page);
    jaDrawer = await sample(page);
    await shot(page, 'ja', `${name}-drawer`, t.lang);
  }

  await open(page, url, t);
  const htmlLang = await page.locator('html').getAttribute('lang');
  const states = [judge(jaPage, await sample(page), t, width, 'page')];
  await shot(page, t.lang, name, t.lang);
  if (jaDrawer) {
    await openDrawer(page);
    states.push(judge(jaDrawer, await sample(page), t, width, 'drawer'));
    await shot(page, t.lang, `${name}-drawer`, t.lang);
  }

  writeReport(t, width, `${url}${t.hash}`, htmlLang, states);

  expect.soft(htmlLang, '<html lang>').toBe(HTML_LANG[t.lang]);
  for (const s of states) {
    expect.soft(s.sampled.overflow, `${s.state}: はみ出しの採取が空`).toBeGreaterThan(0);
    expect.soft(s.sampled.jaLeaksAsLang, `${s.state}: 陽性対照 (ja のページの文が漏れとして出ない)`).toBeGreaterThan(0);
    expect.soft(s.horizontalScroll, `${s.state}: 横スクロール (${s.scroll.scrollWidth} > ${s.scroll.innerWidth})`).toBe(false);
    expect.soft(s.overflow.errors, `${s.state}: はみ出し (ja ではみ出さず ${t.lang} ではみ出す)`).toEqual([]);
    expect.soft(s.leaks.errors, `${s.state}: 日本語の残り`).toEqual([]);
    if (s.sampled.details > 0) {
      expect.soft(s.sampled.leaksInDetails, `${s.state}: <details> の中を採れていない`).toBeGreaterThan(0);
    }
    // T-2308: トップは「ja でもはみ出す (preexisting)」を警告で見逃さない (ヒーローの副ボタンの欠けを直したので 0 件のはず)
    if (t.jaPath === '/') {
      const pre = s.overflow.warnings.filter((w) => w.reason === 'preexisting');
      expect.soft(pre, `${s.state}: ja と ${t.lang} の両方ではみ出す`).toEqual([]);
    }
  }
}

// ---- T-2308: ボタンが Pixel 7 (412px) の幅に収まる -------------------------------------------
// ヒーローの「ブラウザでお試し（…）」が ja 約 492px / en 約 516px で、祖先の section.overflow-hidden に両端を切られていた
// (横スクロールが出ないので (1) では見つからず、ja でも同じなので (2) では警告 preexisting だった)。
// ja / en / zh-tw のトップで、見えているボタン (.btn-*) が全部 viewport の中に収まることを確かめる。

const BUTTON_SELECTOR = '.btn-primary, .btn-secondary, .btn-ghost';
const TOP_PAGES = ['/', '/en/', '/zh-tw/'] as const;

interface ButtonBox {
  text: string;
  left: number;
  right: number;
}

async function visibleButtons(page: Page): Promise<{ innerWidth: number; buttons: ButtonBox[] }> {
  return page.evaluate((selector) => {
    const buttons = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .map(({ el, r }) => ({ text: (el.innerText || '').trim().slice(0, 40), left: r.left, right: r.right }));
    return { innerWidth: window.innerWidth, buttons };
  }, BUTTON_SELECTOR);
}

test.describe('mobile (Pixel 7) のボタンの幅 (T-2308)', () => {
  const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
  test.use(PIXEL_7);
  for (const path of TOP_PAGES) {
    test(`${path} のボタンが画面の幅に収まる`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'load' });
      expect(res?.ok(), `${path} が開けない (${res?.status()})`).toBe(true);
      await settle(page);
      const { innerWidth, buttons } = await visibleButtons(page);
      expect(innerWidth).toBe(412);
      // 採取の空振りを防ぐ: ヒーローの主ボタンとドキュメントのボタンは必ずある
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      const out = buttons.filter((b) => b.left < -0.5 || b.right > innerWidth + 0.5);
      expect(out, `${path}: 画面の外にはみ出すボタン`).toEqual([]);
    });
  }
});

// ---- 対照 (採取の式が壊れたら緑にならないように) ------------------------------------
// はみ出しの 6 つの kind・漏れ・除外するものを 1 枚の使い捨てのページに置き、採取の結果をそのまま確かめる。

const GIF_1PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CONTROL_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Control</title></head><body>
<p style="width:50px;overflow:hidden;white-space:nowrap">Clipped long text here</p>
<p style="width:50px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Ellipsis long text here</p>
<p style="width:300px;height:20px;line-height:20px;overflow:hidden">Clipped-y one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen</p>
<div style="width:50px;white-space:nowrap">Spill long text here wide</div>
<div style="position:absolute;top:0;left:1300px">Offscreen text</div>
<button type="button" style="width:24px;height:24px"></button>
<div style="width:300px;overflow-x:auto;white-space:nowrap"><span style="padding-left:1400px">In scroller</span></div>
<aside aria-hidden="true" style="position:fixed;top:0;left:100%;width:200px">Parked 駐車</aside>
<p>料金</p>
<img alt="画面" src="${GIF_1PX}" width="10" height="10">
<span lang="ja">日本語の社名</span>
<div style="display:contents">表示の内容</div>
<select><option>選択肢</option></select>
<svg width="10" height="10"><title>図の説明</title></svg>
<div data-i18n-switch aria-label="表示言語"><a href="#">日本語</a></div>
<p hidden>隠した文</p>
</body></html>`;

test.describe('対照 (採取の式)', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });
  test('はみ出しの 6 つの kind と漏れが出て、除外したものは出ない', async ({ page }) => {
    await page.setContent(CONTROL_HTML);
    const overflow = (await page.evaluate(OVERFLOW_PROBE_SOURCE)) as OverflowItem[];
    const leaks = (await page.evaluate(LEAK_PROBE_SOURCE)) as LeakItem[];

    const kindsOf = (prefix: string) => overflow.filter((i) => i.text.startsWith(prefix)).flatMap((i) => i.kinds);
    expect(kindsOf('Clipped long')).toContain('clipped');
    expect(kindsOf('Ellipsis long')).toContain('ellipsis');
    expect(kindsOf('Clipped-y')).toContain('clipped-y');
    expect(kindsOf('Spill long')).toContain('spill');
    expect(kindsOf('Offscreen text')).toContain('offscreen');
    expect(overflow.filter((i) => i.tag === 'button').flatMap((i) => i.kinds)).toContain('no-name');
    // スクロールの容器に収まる要素は offscreen にしない。画面の外に置いた aria-hidden の部分木は採らない
    expect(kindsOf('In scroller')).not.toContain('offscreen');
    expect(overflow.some((i) => i.text.includes('Parked'))).toBe(false);

    const ctx = { page: '/', lang: 'en' as const, width: 'desktop' as const };
    const found = diffLeaks(leaks, null, ctx).errors.map((i) => `${i.kind}:${i.text}`);
    for (const want of [
      'text:料金',
      'attr:alt:画面',
      'text:表示の内容',
      'text:選択肢',
      'text:図の説明',
      'attr:aria-label:表示言語',
    ]) {
      expect(found, want).toContain(want);
    }
    for (const text of ['日本語の社名', '日本語', 'Parked 駐車', '隠した文']) {
      expect(found.some((f) => f.endsWith(`:${text}`)), `${text} は除外のはず`).toBe(false);
    }
  });
});

test.describe('desktop (1280×800)', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });
  for (const t of TARGETS) {
    test(`${t.lang} ${t.slug}`, async ({ page }) => {
      await inspect(page, t, 'desktop');
    });
  }
});

test.describe('mobile (Pixel 7)', () => {
  // defaultBrowserType を含む use() はワーカーを分ける指定になるので落とし、端末の形だけ借りる (mobile-nav.spec.ts と同じ)
  const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
  test.use(PIXEL_7);
  for (const t of TARGETS) {
    test(`${t.lang} ${t.slug}`, async ({ page }) => {
      await inspect(page, t, 'mobile');
    });
  }
});
