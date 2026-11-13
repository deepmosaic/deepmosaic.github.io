// ヘッダーの「法人様はこちら」(T-1940、T-1968 で md 幅にも出す) の E2E。
//
// ## 何を守るのか
//
// - PC 幅 (lg = 1024px 以上): ヘッダーの一番右 (「無料でダウンロード」のさらに右) に「法人様はこちら」があり、
//   行き先が Enterprise の導入相談 `/enterprise/inquiry/` であること。
// - md 幅 (768〜1023px): ドロワーが出ない幅なので、ヘッダーのボタンとして短い表示「法人様」で見えていること。
//   ダウンロードも「ダウンロード」と短くする。読み上げ (aria-label) と textContent は「法人様はこちら」
//   「無料でダウンロード」のまま (textContent は GA4 の link_text に入る、`src/main.js`)。
// - 767px 以下: ヘッダーのボタンは隠れ、ドロワー (`src/islands/MobileNav.svelte`) に同じ項目があり、
//   タップで遷移すること。ドロワーの全リンクの「保存されずに遷移する」は `mobile-nav.spec.ts` が別途まとめて見る。
// - 各幅: ロゴ・ナビ・ダウンロード・法人向けのボタンが横にはみ出さず、折り返し・重なりも起きないこと。
import { test, expect, devices, type Page } from '@playwright/test';

const ENTERPRISE_LABEL = '法人様はこちら';
const ENTERPRISE_SHORT_LABEL = '法人様';
const ENTERPRISE_HREF = '/enterprise/inquiry/';
const DOWNLOAD_LABEL = '無料でダウンロード';
const DOWNLOAD_SHORT_LABEL = 'ダウンロード';
const HEADER_ROW = 'header > div';
const DOWNLOAD_CTA = 'header a[data-dl="header"]';
const ENTERPRISE_CTA = `${HEADER_ROW} > a[href="${ENTERPRISE_HREF}"]`;

/** ボタン 1 行分の高さの上限 (px)。これを超えたら文字が折り返している。 */
const SINGLE_LINE_MAX_HEIGHT = 44;
/** 重なり判定の丸め誤差 (px)。 */
const OVERLAP_TOLERANCE = 0.5;
const HEADER_WIDTHS = [320, 767, 768, 800, 900, 1023, 1024, 1280] as const;
/** Tailwind の md。ヘッダーのボタン (ダウンロード・法人向け) を出す最小幅 (px)。これ未満はドロワー。 */
const MD_MIN_WIDTH = 768;
/** Tailwind の lg。ボタンを長い表示 (「無料でダウンロード」「法人様はこちら」) にする最小幅 (px)。 */
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
        label: element.innerText.trim() || element.getAttribute('aria-label') || element.tagName,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        height: rect.height,
      }))
      .sort((a, b) => a.left - b.left);
  });
}

async function openAt(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load'); // 島 (ハンバーガー) とロゴ画像の確定を待つ
}

/** 法人向けのボタンが見えていて、行き先が導入相談で、ヘッダーの一番右 (ダウンロードの右) にあることを確かめる。 */
async function expectEnterpriseIsRightmost(page: Page): Promise<void> {
  const row = page.locator(HEADER_ROW);
  const lastLink = row.locator(':scope > a').last();
  await expect(lastLink).toBeVisible();
  await expect(lastLink).toHaveAttribute('href', ENTERPRISE_HREF);
  await expect(lastLink).not.toHaveAttribute('download');
  await expect(lastLink).toHaveAccessibleName(ENTERPRISE_LABEL);

  const boxes = await readVisibleHeaderBoxes(page);
  const enterprise = await lastLink.boundingBox();
  const download = await page.locator(DOWNLOAD_CTA).boundingBox();
  expect(download, 'ダウンロードボタンが見えていない').not.toBeNull();
  expect(enterprise, '法人向けのボタンが見えていない').not.toBeNull();
  expect(enterprise!.x).toBeGreaterThanOrEqual(download!.x + download!.width);
  expect(boxes.at(-1)?.right, '法人向けのボタンがヘッダーの一番右に無い').toBeCloseTo(enterprise!.x + enterprise!.width, 0);
}

