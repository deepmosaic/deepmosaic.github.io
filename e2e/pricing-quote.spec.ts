// 料金の文 (Pro・お見積り)・Enterprise の詳細のビルド出力の E2E。
//
// ## 何を守るのか
//
// - SoftwareApplication の JSON-LD の AggregateOffer はお見積りの Enterprise を外す (lowPrice 0・highPrice = Hobby・offerCount 2)。
// - FAQ (表示と FAQPage の JSON-LD) は利用枠を使い切ったら次の更新日に戻ることを案内し、追加の契約と Pro の句が無い。
// - /price/・/subscribe/ と英中の meta description の金額は Hobby の価格・税込額だけ。
// - ROI 計算機の既定は月 10 時間で、Hobby の込み時間 (月 5 時間) を超えるので Enterprise (お見積り) の案内を出す。
//   月 5 時間以内に減らすと Hobby (¥2,980) になる。JS 無効では noscript の確定文 (¥2,980) が出る。
// - llms-full.txt の Enterprise は「お見積り」の見出しで、料金の節の金額は Hobby の価格・税込額だけ。
// - /docs/#team に「Enterprise プランの内容」の一覧がある。
//
// 文言・データの細かい検査は `src/lib/site-copy-pricing-text.test.js`。ここは Liquid / 島 → HTML の継ぎ目だけを見る。
import { test, expect, type Page } from '@playwright/test';

/** 画面に出している有料プランの金額 (Hobby の価格・税込額) */
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

const FAQ_RENEWAL: Array<[string, string, string[]]> = [
  ['/', '次の更新日に利用枠が戻ります', ['Pro は最大', '追加でご契約', 'Light']],
  ['/en/', 'restored on the next renewal date', ['Pro: up to', 'add more subscriptions', 'Light']],
  ['/zh-tw/', '下次續訂日恢復', ['Pro 最多', '追加訂閱', 'Light']],
];

for (const [path, renewal, forbidden] of FAQ_RENEWAL) {
  test(`${path} の FAQ (表示と FAQPage) は次の更新日を案内し、追加の契約と Pro の句が無い`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const faq = page.locator('#faq');
    await expect(faq).toContainText(renewal);
    const pages = await jsonLdOf(page, 'FAQPage');
    expect(pages).toHaveLength(1);
    expect(pages[0].raw).toContain(renewal);
    for (const s of forbidden) {
      await expect(faq).not.toContainText(s);
      expect(pages[0].raw).not.toContain(s);
    }
  });
}

for (const path of ['/price/', '/subscribe/', '/en/price/', '/en/subscribe/', '/zh-tw/price/', '/zh-tw/subscribe/']) {
  test(`${path} の meta description の金額は Hobby の価格・税込額だけで、Pro が無い`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const desc = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(desc).not.toBe('');
    for (const a of desc.match(AMOUNT) ?? []) expect(SHOWN_AMOUNTS).toContain(a);
    expect(desc).not.toMatch(/\bPro\b/);
  });
}

const ROI: Array<[string, { hours: string; hobbyHours: string; hobby: string; quote: RegExp }]> = [
  ['/', { hours: '10 時間', hobbyHours: '4 時間', hobby: '¥2,980', quote: /お見積り/ }],
  ['/en/', { hours: '10 hours', hobbyHours: '4 hours', hobby: '¥2,980', quote: /quote/i }],
  ['/zh-tw/', { hours: '10 小時', hobbyHours: '4 小時', hobby: '2,980 日圓', quote: /報價/ }],
];

for (const [path, t] of ROI) {
  test(`${path} の ROI 計算機は既定 (月 10 時間) で Enterprise のお見積りの案内、Hobby の込み時間以内なら Hobby になる`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const island = page.locator('[data-island="roi"]');
    const results = island.locator('dl');
    // 適合プランの行に金額が出ないこと (現状の年間コストの行は見ない)
    const plan = results.locator(':scope > div').nth(1);
    await expect(results).toContainText(t.hours);
    await expect(plan).toContainText('Enterprise');
    await expect(results).toContainText(t.quote);
    await expect(plan).not.toContainText(/\d{1,3}(?:,\d{3})+|¥|日圓/);
    await expect(results).not.toContainText('Light');

    // 月 2 本 × 2 時間 = 月 4 時間は Hobby の込み時間 (月 5 時間) に収まる
    await page.locator('#roi-videos').fill('2');
    await expect(results).toContainText(t.hobbyHours);
    await expect(plan).toContainText('Hobby');
    await expect(plan).toContainText(t.hobby);

    await page.locator('#roi-videos').fill('5');
    await expect(plan).toContainText('Enterprise');
  });
}

test('JS 無効の / では ROI の noscript の確定文 (Hobby の ¥2,980 とお見積りの案内) が出る', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    // noscript の中身は textContent に出ないので innerText で見る
    await expect(page.locator('#roi')).toContainText('¥2,980', { useInnerText: true });
    await expect(page.locator('#roi')).toContainText('Enterprise（お見積り）', { useInnerText: true });
    // 見える金額は確定文の 1 つだけ (ほかの試算の金額を出さない)
    const amounts = (await page.locator('#roi').innerText()).match(/\d{1,3}(?:,\d{3})+/g) ?? [];
    expect([...new Set(amounts)]).toEqual(['2,980']);
  } finally {
    await context.close();
  }
});

test('/llms-full.txt の Enterprise はお見積りの見出しで、料金の節に Pro が無く金額は Hobby のものだけ', async ({ request }) => {
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
  expect(pricing).toContain('### Hobby');
  expect(pricing).not.toContain('Light');
  expect(pricing).not.toContain('追加契約');
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
