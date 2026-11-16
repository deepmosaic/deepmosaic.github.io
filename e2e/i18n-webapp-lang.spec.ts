// 英語・繁体字のページから Web 版 (app.deepmosaic.co.jp) へのリンクで表示言語を渡す E2E。
//
// サイトの Playwright は `_site/` の静的配信 (アプリを起動しない)。この spec だけを回すとき:
//   E2E_PORT=4516 E2E_SKIP_BUILD=1 npx playwright test e2e/i18n-webapp-lang.spec.ts
//
// ## 何を守るのか
//
// - (a) /en/・/en/price/・/en/spec/・/en/subscribe/ の Web 版へのリンク (`a[href*="app.deepmosaic.co.jp"]`) は、読み込み時の
//       流入経路の装飾 (src/main.js の decorateLinks) の後も `lang=en` をちょうど 1 つと `dm=1` を持つ。/zh-tw/ の同じ 4 ページは `lang=zh-TW`。
//       各ページでリンクが 0 本でない (リンクが消えて素通りするのを防ぐ)。
// - (b) ja の /・/price/・/spec/・/subscribe/ の同じリンクは `lang` を持たず、`dm=1` を持つ (装飾は今どおり)。
// - (c) /en/subscribe/ のボタンは `checkout=<code>` と `lang=en` を両方持つ。
// - (d) クリック時の装飾 (`auxclick` の capture のリスナー) の後も、/en/ のヒーローのリンクの `lang=en` はちょうど 1 つ。
//
// 本番の Web 版へは出ない (route で止め、遷移もさせない)。値の正は `_data/site.yml` の `web_app.lang_query` / `lang_param`
// (ビルド出力の検査は scripts/i18n/checks/webapp-lang.mjs)。
import { test, expect, type Page } from '@playwright/test';

const WEB_APP_LINKS = 'a[href*="app.deepmosaic.co.jp"]';
const PAGES = ['', 'price/', 'spec/', 'subscribe/'] as const;
const LANGS = [
  { prefix: '/en/', want: 'en' },
  { prefix: '/zh-tw/', want: 'zh-TW' },
] as const;

test.beforeEach(async ({ page }) => {
  await page.route('https://app.deepmosaic.co.jp/**', (r) => r.abort());
});

/** ページを開き、読み込み時の装飾 (dm=1) が全部の Web 版へのリンクに付いた後の href を返す。 */
async function webAppHrefs(page: Page, path: string): Promise<URL[]> {
  await page.goto(path);
  const links = page.locator(WEB_APP_LINKS);
  await expect.poll(async () => links.count(), { message: `${path}: Web 版へのリンクが無い` }).toBeGreaterThan(0);
  await expect
    .poll(async () => links.evaluateAll((as) => as.every((a) => (a as HTMLAnchorElement).href.includes('dm=1'))), {
      message: `${path}: 読み込み時の装飾 (dm=1) が付かない`,
    })
    .toBe(true);
  const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  return hrefs.map((h) => new URL(h));
}

for (const { prefix, want } of LANGS) {
  for (const p of PAGES) {
    const path = `${prefix}${p}`;
    test(`(a) ${path}: Web 版へのリンクは lang=${want} をちょうど 1 つと dm=1 を持つ`, async ({ page }) => {
      const urls = await webAppHrefs(page, path);
      for (const u of urls) {
        expect(u.searchParams.getAll('lang'), u.href).toEqual([want]);
        expect(u.searchParams.get('dm'), u.href).toBe('1');
      }
    });
  }
}

for (const p of PAGES) {
  const path = `/${p}`;
  test(`(b) ${path}: ja の Web 版へのリンクは lang を持たず dm=1 を持つ`, async ({ page }) => {
    const urls = await webAppHrefs(page, path);
    for (const u of urls) {
      expect(u.searchParams.getAll('lang'), u.href).toEqual([]);
      expect(u.searchParams.get('dm'), u.href).toBe('1');
    }
  });
}

test('(c) /en/subscribe/: 申し込みのボタンは checkout と lang=en を両方持つ', async ({ page }) => {
  const urls = await webAppHrefs(page, '/en/subscribe/');
  const buttons = urls.filter((u) => u.searchParams.has('checkout'));
  expect(buttons.length).toBeGreaterThan(0);
  for (const u of buttons) {
    expect(u.searchParams.getAll('checkout'), u.href).toHaveLength(1);
    expect(u.searchParams.get('checkout'), u.href).toMatch(/^[a-z]+$/);
    expect(u.searchParams.getAll('lang'), u.href).toEqual(['en']);
  }
});

test('(d) /en/: クリック時の装飾の後もヒーローのリンクの lang=en はちょうど 1 つ', async ({ page }) => {
  await webAppHrefs(page, '/en/');
  const hero = page.locator('a[data-dl="hero-webapp"]');
  await expect(hero).toHaveCount(1);
  const href = await hero.evaluate((a) => {
    // 遷移させない (main.js の capture のリスナーが先に装飾してから、ここで止める)
    window.addEventListener('auxclick', (e) => e.preventDefault());
    window.addEventListener('click', (e) => e.preventDefault());
    a.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    return (a as HTMLAnchorElement).href;
  });
  const u = new URL(href);
  expect(u.searchParams.getAll('lang'), href).toEqual(['en']);
  expect(u.searchParams.get('dm'), href).toBe('1');
});
