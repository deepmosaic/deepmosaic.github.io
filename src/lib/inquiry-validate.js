// 問い合わせフォームの入力検証 (T-254、T-332 で kind 分岐)。
//
// 送信先は `desktop/worker-auth0-updater/src/inquiry.ts` (T-253) の `POST /inquiry`。
// **ここは Worker 側の `validateInquiry` の写し**で、規則 (上限・正規表現・制御文字) を
// 同じにしてある。サーバ側が正で、ここは往復を減らすための前検査に過ぎない —
// ここを緩めても Worker が 400 を返すだけだが、厳しくすると正当な入力を送れなくなる。
// **規則を変えるときは Worker と同時に変える。**
//
// ## 2 種類の問い合わせ (T-331 / T-332)
//
// | kind | ページ | 項目 |
// |------|--------|------|
// | `enterprise` (既定) | `/enterprise/inquiry/` | 会社名・氏名・メール・電話・アカウント数・ご相談内容 |
// | `general` | `/contact/` | 氏名・メール・件名・お問い合わせ内容・ご利用中のバージョン (任意) |
//
// **enterprise は `kind` を載せずに送る。** Worker 側の既定が enterprise で、そうすることで
// 旧サイト (このコードが届く前の公開物) からの送信と同じボディのままになる。
//
// ## この module の約束
//
// - **純関数だけ。** DOM / fetch / Turnstile に触らない (`src/islands/InquiryForm.svelte` が
//   impure 側)。`node --test src/lib/inquiry-validate.test.js` でそのまま検証できる。
// - 全フィールドの誤りを一度に返す (Worker は最初の 1 件で止まるが、フォームでは
//   全部を赤くしたほうが往復が少ない)。
// - 電話番号は送信前に全角 → 半角へ正規化する。Worker は ASCII の数字・`+`・`-`・空白・
//   括弧しか受けないため、日本語 IME で `０３－１２３４` と打った入力をそのまま送ると
//   400 になる。

/** 問い合わせの種類。Worker の判別 union と同じ値 (T-331)。 */
export const KINDS = Object.freeze(['enterprise', 'general']);

/**
 * 未知の値は `enterprise` に倒す。Worker 側の既定と同じにしてあり、
 * `data-kind` の書き間違いでフォームが壊れるより、旧来の形で送るほうが安全。
 *
 * @param {unknown} raw
 * @returns {'enterprise' | 'general'}
 */
export function normalizeKind(raw) {
  return KINDS.includes(raw) ? raw : 'enterprise';
}

/** Worker 側 `LIMITS` と同じ値。 */
export const LIMITS = Object.freeze({
  company: 200,
  name: 100,
  email: 254,
  phoneMin: 5,
  phoneMax: 40,
  seatsMin: 3,
  seatsMax: 10_000,
  subject: 100,
  appVersion: 40,
  message: 4000,
});

/**
 * フォームに出す項目名 (全 kind 分)。Worker のエラー応答の `field` をこの表で表示に
 * 対応させる。`message` の表示名だけ kind で変わる (general は `GENERAL_LABELS`)。
 */
export const FIELD_LABELS = Object.freeze({
  company: '会社名',
  name: '氏名',
  email: 'メールアドレス',
  phone: '電話番号',
  seats: '利用アカウント予定数',
  subject: '件名',
  appVersion: 'ご利用中のバージョン',
  message: 'ご相談内容',
});

/** `describeFailure` が受け付ける項目名 (全 kind の和集合)。 */
export const FIELD_NAMES = Object.freeze(Object.keys(FIELD_LABELS));

/**
 * kind ごとの項目と**並び**。誤りがあったときに最初の項目へフォーカスする順でもあるので、
 * 画面の上から下の順に並べる。
 */
const FIELD_ORDER = Object.freeze({
  enterprise: Object.freeze(['company', 'name', 'email', 'phone', 'seats', 'message']),
  general: Object.freeze(['name', 'email', 'subject', 'message', 'appVersion']),
});

/**
 * @param {unknown} [kind]
 * @returns {readonly string[]}
 */
export function fieldNames(kind) {
  return FIELD_ORDER[normalizeKind(kind)];
}

/** general だけ「ご相談内容」ではなく「お問い合わせ内容」と呼ぶ。 */
const GENERAL_LABELS = Object.freeze({ ...FIELD_LABELS, message: 'お問い合わせ内容' });

