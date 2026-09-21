// 問い合わせフォーム E2E の共有ハーネス (T-286 で inquiry.spec.ts に書いたものを T-332 で抽出)。
//
// `/enterprise/inquiry/` (kind=enterprise) と `/contact/` (kind=general) は**同じ島**
// (`src/islands/InquiryForm.svelte`) と**同じ Worker エンドポイント**を使う。配線
// (Liquid → data-* → props → fetch) を固定する道具立ては共通なので、ここに置いて
// 両方の spec から使う。項目名や文面といったページ固有の期待値は各 spec に置く。
//
// ## 外部通信は一切させない
//
// `data-endpoint` は本番 / dev の Worker を指す。**実行のたびに本物の問い合わせを
// 作ってしまわないよう**、`blockExternalTraffic` でまず全リクエストを見張り、配信サーバ
// 以外へ出ようとするものを abort する。その後に endpoint だけを `stubInquiryEndpoint` で
// 差し替える (後から登録したハンドラが先に評価されるため、差し替えが見張りに優先する)。
//
// route.fulfill した応答にもブラウザは CORS を適用するので、プリフライト (OPTIONS) と
// `Access-Control-Allow-Origin` を自前で返す。ここを落とすと本体の fetch が
// ネットワークエラーに倒れ、「送信できませんでした」の文面が出て原因が分かりにくい。
import { expect, type Page, type Route } from '@playwright/test';

/** `page.route` で捕まえた `POST /inquiry` の 1 件。 */
export type InquiryCall = {
  method: string;
  contentType: string;
  body: Record<string, unknown>;
};

/** Worker の代わりに返す応答。`body` は JSON にして返す。 */
export type StubReply = { status: number; body?: unknown };

/** 島に渡っている設定値 (ビルド出力の data-* から読んだもの)。 */
export type InquiryPageConfig = {
  endpoint: string;
  supportEmail: string;
  kind: string;
};

const CORS_HEADERS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '0',
});

/** 配信サーバ以外への通信を止める。テストが本物の Worker を叩かないための最後の砦。 */
export async function blockExternalTraffic(page: Page, baseURL: string): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const url = route.request().url();
    if (url.startsWith(baseURL) || url.startsWith('data:') || url.startsWith('blob:')) {
      await route.continue();
      return;
    }
    await route.abort();
  });
}

/**
 * 問い合わせページを開き、島に渡っている設定値を読む。
 *
 * 値は **Jekyll が出した markup から**取る。テスト側に endpoint を直書きすると
 * `_data/inquiry.yml` の差し替えを検知できなくなる。
 */
export async function openInquiryPage(page: Page, path: string): Promise<InquiryPageConfig> {
  await page.goto(path);
  const root = page.locator('[data-island="inquiry-form"]');
  await expect(root).toHaveCount(1);

  const endpoint = (await root.getAttribute('data-endpoint')) ?? '';
  const supportEmail = (await root.getAttribute('data-support-email')) ?? '';
  const kind = (await root.getAttribute('data-kind')) ?? '';
  expect(endpoint, 'data-endpoint が空 — _data/inquiry.yml の受け渡しが切れている').not.toBe('');
  expect(supportEmail, 'data-support-email が空 — 502 の案内文に宛先が出せない').not.toBe('');

  // 島がマウントされてフォームが描画されるまで待つ (素の markup は noscript だけ)
  await expect(inquiryForm(page)).toBeVisible();
  return { endpoint, supportEmail, kind };
}

/** endpoint への POST を横取りして `reply` を返す。捕まえた送信内容を配列で返す。 */
export async function stubInquiryEndpoint(
  page: Page,
  endpoint: string,
  reply: StubReply,
): Promise<InquiryCall[]> {
  const calls: InquiryCall[] = [];
  await page.route(endpoint, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { ...CORS_HEADERS }, body: '' });
      return;
    }
    calls.push({
      method: request.method(),
      contentType: request.headers()['content-type'] ?? '',
      body: (request.postDataJSON() ?? {}) as Record<string, unknown>,
    });
    await route.fulfill({
      status: reply.status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(reply.body ?? {}),
    });
  });
  return calls;
}

/** 項目名 → 値で埋める (`#inq-<項目名>`)。 */
export async function fillFields(page: Page, values: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await page.locator(`#inq-${key}`).fill(value);
  }
}

/** 島の root で範囲を絞る (ページ内の他のフォーム / ボタンと混ざらないように)。 */
export function inquiryForm(page: Page) {
  return page.locator('[data-island="inquiry-form"] form');
}

export function submitButton(page: Page) {
  return inquiryForm(page).locator('button[type="submit"]');
}

/** 完了カード。島の root 配下で `tabindex="-1"` を持つのはこれだけ。 */
export function doneCard(page: Page) {
  return page.locator('[data-island="inquiry-form"] div[tabindex="-1"]');
}
