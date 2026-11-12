// T-2204 (i18n1112 I18N-706): ヘッダー・フッター・モバイルのドロワーの言語の切り替えの E2E。
//
// **チケットでは回さない**。ウェーブ末尾にリーダーが既存の spec と一緒に回す:
//   npx playwright test e2e/i18n-nav.spec.ts e2e/header-enterprise.spec.ts e2e/mobile-nav.spec.ts
//
// ## 何を守るのか
//
// - (a) ja のトップ: 幅 1280px でヘッダーに言語の切り替えが見え、English の行き先が /en/。幅 768 / 900 / 1024 では見えない
//       (md / lg の既存の条件 = header-enterprise.spec.ts を壊さない)。1280px でも法人向けのボタンが一番右で、行がはみ出さない。
// - (b) /en/ と /zh-tw/: header-enterprise.spec.ts と同じ幅の組でヘッダーがはみ出さず、法人向けのボタンが一番右。
// - (c) モバイル (mobile-nav.spec.ts と同じ Pixel 7) でドロワーを開くと言語のリンクが 3 つあり、今の言語に aria-current、
//       download 属性が無い。既存のドロワーの項目 (aside ul li a) とは別の段 (`[data-i18n-switch]`) に出る。
// - (d) /price/ の切り替えで /en/price/ に移る。
//
// 英中のページ (/en/・/zh-tw/・/en/price/) は W7b (I18N-709〜711) で作られる。まだ無い (404) 間は (b) と (d) の行き先の表示を飛ばす
// (飛ばした理由を出す)。全部のページがそろった後は飛ばさない。
import { test, expect, devices, type Page } from '@playwright/test';

const HEADER_ROW = 'header > div';
// ヘッダー行の直下の切り替え (div) だけを指す。モバイルのドロワーへ渡す言語の表 (`<script data-i18n-switch data-lang-links>`) も
// header の中にあり data-i18n-switch を持つ (ja-identity がこの要素を除いて比べる設計) ので、`header [data-i18n-switch]` では 2 つに当たる。
const HEADER_SWITCH = 'header > div > div[data-i18n-switch]';
const FOOTER_SWITCH = 'footer [data-i18n-switch]';
const HEADER_WIDTHS = [320, 767, 768, 800, 900, 1023, 1024, 1280] as const;
const MD_MIN_WIDTH = 768;
/** Tailwind の xl。ヘッダーの言語の切り替えを出す最小幅 (px)。 */
const XL_MIN_WIDTH = 1280;
const OVERLAP_TOLERANCE = 0.5;

/** 英中のページが出来ているか (W7b より前は 404)。 */
async function exists(page: Page, path: string): Promise<boolean> {
  const res = await page.request.get(path);
  return res.ok();
}

async function openAt(page: Page, path: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
}

/** ヘッダーの行がはみ出さず、法人向けのボタン (md 以上) が一番右にあることを確かめる。 */
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
  expect(await last.getAttribute('href')).toMatch(/\/enterprise\/inquiry\/$/);
  const lastBox = await last.boundingBox();
  expect(boxes.at(-1)?.right, '法人向けのボタンがヘッダーの一番右に無い').toBeCloseTo(lastBox!.x + lastBox!.width, 0);
  for (const box of boxes) expect.soft(box.height, `${box.label} が折り返している`).toBeLessThanOrEqual(44);
  for (let i = 1; i < boxes.length; i += 1) {
    expect
      .soft(boxes[i].left + OVERLAP_TOLERANCE, `${boxes[i - 1].label} と ${boxes[i].label} が重なっている`)
      .toBeGreaterThanOrEqual(boxes[i - 1].right);
  }
}

test.describe('(a) ja のトップのヘッダー', () => {
  test('幅 1280px で切り替えが見え、English の行き先が /en/、法人向けのボタンが一番右', async ({ page }) => {
    await openAt(page, '/', XL_MIN_WIDTH);
    const sw = page.locator(HEADER_SWITCH);
    await expect(sw).toBeVisible();
    const links = sw.locator('a[hreflang]');
    await expect(links).toHaveCount(3);
    await expect(sw.locator('a[hreflang="en"]')).toHaveAttribute('href', '/en/');
    await expect(sw.locator('a[hreflang="zh-Hant-TW"]')).toHaveAttribute('href', '/zh-tw/');
    await expect(sw.locator('a[aria-current="true"]')).toHaveAttribute('hreflang', 'ja');
    await expectHeaderFits(page, XL_MIN_WIDTH);
  });

  for (const width of [768, 900, 1024]) {
    test(`幅 ${width}px では切り替えが見えない (フッターにはある)`, async ({ page }) => {
      await openAt(page, '/', width);
      await expect(page.locator(HEADER_SWITCH)).toBeHidden();
      await expect(page.locator(FOOTER_SWITCH)).toHaveCount(1);
      await expectHeaderFits(page, width);
    });
  }
});

for (const prefix of ['/en/', '/zh-tw/'] as const) {
  test.describe(`(b) ${prefix} のヘッダー`, () => {
    for (const width of HEADER_WIDTHS) {
      test(`幅 ${width}px でヘッダーがはみ出さず、法人向けのボタンが一番右`, async ({ page }) => {
        test.skip(!(await exists(page, prefix)), `${prefix} がまだ無い (W7b で作る)`);
        await openAt(page, prefix, width);
        await expectHeaderFits(page, width);
        if (width >= XL_MIN_WIDTH) {
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
    test.skip(!(await exists(page, '/en/price/')), '/en/price/ がまだ無い (W7b で作る)');
    await en.click();
    await expect(page).toHaveURL(/\/en\/price\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

// T-2210 ウェーブ末尾: 英中のページから日本語だけのページ (docs・法務) へ向くリンクは、本文・CTA の副ボタン・ドロワーの項目の
// どれでも hreflang="ja" を持つ (設計書 §9.2)。ウェーブ末尾の確認で、CTA の副ボタンとドロワーの Docs に抜けがあった。
const JA_ONLY_HREF = /^\/(docs|company\/(terms|privacy|tokushoho))(\/|#|$)/;

test.describe('(e) 日本語だけのページへのリンクの hreflang', () => {
  for (const path of ['/en/price/', '/zh-tw/price/', '/en/spec/', '/zh-tw/spec/', '/en/', '/zh-tw/']) {
    test(`${path} の docs・法務へのリンクは全部 hreflang="ja"`, async ({ page }) => {
      await openAt(page, path, XL_MIN_WIDTH);
      const hrefs = await page.$$eval('a[href]', (as) =>
        as.map((a) => ({ href: a.getAttribute('href') ?? '', hreflang: a.getAttribute('hreflang') })),
      );
      const jaOnly = hrefs.filter((l) => JA_ONLY_HREF.test(l.href));
      expect(jaOnly.length, '日本語だけのページへのリンクが 1 本も無い').toBeGreaterThan(0);
      expect(jaOnly.filter((l) => l.hreflang !== 'ja').map((l) => l.href)).toEqual([]);
    });
  }

  test.describe('ドロワー', () => {
    const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
    test.use(PIXEL_7);

    test('/en/price/ のドロワーの Docs は hreflang="ja" と印を持つ', async ({ page }) => {
      await page.goto('/en/price/', { waitUntil: 'domcontentloaded' });
      const button = page.locator('[data-island="mobile-nav"] button').first();
      await button.waitFor({ state: 'visible' });
      await button.tap();
      const docs = page.locator('aside ul li a[href="/docs"]');
      await expect(docs).toHaveAttribute('hreflang', 'ja');
      await expect(docs).toContainText('(Japanese)');
    });
  });
});
