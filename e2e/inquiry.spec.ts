// Enterprise 導入相談フォームのブラウザ E2E (T-286)。
//
// `src/lib/inquiry-validate.test.js` (node --test) が検証しているのは**純ロジック**だけ。
// ここで固定するのは、そのロジックが**実際の DOM と fetch に繋がっていること**:
//
//   - Jekyll の `data-endpoint` / `data-support-email` が島の props まで届いている
//   - 検証エラーが `aria-invalid` / `aria-describedby` / フォーカスとして現れる
//   - 全角で打った電話番号が **送信時に** 半角へ変換されている
//   - Worker の応答 (200 / 429 / 502) ごとに出る文面と、完了カードのフォーカス移動
//   - ハニーポット `website` が payload に載る (Worker が bot を判定できる)
//   - POST ボディの形が Worker の契約どおり (enterprise は `kind` を載せない)
//
// 一般のお問い合わせ (`/contact/`, kind=general) は `e2e/contact.spec.ts`。
// 共有の道具立て (外部通信の遮断 / endpoint の差し替え / locator) は
// `e2e/lib/inquiry-harness.ts` にある。
import { expect, test, type Page } from '@playwright/test';

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

const INQUIRY_PATH = '/enterprise/inquiry/';

/** 正常系の入力。個々のテストは必要な項目だけ上書きする。 */
const VALID_INPUT = Object.freeze({
  company: 'デモ映像制作株式会社',
  name: '山田 太郎',
  email: 'taro.yamada@example.com',
  phone: '03-1234-5678',
  seats: '12',
  message: '導入時期と請求書払いについて相談したいです。',
});

type FieldKey = keyof typeof VALID_INPUT;

async function fillForm(
  page: Page,
  overrides: Partial<Record<FieldKey, string>> = {},
): Promise<void> {
  await fillFields(page, { ...VALID_INPUT, ...overrides });
}

test.beforeEach(async ({ page, baseURL }) => {
  await blockExternalTraffic(page, baseURL as string);
});

test('未入力のまま送信すると、項目ごとのエラーが aria 属性つきで出て送信はされない', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await submitButton(page).click();

  // 必須 4 項目にそれぞれの文面が出る
  await expect(page.locator('#inq-company-error')).toHaveText('会社名を入力してください');
  await expect(page.locator('#inq-name-error')).toHaveText('氏名を入力してください');
  await expect(page.locator('#inq-email-error')).toHaveText('メールアドレスを入力してください');
  await expect(page.locator('#inq-phone-error')).toHaveText(
    '電話番号は 5 文字以上で入力してください',
  );

  // 支援技術に伝わる形になっていること。help がある項目は help と error の両方を指す
  await expect(page.locator('#inq-company')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#inq-company')).toHaveAttribute(
    'aria-describedby',
    'inq-company-error',
  );
  await expect(page.locator('#inq-email')).toHaveAttribute(
    'aria-describedby',
    'inq-email-help inq-email-error',
  );

  // 既定値 (3) の seats は誤りではないので赤くしない
  await expect(page.locator('#inq-seats-error')).toHaveCount(0);
  await expect(page.locator('#inq-seats')).not.toHaveAttribute('aria-invalid', 'true');

  await expect(page.getByRole('alert')).toHaveText('入力内容をご確認ください。');
  // 最初の誤り (会社名) にフォーカスが移る
  await expect(page.locator('#inq-company')).toBeFocused();

  expect(calls, '入力エラーのまま Worker を叩いてはいけない').toHaveLength(0);
});

test('全角で入力した電話番号は半角に直してから送信される', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, {
    status: 200,
    body: { ok: true, mail: true },
  });

  // 全角数字・全角括弧・全角ハイフン・全角空白がすべて混ざった、IME で実際に出る形
  await fillForm(page, { phone: '（０３）１２３４－５６７８　' });
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.body['phone']).toBe('(03)1234-5678');
});

test('利用アカウント予定数が 3 未満だと Enterprise の下限を示して止まる', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await fillForm(page, { seats: '2' });
  await submitButton(page).click();

  await expect(page.locator('#inq-seats-error')).toHaveText(
    '利用アカウント予定数は 3 以上で入力してください (Enterprise は 3 アカウントから)',
  );
  await expect(page.locator('#inq-seats')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#inq-seats')).toHaveAttribute(
    'aria-describedby',
    'inq-seats-help inq-seats-error',
  );
  await expect(page.locator('#inq-seats')).toBeFocused();
  expect(calls).toHaveLength(0);
});

