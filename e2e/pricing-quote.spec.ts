// 料金の文 (Pro・お見積り)・Enterprise の詳細のビルド出力の E2E。
//
// ## 何を守るのか
//
// - SoftwareApplication の JSON-LD の AggregateOffer はお見積りの Enterprise を外す (lowPrice 0・highPrice = Light・offerCount 2)。
// - FAQ (表示と FAQPage の JSON-LD) に Pro の追加契約の句が無く、Light の上限 (2 契約・月 10 時間) がある。
// - /price/・/subscribe/ と英中の meta description の金額は Light の価格・税込額だけ。
// - ROI 計算機の既定は月 10 時間で Light (¥5,960)。10 時間を超えると Enterprise (お見積り) になり、金額の代わりにお見積りの案内を出す。
//   JS 無効では noscript の確定文 (¥5,960) が出る。
// - llms-full.txt の Enterprise は「お見積り」の見出しで、料金の節の金額は Light の価格・税込額だけ。
// - /docs/#team に「Enterprise プランの内容」の一覧がある。
//
// 文言・データの細かい検査は `src/lib/site-copy-pricing-text.test.js`。ここは Liquid / 島 → HTML の継ぎ目だけを見る。
import { test, expect, type Page } from '@playwright/test';

/** 画面に出している有料プランの金額 (Light の価格・税込額) */
const SHOWN_AMOUNTS = ['2,980', '3,278'];
/** 桁区切りの数 (金額) */
const AMOUNT = /\d{1,3}(?:,\d{3})+/g;

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin && (url.protocol === 'http:' || url.protocol === 'https:'),
    (route) => route.abort(),
  );
});

/** ページの JSON-LD のうち @type が type のもの (配列・@graph も見る)。 */
async function jsonLdOf(page: Page, type: string): Promise<{ node: Record<string, unknown>; raw: string }[]> {
  const raws = await page.locator('script[type="application/ld+json"]').allTextContents();
  const found: { node: Record<string, unknown>; raw: string }[] = [];
  for (const raw of raws) {
    const data = JSON.parse(raw);
    const nodes = Array.isArray(data) ? data : data['@graph'] ?? [data];
    for (const node of nodes) {
      if (node['@type'] === type) found.push({ node, raw: JSON.stringify(node) });
    }
  }
  return found;
}

for (const path of ['/', '/price/', '/spec/', '/en/', '/en/price/', '/en/spec/', '/zh-tw/', '/zh-tw/price/', '/zh-tw/spec/']) {
  test(`${path} の SoftwareApplication の offers はお見積りの Enterprise を含まない`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const apps = await jsonLdOf(page, 'SoftwareApplication');
    expect(apps).toHaveLength(1);
    const offers = apps[0].node.offers as Record<string, unknown>;
    expect(offers.lowPrice).toBe(0);
    expect(offers.highPrice).toBe(2980);
    expect(offers.offerCount).toBe(2);
    expect(Object.keys(offers).sort()).toEqual(['@type', 'highPrice', 'lowPrice', 'offerCount', 'priceCurrency']);
  });
}

const FAQ_LIGHT: Array<[string, string, string]> = [
  ['/', 'Light は最大 2 契約で月 10 時間まで', 'Pro は最大'],
  ['/en/', 'Light: up to 2 subscriptions for 10 hours a month', 'Pro: up to'],
  ['/zh-tw/', 'Light 最多 2 份訂閱，每月 10 小時', 'Pro 最多'],
];

for (const [path, light, pro] of FAQ_LIGHT) {
  test(`${path} の FAQ (表示と FAQPage) に Pro の句が無く、Light の上限がある`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const faq = page.locator('#faq');
    await expect(faq).toContainText(light);
    await expect(faq).not.toContainText(pro);
    const pages = await jsonLdOf(page, 'FAQPage');
    expect(pages).toHaveLength(1);
    expect(pages[0].raw).toContain(light);
    expect(pages[0].raw).not.toContain(pro);
  });
}

for (const path of ['/price/', '/subscribe/', '/en/price/', '/en/subscribe/', '/zh-tw/price/', '/zh-tw/subscribe/']) {
  test(`${path} の meta description の金額は Light の価格・税込額だけで、Pro が無い`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const desc = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(desc).not.toBe('');
    for (const a of desc.match(AMOUNT) ?? []) expect(SHOWN_AMOUNTS).toContain(a);
    expect(desc).not.toMatch(/\bPro\b/);
  });
}