// RFC 5322 の実用サブセット (HTML5 の input[type=email] 相当 + TLD 必須)。Worker と同一。
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
// 数字・`+`・`-`・空白・括弧のみ。Worker と同一。
const PHONE_RE = /^[0-9+()\- ]+$/;

/**
 * 空のフォーム。`website` はハニーポット (人は触らないので常に空)。
 *
 * @param {unknown} [kind]
 */
export function emptyFields(kind) {
  if (normalizeKind(kind) === 'general') {
    return { name: '', email: '', subject: '', message: '', appVersion: '', website: '' };
  }
  return {
    company: '',
    name: '',
    email: '',
    phone: '',
    seats: LIMITS.seatsMin,
    message: '',
    website: '',
  };
}

/** 1 行フィールド用: 制御文字 (U+0000–U+001F, U+007F) を一切許さない。 */
function hasAnyControlChar(s) {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** 本文用: `\t` / `\n` 以外の制御文字を拒否する。 */
function hasInvalidMessageChar(s) {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x7f) return true;
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a) return true;
  }
  return false;
}

/** 文字列以外 (null / undefined / 数値) は文字列に寄せる。 */
function asString(raw) {
  if (typeof raw === 'string') return raw;
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

/**
 * 全角の数字・記号を ASCII に寄せる。
 *
 * - 全角数字 `０-９` → `0-9`
 * - `＋` → `+`、`（` `）` → `(` `)`、全角空白 → 半角空白
 * - 全角ハイフン `－` / マイナス `−` / 各種ダッシュ `‐‑‒–—―` / 長音 `ー` `ｰ` → `-`
 *   (日本語 IME で電話番号を打つと長音記号やダッシュになりがち)
 *
 * それ以外の文字はそのまま (regex 検査で弾かれ、ユーザーに直してもらう)。
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizePhone(raw) {
  return asString(raw)
    .replace(/[\uFF10-\uFF19]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/\uFF0B/g, '+')
    .replace(/\uFF08/g, '(')
    .replace(/\uFF09/g, ')')
    .replace(/\u3000/g, ' ')
    .replace(/[\uFF0D\u2212\u2010\u2011\u2012\u2013\u2014\u2015\u30FC\uFF70]/g, '-')
    .trim();
}

/**
 * 本文の改行を LF に揃えて前後の空白を落とす (Worker と同じ)。
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeMessage(raw) {
  return asString(raw).replace(/\r\n?/g, '\n').trim();
}

/**
 * 予定アカウント数を整数にする。`<input type="number">` は数値か null を返し、
 * 全角数字の文字列が来ることもあるので両方受ける。整数にできなければ null。
 *
 * @param {unknown} raw
 * @returns {number | null}
 */
export function normalizeSeats(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : null;
  const text = normalizePhone(raw); // 全角数字 → 半角、前後空白の除去だけを借りる
  if (!/^\d{1,6}$/.test(text)) return null;
  return Number(text);
}

/**
 * @param {unknown} raw
 * @param {'company'|'name'|'email'|'phone'|'subject'|'appVersion'} key
 * @param {number} min
 * @param {number} max
 * @param {Record<string, string>} [labels] kind ごとの表示名
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
function singleLine(raw, key, min, max, labels = FIELD_LABELS) {
  const label = labels[key];
  const value = key === 'phone' ? normalizePhone(raw) : asString(raw).trim();
  if (value.length < min) {
    return {
      ok: false,
      message: min === 1 ? `${label}を入力してください` : `${label}は ${min} 文字以上で入力してください`,
    };
  }
  if (value.length > max) return { ok: false, message: `${label}は ${max} 文字以内で入力してください` };
  if (hasAnyControlChar(value)) return { ok: false, message: `${label}に使用できない文字が含まれています` };
  return { ok: true, value };
}

/**
 * フォームの値を検証し、送信用に正規化した値を返す。
 *
 * 誤りがあれば `errors` に **項目ごとの文面**を全部入れて返す (Worker と同じ文面)。
 * `website` (ハニーポット) は検査しない — 埋まっていても Worker が「成功したふり」の
 * 200 を返す契約なので、ここで弾くと bot に気付かれる。
 *
 * @param {Record<string, unknown>} input
 * @param {unknown} [kind] `'enterprise'` (既定) か `'general'`
 * @returns {{ ok: true, fields: Record<string, string | number> } | { ok: false, errors: Record<string, string> }}
 */
export function validateInquiry(input, kind) {
  const src = input && typeof input === 'object' ? input : {};
  return normalizeKind(kind) === 'general' ? validateGeneral(src) : validateEnterprise(src);
}

/**
 * 一般問い合わせ (`/contact/`, T-332)。会社名・電話番号・アカウント数は扱わない。
 *
 * 本文は **Enterprise と違って必須**にする。件名だけの問い合わせは返答のしようがなく、
 * Worker が受け付けても担当者が困るため — ここだけ意図的に Worker より厳しい。
 *
 * @param {Record<string, unknown>} src
 */
function validateGeneral(src) {
  const labels = GENERAL_LABELS;
  /** @type {Record<string, string>} */
  const errors = {};
  const out = { name: '', email: '', subject: '', message: '', appVersion: '', website: '' };

  const name = singleLine(src.name, 'name', 1, LIMITS.name, labels);
  if (name.ok) out.name = name.value;
  else errors.name = name.message;

  const email = singleLine(src.email, 'email', 1, LIMITS.email, labels);
  if (!email.ok) errors.email = email.message;
  else if (!EMAIL_RE.test(email.value)) errors.email = 'メールアドレスの形式が正しくありません';
  else out.email = email.value;

  const subject = singleLine(src.subject, 'subject', 1, LIMITS.subject, labels);
  if (subject.ok) out.subject = subject.value;
  else errors.subject = subject.message;

  const message = normalizeMessage(src.message);
  if (message.length === 0) errors.message = `${labels.message}を入力してください`;
  else if (message.length > LIMITS.message) {
    errors.message = `${labels.message}は ${LIMITS.message} 文字以内で入力してください`;
  } else if (hasInvalidMessageChar(message)) {
    errors.message = `${labels.message}に使用できない文字が含まれています`;
  } else out.message = message;

  // 任意項目。未入力はそのまま空で通し、入力があるときだけ単行・長さを見る
  if (asString(src.appVersion).trim() !== '') {
    const appVersion = singleLine(src.appVersion, 'appVersion', 1, LIMITS.appVersion, labels);
    if (appVersion.ok) out.appVersion = appVersion.value;
    else errors.appVersion = appVersion.message;
  }

  out.website = asString(src.website);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, fields: out };
}

