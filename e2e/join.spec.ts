// `/join/` (法人の案内メールのリンクの着地点) の E2E。
//
// ## 何を守るのか
//
// - フラグメントに応じて 3 つの表示のどれか 1 つだけが出ること:
//     #code=XXXX-XXXX-XXXX → 組織コードの表示 + 「アプリで開く」= deepmosaic://join?code=XXXX-XXXX-XXXX
//     #admin               → 管理者の表示 + 「アプリで開く」= deepmosaic://login
//     それ以外              → 「リンクが正しくありません。…」(ボタンなし、入力値を画面に出さない)
// - 自動ではアプリを開かない (ページを開いただけでは遷移しない)。
// - 計測を載せない: 外部へのリクエストが 1 本も出ない (Google tag / Cloudflare Web Analytics / LINE)、
//   流入経路の記録 (localStorage) もしない。noindex・referrer を送らない・サイトマップに載らない。
// - モバイル幅で横にはみ出さない。
//
// 判定の純ロジック (`parseJoinHash`) の網羅は `src/lib/join-hash.test.js`。ここはビルド出力 (`_site/`) の継ぎ目を見る。
import { test, expect, devices, type Page } from '@playwright/test';

const PATH = '/join/';
const VIEW = (kind: string) => `[data-join-view="${kind}"]`;
const OPEN_CODE = '[data-join-open-code]';
const OPEN_ADMIN = '[data-join-open-admin]';
const INVALID_TEXT = 'リンクが正しくありません。メールのリンクをもう一度開くか、アプリを起動して組織コードを入力してください。';

/** 配信元以外へのリクエスト (計測・第三者)。beforeEach で止めて記録する。 */
let externalRequests: string[] = [];

test.beforeEach(async ({ page, baseURL }) => {
  externalRequests = [];
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin && (url.protocol === 'http:' || url.protocol === 'https:'),
    (route) => {
      externalRequests.push(route.request().url());
      return route.abort();
    },
  );
});

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`${PATH}${hash}`, { waitUntil: 'load' });
  await expect(page.getByRole('heading', { level: 1, name: 'Deepmosaic を開く' })).toBeVisible();
}

async function expectOnlyView(page: Page, kind: 'code' | 'admin' | 'invalid'): Promise<void> {
  for (const k of ['code', 'admin', 'invalid']) {
    if (k === kind) await expect(page.locator(VIEW(k))).toBeVisible();
    else await expect(page.locator(VIEW(k))).toBeHidden();
  }
}

test('#code=: 組織コードを大文字で表示し、アプリで開くの href が deepmosaic://join?code=…', async ({ page }) => {
  await open(page, '#code=abcd-efgh-2345');
  await expectOnlyView(page, 'code');
  const view = page.locator(VIEW('code'));
  await expect(view).toContainText('組織コード ABCD-EFGH-2345 でアプリを開きます。');
  await expect(view.locator('strong[data-join-code]')).toHaveText('ABCD-EFGH-2345');
  await expect(page.locator(OPEN_CODE)).toHaveAttribute('href', 'deepmosaic://join?code=ABCD-EFGH-2345');
  await expect(page.locator(OPEN_CODE)).toHaveText('アプリで開く');
  await expect(view.locator('ol > li')).toHaveCount(3);
  await expect(view.getByRole('button', { name: 'コピー' })).toBeVisible();
});

test('#admin: 管理者の表示で、アプリで開くの href が deepmosaic://login', async ({ page }) => {
  await open(page, '#admin');
  await expectOnlyView(page, 'admin');
  await expect(page.locator(VIEW('admin'))).toContainText('管理者としてサインインします。');
  await expect(page.locator(OPEN_ADMIN)).toHaveAttribute('href', 'deepmosaic://login');
  await expect(page.locator(VIEW('admin')).locator('ol > li')).toHaveCount(2);
  await expect(page.locator(OPEN_CODE)).not.toHaveAttribute('href', /.*/);
});

for (const hash of ['', '#', '#code=ABCD-EFGH', '#code=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', '#admin=1']) {
  test(`不正なリンク (${hash || '空'}): 文言だけでボタンを出さず、入力値を画面に出さない`, async ({ page }) => {
    let dialog = false;
    page.on('dialog', (d) => {
      dialog = true;
      void d.dismiss();
    });
    await open(page, hash);
    await expectOnlyView(page, 'invalid');
    await expect(page.locator(VIEW('invalid'))).toHaveText(INVALID_TEXT);
    await expect(page.locator('[data-join] a:visible:has-text("アプリで開く")')).toHaveCount(0);
    await expect(page.locator(OPEN_CODE)).not.toHaveAttribute('href', /.*/);
    await expect(page.locator('[data-join-code]').first()).toHaveText('');
    // 入力値から作られた画像が無い (原稿にある画像は Microsoft Store のバッジ 1 つだけ)
    await expect(page.locator('[data-join] img:not([src="/assets/img/store-badge/ja.svg"])')).toHaveCount(0);
    expect(dialog, 'HTML を含む値が実行された').toBe(false);
  });
}

