// 問い合わせフォームの入力検証 (T-254、T-332 で kind 分岐、T-516 で general の項目を削減)。
//
// 送信先は `desktop/worker-auth0-updater/src/inquiry.ts` (T-253) の `POST /inquiry`。
// **ここは Worker 側の `validateInquiry` の写し**で、規則 (上限・正規表現・制御文字・U+FFFD 拒否) を
// 同じにしてある。サーバ側が正で、ここは往復を減らすための前検査に過ぎない —
// ここを緩めても Worker が 400 を返すだけだが、厳しくすると正当な入力を送れなくなる。
// **規則を変えるときは Worker と同時に変える。**
//
// ## 2 種類の問い合わせ (T-331 / T-332)
//
// | kind | ページ | 項目 |
// |------|--------|------|
// | `enterprise` (既定) | `/enterprise/inquiry/` | 会社名・氏名・メール・電話・アカウント数・ご相談内容・会社の Web ページ (任意、T-1958) |
// | `general` | `/contact/` | メール・お問い合わせ内容 |
//
// general の氏名・件名・ご利用中のバージョンは T-516 (2026-09-23 ユーザー決定) で廃止した。
// Worker 側 (`inquiry-validate.ts`) と同じく、入力に旧項目が付いていても**検査せず・送らず**に
// 無視する (旧フォームの値が残っていても 400 の往復を作らない)。
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
// - **言語 (T-2206、i18n1112 I18N-708)。** 項目名と文は言語ごとの表 (`LABELS`・`MESSAGES`) から選ぶ。
//   ja は既存の定数・文面のまま (言語の引数を省くと ja)。英中は同じ規則の結果を訳した文にするだけで、
//   検証の規則 (`LIMITS`・正規表現・正規化) と送る内容 (`buildPayload`) は言語に依らない。**言語は送らない。**

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
  seatsMin: 1,
  seatsMax: 10_000,
  message: 4000,
  /** 会社の Web ページ (T-1958)。`https://` を補った後の長さで数える */
  companyUrl: 500,
});

/**
 * フォームに出す項目名 (全 kind 分)。Worker のエラー応答の `field` をこの表で表示に
 * 対応させる。`message` の表示名だけ kind で変わる (general は `GENERAL_LABELS`)。
 * T-516 で廃止した general の件名・バージョンは載せない — どのフォームにも欄が無いので、
 * Worker がその項目名を返しても項目に紐づけず、文面だけを警告に出す。
 */
export const FIELD_LABELS = Object.freeze({
  company: '会社名',
  companyUrl: '会社の Web ページ',
  name: '氏名',
  email: 'メールアドレス',
  phone: '電話番号',
  seats: '利用アカウント予定数',
  message: 'ご相談内容',
});

/** `describeFailure` が受け付ける項目名 (全 kind の和集合)。 */
export const FIELD_NAMES = Object.freeze(Object.keys(FIELD_LABELS));

/**
 * kind ごとの項目と**並び**。誤りがあったときに最初の項目へフォーカスする順でもあるので、
 * 画面の上から下の順に並べる。
 */
