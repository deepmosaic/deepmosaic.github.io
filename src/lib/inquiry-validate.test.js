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
  fieldNames,
  normalizeMessage,
  normalizePhone,
  normalizeSeats,
  validateInquiry,
} from './inquiry-validate.js';

/** 通る入力の雛形 (kind='enterprise')。各テストは 1 項目だけ壊す。 */
const VALID = {
  company: 'テスト株式会社',
  name: '確認 太郎',
  email: 'taro@example.co.jp',
  phone: '03-1234-5678',
  seats: 5,
  message: 'T-254 動作確認',
  website: '',
};

/**
 * 通る入力の雛形 (kind='general', T-332 → T-516)。T-516 で氏名・件名・ご利用中のバージョンを
 * 外したので、メールアドレスとお問い合わせ内容 (+ ハニーポット) だけを持つ。
 */
const VALID_GENERAL = {
  email: 'taro@example.co.jp',
  message: 'T-516 動作確認',
  website: '',
};

/** T-516 より前の general が送っていた項目。今は受け取っても無視する (Worker と同じ契約)。 */
const RETIRED_GENERAL_FIELDS = Object.freeze({
  name: '確認 太郎',
  subject: '書き出しに失敗する',
  appVersion: '2.3.7',
});

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
  assert.deepEqual(Object.keys(f).sort(), [...fieldNames('enterprise'), 'website'].sort());
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

