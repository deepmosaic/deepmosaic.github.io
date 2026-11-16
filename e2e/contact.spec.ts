// 一般お問い合わせフォーム (/contact/) のブラウザ E2E。
//
// `/enterprise/inquiry/` と**同じ島・同じ Worker エンドポイント**を使い、`data-kind` だけが
// 違う。したがってここで固定するのは kind が効いていること:
//
//   - Jekyll の `data-kind="general"` が島の props まで届き、項目立てが切り替わる
//     (会社名・電話番号・利用アカウント予定数は出さない / 氏名・件名・
//     ご利用中のバージョンも無く、メールアドレスとお問い合わせ内容の 2 項目だけ)
//   - POST ボディが general の契約どおり (`kind: 'general'` + email + message + website。
//     受け付けない name / subject / appVersion は載せない — 受け口も受け取って無視する)
//   - 本文の上限 (4000) と必須項目の検証が DOM とフォーカスに現れる
//
// 応答ごとの文面 (429 / 502 / 完了カードの挙動) は kind に依らないので
// `e2e/inquiry.spec.ts` 側で固定している。共有の道具立ては `e2e/lib/inquiry-harness.ts`。
import { expect, test, type Page, type Route } from '@playwright/test';

import {
  blockExternalTraffic,
  CORS_HEADERS,
  doneCard,
  fillFields,
  inquiryForm,
  openInquiryPage,
  stubInquiryEndpoint,
  submitButton,
  type InquiryCall,
} from './lib/inquiry-harness';

const CONTACT_PATH = '/contact/';

/** general の本文の上限 (`src/lib/inquiry-validate.js` の `LIMITS.message` / Worker と同じ)。 */
const MESSAGE_MAX = 4000;

/** 正常系の入力。個々のテストは必要な項目だけ上書きする。 */
const VALID_INPUT = Object.freeze({
  email: 'taro.yamada@example.com',
  message: '4K の動画を書き出すと 80% 付近で止まります。',
});

/** general に無い項目。フォームに欄が無く、payload にも載らない。 */
const ABSENT_GENERAL_FIELDS = Object.freeze(['name', 'subject', 'appVersion']);

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

test('kind=general が島まで届き、メールアドレスとお問い合わせ内容だけを出す', async ({ page }) => {
  const { kind } = await openInquiryPage(page, CONTACT_PATH);

  expect(kind, 'data-kind が general でないと Enterprise の項目立てで描画される').toBe('general');
  for (const key of ['email', 'message']) {
    await expect(page.locator(`#inq-${key}`), `${key} が無い`).toHaveCount(1);
  }
  // companyUrl (会社の Web ページ) も Enterprise だけの任意項目
  for (const key of ['company', 'companyUrl', 'phone', 'seats']) {
    await expect(page.locator(`#inq-${key}`), `${key} は general には出さない`).toHaveCount(0);
  }
  for (const key of ABSENT_GENERAL_FIELDS) {
    await expect(page.locator(`#inq-${key}`), `${key} は general に無い項目`).toHaveCount(0);
  }

  // 導入相談 (Enterprise) への逃がし先は残す — 見積りの問い合わせがここで行き止まりにならない
  // (全ページ共通のヘッダーの「法人様はこちら」と、body 直下へ portal されるモバイルの
  //  ドロワーは数えない。ページ本文の section の中だけを見る)
  await expect(page.locator('section a[href="/enterprise/inquiry/"]')).toHaveCount(1);
});

test('未入力のまま送信すると、必須 2 項目のエラーが aria 属性つきで出て送信はされない', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await submitButton(page).click();

  await expect(page.locator('#inq-email-error')).toHaveText('メールアドレスを入力してください');
  await expect(page.locator('#inq-message-error')).toHaveText('お問い合わせ内容を入力してください');

  await expect(page.locator('#inq-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#inq-email')).toHaveAttribute(
    'aria-describedby',
    'inq-email-help inq-email-error',
  );
  await expect(page.locator('#inq-message')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#inq-message')).toHaveAttribute(
    'aria-describedby',
    'inq-message-error',
  );

  await expect(page.getByRole('alert')).toHaveText('入力内容をご確認ください。');
  // 最初の誤り (メールアドレス = general の先頭項目) にフォーカスが移る
  await expect(page.locator('#inq-email')).toBeFocused();

  expect(calls, '入力エラーのまま Worker を叩いてはいけない').toHaveLength(0);
});

