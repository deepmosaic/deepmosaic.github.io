// T-2210 (i18n1112 I18N-712): 英中のお問い合わせ・導入相談・組織への参加・404 の E2E。
//
// **チケットでは回さない**。ウェーブ末尾にリーダーが既存の spec と一緒に回す:
//   npx playwright test e2e/i18n-contact.spec.ts e2e/contact.spec.ts e2e/inquiry.spec.ts e2e/join.spec.ts
//
// ## 何を守るのか
//
// - (a) /en/contact/・/zh-tw/contact/: 未入力の送信で必須の 2 項目のエラーが英中の文で aria-invalid 付きで出て、送信されない。
// - (b) 正しい入力: スタブの 200 で完了カードが英中の文 (確認メールが日本語の注記を含む)。payload は ja のページと同じ形 (言語の欄が無い)。
// - (c) 429 の文が英中。
// - (d) /en/enterprise/inquiry/: 電話番号が必須 (規則は ja と同じ。空のときは ja と同じく「最低 5 文字」の文になる = inquiry-validate.js)。
// - (e) /en/join/#code=…: code の表示とコピーの英文、計測のリクエストが出ない。
// - (g)(h) /join/ の言語の切り替えで #code= / #admin を引き継ぐ (ウェーブ末尾の追い修正)。
// - (f) 存在しない /en/nope/ を開くと /en/404.html に移り英文が出る (e2e/lib/serve.mjs は 404 にルートの 404.html を返す =
//       GitHub Pages と同じ。その中の印 data-lang-404 を src/main.js が見て移す)。
//
// 文の期待値は src/lib/inquiry-validate.js (MESSAGES / LABELS)・src/islands/InquiryForm.svelte (TEXT)・src/main.js (COPY_TEXT) の英中の値。
// 外部通信は e2e/lib/inquiry-harness.ts の blockExternalTraffic で止める (本物の Worker を叩かない)。
import { expect, test } from '@playwright/test';

import {
  blockExternalTraffic,
  doneCard,
  fillFields,
  inquiryForm,
  openInquiryPage,
  stubInquiryEndpoint,
  submitButton,
  type InquiryCall,
} from './lib/inquiry-harness';

/** 言語ごとの期待値 */
const TEXT = {
  en: {
    path: '/en/contact/',
    emailRequired: 'Enter your email address.',
    messageRequired: 'Enter your message.',
    checkInput: 'Check your entries.',
    doneTitle: 'Submitted',
    mailJaNote: 'The confirmation email is in Japanese.',
    pageMailNote: 'The confirmation email and our reply will be in Japanese.',
    rateLimited: "You've reached the sending limit. Wait a while and try again.",
  },
  'zh-tw': {
    path: '/zh-tw/contact/',
    emailRequired: '請輸入電子郵件地址。',
    messageRequired: '請輸入詢問內容。',
    checkInput: '請確認輸入的內容。',
    doneTitle: '已送出',
    mailJaNote: '確認電子郵件為日文。',
    pageMailNote: '確認電子郵件與回覆將以日文寄送。',
    rateLimited: '已達送出次數上限。請稍後再試。',
  },
} as const;

/** 正常系の入力 (general)。contact.spec.ts と同じ値 */
const VALID_GENERAL = Object.freeze({
  email: 'taro.yamada@example.com',
  message: 'Export stops at around 80% for 4K videos.',
});

/** 正常系の入力 (enterprise)。inquiry.spec.ts と同じ形 */
const VALID_ENTERPRISE = Object.freeze({
  company: 'Demo Video Production Inc.',
  name: 'Taro Yamada',
  email: 'taro.yamada@example.com',
  phone: '03-1234-5678',
  seats: '12',
  message: 'We would like to discuss when to start and paying by invoice.',
});