/**
 * Enterprise 導入相談 (`/enterprise/inquiry/`, T-254)。規則は T-254 から不変。
 *
 * @param {Record<string, unknown>} src
 */
function validateEnterprise(src) {
  /** @type {Record<string, string>} */
  const errors = {};
  const out = { company: '', name: '', email: '', phone: '', seats: 0, message: '', website: '' };

  const company = singleLine(src.company, 'company', 1, LIMITS.company);
  if (company.ok) out.company = company.value;
  else errors.company = company.message;

  const name = singleLine(src.name, 'name', 1, LIMITS.name);
  if (name.ok) out.name = name.value;
  else errors.name = name.message;

  const email = singleLine(src.email, 'email', 1, LIMITS.email);
  if (!email.ok) errors.email = email.message;
  else if (!EMAIL_RE.test(email.value)) errors.email = 'メールアドレスの形式が正しくありません';
  else out.email = email.value;

  const phone = singleLine(src.phone, 'phone', LIMITS.phoneMin, LIMITS.phoneMax);
  if (!phone.ok) errors.phone = phone.message;
  else if (!PHONE_RE.test(phone.value)) {
    errors.phone = '電話番号は数字・+・-・空白・括弧のみで入力してください';
  } else out.phone = phone.value;

  const seats = normalizeSeats(src.seats);
  if (seats === null) errors.seats = `${FIELD_LABELS.seats}は整数で入力してください`;
  else if (seats < LIMITS.seatsMin) {
    errors.seats = `${FIELD_LABELS.seats}は ${LIMITS.seatsMin} 以上で入力してください (Enterprise は ${LIMITS.seatsMin} アカウントから)`;
  } else if (seats > LIMITS.seatsMax) {
    errors.seats = `${FIELD_LABELS.seats}は ${LIMITS.seatsMax} 以下で入力してください`;
  } else out.seats = seats;

  const message = normalizeMessage(src.message);
  if (message.length > LIMITS.message) {
    errors.message = `${FIELD_LABELS.message}は ${LIMITS.message} 文字以内で入力してください`;
  } else if (hasInvalidMessageChar(message)) {
    errors.message = `${FIELD_LABELS.message}に使用できない文字が含まれています`;
  } else out.message = message;

  out.website = asString(src.website);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, fields: out };
}

