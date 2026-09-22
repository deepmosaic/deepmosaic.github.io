// 料金ページ (/price/) の「支払方法」行を固定する回帰テスト (T-333)。
//
//   node --test src/lib/plans-payment.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// 支払方法はプラン表の中で**実際に受け付けている決済手段の広告**なので、
// 実装 (Worker の支払リンク発行) より広く書くと存在しない導線を売ることになる。
//
//   - 3 プランとも「支払方法」を明示する契約は T-252 から (ラベル表記も揃える)。
//   - Enterprise は見積 → 支払リンクで、カード払いと請求書払い (銀行振込またはカード、T-419) の
//     どちらも選べる (`_includes/docs/07-team.html` の「お支払い方法」と同じ内容)。
//     T-333 でユーザー指定の並列表記に変更した。
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
    assert.match(rows[0].value, /クレジットカード/);
  });
}

test('Enterprise の支払方法はカード払いと請求書払い (銀行振込) を並べる', () => {
  // Arrange
  const [row] = paymentRows('enterprise');

  // Act / Assert — ユーザー指定の文言 (T-333)。
  assert.equal(row.value, 'クレジットカード払い、請求書払い（銀行振込またはクレジットカード）');
});

test('Enterprise の支払方法にカードだけ / 請求書だけの欠落が無い', () => {
  // Arrange
  const [row] = paymentRows('enterprise');

  // Act
  const card = row.value.indexOf('クレジットカード');
  const invoice = row.value.indexOf('請求書払い');

  // Assert
  assert.ok(card >= 0, 'クレジットカード払いが書かれていない');
  assert.ok(invoice >= 0, '請求書払いが書かれていない');
  assert.ok(card < invoice, 'カード払いを先に書く (料金ページの並びの指定)');
  assert.match(row.value, /銀行振込/);
});
