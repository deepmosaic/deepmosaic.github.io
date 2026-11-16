// Enterprise の料金カード (お見積りのカード) と導入の相談のビルド出力の E2E。
//
// ## 何を守るのか
//
// - `/price/`・トップの PRICING 節・英中の `/price/` の ENTERPRISE カードが「お見積り」のカードであること
//   (`_data/plans.yml` の `quote_label` / `quote_note` / `note_title` / `note`)。金額 (桁区切りの数・通貨の記号)・
//   アカウント単位の価格 (`/ アカウント`)・維持管理費用の字が出ないこと。導入相談の CTA が 1 本あること
//   (`.github/workflows/jekyll.yml` の grep と同じ固定を、カード単位・3 言語で見る)。
// - Pro は public: false: 料金カードに PRO の見出しが無く、LIGHT が featured のカード。`/subscribe/` に Pro が無い。
// - トップの「組織で使う（Enterprise）」カードにも導入の相談の 1 文があること (API 等は書かない)。
// - 導入相談ページのリード文に「御社のシステム・サービスへの導入のご相談」があること (「自社」ではない)。
//
// 文言そのものの細かい検査は `src/lib/site-copy-pricing-cards.test.js` と `src/lib/site-copy-enterprise-integration.test.js` が見る。
// ここは Liquid → HTML の継ぎ目だけを確かめる。
import { test, expect, type Locator, type Page } from '@playwright/test';

const INQUIRY_HREF = '/enterprise/inquiry/';

type CardText = {
  prefix: string;
  quoteLabel: string;
  quoteNote: string;
  noteTitle: string;
  note: string;
  cta: string;
  forbidden: Array<string | RegExp>;
};

/** 金額 (桁区切りの数) と通貨の記号 */
const COMMON_FORBIDDEN: RegExp[] = [/\d{1,3}(?:,\d{3})+/, /¥|日圓/];

const CARD_TEXT: Record<'ja' | 'en' | 'zh-tw', CardText> = {
  ja: {
    prefix: '',
    quoteLabel: 'お見積り',
    quoteNote: 'ご利用規模・運用形態に応じて個別にご案内します',
    noteTitle: 'API 利用・システム組み込み',
    note: 'API 経由でのご利用や、御社のシステム・サービスへの組み込みをご希望の場合も、こちらからご相談ください。',
    cta: '導入について相談する',
    forbidden: [...COMMON_FORBIDDEN, '維持管理費用', '/ アカウント', '税別'],
  },
  en: {
    prefix: '/en',
    quoteLabel: 'Custom quote',
    quoteNote: 'We will guide you individually based on your scale of use and how you operate',
    noteTitle: 'API use and system integration',
    note: "If you would like to use it via an API or integrate it into your company's systems and services, please contact us here as well.",
    cta: 'Talk to us about getting started',
    forbidden: [...COMMON_FORBIDDEN, 'maintenance', '/ account / month', 'excl. tax'],
  },
  'zh-tw': {
    prefix: '/zh-tw',
    quoteLabel: '個別報價',
    quoteNote: '將依使用規模與運用方式個別說明',
    noteTitle: 'API 使用與系統整合',
    note: '若希望透過 API 使用，或整合至貴公司的系統與服務，也請由此洽詢。',
    cta: '洽詢導入事宜',
    forbidden: [...COMMON_FORBIDDEN, '維護管理', '/ 帳號 / 月', '未稅'],
  },
};

/** 料金カードのうち見出しが name のもの。 */
function pricingCard(page: Page, name: RegExp): Locator {
  return page.locator('.plan-card, .plan-card-featured').filter({ has: page.locator('h3', { hasText: name }) });
}

async function expectEnterpriseQuoteCard(page: Page, t: CardText): Promise<void> {
  const card = pricingCard(page, /^ENTERPRISE$/);
  await expect(card).toHaveCount(1);
  for (const text of [t.quoteLabel, t.quoteNote, t.noteTitle, t.note]) {
    await expect(card).toContainText(text);
  }
  for (const text of t.forbidden) {
    await expect(card).not.toContainText(text);
  }
  const cta = card.locator(`a[href$="${INQUIRY_HREF}"]`);
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveAttribute('href', `${t.prefix}${INQUIRY_HREF}`);
  await expect(cta).toHaveText(t.cta);
}

async function expectProHiddenAndLightFeatured(page: Page): Promise<void> {
  await expect(pricingCard(page, /^PRO$/)).toHaveCount(0);
  await expect(page.locator('.plan-card-featured').filter({ has: page.locator('h3', { hasText: /^LIGHT$/ }) })).toHaveCount(1);
}

const PRICING_PAGES: Array<[string, CardText]> = [
  ['/price/', CARD_TEXT.ja],
  ['/', CARD_TEXT.ja],
  ['/en/price/', CARD_TEXT.en],
  ['/zh-tw/price/', CARD_TEXT['zh-tw']],
];

for (const [path, t] of PRICING_PAGES) {
  test(`${path} の ENTERPRISE 料金カードはお見積りのカードで、単価・維持管理費用が無く、相談の CTA がある`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expectEnterpriseQuoteCard(page, t);
  });

  test(`${path} の料金カードに PRO が無く、LIGHT が featured`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expectProHiddenAndLightFeatured(page);
  });
}

for (const path of ['/subscribe/', '/en/subscribe/', '/zh-tw/subscribe/']) {
  test(`${path} に Pro の申し込みが無く、Light のボタンは主ボタン`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#plan-pro')).toHaveCount(0);
    await expect(page.locator('a[href*="checkout=pro"]')).toHaveCount(0);
    await expect(page.locator('#plan-light a[href*="checkout=light"]')).toHaveClass(/btn-primary/);
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

test('導入相談ページのリード文に御社のシステム・サービスへの導入のご相談がある', async ({ page }) => {
  await page.goto(INQUIRY_HREF, { waitUntil: 'domcontentloaded' });
  const lead = page.locator('h1 + p');
  await expect(lead).toContainText('御社のシステム・サービスへの導入のご相談');
  await expect(lead).not.toContainText('自社');
});