const ROI: Array<[string, { hours: string; light: string; quote: RegExp }]> = [
  ['/', { hours: '10 時間', light: '¥5,960', quote: /お見積り/ }],
  ['/en/', { hours: '10 hours', light: '¥5,960', quote: /quote/i }],
  ['/zh-tw/', { hours: '10 小時', light: '5,960 日圓', quote: /報價/ }],
];

for (const [path, t] of ROI) {
  test(`${path} の ROI 計算機は既定で Light、10 時間を超えると Enterprise のお見積りの案内になる`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const island = page.locator('[data-island="roi"]');
    const results = island.locator('dl');
    await expect(results).toContainText(t.hours);
    await expect(results).toContainText('Light');
    await expect(results).toContainText(t.light);

    await page.locator('#roi-videos').fill('6');
    await expect(results).toContainText('Enterprise');
    await expect(results).toContainText(t.quote);
    // 適合プランの行に金額が出ないこと (現状の年間コストの行は見ない)
    const plan = results.locator(':scope > div').nth(1);
    await expect(plan).toContainText('Enterprise');
    await expect(plan).not.toContainText(/\d{1,3}(?:,\d{3})+|¥|日圓/);

    await page.locator('#roi-videos').fill('5');
    await expect(results).toContainText('Light');
    await expect(results).toContainText(t.light);
  });
}

test('JS 無効の / では ROI の noscript の確定文 (¥5,960) が出る', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    // noscript の中身は textContent に出ないので innerText で見る
    await expect(page.locator('#roi')).toContainText('¥5,960', { useInnerText: true });
    // 見える金額は確定文の 1 つだけ (ほかの試算の金額を出さない)
    const amounts = (await page.locator('#roi').innerText()).match(/\d{1,3}(?:,\d{3})+/g) ?? [];
    expect([...new Set(amounts)]).toEqual(['5,960']);
  } finally {
    await context.close();
  }
});

test('/llms-full.txt の Enterprise はお見積りの見出しで、料金の節に Pro が無く金額は Light のものだけ', async ({ request }) => {
  const res = await request.get('/llms-full.txt');
  expect(res.ok()).toBe(true);
  const body = await res.text();
  expect(body.trimStart().toLowerCase().startsWith('<!doctype')).toBe(false);
  expect(body).toContain('### Enterprise — お見積り');
  expect(body).toContain('ご利用規模・運用形態に応じて個別にご案内します');
  const start = body.indexOf('## 4. 料金');
  expect(start).toBeGreaterThanOrEqual(0);
  const next = body.indexOf('\n## ', start + 1);
  const pricing = body.slice(start, next < 0 ? undefined : next);
  expect(pricing).toContain('### Light');
  expect(pricing).not.toMatch(/^### Pro\b/m);
  const amounts = pricing.match(AMOUNT) ?? [];
  expect(amounts.length).toBeGreaterThan(0);
  for (const a of amounts) expect(SHOWN_AMOUNTS).toContain(a);
});

test('/docs/#team に Enterprise プランの内容の一覧と導入相談のリンクがある', async ({ page }) => {
  await page.goto('/docs/', { waitUntil: 'domcontentloaded' });
  const team = page.locator('#team');
  await expect(team.locator('h3', { hasText: 'Enterprise プランの内容' })).toHaveCount(1);
  for (const s of [
    'お見積り',
    'ご利用規模・運用形態に応じて個別にご案内します',
    'アカウント数 × 20 時間をプール共有',
    'ご利用月ごとに請求書を発行',
    '請求書払い（銀行振込）',
    'API 利用・システム組み込み',
    'API 経由でのご利用や、御社のシステム・サービスへの組み込みをご希望の場合も、こちらからご相談ください。',
  ]) {
    await expect(team).toContainText(s);
  }
  await expect(team.locator('a[href="/enterprise/inquiry/"]', { hasText: '導入について相談する' })).toHaveCount(1);
  await expect(team).not.toContainText(/\d{1,3}(?:,\d{3})+/);
});
