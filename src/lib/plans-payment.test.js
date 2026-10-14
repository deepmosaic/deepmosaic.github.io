// 料金ページ (/price/) の「支払方法」行を固定する回帰テスト (T-333)。
//
//   node --test src/lib/plans-payment.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// 支払方法はプラン表の中で**実際に受け付けている決済手段の広告**なので、
// 実装 (Worker の支払リンク発行) より広く書くと存在しない導線を売ることになる。
//
//   - 3 プランとも「支払方法」を明示する契約は T-252 から (ラベル表記も揃える)。
//   - Enterprise は T-333 / T-419 でカード払いと請求書払いを並べていたが、T-1215 (2026-10-14) で
//     法人は Stripe を使わなくなり、請求書による銀行振込だけになった (T-1252 で追従。
//     `_includes/docs/07-team.html` の「お支払い方法」と同じ内容)。
//
// plans.yml の読み取りは `plans-yml.js` を通す — 読み手を 2 つ持つと
// 「片方だけ直して片方が古い」が起きる (同モジュール冒頭の注記を参照)。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSpecs } from './plans-yml.js';

/** 支払方法の行のラベル (T-252 で 3 プランに揃えた表記)。 */
const PAYMENT_LABEL = '支払方法';

/** `_data/plans.yml` の `code` のうち、支払方法を明示するプラン。 */
const PAID_CODES = ['light', 'pro', 'enterprise'];

/** そのプランの支払方法の行 (0 件なら空配列)。 */
const paymentRows = (code) => loadSpecs(code).filter((s) => s.label === PAYMENT_LABEL);

test('loadSpecs は未知の code では空を返す (検査のすり抜けを防ぐ)', () => {
  // Arrange / Act
  const specs = loadSpecs('存在しないプラン');

  // Assert
  assert.deepEqual(specs, []);
});

test('loadSpecs はプランの specs を label / value で読める', () => {
  // Arrange / Act
  const specs = loadSpecs('enterprise');

  // Assert
  assert.ok(specs.length >= 3, `enterprise の specs が ${specs.length} 行しか読めていない`);
  assert.ok(
    specs.every((s) => typeof s.label === 'string' && s.label !== '' && typeof s.value === 'string'),
    `label / value が読めていない行がある: ${JSON.stringify(specs)}`,
  );
});

for (const code of PAID_CODES) {
  test(`${code} に「${PAYMENT_LABEL}」の行がちょうど 1 つある (T-252 の契約)`, () => {
    // Arrange / Act
    const rows = paymentRows(code);

    // Assert
    assert.equal(rows.length, 1, `${code} の ${PAYMENT_LABEL} 行が ${rows.length} 個ある`);
    // 個人向け (Light / Pro) はカード、Enterprise は請求書による銀行振込 (T-1215 / T-1252)。
    assert.match(rows[0].value, code === 'enterprise' ? /銀行振込/ : /クレジットカード/);
  });
}

// T-1252: T-1215 で法人の見積はすべて Stripe を使わなくなった (支払リンク・カードの自動更新・日割りなし)。
// 月額は月次請求書 (`invoice_monthly`) による銀行振込だけ (`_includes/docs/07-team.html` の「お支払い方法」)。
test('Enterprise の支払方法は請求書払い (銀行振込) だけを書く', () => {
  // Arrange
  const [row] = paymentRows('enterprise');

  // Act / Assert
  assert.equal(row.value, '請求書払い（銀行振込）');
});

test('Enterprise の請求の行に日割り・毎月 1 日の自動請求が残っていない', () => {
  // Arrange
  const [row] = loadSpecs('enterprise').filter((s) => s.label === '請求');
  assert.ok(row, 'Enterprise に「請求」の行が無い');

  // Act / Assert
  assert.doesNotMatch(row.value, /日割り|毎月 1 日/, `Stripe 経路の請求の説明が残っている: ${row.value}`);
  assert.match(row.value, /ご利用月ごと/);
});
