// T-2211 (i18n1112 I18N-713): ja のページの言語の案内の帯 (ブラウザの言語が英中のとき) と選んだ言語の記憶の E2E。
//
// **チケットでは回さない**。ウェーブ末尾にリーダーが既存の spec と一緒に回す:
//   npx playwright test e2e/i18n-suggest.spec.ts e2e/i18n-nav.spec.ts
//
// ## 何を守るのか
//
// - (a) locale en-US で / → 英語の帯があり、リンクが /en/ を指す。押すと /en/ に移り、/ に戻っても帯が出る (保存値 en)。
// - (b) 閉じる → 帯が消え、再読込でも出ない (保存値 ja)。
// - (c) locale zh-CN で /price/ → 繁体字の帯 (lang="zh-Hant-TW") で /zh-tw/price/。
// - (d) locale ja-JP では帯が無い。
// - (e) en-US でも、言語の切り替え (フッター) で「日本語」を選ぶと以後 帯が無い。
// - (f) docs (/docs/、訳の無いページ = alternate が無い) では帯が無い。
// - (g) 自動のリダイレクトはしない (en-US で / を開いても URL は / のまま)。
//
// 文の期待値は src/lib/lang-suggest.js の TEXT。保存のキーは dm-site-lang。
import { expect, test } from '@playwright/test';

const BANNER = '.lang-suggest';
const KEY = 'dm-site-lang';

test.describe('locale en-US', () => {
  test.use({ locale: 'en-US' });

  test('(a)(g) / に英語の帯、押すと /en/、戻っても帯が出る', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    const banner = page.locator(BANNER);
    await expect(banner).toHaveCount(1);
    await expect(banner).toHaveAttribute('lang', 'en');
    await expect(banner).toHaveAttribute('role', 'region');
    await expect(banner).toHaveAttribute('data-nosnippet', '');
    await expect(banner).toContainText('This page is also available in English.');
    const link = banner.getByRole('link', { name: 'View in English' });
    await expect(link).toHaveAttribute('href', '/en/');
    // 帯は body の先頭 (ヘッダーより前)
    expect(await page.evaluate(() => document.body.firstElementChild?.classList.contains('lang-suggest'))).toBe(true);

    await link.click();
    await expect(page).toHaveURL(/\/en\/$/);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('en');
    await expect(page.locator(BANNER)).toHaveCount(0);

    await page.goto('/');
    await expect(page.locator(BANNER)).toHaveCount(1);
  });

  test('(b) 閉じると消え、再読込でも出ない', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator(BANNER);
    await banner.getByRole('button', { name: 'Close' }).click();
    await expect(banner).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('ja');
    await page.reload();
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('(e) 言語の切り替えで日本語を選ぶと以後 帯が無い', async ({ page }) => {
    await page.goto('/en/');
    await page.locator('footer [data-i18n-switch] a[hreflang="ja"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(BANNER)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('ja');
    await page.goto('/price/');
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('(f) docs には帯が無い', async ({ page }) => {
    await page.goto('/docs/');
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});

test.describe('locale zh-CN', () => {
  test.use({ locale: 'zh-CN' });

  test('(c) /price/ に繁体字の帯で /zh-tw/price/', async ({ page }) => {
    await page.goto('/price/');
    const banner = page.locator(BANNER);
    await expect(banner).toHaveAttribute('lang', 'zh-Hant-TW');
    await expect(banner).toContainText('本頁面也提供繁體中文版。');
    await expect(banner.getByRole('link', { name: '以繁體中文檢視' })).toHaveAttribute('href', '/zh-tw/price/');
    await expect(banner.getByRole('button', { name: '關閉' })).toBeVisible();
  });
});

test.describe('locale ja-JP', () => {
  test.use({ locale: 'ja-JP' });

  test('(d) 帯が無い', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(BANNER)).toHaveCount(0);
    await page.goto('/price/');
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});
