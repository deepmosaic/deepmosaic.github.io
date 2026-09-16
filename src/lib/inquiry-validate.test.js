// Enterprise 導入相談フォームの入力検証の回帰テスト (T-254)。
//
//   node --test src/lib/inquiry-validate.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// **規則は Worker (`desktop/worker-auth0-updater/src/inquiry.ts`) の写し**なので、
// 境界値は Worker 側の test/inquiry.spec.ts と同じ値で固定する。ここが Worker より
// 厳しくなると正当な入力が送れなくなり、緩くなると 400 の往復が増える。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_LABELS,
  FIELD_NAMES,
  LIMITS,
  buildPayload,
  describeFailure,
  emptyFields,
  normalizeMessage,
  normalizePhone,
  normalizeSeats,
  validateInquiry,
} from './inquiry-validate.js';

/** 通る入力の雛形。各テストは 1 項目だけ壊す。 */
const VALID = {
  company: 'テスト株式会社',
  name: '確認 太郎',
  email: 'taro@example.co.jp',
  phone: '03-1234-5678',
  seats: 5,
  message: 'T-254 動作確認',
  website: '',
};

// ── normalizePhone ──────────────────────────────────────────────────────────

test('normalizePhone は全角の数字・記号を半角に寄せる', () => {
  assert.equal(normalizePhone('０３－１２３４－５６７８'), '03-1234-5678', '全角数字 + 全角ハイフン');
  assert.equal(normalizePhone('＋８１　３　１２３４'), '+81 3 1234', '全角プラス + 全角空白');
  assert.equal(normalizePhone('（０３）１２３４−５６７８'), '(03)1234-5678', '全角括弧 + マイナス記号');
  assert.equal(normalizePhone('03ー1234ー5678'), '03-1234-5678', '長音記号をハイフンに');
  assert.equal(normalizePhone('03–1234—5678'), '03-1234-5678', 'en dash / em dash');
});

test('normalizePhone は半角の入力を変えず、前後の空白だけ落とす', () => {
  assert.equal(normalizePhone('  +81 3-1234-5678  '), '+81 3-1234-5678');
  assert.equal(normalizePhone(null), '', 'null は空文字');
  assert.equal(normalizePhone(undefined), '', 'undefined は空文字');
});

// ── normalizeMessage / normalizeSeats ───────────────────────────────────────

test('normalizeMessage は CRLF を LF に揃え前後の空白を落とす', () => {
  assert.equal(normalizeMessage('  a\r\nb\rc\n  '), 'a\nb\nc');
  assert.equal(normalizeMessage(undefined), '');
});

test('normalizeSeats は数値・数字文字列・全角数字を整数にし、それ以外は null', () => {
  assert.equal(normalizeSeats(5), 5);
  assert.equal(normalizeSeats('12'), 12);
  assert.equal(normalizeSeats('１０'), 10, '全角数字');
  assert.equal(normalizeSeats(' 7 '), 7, '前後空白');
  assert.equal(normalizeSeats(''), null, '空 (type=number を消したとき)');
  assert.equal(normalizeSeats(null), null, 'null (Svelte の number 入力が空のとき)');
  assert.equal(normalizeSeats(2.5), null, '小数');
  assert.equal(normalizeSeats('3人'), null, '数字以外を含む');
  assert.equal(normalizeSeats('1234567'), null, '7 桁は Worker と同じく拒否');
});

// ── validateInquiry: 正常系 ─────────────────────────────────────────────────