test('フラグメントを書き換えると表示が追従し、前のコードを残さない', async ({ page }) => {
  await open(page, '#code=ABCD-EFGH-2345');
  await expectOnlyView(page, 'code');
  await page.evaluate(() => {
    location.hash = '#nope';
  });
  await expectOnlyView(page, 'invalid');
  await expect(page.locator('[data-join-code]').first()).toHaveText('');
  await expect(page.locator(OPEN_CODE)).not.toHaveAttribute('href', /.*/);
  await page.evaluate(() => {
    location.hash = '#admin';
  });
  await expectOnlyView(page, 'admin');
});

test('自動ではアプリを開かない (ページを開いただけでは遷移しない)', async ({ page }) => {
  await open(page, '#code=ABCD-EFGH-2345');
  await page.waitForTimeout(800);
  expect(new URL(page.url()).pathname).toBe(PATH);
  expect(new URL(page.url()).hash).toBe('#code=ABCD-EFGH-2345');
});

test('コピー: 組織コードをクリップボードへ写し、結果を知らせる', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin });
  await open(page, '#code=wxyz-2345-abcd');
  await page.getByRole('button', { name: 'コピー' }).click();
  await expect(page.locator('[data-join-copy-status]')).toHaveText('コピーしました。');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('WXYZ-2345-ABCD');
});

test('計測なし: 外部へのリクエストが出ず、gtag も流入経路の記録も無い', async ({ page }) => {
  await open(page, '#code=ABCD-EFGH-2345');
  await page.waitForLoadState('networkidle');
  expect(externalRequests, '外部へのリクエスト (計測・第三者)').toEqual([]);
  const state = await page.evaluate(() => ({
    gtag: typeof (window as unknown as Record<string, unknown>).gtag,
    dataLayer: typeof (window as unknown as Record<string, unknown>).dataLayer,
    attr: localStorage.getItem('dm_attr'),
    first: localStorage.getItem('dm_attr_first'),
    noTracking: document.documentElement.hasAttribute('data-no-tracking'),
  }));
  expect(state).toEqual({ gtag: 'undefined', dataLayer: 'undefined', attr: null, first: null, noTracking: true });
  const html = await page.content();
  for (const host of ['googletagmanager.com', 'cloudflareinsights.com', 'line-scdn.net']) {
    expect(html.includes(host), `${host} を読み込まない`).toBe(false);
  }
});

test('noindex・referrer なし・サイトマップに載らない', async ({ page, request }) => {
  await open(page, '#admin');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).not.toContain('/join/');
});

// 「アプリをまだ入れていない方」は Microsoft Store の文と Store のバッジ (その言語の公式の画像) だけ。インストーラのリンクは出さない。
// 計測しないページなので data-dl を付けない。
/** ページの言語の掲載ページ (公式のバッジと同じ形、hl はページの言語) */
const STORE_URL = (hl: string) => `https://apps.microsoft.com/detail/9PDKMKWHN9RW?referrer=appbadge&mode=direct&hl=${hl}`;
for (const [path, text, label, lang, hl] of [
  ['/join/', 'Microsoft Store から Deepmosaic（Windows 版）を入れてください。', 'Microsoft Store からダウンロード', 'ja', 'ja-JP'],
  ['/en/join/', 'Get Deepmosaic for Windows from Microsoft Store.', 'Download from the Microsoft Store', 'en', 'en-US'],
  ['/zh-tw/join/', '請從 Microsoft Store 取得並安裝 Deepmosaic（Windows 版）。', '從 Microsoft Store 下載', 'zh-tw', 'zh-TW'],
] as const) {
  test(`${path}: Microsoft Store のバッジが 1 つ (別タブ・noopener・計測なし)、インストーラのリンクは無い`, async ({ page }) => {
    await page.goto(`${path}#code=ABCD-EFGH-2345`, { waitUntil: 'load' });
    const install = page.locator('[data-join-install]');
    await expect(install).toContainText(text);
    const store = install.locator('a[data-store-button="join-store"]');
    await expect(store).toHaveCount(1);
    await expect(store).toHaveAccessibleName(label);
    await expect(store.locator('img')).toHaveAttribute('src', `/assets/img/store-badge/${lang}.svg`);
    await expect(store).toHaveAttribute('href', STORE_URL(hl));
    await expect(store).toHaveAttribute('target', '_blank');
    await expect(store).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(store).not.toHaveAttribute('download');
    await expect(store).not.toHaveAttribute('data-dl', /.*/);
    await expect(install.locator('[data-join-download]')).toHaveCount(0);
    await expect(page.locator('a[href*="download/latest/windows"], a[download]')).toHaveCount(0);
  });
}

test.describe('モバイル幅', () => {
  const { defaultBrowserType: _browser, ...PIXEL_7 } = devices['Pixel 7'];
  test.use(PIXEL_7);

  for (const hash of ['#code=ABCD-EFGH-2345', '#admin', '#bad']) {
    test(`${hash}: 横にはみ出さない`, async ({ page }) => {
      await open(page, hash);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      if (hash !== '#bad') {
        const button = page.locator(`${hash === '#admin' ? OPEN_ADMIN : OPEN_CODE}`);
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(clientWidth);
      }
    });
  }
});
