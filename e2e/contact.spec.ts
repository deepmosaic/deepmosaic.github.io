// 一般お問い合わせフォーム (/contact/) のブラウザ E2E (T-332)。
//
// `/enterprise/inquiry/` と**同じ島・同じ Worker エンドポイント**を使い、`data-kind` だけが
// 違う。したがってここで固定するのは kind が効いていること:
//
//   - Jekyll の `data-kind="general"` が島の props まで届き、項目立てが切り替わる
//     (会社名・電話番号・利用アカウント予定数は出さない / 件名とバージョンを出す)
//   - POST ボディが general の契約どおり (`kind: 'general'`、phone / seats 無し、
//     任意の `appVersion` は空なら載せない)
//   - 件名の上限 (100) と必須項目の検証が DOM とフォーカスに現れる
//
// 応答ごとの文面 (429 / 502 / 完了カードの挙動) は kind に依らないので
// `e2e/inquiry.spec.ts` 側で固定している。共有の道具立ては `e2e/lib/inquiry-harness.ts`。
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

const CONTACT_PATH = '/contact/';

/** 正常系の入力。個々のテストは必要な項目だけ上書きする。 */
const VALID_INPUT = Object.freeze({
  name: '山田 太郎',
  email: 'taro.yamada@example.com',
  subject: '書き出しが途中で止まる',
  message: '4K の動画を書き出すと 80% 付近で止まります。',
  appVersion: '2.3.7',
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

test('kind=general が島まで届き、Enterprise 専用の項目は出さない', async ({ page }) => {
  const { kind } = await openInquiryPage(page, CONTACT_PATH);

  expect(kind, 'data-kind が general でないと Enterprise の項目立てで描画される').toBe('general');
  for (const key of ['name', 'email', 'subject', 'message', 'appVersion']) {
    await expect(page.locator(`#inq-${key}`), `${key} が無い`).toHaveCount(1);
  }
  for (const key of ['company', 'phone', 'seats']) {
    await expect(page.locator(`#inq-${key}`), `${key} は general には出さない`).toHaveCount(0);
  }

  // 導入相談 (Enterprise) への逃がし先は残す — 見積りの問い合わせがここで行き止まりにならない
  await expect(page.locator('a[href="/enterprise/inquiry/"]')).toHaveCount(1);
});

test('未入力のまま送信すると、必須 4 項目のエラーが aria 属性つきで出て送信はされない', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await submitButton(page).click();

  await expect(page.locator('#inq-name-error')).toHaveText('氏名を入力してください');
  await expect(page.locator('#inq-email-error')).toHaveText('メールアドレスを入力してください');
  await expect(page.locator('#inq-subject-error')).toHaveText('件名を入力してください');
  await expect(page.locator('#inq-message-error')).toHaveText('お問い合わせ内容を入力してください');

  await expect(page.locator('#inq-subject')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#inq-subject')).toHaveAttribute('aria-describedby', 'inq-subject-error');
  await expect(page.locator('#inq-message')).toHaveAttribute(
    'aria-describedby',
    'inq-message-help inq-message-error',
  );

  // 任意項目は未入力でも赤くしない
  await expect(page.locator('#inq-appVersion-error')).toHaveCount(0);
  await expect(page.locator('#inq-appVersion')).not.toHaveAttribute('aria-invalid', 'true');

  await expect(page.getByRole('alert')).toHaveText('入力内容をご確認ください。');
  // 最初の誤り (氏名) にフォーカスが移る
  await expect(page.locator('#inq-name')).toBeFocused();

  expect(calls, '入力エラーのまま Worker を叩いてはいけない').toHaveLength(0);
});

test('件名が 100 文字を超えると上限を示して止まる', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  // maxlength を外した経路 (貼り付け / 自動入力) でも止まることを見る
  await fillForm(page);
  await page.locator('#inq-subject').evaluate((el: HTMLInputElement) => {
    el.removeAttribute('maxlength');
  });
  await page.locator('#inq-subject').fill('あ'.repeat(101));
  await submitButton(page).click();

  await expect(page.locator('#inq-subject-error')).toHaveText('件名は 100 文字以内で入力してください');
  await expect(page.locator('#inq-subject')).toBeFocused();
  expect(calls).toHaveLength(0);
});

test('送信 payload は general の契約どおりで、正規化済みの値を持つ', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  await fillForm(page, { name: '  山田 太郎  ' });
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  const call = calls[0] as InquiryCall;

  expect(call.method).toBe('POST');
  expect(call.contentType).toContain('application/json');
  expect(Object.keys(call.body).sort()).toEqual([
    'appVersion',
    'email',
    'kind',
    'message',
    'name',
    'subject',
    'website',
  ]);
  expect(call.body['kind'], 'kind が無いと Worker は Enterprise として検証する').toBe('general');
  expect(call.body['name'], '前後の空白は落として送る').toBe('山田 太郎');
  expect(call.body['email']).toBe(VALID_INPUT.email);
  expect(call.body['subject']).toBe(VALID_INPUT.subject);
  expect(call.body['message']).toBe(VALID_INPUT.message);
  expect(call.body['appVersion']).toBe(VALID_INPUT.appVersion);
  expect(call.body['website'], '人が触らないハニーポットは空文字').toBe('');
  expect(call.body, 'general に電話番号・アカウント数は無い').not.toHaveProperty('phone');
  expect(call.body).not.toHaveProperty('seats');
  // turnstile_site_key が空の間はトークンを作れないので、キーごと載せない
  expect(call.body).not.toHaveProperty('turnstileToken');
});

test('バージョン未入力なら payload に載せず、ハニーポットの値は載せる', async ({ page }) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  const calls = await stubInquiryEndpoint(page, endpoint, { status: 200, body: { ok: true } });

  // bot が全項目を埋めた状況。人には見えないので Playwright も force で触る
  await page.locator('#inq-website').fill('https://spam.example.com/', { force: true });
  await fillForm(page, { appVersion: '' });
  await submitButton(page).click();

  await expect(doneCard(page)).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.body, '任意項目は空なら送らない').not.toHaveProperty('appVersion');
  expect(calls[0]?.body['website'], 'ハニーポットを送らないと Worker が bot を判定できない').toBe(
    'https://spam.example.com/',
  );
});

test('このページに無い項目のエラーが返っても、Worker の文面を出して手詰まりにしない', async ({
  page,
}) => {
  const { endpoint } = await openInquiryPage(page, CONTACT_PATH);
  // Worker を T-331 より前に巻き戻すと、kind を知らない検証に落ちて general の送信にも
  // 「会社名を入力してください」が返る。/contact/ に会社名の欄は無いので、項目ごとの
  // 赤字に入れるとどこにも出ないまま「入力内容をご確認ください。」だけが残る。
  await stubInquiryEndpoint(page, endpoint, {
    status: 400,
    body: { ok: false, code: 'invalid_input', field: 'company', message: '会社名を入力してください' },
  });

  await fillForm(page);
  await submitButton(page).click();

  await expect(page.getByRole('alert')).toHaveText('会社名を入力してください');
  await expect(inquiryForm(page), 'やり直せるようフォームは出したまま').toBeVisible();
  await expect(page.locator('#inq-subject'), '入力は消さない').toHaveValue(VALID_INPUT.subject);
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
  await expect(page.locator('#inq-subject')).toHaveValue('');
  await expect(page.locator('#inq-message')).toHaveValue('');
  await expect(page.locator('#inq-appVersion')).toHaveValue('');
  // general の先頭項目は氏名 (Enterprise の会社名ではない)
  await expect(page.locator('#inq-name')).toBeFocused();
});
