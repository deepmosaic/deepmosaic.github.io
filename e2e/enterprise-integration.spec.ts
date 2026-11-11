// Enterprise の「御社システムへの導入 (組み込み)」の相談 (T-1941) のビルド出力の E2E。
//
// ## 何を守るのか
//
// - `/price/` とトップの PRICING 節の ENTERPRISE カードに、`_data/plans.yml` の `note`
//   (導入の相談・別途お見積り) が出ていること。同じカードに導入相談の CTA
//   (`href="/enterprise/inquiry/"`) と「維持管理費用」の注記が残っていること
//   (`.github/workflows/jekyll.yml` の grep と同じ固定を、カード単位で見る)。
// - トップの「組織で使う（Enterprise）」カードにも同じ趣旨の 1 文があること。
// - 導入相談ページのリード文に「自社システムへの導入のご相談」があること。
//
// 文言そのものの細かい検査 (提供していない機能の具体名を出さない など) は
// `src/lib/site-copy-t1941.test.js` が見る。ここは Liquid → HTML の継ぎ目だけを確かめる。
import { test, expect, type Locator, type Page } from '@playwright/test';

const CARD_NOTE = '御社のシステム・サービスへの導入（組み込み）もご相談ください。内容に応じて別途お見積りします。';
const INQUIRY_HREF = '/enterprise/inquiry/';

/** 料金カードのうち見出しが ENTERPRISE のもの。 */
function enterprisePricingCard(page: Page): Locator {
  return page
    .locator('.plan-card, .plan-card-featured')
    .filter({ has: page.locator('h3', { hasText: /^ENTERPRISE$/ }) });
}

async function expectEnterprisePricingCard(page: Page): Promise<void> {
  const card = enterprisePricingCard(page);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(CARD_NOTE);
  await expect(card).toContainText('維持管理費用');
  await expect(card.locator(`a[href="${INQUIRY_HREF}"]`)).toHaveText('導入について相談する');
}

for (const path of ['/price/', '/']) {
  test(`${path} の ENTERPRISE 料金カードに導入の相談・維持管理費用・相談の CTA がある`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expectEnterprisePricingCard(page);
  });
}

test('トップの「組織で使う（Enterprise）」カードに導入の相談の 1 文と相談リンクがある', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.card').filter({ has: page.locator('h3', { hasText: '組織で使う（Enterprise）' }) });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('御社のシステム・サービスへの導入（組み込み）もご相談ください');
  await expect(card).toContainText('別途お見積り');
  await expect(card.locator(`a[href="${INQUIRY_HREF}"]`)).toHaveCount(1);
});

test('導入相談ページのリード文に自社システムへの導入のご相談がある', async ({ page }) => {
  await page.goto(INQUIRY_HREF, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1 + p')).toContainText('自社システムへの導入のご相談');
});