const FIELD_ORDER = Object.freeze({
  enterprise: Object.freeze(['company', 'companyUrl', 'name', 'email', 'phone', 'seats', 'message']),
  general: Object.freeze(['email', 'message']),
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

// ── 言語ごとの項目名と文 (T-2206、i18n1112 I18N-708) ────────────────────────
//
// 言語は 'ja' | 'en' | 'zh-tw' (`src/lib/site-lang.js` の pageLang と同じ値)。それ以外は ja。
// ja の値は上の既存の定数と今の文面そのもの。英中の文は画面にだけ出し、Worker・メール・Slack は日本語のまま。

const EN_LABELS = Object.freeze({
  company: 'Company name',
  companyUrl: 'Company website',
  name: 'Name',
  email: 'Email address',
  phone: 'Phone number',
  seats: 'Planned number of accounts',
  message: 'Details of your inquiry',
});

const ZH_LABELS = Object.freeze({
  company: '公司名稱',
  companyUrl: '公司網站',
  name: '姓名',
  email: '電子郵件地址',
  phone: '電話號碼',
  seats: '預計使用的帳號數',
  message: '諮詢內容',
});

/** 画面に出す項目名 (言語 × kind)。ja は既存の `FIELD_LABELS` / `GENERAL_LABELS` そのもの。 */
const LABELS = Object.freeze({
  ja: Object.freeze({ enterprise: FIELD_LABELS, general: GENERAL_LABELS }),
  en: Object.freeze({ enterprise: EN_LABELS, general: Object.freeze({ ...EN_LABELS, message: 'Message' }) }),
  'zh-tw': Object.freeze({ enterprise: ZH_LABELS, general: Object.freeze({ ...ZH_LABELS, message: '詢問內容' }) }),
});

/**
 * 検証の文の中で使う項目名。ja・zh-tw は項目名そのまま。en は文の途中に置くので小文字の名詞句
 * (`Enter your company name.`)。
 */
const EN_INLINE = Object.freeze({
  company: 'your company name',
  companyUrl: 'your company website',
  name: 'your name',
  email: 'your email address',
  phone: 'your phone number',
  seats: 'the planned number of accounts',
  message: 'the details of your inquiry',
});
const INLINE_LABELS = Object.freeze({
  ja: LABELS.ja,
  en: Object.freeze({ enterprise: EN_INLINE, general: Object.freeze({ ...EN_INLINE, message: 'your message' }) }),
  'zh-tw': LABELS['zh-tw'],
});

/** 英中の数の表記 (桁区切り)。ja は今の文面のまま区切らない。 */
const num = (n) => n.toLocaleString('en-US');

/**
 * 検証と送信の失敗の文。ja は今の文面のコピー (語順・空白・句読点を変えない)。
 * 関数の引数は (項目名, 数) か (問い合わせ先の文)。
 */
const MESSAGES = Object.freeze({
  ja: Object.freeze({
    required: (label) => `${label}を入力してください`,
    tooShort: (label, min) => `${label}は ${min} 文字以上で入力してください`,
    tooLong: (label, max) => `${label}は ${max} 文字以内で入力してください`,
    forbiddenChar: (label) => `${label}に使用できない文字が含まれています`,
    emailFormat: 'メールアドレスの形式が正しくありません',
    phoneFormat: '電話番号は数字・+・-・空白・括弧のみで入力してください',
    seatsInteger: (label) => `${label}は整数で入力してください`,
    seatsMin: (label, min) => `${label}は ${min} 以上で入力してください (Enterprise は ${min} アカウントから)`,
    seatsMax: (label, max) => `${label}は ${max} 以下で入力してください`,
    urlFormat: () => COMPANY_URL_FORMAT_MESSAGE,
    network: '送信できませんでした。ネットワーク接続をご確認のうえ、もう一度お試しください。',
    rateLimited: '送信回数の上限に達しました。しばらく時間をおいて再度お試しください。',
    turnstile: '認証に失敗しました。ページを再読み込みしてください。',
    invalidGeneric: '入力内容をご確認ください。',
    /** ja は Worker の文面 (`detail`) をそのまま出すので使わない */
    invalidField: null,
    contactWith: (email) => `${email} まで直接ご連絡ください。`,
    contactWithout: '担当者まで直接ご連絡ください。',
    delivery: (contact) =>
      `お問い合わせを受け付けられませんでした。お手数ですが時間をおいて再度お試しいただくか、${contact}`,
    unknown: (contact) => `送信に失敗しました。時間をおいて再度お試しいただくか、${contact}`,
  }),
  en: Object.freeze({
    required: (label) => `Enter ${label}.`,
    tooShort: (label, min) => `Enter at least ${num(min)} characters for ${label}.`,
    tooLong: (label, max) => `Enter ${label} in ${num(max)} characters or fewer.`,
    forbiddenChar: (label) => `Remove characters that can't be used from ${label}.`,
    emailFormat: 'Enter a valid email address.',
    phoneFormat: 'Use only digits, +, -, spaces, and parentheses in your phone number.',
    seatsInteger: (label) => `Enter a whole number for ${label}.`,
    seatsMin: (label, min) =>
      `Enter ${num(min)} or more for ${label} (Enterprise starts at ${num(min)} ${min === 1 ? 'account' : 'accounts'}).`,
    seatsMax: (label, max) => `Enter ${num(max)} or less for ${label}.`,
    urlFormat: (label) => `Enter ${label} as a URL (example: https://example.co.jp).`,
    network: "Couldn't send your message. Check your network connection and try again.",
    rateLimited: "You've reached the sending limit. Wait a while and try again.",
    turnstile: 'Verification failed. Reload the page.',
    invalidGeneric: 'Check your entries.',
    invalidField: 'Check this field.',
    contactWith: (email) => `contact ${email} directly.`,
    contactWithout: 'contact us directly.',
    delivery: (contact) => `We couldn't accept your inquiry. Wait a while and try again, or ${contact}`,
    unknown: (contact) => `Couldn't send your message. Try again later, or ${contact}`,
  }),
  'zh-tw': Object.freeze({
    required: (label) => `請輸入${label}。`,
    tooShort: (label, min) => `${label}至少須輸入 ${num(min)} 個字元。`,
    tooLong: (label, max) => `${label}最多可輸入 ${num(max)} 個字元。`,
    forbiddenChar: (label) => `${label}含有無法使用的字元。`,
    emailFormat: '電子郵件地址的格式不正確。',
    phoneFormat: '電話號碼只能輸入數字、+、-、空白與括號。',
    seatsInteger: (label) => `${label}請輸入整數。`,
    seatsMin: (label, min) => `${label}請輸入 ${num(min)} 以上的數字（Enterprise 至少需要 ${num(min)} 個帳號）。`,
    seatsMax: (label, max) => `${label}請輸入 ${num(max)} 以下的數字。`,
    urlFormat: (label) => `${label}請以 URL 格式輸入（例如：https://example.co.jp）。`,
    network: '無法送出。請確認網路連線後再試一次。',
    rateLimited: '已達送出次數上限。請稍後再試。',
    turnstile: '驗證失敗。請重新載入頁面。',
    invalidGeneric: '請確認輸入的內容。',
    invalidField: '請確認此欄位的內容。',
    contactWith: (email) => `直接寫信至 ${email} 與我們聯絡。`,
    contactWithout: '直接與負責人員聯絡。',
    delivery: (contact) => `無法受理您的詢問。請稍後再試，或${contact}`,
    unknown: (contact) => `送出失敗。請稍後再試，或${contact}`,
  }),
});

/** 未知の言語は ja。 */
function langOf(lang) {
  return Object.prototype.hasOwnProperty.call(LABELS, lang) ? lang : 'ja';
}

/**
 * 画面に出す項目名 (T-2206)。ja は既存の `FIELD_LABELS` (general は message だけ「お問い合わせ内容」)。
 *
 * @param {unknown} [kind]
 * @param {string} [lang] `'ja'` (既定) | `'en'` | `'zh-tw'`
 * @returns {Readonly<Record<string, string>>}
 */
export function labelsFor(kind, lang = 'ja') {
  return LABELS[langOf(lang)][normalizeKind(kind)];
}

/** 検証の文の部品 (文の中の項目名と文の表)。 */
function textsFor(kind, lang) {
  const l = langOf(lang);
  return { labels: INLINE_LABELS[l][normalizeKind(kind)], msg: MESSAGES[l] };
}

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
    return { email: '', message: '', website: '' };
  }
  return {
    company: '',
    companyUrl: '',
    name: '',
    email: '',
    phone: '',
    seats: LIMITS.seatsMin,
    message: '',
    website: '',
  };
}

