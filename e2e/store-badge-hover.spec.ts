// Microsoft Store のバッジにポインタを載せたときの動きの E2E (`src/app.css` の .store-badge-link)。
//
// - ポインタを載せると、リンクが上へ少し (4px) 動く。周りの配置 (次の要素の位置) は変わらず、外側の明るい縁もリンクと一緒に動く
// - キーボードでフォーカスしたときも同じに動く
// - 動きを減らす設定 (prefers-reduced-motion: reduce) のときは動かない
// - ヘッダーのバッジは動いてもヘッダーの中に収まる
//
// 対象はトップの冒頭のバッジ (hero-store) とヘッダーのバッジ (header)。幅 1280。
import { test, expect, type Locator, type Page } from '@playwright/test';

const SHIFT = 4;

test.use({ viewport: { width: 1280, height: 800 } });

async function transformOf(link: Locator): Promise<string> {
  return link.evaluate((el) => getComputedStyle(el).transform);
}

/** transform の matrix の縦の移動量 (none は 0)。 */
function translateY(transform: string): number {
  const m = transform.match(/^matrix\(([^)]+)\)$/);
  return m ? Number(m[1].split(',')[5]) : 0;
}

/** 動きが終わるまで待ってから transform を読む。 */
async function settledTransform(page: Page, link: Locator): Promise<string> {
  await page.waitForTimeout(500);
  return transformOf(link);
}

for (const where of ['hero-store', 'header']) {
  test(`${where}: ポインタを載せると上へ ${SHIFT}px 動き、配置は変わらず、縁も一緒に動く`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/', { waitUntil: 'load' });
    const link = page.locator(`a[data-store-button="${where}"]`);
    await expect(link).toBeVisible();
    expect(await transformOf(link), '載せる前は動いていない').toBe('none');
    const before = await link.boundingBox();
    const next = page.locator('[data-dl="hero-webapp"]');
    const nextBefore = await next.boundingBox();

    await link.hover();
    const moved = await settledTransform(page, link);
    expect(translateY(moved), `載せた後の transform ${moved}`).toBeCloseTo(-SHIFT, 1);
    const after = await link.boundingBox();
    expect(after!.y - before!.y, '描かれた位置が上へ動く').toBeCloseTo(-SHIFT, 0);
    expect(after!.height, '大きさは変わらない').toBeCloseTo(before!.height, 0);
    expect((await next.boundingBox())!.y, '次の要素の位置は変わらない').toBeCloseTo(nextBefore!.y, 0);
    expect(await link.evaluate((el) => getComputedStyle(el).boxShadow), '外側の縁はリンクに付いたまま').toMatch(/rgba\(255, 255, 255, 0\.7\) 0px 0px 0px 1px/);

    if (where === 'header') {
      const header = await page.locator('header').boundingBox();
      expect(after!.y, 'ヘッダーの上にはみ出さない').toBeGreaterThanOrEqual(header!.y);
      expect(after!.y + after!.height, 'ヘッダーの下にはみ出さない').toBeLessThanOrEqual(header!.y + header!.height);
    }

    await page.mouse.move(0, 790);
    expect(translateY(await settledTransform(page, link)), 'ポインタを外すと戻る').toBe(0);
  });
}

test('hero-store: キーボードでフォーカスしたときも上へ動く', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'load' });
  const link = page.locator('a[data-store-button="hero-store"]');
  // キーボードの操作の後のフォーカスとして扱わせる (focus-visible)
  await page.keyboard.press('Shift');
  await link.focus();
  expect(await link.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  expect(translateY(await settledTransform(page, link))).toBeCloseTo(-SHIFT, 1);
});

for (const where of ['hero-store', 'header']) {
  test(`${where}: 動きを減らす設定のときはポインタを載せても動かない`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'load' });
    const link = page.locator(`a[data-store-button="${where}"]`);
    await link.hover();
    expect(await settledTransform(page, link)).toBe('none');
  });
}