test('お問い合わせ内容が 4000 文字を超えると上限を示して止まる', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  // maxlength を外した経路 (貼り付け / 自動入力) でも止まることを見る
  await fillForm(page);
  await page.locator('#inq-message').evaluate((el: HTMLTextAreaElement) => {
    el.removeAttribute('maxlength');
  });
  await page.locator('#inq-message').fill('あ'.repeat(MESSAGE_MAX + 1));
  await submitButton(page).click();

  await expect(page.locator('#inq-message-error')).toHaveText(
    `お問い合わせ内容は ${MESSAGE_MAX} 文字以内で入力してください`,
  );
  await expect(page.locator('#inq-message')).toBeFocused();
  expect(calls).toHaveLength(0);
});

test('送信 payload は general の契約どおりで、正規化済みの値を持つ', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await fillForm(page, { email: `  ${VALID_INPUT.email}  `, message: `\n${VALID_INPUT.message}\n` });
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  const call = calls[0] as InquiryCall;

  expect(call.method).toBe('POST');
  expect(call.contentType).toContain('application/json');
  expect(Object.keys(call.body).sort()).toEqual(['email', 'kind', 'message', 'website']);
  expect(call.body['kind'], 'kind が無いと Worker は Enterprise として検証する').toBe('general');
  expect(call.body['email'], '前後の空白は落として送る').toBe(VALID_INPUT.email);
  expect(call.body['message'], '本文の前後の改行・空白は落として送る').toBe(VALID_INPUT.message);
  expect(call.body['website'], '`website` 欄は空文字').toBe('');
  for (const key of ABSENT_GENERAL_FIELDS) {
    expect(call.body, `${key} は general に無い項目なので送らない`).not.toHaveProperty(key);
  }
  expect(call.body, 'general に電話番号・アカウント数は無い').not.toHaveProperty('phone');
  expect(call.body).not.toHaveProperty('seats');
  // turnstile_site_key が空の間はトークンを作れないので、キーごと載せない
  expect(call.body).not.toHaveProperty('turnstileToken');
});

test('`website` 欄が埋まっていれば、その値を payload に載せる', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  // 画面に出ない欄なので Playwright も force で触る
  await page.locator('#inq-website').fill('https://spam.example.com/', { force: true });
  await fillForm(page);
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.body['website'], '`website` 欄の値をそのまま送る').toBe(
    'https://spam.example.com/',
  );
});

test('このページに無い項目のエラーが返っても、Worker の文面を出して手詰まりにしない', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  // 受け口が古いと general の送信に「氏名を入力してください」や「会社名を…」が
  // 返ることがある (
  // 同じ形)。/contact/ に氏名の欄は無いので、項目ごとの赤字に入れるとどこにも出ないまま
  // 「入力内容をご確認ください。」だけが残る。
  await stubInquiryEndpoint(page, endpoint, {
    status: 400,
    body: { ok: false, code: 'invalid_input', field: 'name', message: '氏名を入力してください' },
  });

  await fillForm(page);
  await submitButton(page).click();

  await expect(page.getByRole('alert')).toHaveText('氏名を入力してください');
  await expect(inquiryForm(page), 'やり直せるようフォームは出したまま').toBeVisible();
  await expect(page.locator('#inq-message'), '入力は消さない').toHaveValue(VALID_INPUT.message);
});

test('200 {ok:true} で完了カードが出て、閉じると空のフォームに戻る', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true, mail: true } });

  await fillForm(page);
  await submitButton(page).click();

  const done = doneCard(page);
  await expect(done).toBeVisible();
  await expect(done.getByRole('heading', { name: '送信完了' })).toBeVisible();
  await expect(done).toContainText('3 営業日以内に担当者よりご返答いたします');
  await expect(inquiryForm(page)).toBeHidden();
  await expect(done).toBeFocused();

  await done.getByRole('button', { name: '閉じる' }).click();

  await expect(done).toHaveCount(0);
  await expect(page.locator('#inq-email')).toHaveValue('');
  await expect(page.locator('#inq-message')).toHaveValue('');
  // general の先頭項目はメールアドレス (Enterprise の会社名でも、氏名でもない)
  await expect(page.locator('#inq-email')).toBeFocused();
});

test.describe('送信ボタンのカーソル', () => {
  test('有効な送信ボタンは指の形のカーソルで、送信中 (disabled) は指の形にしない', async ({ page }) => {
    const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
    const button = submitButton(page);
    const cursorOf = () => button.evaluate((el) => getComputedStyle(el).cursor);
    expect(await cursorOf()).toBe('pointer');

    // 応答を止めて、送信中 (disabled) の状態を作る
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(endpoint, async (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { ...CORS_HEADERS }, body: '' });
        return;
      }
      await held;
      await route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true }),
      });
    });

    await fillForm(page);
    await button.click();
    await expect(button).toBeDisabled();
    expect(await cursorOf()).not.toBe('pointer');

    release();
    await expect(doneCard(page)).toBeVisible();
  });
});