/**
 * T-404: 文字化けの跡 (U+FFFD REPLACEMENT CHARACTER)。
 *
 * Worker は本文を fatal UTF-8 でデコードするようになったが、**送信元が既に化けていれば**
 * 正しい UTF-8 として U+FFFD が届く。Slack / メール / Supabase に `����` を通さないため、
 * Worker (`inquiry-validate.ts`) と同じく制御文字と同じ扱いで拒否する。
 */
const REPLACEMENT_CHAR_CODE = 0xfffd;

/** 1 行フィールド用: 制御文字 (U+0000–U+001F, U+007F) と U+FFFD を一切許さない。 */
function hasForbiddenChar(s) {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
    if (code === REPLACEMENT_CHAR_CODE) return true;
  }
  return false;
}

/** 本文用: `\t` / `\n` 以外の制御文字と U+FFFD を拒否する。 */
function hasForbiddenMessageChar(s) {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x7f || code === REPLACEMENT_CHAR_CODE) return true;
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
 * @param {'company'|'name'|'email'|'phone'} key
 * @param {number} min
 * @param {number} max
 * @param {{ labels: Record<string, string>, msg: typeof MESSAGES.ja }} [texts] 言語と kind ごとの項目名と文 (既定は ja の enterprise)
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
function singleLine(raw, key, min, max, texts = textsFor('enterprise', 'ja')) {
  const { labels, msg } = texts;
  const label = labels[key];
  const value = key === 'phone' ? normalizePhone(raw) : asString(raw).trim();
  if (value.length < min) {
    return {
      ok: false,
      message: min === 1 ? msg.required(label) : msg.tooShort(label, min),
    };
  }
  if (value.length > max) return { ok: false, message: msg.tooLong(label, max) };
  if (hasForbiddenChar(value)) return { ok: false, message: msg.forbiddenChar(label) };
  return { ok: true, value };
}

