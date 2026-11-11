// ヘッダーの「法人様はこちら」(T-1940) の E2E。
//
// ## 何を守るのか
//
// - PC 幅: ヘッダーの一番右 (「無料でダウンロード」のさらに右) に「法人様はこちら」があり、
//   行き先が Enterprise の導入相談 `/enterprise/inquiry/` であること。
// - モバイル: ドロワー (`src/islands/MobileNav.svelte`) に同じ項目があり、タップで遷移すること。
//   ドロワーの全リンクの「保存されずに遷移する」は `mobile-nav.spec.ts` が別途まとめて見る。
// - 320 / 768 / 1024 px: ロゴ・ナビ・ダウンロード・新ボタンが横にはみ出さず、折り返し・重なりも
//   起きないこと。詰まる幅では新ボタンを隠してドロワーに任せる。
import { test, expect, devices, type Page } from '@playwright/test';

const ENTERPRISE_LABEL = '法人様はこちら';
const ENTERPRISE_HREF = '/enterprise/inquiry/';
const HEADER_ROW = 'header > div';
const DOWNLOAD_CTA = 'header a[data-dl="header"]';

/** ボタン 1 行分の高さの上限 (px)。これを超えたら文字が折り返している。 */
const SINGLE_LINE_MAX_HEIGHT = 44;
/** 重なり判定の丸め誤差 (px)。 */
const OVERLAP_TOLERANCE = 0.5;
const HEADER_WIDTHS = [320, 768, 1024] as const;
/** Tailwind の lg。「法人様はこちら」を PC のボタンとして出す最小幅 (px)。 */
const LG_MIN_WIDTH = 1024;

interface Box {
  label: string;
  left: number;
  right: number;
  top: number;
  height: number;
}

/** ヘッダーの行の中で見えている要素 (ロゴ・ナビの各リンク・ボタン) の箱を左から順に返す。 */
async function readVisibleHeaderBoxes(page: Page): Promise<Box[]> {
  return page.locator(HEADER_ROW).evaluate((row) => {
    const candidates = Array.from(row.querySelectorAll<HTMLElement>(':scope > a, :scope > nav > a, :scope > div > [data-island] button'));
    return candidates
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden')
      .map(({ element, rect }) => ({
        label: (element.textContent ?? '').trim() || element.getAttribute('aria-label') || element.tagName,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        height: rect.height,
      }))
      .sort((a, b) => a.left - b.left);
  });
}

test.describe('PC 幅', () => {
  test('ヘッダーの最後の要素が「法人様はこちら」で、ダウンロードより右にある', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const row = page.locator(HEADER_ROW);
    const lastLink = row.locator(':scope > a').last();

    await expect(lastLink).toBeVisible();
    await expect(lastLink).toHaveText(ENTERPRISE_LABEL);
    await expect(lastLink).toHaveAttribute('href', ENTERPRISE_HREF);
    await expect(lastLink).not.toHaveAttribute('download');

    const download = await page.locator(DOWNLOAD_CTA).boundingBox();
    const enterprise = await lastLink.boundingBox();
    expect(download, 'ダウンロードボタンが見えていない').not.toBeNull();
    expect(enterprise, '「法人様はこちら」が見えていない').not.toBeNull();
    expect(enterprise!.x).toBeGreaterThanOrEqual(download!.x + download!.width);
  });

  test('「法人様はこちら」をクリックすると導入相談のページへ移る', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator(HEADER_ROW).getByRole('link', { name: ENTERPRISE_LABEL }).click();
    await expect(page).toHaveURL(new RegExp(`${ENTERPRISE_HREF}$`));
  });
});

for (const width of HEADER_WIDTHS) {
  test(`幅 ${width}px でヘッダーがはみ出さず、折り返し・重なりもない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load'); // 島 (ハンバーガー) とロゴ画像の確定を待つ

    const overflow = await page.locator(HEADER_ROW).evaluate((row) => ({
      row: row.scrollWidth - row.clientWidth,
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.row, 'ヘッダーの行が横にはみ出している').toBeLessThanOrEqual(0);
    expect(overflow.doc, 'ページが横にスクロールできる').toBeLessThanOrEqual(0);

    // lg (1024px) 以上では PC のボタンとして出す。それより狭い幅では隠して 1 行に収める
    const enterprise = page.locator(HEADER_ROW).locator(`:scope > a[href="${ENTERPRISE_HREF}"]`);
    if (width >= LG_MIN_WIDTH) await expect(enterprise).toBeVisible();
    else await expect(enterprise).toBeHidden();

    const boxes = await readVisibleHeaderBoxes(page);
    expect(boxes.length).toBeGreaterThan(1);
    for (const box of boxes) {
      expect.soft(box.height, `${box.label} が折り返している`).toBeLessThanOrEqual(SINGLE_LINE_MAX_HEIGHT);
    }
    for (let i = 1; i < boxes.length; i += 1) {
      expect
        .soft(boxes[i].left + OVERLAP_TOLERANCE, `${boxes[i - 1].label} と ${boxes[i].label} が重なっている`)
        .toBeGreaterThanOrEqual(boxes[i - 1].right);
    }
  });
}

test.describe('モバイル', () => {
  // `defaultBrowserType` を含む use() はワーカーを分ける指定になるので落とす (mobile-nav.spec.ts と同じ)
  const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
  test.use(PIXEL_7);

  test('ドロワーに「法人様はこちら」があり、タップで導入相談のページへ移る', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const button = page.locator('[data-island="mobile-nav"] button').first();
    await button.waitFor({ state: 'visible' });
    await button.tap();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    const item = page.locator('aside ul li a', { hasText: ENTERPRISE_LABEL });
    await expect(item).toHaveCount(1);
    await expect(item).toHaveAttribute('href', ENTERPRISE_HREF);
    await expect(item).not.toHaveAttribute('download');

    await item.tap();
    await expect(page).toHaveURL(new RegExp(`${ENTERPRISE_HREF}$`));
  });
});