test('200 {ok:true, mail:true} で完了カードが出てフォーカスが移り、閉じると空のフォームに戻る', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true, mail: true } });

  await fillForm(page);
  await submitButton(page).click();

  const done = doneCard(page);
  await expect(done).toBeVisible();
  await expect(done.getByRole('heading', { name: '送信完了' })).toBeVisible();
  await expect(done).toContainText('3 営業日以内に担当者よりご返答いたします');
  await expect(done).toContainText('受付確認メールをお送りしました');
  // 完了は見失わせない: フォームは隠れ、フォーカスは完了カードへ移る
  await expect(inquiryForm(page)).toBeHidden();
  await expect(done).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('お問い合わせを受け付けました。');

  await done.getByRole('button', { name: '閉じる' }).click();

  await expect(done).toHaveCount(0);
  await expect(page.locator('#inq-company')).toBeVisible();
  await expect(page.locator('#inq-company')).toHaveValue('');
  await expect(page.locator('#inq-message')).toHaveValue('');
  await expect(page.locator('#inq-company')).toBeFocused();
});

test('200 {ok:true} だけ (mail なし) のときは受付確認メールの案内を出さない', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await fillForm(page);
  await submitButton(page).click();

  const done = doneCard(page);
  await expect(done).toBeVisible();
  await expect(done).not.toContainText('受付確認メール');
});

test('429 はレート制限として案内し、フォームの入力は残す', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  await stubInquiryEndpoint(page, endpoint, {
    status: 429,
    body: { ok: false, code: 'rate_limited' },
  });

  await fillForm(page);
  await submitButton(page).click();

  await expect(page.getByRole('alert')).toHaveText(
    '送信回数の上限に達しました。しばらく時間をおいて再度お試しください。',
  );
  await expect(doneCard(page)).toHaveCount(0);
  // 再送できる状態に戻っていること (入力は消えない)
  await expect(submitButton(page)).toBeEnabled();
  await expect(page.locator('#inq-company')).toHaveValue(VALID_INPUT.company);
});

test('502 は support_email を添えた案内を出す', async ({ page }) => {
  const { endpoint, supportEmail } = await openInquiryPage(page, INQUIRY_PATH);
  await stubInquiryEndpoint(page, endpoint, {
    status: 502,
    body: { ok: false, code: 'delivery_failed' },
  });

  await fillForm(page);
  await submitButton(page).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('お問い合わせを受け付けられませんでした');
  await expect(alert).toContainText(supportEmail);
  await expect(doneCard(page)).toHaveCount(0);
});

test('ハニーポット website に値が入っていても送信され、その値が payload に載る', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, INQUIRY_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  // bot が全項目を埋めた状況。人には見えないので Playwright も force で触る
  await page.locator('#inq-website').fill('https://spam.example.com/', { force: true });
  await fillForm(page);
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.body['website'], 'ハニーポットを送らないと Worker が bot を判定できない').toBe(
    'https://spam.example.com/',
  );
});

test('送信 payload は Worker の契約どおりの形で、正規化済みの値を持つ', async ({ page }) => {
  const { endpoint, kind } = await openInquiryPage(page, INQUIRY_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  expect(kind, 'このページは Enterprise 導入相談 (T-332 で /contact/ と分かれた)').toBe('enterprise');

  await fillForm(page, { company: '  デモ映像制作株式会社  ', seats: '12' });
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  const call = calls[0] as InquiryCall;

  expect(call.method).toBe('POST');
  expect(call.contentType).toContain('application/json');
  expect(Object.keys(call.body).sort()).toEqual([
    'company',
    'email',
    'message',
    'name',
    'phone',
    'seats',
    'website',
  ]);
  expect(call.body['company'], '前後の空白は落として送る').toBe('デモ映像制作株式会社');
  expect(call.body['name']).toBe(VALID_INPUT.name);
  expect(call.body['email']).toBe(VALID_INPUT.email);
  expect(call.body['phone']).toBe(VALID_INPUT.phone);
  expect(call.body['seats'], 'seats は文字列ではなく整数').toBe(12);
  expect(call.body['message']).toBe(VALID_INPUT.message);
  expect(call.body['website'], '人が触らないハニーポットは空文字').toBe('');
  // **enterprise は kind を載せない** (Worker の既定 = 旧サイト互換、T-331 / T-332)
  expect(call.body).not.toHaveProperty('kind');
  // turnstile_site_key が空の間はトークンを作れないので、キーごと載せない
  expect(call.body).not.toHaveProperty('turnstileToken');
});