test.describe('PC 幅 (lg 以上)', () => {
  test('ヘッダーの最後の要素が「法人様はこちら」で、ダウンロードより右にある', async ({ page }) => {
    await openAt(page, 1280);
    await expectEnterpriseIsRightmost(page);
    await expect(page.locator(ENTERPRISE_CTA)).toHaveText(ENTERPRISE_LABEL, { useInnerText: true });
    await expect(page.locator(DOWNLOAD_CTA)).toHaveText(DOWNLOAD_LABEL, { useInnerText: true });
  });

  test('「法人様はこちら」をクリックすると導入相談のページへ移る', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator(HEADER_ROW).getByRole('link', { name: ENTERPRISE_LABEL }).click();
    await expect(page).toHaveURL(new RegExp(`${ENTERPRISE_HREF}$`));
  });
});

test.describe('md 幅 (768〜1023px)', () => {
  for (const width of [768, 1023]) {
    test(`幅 ${width}px で「法人様」と短く出て、導入相談へのリンクで、ヘッダーの一番右にある`, async ({ page }) => {
      await openAt(page, width);
      await expectEnterpriseIsRightmost(page);
      const enterprise = page.locator(ENTERPRISE_CTA);
      await expect(enterprise).toHaveText(ENTERPRISE_SHORT_LABEL, { useInnerText: true });
      await expect(page.locator(DOWNLOAD_CTA)).toHaveText(DOWNLOAD_SHORT_LABEL, { useInnerText: true });
      // 計測 (GA4 の link_text = textContent) は幅によらず長い文言のまま
      expect((await enterprise.textContent())?.trim()).toBe(ENTERPRISE_LABEL);
      expect((await page.locator(DOWNLOAD_CTA).textContent())?.trim()).toBe(DOWNLOAD_LABEL);
    });
  }

  test('幅 900px で「法人様」をクリックすると導入相談のページへ移る', async ({ page }) => {
    await openAt(page, 900);
    await page.locator(HEADER_ROW).getByRole('link', { name: ENTERPRISE_LABEL }).click();
    await expect(page).toHaveURL(new RegExp(`${ENTERPRISE_HREF}$`));
  });
});

for (const width of HEADER_WIDTHS) {
  test(`幅 ${width}px でヘッダーがはみ出さず、折り返し・重なりもない`, async ({ page }) => {
    await openAt(page, width);

    const overflow = await page.locator(HEADER_ROW).evaluate((row) => ({
      row: row.scrollWidth - row.clientWidth,
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.row, 'ヘッダーの行が横にはみ出している').toBeLessThanOrEqual(0);
    expect(overflow.doc, 'ページが横にスクロールできる').toBeLessThanOrEqual(0);

    // md (768px) 以上ではヘッダーのボタンとして出す。それより狭い幅ではドロワーに任せる
    const enterprise = page.locator(ENTERPRISE_CTA);
    const burger = page.locator('[data-island="mobile-nav"] button').first();
    if (width >= MD_MIN_WIDTH) {
      await expect(enterprise).toBeVisible();
      await expect(burger).toBeHidden();
      await expect(enterprise).toHaveText(width >= LG_MIN_WIDTH ? ENTERPRISE_LABEL : ENTERPRISE_SHORT_LABEL, {
        useInnerText: true,
      });
    } else {
      await expect(enterprise).toBeHidden();
      await expect(burger).toBeVisible();
    }

    const boxes = await readVisibleHeaderBoxes(page);
    expect(boxes.length).toBeGreaterThan(1);
    const rowRight = await page.locator(HEADER_ROW).evaluate((row) => row.getBoundingClientRect().right);
    for (const box of boxes) {
      expect.soft(box.height, `${box.label} が折り返している`).toBeLessThanOrEqual(SINGLE_LINE_MAX_HEIGHT);
      expect.soft(box.right, `${box.label} が行の右端からはみ出している`).toBeLessThanOrEqual(rowRight + OVERLAP_TOLERANCE);
    }
    for (let i = 1; i < boxes.length; i += 1) {
      expect
        .soft(boxes[i].left + OVERLAP_TOLERANCE, `${boxes[i - 1].label} と ${boxes[i].label} が重なっている`)
        .toBeGreaterThanOrEqual(boxes[i - 1].right);
    }
  });
}

test.describe('767px 以下', () => {
  test('幅 767px ではヘッダーのボタンは隠れ、ドロワーに「法人様はこちら」がある', async ({ page }) => {
    await openAt(page, 767);
    await expect(page.locator(ENTERPRISE_CTA)).toBeHidden();
    await expect(page.locator(DOWNLOAD_CTA)).toBeHidden();

    const button = page.locator('[data-island="mobile-nav"] button').first();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const item = page.locator('aside ul li a', { hasText: ENTERPRISE_LABEL });
    await expect(item).toHaveCount(1);
    await expect(item).toHaveAttribute('href', ENTERPRISE_HREF);
  });
});

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
