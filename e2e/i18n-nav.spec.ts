// ヘッダー・フッター・モバイルのドロワーの言語の切り替えの E2E。
//
// 関係する spec と一緒に回す:
//   npx playwright test e2e/i18n-nav.spec.ts e2e/header-enterprise.spec.ts e2e/mobile-nav.spec.ts
//
// ## 何を守るのか
//
// - (a) ja のトップ: 幅 1024 / 1280px でヘッダーに言語のボタンが見え (767〜1023px では見えず、フッターのリンクに任せる)、一覧は閉じたまま DOM に 3 本ある。
//       開くと 3 本が見え、English の行き先が /en/、今の言語は ja。開いた状態でもヘッダーの行とページが横にはみ出さない
//       (ja・en・zh-tw の 1024〜1280px。閉じた状態は (b) が 320〜1280px で見る)。右の並びは言語のボタン → 法人向け → ダウンロードで、ダウンロードが一番右 (header-enterprise.spec.ts を壊さない)。フッターは文字リンクのまま。
// - (b) /en/ と /zh-tw/: header-enterprise.spec.ts と同じ幅の組でヘッダーがはみ出さず、ダウンロードのボタンが一番右でその左が法人向け。
// - (c) モバイル (mobile-nav.spec.ts と同じ Pixel 7) でドロワーを開くと言語のリンクが 3 つあり、今の言語に aria-current、
//       download 属性が無い。既存のドロワーの項目 (aside ul li a) とは別の段 (`[data-i18n-switch]`) に出る。
// - (d) /price/ の切り替えで /en/price/ に移る。
// - (f) ヘッダーの一覧のキーボードと閉じ方 (disclosure): ArrowDown で開いて今の言語へ、矢印・Home・End で回る、Esc でボタンへ戻る、
//       Enter で二重に開閉しない、外側のクリック・Tab で抜けると閉じる、/en/ では en のリンクから、English で /en/ に移る。
// - (g) ボタンの大きさと形: 押せる範囲 40×40px 以上、言語のアイコンの描画 22px 以上、
//       xl (1280px) 以上で今の言語名が見え 1024px では見えない、開くと背景が変わる、一覧の項目は 14px 以上・高さ 40px 以上、
//       3 言語 × 幅 768 / 1024 / 1280 / 1440px でヘッダーの行がはみ出さない。
// - (i) ブラウザの言語が英語・繁体字中国語でも、ja のページ (/・/price/・/join/) に英中への案内の帯を出さず、選んだ言語を localStorage に保存しない。
//
// 英中のページ (/en/・/zh-tw/・/en/price/) が無い (404) ときは (b) と (d) の行き先の表示を飛ばす (飛ばした理由を出す)。
import { test, expect, devices, type Locator, type Page } from '@playwright/test';

const HEADER_ROW = 'header > div';
// ヘッダー行の直下の切り替え (div) だけを指す。モバイルのドロワーへ渡す言語の表 (`<script data-i18n-switch data-lang-links>`) も
// header の中にあり data-i18n-switch を持つ (ja-identity がこの要素を除いて比べる設計) ので、`header [data-i18n-switch]` では 2 つに当たる。
const HEADER_SWITCH = 'header > div > div[data-i18n-switch]';
const HEADER_TRIGGER = `${HEADER_SWITCH} [data-lang-menu-trigger]`;
const FOOTER_SWITCH = 'footer [data-i18n-switch]';
const HEADER_WIDTHS = [320, 767, 768, 800, 900, 1023, 1024, 1280] as const;
const MD_MIN_WIDTH = 768;
/** Tailwind の lg。ヘッダーの言語の切り替え (言語のボタン) を出す最小幅 (px)。768〜1023px は ja の行に収まらない。 */
const LG_MIN_WIDTH = 1024;
const XL_MIN_WIDTH = 1280;
const OVERLAP_TOLERANCE = 0.5;

/** 要素の computed style の cursor。 */
async function cursorOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).cursor);
}

/** 英中のページがあるか (無ければ 404)。 */
async function exists(page: Page, path: string): Promise<boolean> {
  const res = await page.request.get(path);
  return res.ok();
}