/**
 * `POST /inquiry` の JSON ボディ。`turnstileToken` は空なら載せない
 * (Worker は未指定と空文字を同じに扱うが、サイトキー未設定時に空のキーを送る意味が無い)。
 *
 * **enterprise は `kind` を載せない。** Worker の既定が enterprise なので、旧サイトからの
 * 送信とボディが 1 バイトも変わらず、公開の前後どちらでも同じ経路で受け付けられる。
 *
 * @param {Record<string, unknown>} fields `validateInquiry` が返した `fields`
 * @param {string} [turnstileToken]
 * @param {unknown} [kind]
 * @returns {Record<string, string | number>}
 */
export function buildPayload(fields, turnstileToken = '', kind) {
  const body = normalizeKind(kind) === 'general' ? generalBody(fields) : enterpriseBody(fields);
  return turnstileToken ? { ...body, turnstileToken } : body;
}

function enterpriseBody(fields) {
  return {
    company: fields.company,
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    seats: fields.seats,
    message: fields.message,
    website: fields.website,
  };
}

/** 任意項目の `appVersion` は、入力があるときだけ載せる (Worker 側も任意)。 */
function generalBody(fields) {
  const body = {
    kind: 'general',
    name: fields.name,
    email: fields.email,
    subject: fields.subject,
    message: fields.message,
    website: fields.website,
  };
  return fields.appVersion ? { ...body, appVersion: fields.appVersion } : body;
}

/**
 * 送信に失敗したときにフォームへ出す文面。
 *
 * 入力は Worker の応答 (`status` と JSON) だが、**文面はここで決める**。Worker の `message`
 * をそのまま出すのは `invalid_input` (項目ごとの日本語) だけ。未知の code / 壊れた JSON は
 * generic に倒す。
 *
 * @param {{ status: number, data?: unknown }} outcome `status` 0 = fetch 自体が失敗 (ネットワーク)
 * @param {{ supportEmail?: string }} [options]
 * @returns {{ kind: 'network'|'rate_limited'|'turnstile'|'invalid'|'delivery'|'unknown', message: string, field: string | null }}
 */
export function describeFailure(outcome, options = {}) {
  const status = typeof outcome?.status === 'number' ? outcome.status : 0;
  const data = outcome?.data && typeof outcome.data === 'object' ? outcome.data : {};
  const code = typeof data.code === 'string' ? data.code : '';
  const supportEmail = typeof options.supportEmail === 'string' ? options.supportEmail.trim() : '';
  const contactSupport = supportEmail ? `${supportEmail} まで直接ご連絡ください。` : '担当者まで直接ご連絡ください。';

  if (status === 0) {
    return {
      kind: 'network',
      field: null,
      message: '送信できませんでした。ネットワーク接続をご確認のうえ、もう一度お試しください。',
    };
  }
  if (status === 429 || code === 'rate_limited') {
    return {
      kind: 'rate_limited',
      field: null,
      message: '送信回数の上限に達しました。しばらく時間をおいて再度お試しください。',
    };
  }
  if (code === 'turnstile_failed') {
    return {
      kind: 'turnstile',
      field: null,
      message: '認証に失敗しました。ページを再読み込みしてください。',
    };
  }
  if (code === 'invalid_input') {
    const field = typeof data.field === 'string' && FIELD_NAMES.includes(data.field) ? data.field : null;
    const detail = typeof data.message === 'string' ? data.message.trim() : '';
    return {
      kind: 'invalid',
      field,
      message: detail || '入力内容をご確認ください。',
    };
  }
  if (status === 502 || code === 'delivery_failed') {
    return {
      kind: 'delivery',
      field: null,
      message: `お問い合わせを受け付けられませんでした。お手数ですが時間をおいて再度お試しいただくか、${contactSupport}`,
    };
  }
  return {
    kind: 'unknown',
    field: null,
    message: `送信に失敗しました。時間をおいて再度お試しいただくか、${contactSupport}`,
  };
}