test('validateInquiry は正常な入力を正規化して返す', () => {
  const r = validateInquiry({ ...VALID, phone: '０３－１２３４－５６７８', message: 'a\r\nb' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.fields, {
    company: 'テスト株式会社',
    name: '確認 太郎',
    email: 'taro@example.co.jp',
    phone: '03-1234-5678',
    seats: 5,
    message: 'a\nb',
    website: '',
  });
});

test('validateInquiry は本文が空でも通す (Worker は本文任意)', () => {
  const r = validateInquiry({ ...VALID, message: '' });
  assert.equal(r.ok, true);
  assert.equal(r.fields.message, '');
});

test('validateInquiry は境界値ちょうどを通す', () => {
  const r = validateInquiry({
    ...VALID,
    company: 'あ'.repeat(LIMITS.company),
    name: 'い'.repeat(LIMITS.name),
    phone: '1'.repeat(LIMITS.phoneMax),
    seats: LIMITS.seatsMax,
    message: 'う'.repeat(LIMITS.message),
  });
  assert.equal(r.ok, true);
  const min = validateInquiry({ ...VALID, phone: '12345', seats: LIMITS.seatsMin });
  assert.equal(min.ok, true, '電話 5 文字 / 3 アカウントは下限として通る');
});

test('emptyFields は 3 アカウントを既定にしハニーポットは空', () => {
  const f = emptyFields();
  assert.equal(f.seats, LIMITS.seatsMin);
  assert.equal(f.website, '');
  assert.deepEqual(Object.keys(f).sort(), [...FIELD_NAMES, 'website'].sort());
});

// ── validateInquiry: 失敗系 (項目ごと) ──────────────────────────────────────

test('validateInquiry は必須項目の未入力を項目ごとに全部返す', () => {
  const r = validateInquiry({});
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['company', 'email', 'name', 'phone', 'seats']);
  assert.equal(r.errors.company, '会社名を入力してください');
  assert.equal(r.errors.email, 'メールアドレスを入力してください');
  assert.equal(r.errors.phone, '電話番号は 5 文字以上で入力してください');
  assert.equal(r.errors.seats, '利用アカウント予定数は整数で入力してください');
});

test('validateInquiry は上限超過を弾く', () => {
  const r = validateInquiry({
    ...VALID,
    company: 'あ'.repeat(LIMITS.company + 1),
    name: 'い'.repeat(LIMITS.name + 1),
    phone: '1'.repeat(LIMITS.phoneMax + 1),
    message: 'う'.repeat(LIMITS.message + 1),
  });
  assert.equal(r.ok, false);
  assert.equal(r.errors.company, `会社名は ${LIMITS.company} 文字以内で入力してください`);
  assert.equal(r.errors.name, `氏名は ${LIMITS.name} 文字以内で入力してください`);
  assert.equal(r.errors.phone, `電話番号は ${LIMITS.phoneMax} 文字以内で入力してください`);
  assert.equal(r.errors.message, `ご相談内容は ${LIMITS.message} 文字以内で入力してください`);
});

test('validateInquiry はメールアドレスの形式を検査する', () => {
  for (const bad of ['taro', 'taro@', '@example.com', 'taro@example', 'taro@@example.com', 'ta ro@example.com']) {
    const r = validateInquiry({ ...VALID, email: bad });
    assert.equal(r.ok, false, bad);
    assert.equal(r.errors.email, 'メールアドレスの形式が正しくありません', bad);
  }
  for (const good of ['a@b.co', 'first.last+tag@sub.example.co.jp', "o'neil@example.com"]) {
    assert.equal(validateInquiry({ ...VALID, email: good }).ok, true, good);
  }
});