async function openAt(page: Page, path: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
}

/** ヘッダーの行がはみ出さず、md 以上ではダウンロードのボタンが一番右、その左が法人向け (lg 以上はさらに左が言語のボタン) であることを確かめる。 */
async function expectHeaderFits(page: Page, width: number): Promise<void> {
  const overflow = await page.locator(HEADER_ROW).evaluate((row) => ({
    row: row.scrollWidth - row.clientWidth,
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.row, 'ヘッダーの行が横にはみ出している').toBeLessThanOrEqual(0);
  expect(overflow.doc, 'ページが横にスクロールできる').toBeLessThanOrEqual(0);
  if (width < MD_MIN_WIDTH) return;

  const boxes = await page.locator(HEADER_ROW).evaluate((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(':scope > a, :scope > nav > a, :scope > [data-i18n-switch]'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden')
      .map(({ el, r }) => ({ label: el.innerText.trim(), left: r.left, right: r.right, height: r.height }))
      .sort((a, b) => a.left - b.left),
  );
  const last = page.locator(`${HEADER_ROW} > a`).last();
  await expect(last).toBeVisible();
  expect(await last.getAttribute('data-dl')).toBe('header');
  const lastBox = await last.boundingBox();
  expect(boxes.at(-1)?.right, 'ダウンロードボタンがヘッダーの一番右に無い').toBeCloseTo(lastBox!.x + lastBox!.width, 0);
  // その左が法人向け。lg 以上ではさらに左が言語のボタン
  const enterprise = page.locator(`${HEADER_ROW} > a[href$="/enterprise/inquiry/"]`);
  const enterpriseBox = await enterprise.boundingBox();
  expect(enterpriseBox, '法人向けのボタンが見えていない').not.toBeNull();
  expect(lastBox!.x + OVERLAP_TOLERANCE).toBeGreaterThanOrEqual(enterpriseBox!.x + enterpriseBox!.width);
  if (width >= LG_MIN_WIDTH) {
    const switchBox = await page.locator(HEADER_SWITCH).boundingBox();
    expect(switchBox, '言語のボタンが見えていない').not.toBeNull();
    expect(enterpriseBox!.x + OVERLAP_TOLERANCE).toBeGreaterThanOrEqual(switchBox!.x + switchBox!.width);
  }
  for (const box of boxes) expect.soft(box.height, `${box.label} が折り返している`).toBeLessThanOrEqual(44);
  for (let i = 1; i < boxes.length; i += 1) {
    expect
      .soft(boxes[i].left + OVERLAP_TOLERANCE, `${boxes[i - 1].label} と ${boxes[i].label} が重なっている`)
      .toBeGreaterThanOrEqual(boxes[i - 1].right);
  }
}

/** 一覧を開いた状態でも、ページが横に広がらない (一覧は右端そろえの absolute)。 */
async function expectNoDocOverflow(page: Page): Promise<void> {
  const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(doc, '一覧を開くとページが横にスクロールできる').toBeLessThanOrEqual(0);
}

test.describe('(a) ja のトップのヘッダー', () => {
  for (const width of [LG_MIN_WIDTH, XL_MIN_WIDTH]) {
    test(`幅 ${width}px で言語のボタンが見え、開くと 3 言語のリンク、ヘッダーがはみ出さない`, async ({ page }) => {
      await openAt(page, '/', width);
      const sw = page.locator(HEADER_SWITCH);
      const trigger = page.locator(HEADER_TRIGGER);
      const links = sw.locator('a[hreflang]');
      await expect(trigger).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(links).toHaveCount(3);
      for (let i = 0; i < 3; i += 1) await expect(links.nth(i)).toBeHidden();
      await expectHeaderFits(page, width);

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      for (let i = 0; i < 3; i += 1) await expect(links.nth(i)).toBeVisible();
      await expect(sw.locator('a[hreflang="en"]')).toHaveAttribute('href', '/en/');
      await expect(sw.locator('a[hreflang="zh-Hant-TW"]')).toHaveAttribute('href', '/zh-tw/');
      await expect(sw.locator('a[aria-current="true"]')).toHaveAttribute('hreflang', 'ja');
      await expectHeaderFits(page, width);
      await expectNoDocOverflow(page);

      // フッターは文字リンクのまま (SEO と JS が無いときの道)
      await expect(page.locator(FOOTER_SWITCH)).toHaveCount(1);
      const footerLinks = page.locator(`${FOOTER_SWITCH} a[hreflang]`);
      await expect(footerLinks).toHaveCount(3);
      for (let i = 0; i < 3; i += 1) await expect(footerLinks.nth(i)).toBeVisible();
    });
  }

  for (const width of [MD_MIN_WIDTH - 1, MD_MIN_WIDTH, 900, LG_MIN_WIDTH - 1]) {
    test(`幅 ${width}px ではヘッダーのボタンが見えない (フッターにはある)`, async ({ page }) => {
      await openAt(page, '/', width);
      await expect(page.locator(HEADER_TRIGGER)).toBeHidden();
      await expect(page.locator(`${FOOTER_SWITCH} a[hreflang]`)).toHaveCount(3);
      await expectHeaderFits(page, width);
    });
  }

  for (const prefix of ['/', '/en/', '/zh-tw/'] as const) {
    for (const width of [LG_MIN_WIDTH, 1100, XL_MIN_WIDTH]) {
      test(`${prefix} 幅 ${width}px で一覧を開いてもヘッダーとページがはみ出さない`, async ({ page }) => {
        await openAt(page, prefix, width);
        await page.locator(HEADER_TRIGGER).click();
        await expect(page.locator(`${HEADER_SWITCH} a[aria-current="true"]`)).toBeVisible();
        await expectHeaderFits(page, width);
        await expectNoDocOverflow(page);
      });
    }
  }
});

for (const prefix of ['/en/', '/zh-tw/'] as const) {
  test.describe(`(b) ${prefix} のヘッダー`, () => {
    for (const width of HEADER_WIDTHS) {
      test(`幅 ${width}px でヘッダーがはみ出さず、ダウンロードのボタンが一番右`, async ({ page }) => {
        test.skip(!(await exists(page, prefix)), `${prefix} が無い`);
        await openAt(page, prefix, width);
        await expectHeaderFits(page, width);
        if (width >= LG_MIN_WIDTH) {
          // 一覧は閉じたまま DOM にある (属性だけ見る)
          await expect(page.locator(`${HEADER_SWITCH} a[aria-current="true"]`)).toHaveAttribute(
            'hreflang',
            prefix === '/en/' ? 'en' : 'zh-Hant-TW',
          );
        }
      });
    }
  });
}

test.describe('(c) モバイルのドロワー', () => {
  const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
  test.use(PIXEL_7);

  test('言語のリンクが 3 つ、今の言語に aria-current、download 属性なし', async ({ page }) => {
    await page.goto('/price/', { waitUntil: 'domcontentloaded' });
    const button = page.locator('[data-island="mobile-nav"] button').first();
    await button.waitFor({ state: 'visible' });
    await button.tap();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    const links = page.locator('aside [data-i18n-switch] a[hreflang]');
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toHaveText('日本語');
    await expect(links.nth(1)).toHaveAttribute('href', '/en/price/');
    await expect(links.nth(2)).toHaveAttribute('href', '/zh-tw/price/');
    await expect(page.locator('aside [data-i18n-switch] a[aria-current="true"]')).toHaveAttribute('hreflang', 'ja');
    for (let i = 0; i < 3; i += 1) await expect(links.nth(i)).not.toHaveAttribute('download');
    // 既存の項目 (aside ul li a) には言語のリンクを混ぜない (mobile-nav.spec.ts の対象を変えない)
    await expect(page.locator('aside ul li a[hreflang]')).toHaveCount(0);
  });
});

test.describe('(d) 対応するページへの切り替え', () => {
  test('/price/ のフッターの English で /en/price/ に移る', async ({ page }) => {
    await openAt(page, '/price/', 1280);
    const en = page.locator(`${FOOTER_SWITCH} a[hreflang="en"]`);
    await expect(en).toHaveAttribute('href', '/en/price/');
    test.skip(!(await exists(page, '/en/price/')), '/en/price/ が無い');
    await en.click();
    await expect(page).toHaveURL(/\/en\/price\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('(f) キーボードと閉じ方', () => {
  const linkFocused = (page: Page, hreflang: string) =>
    expect(page.locator(`${HEADER_SWITCH} a[hreflang="${hreflang}"]`)).toBeFocused();

  test('ArrowDown で開いて今の言語へ、矢印・Home・End で回り、Esc で閉じてボタンへ戻る', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const trigger = page.locator(HEADER_TRIGGER);
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await linkFocused(page, 'ja');
    await page.keyboard.press('ArrowDown');
    await linkFocused(page, 'en');
    await page.keyboard.press('End');
    await linkFocused(page, 'zh-Hant-TW');
    await page.keyboard.press('ArrowDown');
    await linkFocused(page, 'ja');
    await page.keyboard.press('Home');
    await linkFocused(page, 'ja');
    await page.keyboard.press('ArrowUp');
    await linkFocused(page, 'zh-Hant-TW');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`${HEADER_SWITCH} a[hreflang="ja"]`)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('ボタンの上の Enter で 1 回だけ開き、もう一度クリックで閉じる', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const trigger = page.locator(HEADER_TRIGGER);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`${HEADER_SWITCH} a[hreflang="ja"]`)).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`${HEADER_SWITCH} a[hreflang="ja"]`)).toBeHidden();
  });

  test('ヘッダーの外をクリックすると閉じる', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const trigger = page.locator(HEADER_TRIGGER);
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // 本文の見出し (ヘッダーの外で、リンクではない点) を押す
    await page.locator('h1').first().click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`${HEADER_SWITCH} a[hreflang="ja"]`)).toBeHidden();
  });

  test('一覧から Tab でヘッダーの切り替えの外へ出ると閉じる', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const trigger = page.locator(HEADER_TRIGGER);
    await trigger.focus();
    await page.keyboard.press('ArrowUp');
    await linkFocused(page, 'zh-Hant-TW');
    await page.keyboard.press('Tab');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const inside = await page.locator(HEADER_SWITCH).evaluate((el) => el.contains(document.activeElement));
    expect(inside, 'フォーカスが切り替えの中に残っている').toBe(false);
  });

  test('/en/ で開くと en のリンクにフォーカスがある', async ({ page }) => {
    await openAt(page, '/en/', XL_MIN_WIDTH);
    const trigger = page.locator(HEADER_TRIGGER);
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await linkFocused(page, 'en');
    await expect(page.locator(`${HEADER_SWITCH} a[aria-current="true"]`)).toHaveAttribute('hreflang', 'en');
  });

  test('開いて English をクリックすると /en/ に移る', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    await page.locator(HEADER_TRIGGER).click();
    await page.locator(`${HEADER_SWITCH} a[hreflang="en"]`).click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

/** 押せる範囲の下限 (px)。WCAG 2.5.8 の 24px より大きく、指で押しやすい 40px。 */
const MIN_TARGET_PX = 40;
/** 言語のアイコンの描画の下限 (px)。 */
const MIN_ICON_PX = 22;
/** 一覧の項目の文字の下限 (px)。 */
const MIN_ITEM_FONT_PX = 14;
const CUR_NAME = { '/': '日本語', '/en/': 'English', '/zh-tw/': '繁體中文' } as const;

test.describe('(g) ボタンの大きさと形', () => {
  for (const prefix of ['/', '/en/', '/zh-tw/'] as const) {
    for (const width of [LG_MIN_WIDTH, XL_MIN_WIDTH, 1440]) {
      test(`${prefix} 幅 ${width}px: 40px 以上のボタン、22px 以上のアイコン、言語名は xl 以上だけ`, async ({ page }) => {
        await openAt(page, prefix, width);
        const trigger = page.locator(HEADER_TRIGGER);
        const box = await trigger.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(MIN_TARGET_PX);
        expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX);
        const icon = await trigger.locator('svg').first().boundingBox();
        expect(icon!.width).toBeGreaterThanOrEqual(MIN_ICON_PX);
        expect(icon!.height).toBeGreaterThanOrEqual(MIN_ICON_PX);
        // ▾ (2 つめの svg) が見える
        await expect(trigger.locator('svg').nth(1)).toBeVisible();
        const name = trigger.getByText(CUR_NAME[prefix], { exact: true });
        if (width >= XL_MIN_WIDTH) await expect(name).toBeVisible();
        else await expect(name).toBeHidden();
        // 見えるかどうかに関わらず、読み上げの名前に今の言語名が入る
        expect(await trigger.getAttribute('aria-label')).toContain(CUR_NAME[prefix]);
        // ほかのリンクと同じく指の形のカーソル (Tailwind v4 の preflight は button に付けないので app.css の base 層で付ける)
        expect(await cursorOf(trigger)).toBe('pointer');
        await expectHeaderFits(page, width);
      });
    }
  }

  test('開くとボタンの背景が変わり、一覧の項目は 14px 以上・高さ 40px 以上、今の言語に印', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const trigger = page.locator(HEADER_TRIGGER);
    const bg = () => trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
    const closedBg = await bg();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // 開いた直後はフォーカスが一覧へ移るので、ホバーやフォーカスではなく aria-expanded の見た目
    await page.mouse.move(0, 0);
    expect(await bg(), '開いている間の背景が閉じたときと同じ').not.toBe(closedBg);
    const links = page.locator(`${HEADER_SWITCH} a[hreflang]`);
    for (let i = 0; i < 3; i += 1) {
      const m = await links.nth(i).evaluate((el) => ({
        font: parseFloat(getComputedStyle(el).fontSize),
        h: el.getBoundingClientRect().height,
      }));
      expect(m.font).toBeGreaterThanOrEqual(MIN_ITEM_FONT_PX);
      expect(m.h).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(await cursorOf(links.nth(i))).toBe('pointer');
    }
    await expect(page.locator(`${HEADER_SWITCH} a[aria-current="true"] svg`)).toHaveCount(1);
  });

  for (const prefix of ['/', '/en/', '/zh-tw/'] as const) {
    for (const width of [MD_MIN_WIDTH, LG_MIN_WIDTH, XL_MIN_WIDTH, 1440]) {
      test(`${prefix} 幅 ${width}px でヘッダーの行の scrollWidth が clientWidth 以下`, async ({ page }) => {
        await openAt(page, prefix, width);
        const r = await page.locator('header').evaluate((h) => ({ s: h.scrollWidth, c: h.clientWidth }));
        expect(r.s).toBeLessThanOrEqual(r.c);
        await expectHeaderFits(page, width);
      });
    }
  }
});

// 英中のページから日本語だけのページ (法務) へ向くリンクは、本文・フッターのどれでも hreflang="ja" を持つ。
// docs は訳のあるページなので、本文・CTA の副ボタン・ドロワーの項目のどれでも同じ言語の docs を指し、hreflang="ja" を持たない。
const JA_ONLY_HREF = /^\/company\/(terms|privacy|tokushoho)(\/|#|$)/;
const JA_DOCS_HREF = /^\/docs(\/|#|$)/;

test.describe('(e) 日本語だけのページへのリンクの hreflang', () => {
  for (const path of ['/en/price/', '/zh-tw/price/', '/en/spec/', '/zh-tw/spec/', '/en/', '/zh-tw/']) {
    test(`${path} の法務へのリンクは全部 hreflang="ja"、docs へのリンクは同じ言語の docs`, async ({ page }) => {
      await openAt(page, path, XL_MIN_WIDTH);
      const hrefs = await page.$$eval('a[href]', (as) =>
        as.map((a) => ({ href: a.getAttribute('href') ?? '', hreflang: a.getAttribute('hreflang') })),
      );
      const jaOnly = hrefs.filter((l) => JA_ONLY_HREF.test(l.href));
      expect(jaOnly.length, '日本語だけのページへのリンクが 1 本も無い').toBeGreaterThan(0);
      expect(jaOnly.filter((l) => l.hreflang !== 'ja').map((l) => l.href)).toEqual([]);
      expect(hrefs.filter((l) => JA_DOCS_HREF.test(l.href)).map((l) => l.href), '日本語の docs へのリンクがある').toEqual([]);
      const prefix = path.startsWith('/en/') ? '/en' : '/zh-tw';
      const docs = hrefs.filter((l) => l.href.startsWith(`${prefix}/docs/`));
      expect(docs.length, '同じ言語の docs へのリンクが 1 本も無い').toBeGreaterThan(0);
      expect(docs.filter((l) => l.hreflang !== null).map((l) => l.href)).toEqual([]);
    });
  }

  test.describe('ドロワー', () => {
    const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
    test.use(PIXEL_7);

    test('/en/price/ のドロワーの Docs は英語の docs を指し、日本語のページの印を持たない', async ({ page }) => {
      await page.goto('/en/price/', { waitUntil: 'domcontentloaded' });
      const button = page.locator('[data-island="mobile-nav"] button').first();
      await button.waitFor({ state: 'visible' });
      await button.tap();
      const docs = page.locator('aside ul li a[href="/en/docs/"]');
      await expect(docs).toHaveCount(1);
      await expect(docs).not.toHaveAttribute('hreflang', 'ja');
      await expect(docs).not.toContainText('(Japanese)');
    });
  });
});

// (h) カーソル: ヘッダーのボタン (<a>) と、トップのタブ (<button class="tab">) が指の形のまま。
// <button> の pointer は src/app.css の base 層で一括に付ける (言語のボタンは (g)、ドロワーは mobile-nav.spec.ts、送信ボタンは contact.spec.ts)。
test.describe('(h) カーソル', () => {
  for (const prefix of ['/', '/en/', '/zh-tw/'] as const) {
    test(`${prefix} のヘッダーの DL と法人向けのボタンは指の形のカーソル`, async ({ page }) => {
      await openAt(page, prefix, XL_MIN_WIDTH);
      expect(await cursorOf(page.locator(`${HEADER_ROW} > a[data-dl="header"]`))).toBe('pointer');
      expect(await cursorOf(page.locator(`${HEADER_ROW} > a[href$="/enterprise/inquiry/"]`))).toBe('pointer');
    });
  }

  test('トップのタブ (.tab) は指の形のカーソルのまま', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const tabs = page.locator('button.tab');
    expect(await tabs.count()).toBeGreaterThan(0);
    expect(await cursorOf(tabs.first())).toBe('pointer');
  });
});

// (i) ja のページはブラウザの言語が英中でも、英中への案内の帯を出さず、選んだ言語を覚えない (英中へは言語の切り替えで行く)。
const NO_BANNER_PATHS = ['/', '/price/', '/join/'] as const;

async function expectNoBanner(page: Page, path: string): Promise<void> {
  await openAt(page, path, XL_MIN_WIDTH);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('.lang-suggest')).toHaveCount(0);
  const first = await page.evaluate(() => document.body.firstElementChild?.className ?? '');
  expect(first, `${path} の body の最初の子が帯`).not.toContain('lang-suggest');
  expect(await page.evaluate(() => localStorage.getItem('dm-site-lang'))).toBeNull();
}

test.describe('(i) 言語の案内の帯を出さない', () => {
  test.describe('ブラウザの言語が英語', () => {
    test.use({ locale: 'en-US' });
    for (const path of NO_BANNER_PATHS) {
      test(`${path} に帯が無く、選んだ言語を保存しない`, async ({ page }) => {
        await expectNoBanner(page, path);
      });
    }
    test('フッターの切り替えで /en/price/ に移っても選んだ言語を保存しない', async ({ page }) => {
      await openAt(page, '/price/', XL_MIN_WIDTH);
      await page.locator(`${FOOTER_SWITCH} a[hreflang="en"]`).click();
      await expect(page).toHaveURL(/\/en\/price\/$/);
      expect(await page.evaluate(() => localStorage.getItem('dm-site-lang'))).toBeNull();
    });
  });

  test.describe('ブラウザの言語が繁体字中国語', () => {
    test.use({ locale: 'zh-TW' });
    for (const path of NO_BANNER_PATHS) {
      test(`${path} に帯が無い`, async ({ page }) => {
        await expectNoBanner(page, path);
      });
    }
  });
});
