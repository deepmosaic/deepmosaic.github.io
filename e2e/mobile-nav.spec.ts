// モバイルドロワー (`src/islands/MobileNav.svelte`) の回帰 E2E。
//
// ## 何を守るのか
//
// `download={!!item.download}` が同一オリジンのリンクに `download="false"` を付け、
// スマホで「料金」「ドキュメント」をタップすると "false.html" が落ちてページが開けなかった。
// `download` は真偽属性ではない — 値があれば (たとえ "false" でも) ブラウザは保存に回す。
//
// CI の `Verify build output` はバンドル中の `download`,!! という**形**を grep するだけなので、
// `download={item.download}` や `Boolean(x)` のような別の書き方は素通りする。ここでは書き方に
// 依らず、**実ブラウザのモバイルエミュレーションで tap した結果** (保存が起きない / 遷移する) を見る。
//
// ## 本番へ向ける
//
//   E2E_BASE_URL=https://www.deepmosaic.co.jp npx playwright test e2e/mobile-nav.spec.ts
//
// 公開後の確認用。`playwright.config.ts` が配信サーバを立てず、この spec だけを
// 対象にする。解析系のリクエストは下で abort するので本番の計測は汚さない。
import { test, expect, devices, type Page } from '@playwright/test';

// `defaultBrowserType` を含む use() はファイル単位でワーカーを分ける指定になる。ブラウザは
// 設定側の chromium のままでよいので落とし、端末の形 (viewport / UA / touch) だけ借りる。
const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
test.use(PIXEL_7);

const HAMBURGER = '[data-island="mobile-nav"] button';
const STORE_URL = 'https://get.microsoft.com/installer/download/9PDKMKWHN9RW?referrer=appbadge&source=www.deepmosaic.co.jp';
const DRAWER_LINK = 'aside ul li a';

/** download イベントが遅れて届く場合の余裕 (遷移の commit とは別に待つ)。 */
const DOWNLOAD_GRACE_MS = 700;
const NAVIGATION_TIMEOUT_MS = 6_000;

/** 本番を読むときに計測を汚さない。マッチしたものだけ止める (catch-all は遷移に副作用が出る)。 */
const ANALYTICS_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'analytics.google.com',
  'clarity.ms',
  'doubleclick.net',
  'googleadservices.com',
  'googlesyndication.com',
];

interface DrawerLink {
  text: string;
  href: string;
  download: string | null;
}

async function openDrawer(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const button = page.locator(HAMBURGER).first();
  await button.waitFor({ state: 'visible' }); // 島のマウント待ち
  await button.tap();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
}

async function readDrawerLinks(page: Page): Promise<DrawerLink[]> {
  return page.locator(DRAWER_LINK).evaluateAll((elements) =>
    elements.map((element) => ({
      text: (element.textContent ?? '').trim(),
      href: element.getAttribute('href') ?? '',
      download: element.getAttribute('download'),
    })),
  );
}

/** 同一オリジンで、別ページへ移るリンク (同一ページ内の #アンカーは遷移が起きないので除く)。 */
function isSameOriginPageLink(link: DrawerLink, pageUrl: URL): boolean {
  const target = new URL(link.href, pageUrl);
  return target.origin === pageUrl.origin && target.hash === '';
}

/** GitHub Pages は `/price` を `/price/` に正規化する。比べたいのは行き先なので末尾だけ揃える。 */
function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => ANALYTICS_HOSTS.some((host) => url.hostname.endsWith(host)),
    (route) => route.abort(),
  );
});

test('同一オリジンのリンクに download 属性が付かない', async ({ page }) => {
  await openDrawer(page);
  const pageUrl = new URL(page.url());
  const links = await readDrawerLinks(page);

  expect(links.length, 'ドロワーにリンクが 1 つも無い').toBeGreaterThan(0);
  const offenders = links.filter(
    (link) => new URL(link.href, pageUrl).origin === pageUrl.origin && link.download !== null,
  );
  expect(offenders, 'download 属性は値が "false" でも保存に回る').toEqual([]);
});

test('ドロワーの先頭の DL 項目は Microsoft Store のインストーラを直接ダウンロードする URL (同じタブ、download 属性なし、流入経路を載せない)', async ({ page }) => {
  await openDrawer(page);
  const first = page.locator(DRAWER_LINK).first();

  await expect(first).toHaveAttribute('href', STORE_URL);
  await expect(first).toContainText('Microsoft Store からダウンロード');
  // 第三者 (get.microsoft.com) の URL には計測の装飾 (utm・ref・lp・dm) を載せない
  await expect(first).not.toHaveAttribute('href', /[?&](?:utm_[a-z]+|ref|lp|dm)=/);
  await expect(first).toHaveAttribute('data-dl', 'mobile');
  await expect(first).not.toHaveAttribute('target');
  await expect(first).not.toHaveAttribute('download');
  // ドロワーのどのリンクにも download 属性が無い (インストーラの導線を出さない)
  const links = await readDrawerLinks(page);
  expect(links.filter((link) => link.download !== null)).toEqual([]);
});

test('同一オリジンのリンクを tap すると保存されずに遷移する', async ({ page }) => {
  await openDrawer(page);
  const targets = (await readDrawerLinks(page)).filter((link) =>
    isSameOriginPageLink(link, new URL(page.url())),
  );
  expect(targets.length, '同一オリジンのリンクが 1 つも無い').toBeGreaterThan(0);

  const downloads: string[] = [];
  page.on('download', (download) => {
    downloads.push(download.suggestedFilename());
    void download.delete().catch(() => undefined); // 保存しない
  });

  for (const target of targets) {
    await test.step(`${target.text} (${target.href})`, async () => {
      downloads.length = 0;
      await openDrawer(page);
      // `/` → `/` のように URL が変わらない遷移も検出できるよう、ドキュメントと共に消える印を置く
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__navMarker = true;
      });

      const committed = page
        .waitForNavigation({ waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      await page.locator(`${DRAWER_LINK}[href="${target.href}"]`).first().tap();
      const didCommit = await committed;
      await page.waitForTimeout(DOWNLOAD_GRACE_MS);

      const markerSurvived = await page
        .evaluate(() => (window as unknown as Record<string, unknown>).__navMarker === true)
        .catch(() => false);
      const expectedPath = new URL(target.href, page.url()).pathname;

      expect.soft(downloads, `${target.text}: 保存が起きた`).toEqual([]);
      expect.soft(didCommit && !markerSurvived, `${target.text}: 遷移していない`).toBe(true);
      expect
        .soft(trimTrailingSlash(new URL(page.url()).pathname), `${target.text}: 行き先`)
        .toBe(trimTrailingSlash(expectedPath));
    });
  }
});

test('幅 767px のハンバーガーと、開いた後の閉じるボタンは指の形のカーソル', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 800 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cursorOf = (selector: string) =>
    page.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor);

  const hamburger = page.locator(HAMBURGER).first();
  await hamburger.waitFor({ state: 'visible' }); // 島のマウント待ち
  expect(await cursorOf(HAMBURGER)).toBe('pointer');

  await hamburger.tap();
  await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  const closeButton = 'aside button';
  await expect(page.locator(closeButton).first()).toBeVisible();
  expect(await cursorOf(closeButton)).toBe('pointer');
});