const COMPANY_URL_FORMAT_MESSAGE = `${FIELD_LABELS.companyUrl}は URL の形式で入力してください (例: https://example.co.jp)`;

/**
 * 先頭のスキーム (`javascript:` など)。ドットを含む名前 (`example.com:8080` の `example.com`) は
 * スキームではなくホストとみなし、`https://` を補う側に倒す (Worker と同一)。
 */
const SCHEME_RE = /^([A-Za-z][A-Za-z0-9+.-]*):/;

function withDefaultScheme(value) {
  const scheme = SCHEME_RE.exec(value)?.[1];
  return scheme !== undefined && !scheme.includes('.') ? value : `https://${value}`;
}

/** ホスト名にドットが 1 つ以上あり、空のラベル (`a..b` / 末尾の `.`) が無い。 */
function hasDottedHost(hostname) {
  const labels = hostname.split('.');
  return labels.length >= 2 && labels.every((label) => label !== '');
}

/** `new URL()` で解釈して http(s)・ドット付きのホスト・ユーザー情報なしを確かめ、`href` を返す。 */
function parseHttpUrl(candidate) {
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (!hasDottedHost(url.hostname)) return null;
  return url.href;
}

/**
 * 会社の Web ページ (T-1958、enterprise だけの任意項目。Worker の T-1952 `companyUrlField` の写し)。
 * 空 (trim 後) は未入力 = `null`。スキームが無ければ `https://` を補い、補った後の長さで上限を数える。
 * 空白・制御文字・U+FFFD は `new URL()` に渡す前に弾く (URL の解釈はタブ・改行を黙って取り除き、
 * 空白を `%20` にするため)。通ったら `URL#href` (ホストの小文字化・末尾の `/` の補完など) を返す。
 *
 * @param {unknown} raw
 * @param {string} [lang] 文の言語 (T-2206)。既定は ja (今の文面)。規則は言語に依らない
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
export function normalizeCompanyUrl(raw, lang = 'ja') {
  const { labels, msg } = textsFor('enterprise', lang);
  const formatMessage = msg.urlFormat(labels.companyUrl);
  const value = asString(raw).trim();
  if (value === '') return { ok: true, value: null };
  if (hasForbiddenChar(value) || /\s/.test(value)) return { ok: false, message: formatMessage };

  const candidate = withDefaultScheme(value);
  if (candidate.length > LIMITS.companyUrl) {
    return { ok: false, message: msg.tooLong(labels.companyUrl, LIMITS.companyUrl) };
  }
  const href = parseHttpUrl(candidate);
  return href === null ? { ok: false, message: formatMessage } : { ok: true, value: href };
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
 * @param {string} [lang] 誤りの文の言語 (T-2206)。既定は ja (今の文面)。どの欄が誤りか・`fields` は言語に依らない
 * @returns {{ ok: true, fields: Record<string, string | number> } | { ok: false, errors: Record<string, string> }}
 */