test('validateInquiry は正規化後も規則外の電話番号を弾く', () => {
  const r = validateInquiry({ ...VALID, phone: '03-1234-5678 (代表)' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.phone, '電話番号は数字・+・-・空白・括弧のみで入力してください');
  const dot = validateInquiry({ ...VALID, phone: '03.1234.5678' });
  assert.equal(dot.ok, false, 'ドット区切りは Worker も拒否する');
});

test('validateInquiry は予定アカウント数 3 未満・上限超過・非整数を弾く', () => {
  const low = validateInquiry({ ...VALID, seats: 2 });
  assert.equal(low.ok, false);
  assert.match(low.errors.seats, /3 以上/);
  assert.match(low.errors.seats, /Enterprise は 3 アカウントから/);
  const high = validateInquiry({ ...VALID, seats: LIMITS.seatsMax + 1 });
  assert.equal(high.ok, false);
  assert.match(high.errors.seats, /10000 以下/);
  const empty = validateInquiry({ ...VALID, seats: null });
  assert.equal(empty.ok, false);
  assert.equal(empty.errors.seats, `${FIELD_LABELS.seats}は整数で入力してください`);
});

test('validateInquiry は制御文字を弾く (本文はタブ・改行だけ許す)', () => {
  const r = validateInquiry({ ...VALID, name: '太郎\u0000', message: 'ok\tok\nok' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.name, '氏名に使用できない文字が含まれています');
  assert.equal(r.errors.message, undefined, 'タブ・改行入りの本文は通る');
  const esc = validateInquiry({ ...VALID, message: 'a\u001bb' });
  assert.equal(esc.ok, false);
  assert.equal(esc.errors.message, 'ご相談内容に使用できない文字が含まれています');
});

test('validateInquiry はハニーポットを検査しない (埋まっていても通す)', () => {
  const r = validateInquiry({ ...VALID, website: 'http://spam.example' });
  assert.equal(r.ok, true, 'ここで弾くと bot に気付かれる。Worker が副作用なしの 200 を返す');
  assert.equal(r.fields.website, 'http://spam.example');
});

test('validateInquiry は入力がオブジェクトでなくても落ちない', () => {
  assert.equal(validateInquiry(null).ok, false);
  assert.equal(validateInquiry(undefined).ok, false);
  assert.equal(validateInquiry('x').ok, false);
});

// ── buildPayload ────────────────────────────────────────────────────────────

test('buildPayload は Worker の項目名で組み、トークンは空なら載せない', () => {
  const fields = validateInquiry(VALID).fields;
  assert.deepEqual(buildPayload(fields), { ...VALID });
  assert.deepEqual(buildPayload(fields, 'tok'), { ...VALID, turnstileToken: 'tok' });
  assert.equal('turnstileToken' in buildPayload(fields, ''), false);
});

// ── describeFailure ─────────────────────────────────────────────────────────

test('describeFailure: ネットワーク失敗 (status 0) は generic', () => {
  const r = describeFailure({ status: 0 });
  assert.equal(r.kind, 'network');
  assert.equal(r.field, null);
  assert.match(r.message, /ネットワーク接続/);
});

test('describeFailure: 429 は時間をおく案内', () => {
  const r = describeFailure({ status: 429, data: { ok: false, code: 'rate_limited' } });
  assert.equal(r.kind, 'rate_limited');
  assert.match(r.message, /しばらく時間をおいて再度お試しください/);
  assert.equal(describeFailure({ status: 429, data: null }).kind, 'rate_limited', 'JSON が無くても status で判定');
});

test('describeFailure: turnstile_failed は再読み込みの案内', () => {
  const r = describeFailure({ status: 400, data: { ok: false, code: 'turnstile_failed' } });
  assert.equal(r.kind, 'turnstile');
  assert.match(r.message, /認証に失敗しました。ページを再読み込みしてください/);
});

test('describeFailure: invalid_input は既知の項目名なら field 付きで Worker の文面を出す', () => {
  const r = describeFailure({
    status: 400,
    data: { ok: false, code: 'invalid_input', field: 'email', message: 'メールアドレスの形式が正しくありません' },
  });
  assert.equal(r.kind, 'invalid');
  assert.equal(r.field, 'email');
  assert.equal(r.message, 'メールアドレスの形式が正しくありません');
  const unknownField = describeFailure({
    status: 400,
    data: { ok: false, code: 'invalid_input', field: 'turnstileToken', message: 'x' },
  });
  assert.equal(unknownField.field, null, 'フォームに無い項目名は項目に紐づけない');
  const noMessage = describeFailure({ status: 400, data: { ok: false, code: 'invalid_input', field: 'name' } });
  assert.equal(noMessage.message, '入力内容をご確認ください。');
});

test('describeFailure: 502 / delivery_failed は support 宛の直接連絡を促す', () => {
  const r = describeFailure(
    { status: 502, data: { ok: false, code: 'delivery_failed' } },
    { supportEmail: 'support@example.com' },
  );
  assert.equal(r.kind, 'delivery');
  assert.match(r.message, /support@example\.com まで直接ご連絡ください/);
  const noMail = describeFailure({ status: 502 });
  assert.equal(noMail.kind, 'delivery');
  assert.doesNotMatch(noMail.message, /@/, 'メールアドレス未指定なら文面に @ を出さない');
});

test('describeFailure: 未知の code / 壊れた応答は generic に倒す', () => {
  assert.equal(describeFailure({ status: 500, data: 'not json' }).kind, 'unknown');
  assert.equal(describeFailure({ status: 403, data: { ok: false, code: 'origin_not_allowed' } }).kind, 'unknown');
  assert.equal(describeFailure({}).kind, 'network', 'status が無ければネットワーク扱い');
});
