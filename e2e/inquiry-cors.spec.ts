// 公開後の確認 — 問い合わせページから送信先への CORS を実ブラウザで確認する。
// `E2E_BASE_URL` を渡したときだけ走る (ローカルの _site からは本番の送信先を叩かない)。
// 送るのは検証エラーになる本文 (seats=0) だけ。ブラウザが 400 の本文を読めれば、preflight と ACAO が実際に通っている。
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/** 本番のビルドの送信先 (`_data/inquiry.yml` の endpoint) */
const PRODUCTION_ENDPOINT = (() => {
  const yml = readFileSync(new URL('../_data/inquiry.yml', import.meta.url), 'utf8');
  const m = yml.match(/^endpoint:\s*"([^"]+)"/m);
  if (!m) throw new Error('_data/inquiry.yml に endpoint が無い');
  return m[1];
})();

test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL (公開後の確認) のときだけ');

test('問い合わせページから送信先へ fetch でき、検証エラーの本文が読める (CORS)', async ({ page }) => {
  await page.route(
    (url) => /google-analytics|googletagmanager|analytics\.google|clarity\.ms|doubleclick/.test(url.hostname),
    (route) => route.abort(),
  );
  await page.goto('/enterprise/inquiry/', { waitUntil: 'domcontentloaded' });
  const endpoint = await page.locator('[data-island="inquiry-form"]').getAttribute('data-endpoint');
  expect(endpoint).toBe(PRODUCTION_ENDPOINT);
  // フォームが描画されている (島が hydrate した)
  await expect(page.locator('form')).toBeVisible();

  const result = await page.evaluate(async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'x', name: 'x', email: 'x@example.com', phone: '0300000000', seats: 0, message: '', website: '' }),
    });
    return { status: res.status, body: (await res.json()) as { ok: boolean; code?: string; field?: string } };
  }, endpoint!);
  expect(result.status).toBe(400);
  expect(result.body.ok).toBe(false);
  expect(result.body.code).toBe('invalid_input');
  expect(result.body.field).toBe('seats');
});