// T-404: 文字化けの跡 (U+FFFD)。Worker 側 (`inquiry-validate.ts`) と同時に入れた規則で、
// ここが緩いと「サイトでは通るのに Worker が 400」という往復になる
test('validateInquiry は U+FFFD (文字化け) を弾く', () => {
  const r = validateInquiry({ ...VALID, company: 'テスト�株式会社', message: '導入を�検討' });
  assert.equal(r.ok, false);
  assert.equal(r.errors.company, '会社名に使用できない文字が含まれています');
  assert.equal(r.errors.message, 'ご相談内容に使用できない文字が含まれています');

  const general = validateInquiry({ ...VALID_GENERAL, message: '書き出しが�止まる' }, 'general');
  assert.equal(general.ok, false);
  assert.equal(general.errors.message, 'お問い合わせ内容に使用できない文字が含まれています');

  assert.equal(validateInquiry(VALID).ok, true, '正常な日本語は通る');
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

// ── kind='general' (一般問い合わせ /contact/、T-332 → T-516) ─────────────────
//
// Worker (`POST /inquiry`) は `kind` で判別する union を受ける (T-331)。**既定は
// enterprise** で、旧サイト (kind を送らない) との互換をそこで保つ。general は
// 会社名・電話番号・アカウント数を持たない。
//
// T-516 (2026-09-23 ユーザー決定) で氏名・件名・ご利用中のバージョンも外し、general は
// **メールアドレス + お問い合わせ内容** だけになった。Worker 側 (`inquiry-validate.ts`) と
// 同じく、旧項目が入力に付いていても**検査せず・送らず**に無視する。

test("kind='general' はメールアドレスとお問い合わせ内容だけを正規化して返す", () => {
  // Arrange
  const input = { ...VALID_GENERAL, email: '  taro@example.co.jp  ', message: 'a\r\nb' };

  // Act
  const r = validateInquiry(input, 'general');

  // Assert
  assert.equal(r.ok, true);
  assert.deepEqual(r.fields, { email: 'taro@example.co.jp', message: 'a\nb', website: '' });
});

test("kind='general' は旧項目 (氏名・件名・バージョン) が付いていても無視して通す (Worker と同じ契約)", () => {
  // Arrange: 旧フォームの値 + 旧規則なら弾かれていた値 (制御文字・上限超過) の両方
  const legacy = validateInquiry({ ...VALID_GENERAL, ...RETIRED_GENERAL_FIELDS }, 'general');
  const broken = validateInquiry(
    {
      ...VALID_GENERAL,
      name: '太郎\u0000',
      subject: 'あ'.repeat(101),
      appVersion: '2.3.7\n2.3.6',
    },
    'general',
  );

  // Assert
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.fields, { email: 'taro@example.co.jp', message: 'T-516 動作確認', website: '' });
  assert.equal(broken.ok, true, '無視する項目の中身で 400 相当にしない');
  assert.deepEqual(broken.fields, legacy.fields);
});

test("kind='general' は必須 2 項目の未入力を全部返し、それ以外の項目は赤くしない", () => {
  // Arrange / Act
  const r = validateInquiry({}, 'general');

  // Assert
  assert.equal(r.ok, false);
  assert.deepEqual(
    Object.keys(r.errors).sort(),
    ['email', 'message'],
    '氏名・件名 (T-516 で廃止) と company / phone / seats (Enterprise 専用) は general に無い',
  );
  assert.equal(r.errors.email, 'メールアドレスを入力してください');
  assert.equal(r.errors.message, 'お問い合わせ内容を入力してください');
});

test("kind='general' は本文が空白だけでも未入力として弾く (general の本文は必須)", () => {
  // Arrange / Act
  const r = validateInquiry({ ...VALID_GENERAL, message: ' \r\n\t ' }, 'general');

  // Assert
  assert.equal(r.ok, false);
  assert.equal(r.errors.message, 'お問い合わせ内容を入力してください');
});

test("kind='general' は本文の上限ちょうどを通し、1 文字超過を弾く", () => {
  // Arrange / Act
  const ok = validateInquiry({ ...VALID_GENERAL, message: 'う'.repeat(LIMITS.message) }, 'general');
  const ng = validateInquiry({ ...VALID_GENERAL, message: 'う'.repeat(LIMITS.message + 1) }, 'general');

  // Assert
  assert.equal(ok.ok, true);
  assert.equal(ng.ok, false);
  assert.equal(ng.errors.message, `お問い合わせ内容は ${LIMITS.message} 文字以内で入力してください`);
});

test("kind='general' はメールアドレスの形式と本文の制御文字を検査する", () => {
  // Arrange / Act
  const badEmail = validateInquiry({ ...VALID_GENERAL, email: 'taro@example' }, 'general');
  const esc = validateInquiry({ ...VALID_GENERAL, message: 'a\u001bb' }, 'general');
  const tabs = validateInquiry({ ...VALID_GENERAL, message: 'ok\tok\nok' }, 'general');

  // Assert
  assert.equal(badEmail.ok, false);
  assert.equal(badEmail.errors.email, 'メールアドレスの形式が正しくありません');
  assert.equal(esc.ok, false);
  assert.equal(esc.errors.message, 'お問い合わせ内容に使用できない文字が含まれています');
  assert.equal(tabs.ok, true, 'タブ・改行入りの本文は通る');
});

test("emptyFields('general') は general の項目だけを持つ", () => {
  // Arrange / Act
  const f = emptyFields('general');

  // Assert
  assert.deepEqual(Object.keys(f).sort(), [...fieldNames('general'), 'website'].sort());
  for (const retired of ['name', 'subject', 'appVersion', 'seats']) {
    assert.equal(retired in f, false, `${retired} は general のフォームに無い`);
  }
  assert.equal(f.email, '');
  assert.equal(f.message, '');
  assert.equal(f.website, '');
});

test('fieldNames は kind ごとの並び (最初のエラーへフォーカスする順) を返す', () => {
  assert.deepEqual(fieldNames('enterprise'), ['company', 'name', 'email', 'phone', 'seats', 'message']);
  assert.deepEqual(fieldNames('general'), ['email', 'message']);
  assert.deepEqual(fieldNames('スパム'), fieldNames('enterprise'), '未知の kind は enterprise に倒す');
  assert.deepEqual(fieldNames(), fieldNames('enterprise'), '既定は enterprise');
  for (const key of [...fieldNames('enterprise'), ...fieldNames('general')]) {
    assert.ok(FIELD_NAMES.includes(key), `${key} は describeFailure が受け付ける項目名に含まれる`);
  }
});

test('describeFailure: 廃止した general の項目 (件名・バージョン) は項目に紐づけない', () => {
  // Arrange: T-516 より前の Worker が general の送信に返しうる応答
  const outcomes = ['subject', 'appVersion'].map((field) => ({
    status: 400,
    data: { ok: false, code: 'invalid_input', field, message: `${field} の検証エラー` },
  }));

  // Act
  const failures = outcomes.map((o) => describeFailure(o));

  // Assert: 項目に紐づけず、Worker の文面はそのまま出す (島が警告として表示する)
  for (const [i, f] of failures.entries()) {
    assert.equal(f.kind, 'invalid');
    assert.equal(f.field, null, `${outcomes[i].data.field} はどの kind のフォームにも無い`);
    assert.equal(f.message, outcomes[i].data.message);
  }
});

test('buildPayload は general に kind を載せ、enterprise には載せない (旧サイト互換)', () => {
  // Arrange
  const general = validateInquiry(VALID_GENERAL, 'general').fields;
  const enterprise = validateInquiry(VALID).fields;

  // Act / Assert
  assert.deepEqual(buildPayload(general, '', 'general'), {
    kind: 'general',
    email: 'taro@example.co.jp',
    message: 'T-516 動作確認',
    website: '',
  });
  assert.deepEqual(buildPayload(general, 'tok', 'general'), {
    kind: 'general',
    email: 'taro@example.co.jp',
    message: 'T-516 動作確認',
    website: '',
    turnstileToken: 'tok',
  });
  assert.equal('kind' in buildPayload(enterprise), false, 'Worker の既定 (enterprise) にそのまま乗る');
  assert.deepEqual(buildPayload(enterprise), { ...VALID });
});

test('buildPayload は general の fields に旧項目が混ざっていても送らない', () => {
  // Arrange: 呼び出し側が旧形の fields を渡してしまった場合
  const fields = { ...VALID_GENERAL, ...RETIRED_GENERAL_FIELDS };

  // Act
  const body = buildPayload(fields, '', 'general');

  // Assert
  assert.deepEqual(Object.keys(body).sort(), ['email', 'kind', 'message', 'website']);
});

test('未知の kind は enterprise として検証する (既定は旧サイトの契約)', () => {
  const r = validateInquiry(VALID, 'スパム');
  assert.equal(r.ok, true);
  assert.deepEqual(r.fields, validateInquiry(VALID).fields);
  assert.equal(
    validateInquiry(VALID_GENERAL, 'スパム').ok,
    false,
    'general の入力は enterprise の規則では通らない (会社名・電話・アカウント数が無い)',
  );
});
