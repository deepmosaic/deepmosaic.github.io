// 料金のカードのダウンロードのボタンの E2E。
//
// ## 何を守るのか
//
// - 料金のカード (トップと /price/、3 言語) のダウンロードのカード (HOBBY) のボタンは、青い主ボタンの「アプリをダウンロード」
//   (en「Download the app」、zh-TW「下載應用程式」) で、押すと Microsoft Store のインストーラが直接ダウンロードされる URL へ向く。
// - 同じタブで開く (target なし)・download 属性なし・計測の目印 data-dl はプランの code。
// - 料金のカードから申し込みのページ (/subscribe/) へは向けない (申し込みはアプリのプロフィールメニューと /subscribe/)。
// - ボタンはカードの幅いっぱいで、文字が 1 行に収まる (1280 / 390 の幅)。
import { test, expect } from '@playwright/test';

const STORE_URL = 'https://get.microsoft.com/installer/download/9PDKMKWHN9RW?referrer=appbadge&source=www.deepmosaic.co.jp';
const CASES = [
  { path: '/price/', label: 'アプリをダウンロード' },
  { path: '/', label: 'アプリをダウンロード' },
  { path: '/en/price/', label: 'Download the app' },
  { path: '/en/', label: 'Download the app' },
  { path: '/zh-tw/price/', label: '下載應用程式' },
  { path: '/zh-tw/', label: '下載應用程式' },
] as const;
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
];
/** ボタン 1 行分の高さの上限 (px)。これを超えたら文字が折り返している。 */
const SINGLE_LINE_MAX_HEIGHT = 56;

for (const vp of VIEWPORTS) {
  test.describe(`幅 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const { path, label } of CASES) {
      test(`${path}: HOBBY のカードのボタンは「${label}」でインストーラを直接ダウンロードする`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'load' });
        const button = page.locator('a[data-store-button="light"]');
        await expect(button).toHaveCount(1);
        await expect(button).toHaveText(label);
        await expect(button).toHaveAttribute('href', STORE_URL);
        await expect(button).toHaveAttribute('data-dl', 'light');
        await expect(button).toHaveClass(/\bbtn-primary\b/);
        await expect(button).not.toHaveAttribute('target');
        await expect(button).not.toHaveAttribute('download');
        await expect(button.locator('img')).toHaveCount(0);
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        expect(box, 'ボタンが見えていない').not.toBeNull();
        expect(box!.height, '文字が折り返している').toBeLessThanOrEqual(SINGLE_LINE_MAX_HEIGHT);
        // 料金のカードから申し込みのページへは向けない
        await expect(page.locator('.plan-card-featured a[href*="/subscribe/"], .plan-card a[href*="/subscribe/"]')).toHaveCount(0);
      });
    }
  });
}