test.describe('お問い合わせ (英中)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await blockExternalTraffic(page, baseURL as string);
  });

  for (const [lang, t] of Object.entries(TEXT)) {
    test(`(a) ${t.path}: 未入力の送信で必須 2 項目のエラーが ${lang} の文で出て、送信されない`, async ({ page }) => {
      const { endpoint, kind } = await openInquiryPage(page, t.path);
      expect(kind).toBe('general');
      const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });
      await expect(page.getByText(t.pageMailNote)).toBeVisible();

      await submitButton(page).click();

      await expect(page.locator('#inq-email-error')).toHaveText(t.emailRequired);
      await expect(page.locator('#inq-message-error')).toHaveText(t.messageRequired);
      await expect(page.locator('#inq-email')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.locator('#inq-message')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toHaveText(t.checkInput);
      await expect(page.locator('#inq-email')).toBeFocused();
      expect(calls, '入力エラーのまま Worker を叩いてはいけない').toHaveLength(0);
    });

    test(`(b) ${t.path}: 200 で完了カードが ${lang} の文、payload は ja と同じ形 (言語の欄が無い)`, async ({ page }) => {
      const { endpoint } = await openInquiryPage(page, t.path);
      const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true, mail: true } });

      await fillFields(page, VALID_GENERAL);
      await submitButton(page).click();

      const done = doneCard(page);
      await expect(done).toBeVisible();
      await expect(done.getByRole('heading', { name: t.doneTitle })).toBeVisible();
      await expect(done).toContainText(t.mailJaNote);
      await expect(inquiryForm(page)).toBeHidden();

      expect(calls).toHaveLength(1);
      const call = calls[0] as InquiryCall;
      // contact.spec.ts (ja) と同じ鍵の集合。言語を送らない (COMMON §9)
      expect(Object.keys(call.body).sort()).toEqual(['email', 'kind', 'message', 'website']);
      expect(call.body['kind']).toBe('general');
      expect(call.body['email']).toBe(VALID_GENERAL.email);
      expect(call.body['message']).toBe(VALID_GENERAL.message);
    });

    test(`(c) ${t.path}: 429 の文が ${lang}`, async ({ page }) => {
      const { endpoint } = await openInquiryPage(page, t.path);
      await stubInquiryEndpoint(page, endpoint, { status: 429, body: { ok: false, code: 'rate_limited' } });

      await fillFields(page, VALID_GENERAL);
      await submitButton(page).click();

      await expect(page.getByRole('alert')).toHaveText(t.rateLimited);
      await expect(doneCard(page)).toHaveCount(0);
      await expect(submitButton(page)).toBeEnabled();
      await expect(page.locator('#inq-message')).toHaveValue(VALID_GENERAL.message);
    });
  }

  test('(d) /en/enterprise/inquiry/: 電話番号が必須 (ja と同じ規則)', async ({ page }) => {
    const { endpoint, kind } = await openInquiryPage(page, '/en/enterprise/inquiry/');
    expect(kind).toBe('enterprise');
    const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });
    await expect(page.getByText(TEXT.en.pageMailNote)).toBeVisible();

    await fillFields(page, { ...VALID_ENTERPRISE, phone: '' });
    await submitButton(page).click();

    await expect(page.locator('#inq-phone-error')).toHaveText('Enter at least 5 characters for your phone number.');
    await expect(page.locator('#inq-phone')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#inq-phone')).toBeFocused();
    expect(calls).toHaveLength(0);
  });
});

test.describe('組織への参加 (英語)', () => {
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

  test('(e) /en/join/#code=: code の表示とコピーの英文、計測のリクエストが出ない', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL!).origin });
    await page.goto('/en/join/#code=ABCD-EFGH-JKLM', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { level: 1, name: 'Open Deepmosaic' })).toBeVisible();

    const view = page.locator('[data-join-view="code"]');
    await expect(view).toBeVisible();
    await expect(page.locator('[data-join-view="admin"]')).toBeHidden();
    await expect(page.locator('[data-join-view="invalid"]')).toBeHidden();
    await expect(view).toContainText('Open the app with the organization code ABCD-EFGH-JKLM.');
    await expect(page.locator('[data-join-open-code]')).toHaveAttribute('href', 'deepmosaic://join?code=ABCD-EFGH-JKLM');
    await expect(page.locator('[data-join-open-code]')).toHaveText('Open in app');

    await view.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('[data-join-copy-status]')).toHaveText('Copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ABCD-EFGH-JKLM');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect(externalRequests, '計測・第三者へのリクエストを出さない').toEqual([]);
  });
});

// ウェーブ末尾の追い修正 (T-2210): /join/ で言語を切り替えても組織コード (フラグメント) が残る。
// フッターの切り替え (幅によらず見える) を押す。フラグメントはサーバーへ送られない (行き先の URL の # 以降)。
test.describe('組織への参加: 言語の切り替えでフラグメントを引き継ぐ', () => {
  test('(g) /join/#code=… → English → /en/join/#code=… でコードが残る', async ({ page }) => {
    await page.goto('/join/#code=ABCD-EFGH-JKLM', { waitUntil: 'load' });
    await expect(page.locator('[data-join-view="code"]')).toBeVisible();
    const en = page.locator('footer [data-i18n-switch] a[hreflang="en"]');
    await expect(en).toHaveAttribute('href', '/en/join/#code=ABCD-EFGH-JKLM');
    await en.click();
    await expect(page).toHaveURL(/\/en\/join\/#code=ABCD-EFGH-JKLM$/);
    await expect(page.locator('[data-join-view="code"]')).toBeVisible();
    await expect(page.locator('[data-join-view="invalid"]')).toBeHidden();
    await expect(page.locator('[data-join-open-code]')).toHaveAttribute('href', 'deepmosaic://join?code=ABCD-EFGH-JKLM');
  });

  test('(h) /en/join/#admin → 繁體中文 → /zh-tw/join/#admin、不正なフラグメントは引き継がない', async ({ page }) => {
    await page.goto('/en/join/#admin', { waitUntil: 'load' });
    const zh = page.locator('footer [data-i18n-switch] a[hreflang="zh-Hant-TW"]');
    await expect(zh).toHaveAttribute('href', '/zh-tw/join/#admin');
    await zh.click();
    await expect(page).toHaveURL(/\/zh-tw\/join\/#admin$/);
    await expect(page.locator('[data-join-view="admin"]')).toBeVisible();

    await page.goto('/join/#code=<b>x</b>', { waitUntil: 'load' });
    await expect(page.locator('footer [data-i18n-switch] a[hreflang="en"]')).toHaveAttribute('href', '/en/join/');
  });
});

test('(f) 存在しない /en/nope/ を開くと /en/404.html に移り英文が出る', async ({ page }) => {
  const res = await page.goto('/en/nope/');
  expect(res?.status(), '配信は 404 でルートの 404.html を返す (GitHub Pages と同じ)').toBe(404);
  await page.waitForURL('**/en/404.html');
  await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
  await expect(page.getByText('The page you are looking for could not be found.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