export function validateInquiry(input, kind, lang = 'ja') {
  const src = input && typeof input === 'object' ? input : {};
  return normalizeKind(kind) === 'general'
    ? validateGeneral(src, textsFor('general', lang))
    : validateEnterprise(src, textsFor('enterprise', lang), lang);
}

/**
 * 一般問い合わせ (`/contact/`, T-332 → T-516)。メールアドレスとお問い合わせ内容だけを扱う。
 * 会社名・電話番号・アカウント数 (Enterprise 専用) と、T-516 で廃止した氏名・件名・
 * ご利用中のバージョンは**読まない** — 付いていても検査も送信もしない (Worker と同じ契約)。
 *
 * 本文は **Enterprise と違って必須**にする。本文の無い問い合わせは返答のしようがなく、
 * Worker が受け付けても担当者が困るため — ここだけ意図的に Worker より厳しい。
 *
 * @param {Record<string, unknown>} src
 * @param {{ labels: Record<string, string>, msg: typeof MESSAGES.ja }} texts 言語ごとの項目名と文 (T-2206)
 */
function validateGeneral(src, texts) {
  const { labels, msg } = texts;
  /** @type {Record<string, string>} */
  const errors = {};
  const out = { email: '', message: '', website: '' };

  const email = singleLine(src.email, 'email', 1, LIMITS.email, texts);
  if (!email.ok) errors.email = email.message;
  else if (!EMAIL_RE.test(email.value)) errors.email = msg.emailFormat;
  else out.email = email.value;

  const message = normalizeMessage(src.message);
  if (message.length === 0) errors.message = msg.required(labels.message);
  else if (message.length > LIMITS.message) {
    errors.message = msg.tooLong(labels.message, LIMITS.message);
  } else if (hasForbiddenMessageChar(message)) {
    errors.message = msg.forbiddenChar(labels.message);
  } else out.message = message;

  out.website = asString(src.website);

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, fields: out };
}

/**
 * Enterprise 導入相談 (`/enterprise/inquiry/`, T-254)。規則は T-254 から不変。
 *
 * @param {Record<string, unknown>} src
 * @param {{ labels: Record<string, string>, msg: typeof MESSAGES.ja }} texts 言語ごとの項目名と文 (T-2206)
 * @param {string} lang
 */
function validateEnterprise(src, texts, lang) {
  const { labels, msg } = texts;
  /** @type {Record<string, string>} */
  const errors = {};
  const out = { company: '', name: '', email: '', phone: '', seats: 0, message: '', website: '' };

  const company = singleLine(src.company, 'company', 1, LIMITS.company, texts);
  if (company.ok) out.company = company.value;
  else errors.company = company.message;

  const name = singleLine(src.name, 'name', 1, LIMITS.name, texts);
  if (name.ok) out.name = name.value;
  else errors.name = name.message;

  const email = singleLine(src.email, 'email', 1, LIMITS.email, texts);
  if (!email.ok) errors.email = email.message;
  else if (!EMAIL_RE.test(email.value)) errors.email = msg.emailFormat;
  else out.email = email.value;

  const phone = singleLine(src.phone, 'phone', LIMITS.phoneMin, LIMITS.phoneMax, texts);
  if (!phone.ok) errors.phone = phone.message;
  else if (!PHONE_RE.test(phone.value)) {
    errors.phone = msg.phoneFormat;
  } else out.phone = phone.value;

  const seats = normalizeSeats(src.seats);
  if (seats === null) errors.seats = msg.seatsInteger(labels.seats);
  else if (seats < LIMITS.seatsMin) {
    errors.seats = msg.seatsMin(labels.seats, LIMITS.seatsMin);
  } else if (seats > LIMITS.seatsMax) {
    errors.seats = msg.seatsMax(labels.seats, LIMITS.seatsMax);
  } else out.seats = seats;

  const message = normalizeMessage(src.message);
  if (message.length > LIMITS.message) {
    errors.message = msg.tooLong(labels.message, LIMITS.message);
  } else if (hasForbiddenMessageChar(message)) {
    errors.message = msg.forbiddenChar(labels.message);
  } else out.message = message;

  out.website = asString(src.website);

  // 会社の Web ページ (T-1958) は任意。未入力なら fields にキーごと持たない (Worker と同じ)
  const companyUrl = normalizeCompanyUrl(src.companyUrl, lang);
  if (!companyUrl.ok) errors.companyUrl = companyUrl.message;
  else if (companyUrl.value !== null) out.companyUrl = companyUrl.value;

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
    // T-1958: 未入力ならキーを載せない (旧サイトと同じボディのまま、Worker も未指定を未入力として扱う)
    ...(typeof fields.companyUrl === 'string' && fields.companyUrl !== '' ? { companyUrl: fields.companyUrl } : {}),
  };
}

/**
 * general のボディ。項目は Worker の general 契約 (T-516) と同じ `email` + `message` だけで、
 * `fields` に旧項目 (name / subject / appVersion) が混ざっていても載せない。
 */
function generalBody(fields) {
  return {
    kind: 'general',
    email: fields.email,
    message: fields.message,
    website: fields.website,
  };
}

/**
 * 送信に失敗したときにフォームへ出す文面。
 *
 * 入力は Worker の応答 (`status` と JSON) だが、**文面はここで決める**。Worker の `message`
 * をそのまま出すのは `invalid_input` (項目ごとの日本語) だけ。未知の code / 壊れた JSON は
 * generic に倒す。
 *
 * **英中 (T-2206) では Worker の `message` (日本語) を画面に出さない。** `invalid_input` は欄が分かれば
 * その欄の汎用の文 (`Check this field.`)、分からなければ `Check your entries.`。`kind` と `field` は言語に依らない。
 *
 * @param {{ status: number, data?: unknown }} outcome `status` 0 = fetch 自体が失敗 (ネットワーク)
 * @param {{ supportEmail?: string, lang?: string }} [options] `lang` は文の言語 (既定は ja = 今の文面)
 * @returns {{ kind: 'network'|'rate_limited'|'turnstile'|'invalid'|'delivery'|'unknown', message: string, field: string | null }}
 */
export function describeFailure(outcome, options = {}) {
  const status = typeof outcome?.status === 'number' ? outcome.status : 0;
  const data = outcome?.data && typeof outcome.data === 'object' ? outcome.data : {};
  const code = typeof data.code === 'string' ? data.code : '';
  const supportEmail = typeof options.supportEmail === 'string' ? options.supportEmail.trim() : '';
  const lang = langOf(options.lang);
  const msg = MESSAGES[lang];
  const contactSupport = supportEmail ? msg.contactWith(supportEmail) : msg.contactWithout;

  if (status === 0) {
    return {
      kind: 'network',
      field: null,
      message: msg.network,
    };
  }
  if (status === 429 || code === 'rate_limited') {
    return {
      kind: 'rate_limited',
      field: null,
      message: msg.rateLimited,
    };
  }
  if (code === 'turnstile_failed') {
    return {
      kind: 'turnstile',
      field: null,
      message: msg.turnstile,
    };
  }
  if (code === 'invalid_input') {
    const field = typeof data.field === 'string' && FIELD_NAMES.includes(data.field) ? data.field : null;
    if (lang !== 'ja') {
      // Worker の文面は日本語なので英中では出さない (T-2206)
      return { kind: 'invalid', field, message: field ? msg.invalidField : msg.invalidGeneric };
    }
    const detail = typeof data.message === 'string' ? data.message.trim() : '';
    return {
      kind: 'invalid',
      field,
      message: detail || msg.invalidGeneric,
    };
  }
  if (status === 502 || code === 'delivery_failed') {
    return {
      kind: 'delivery',
      field: null,
      message: msg.delivery(contactSupport),
    };
  }
  return {
    kind: 'unknown',
    field: null,
    message: msg.unknown(contactSupport),
  };
}
