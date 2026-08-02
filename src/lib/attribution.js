// ダウンロードの流入経路の引き継ぎ (TICKET-SITE-37)。
//
// DL ボタンは Cloudflare Worker (`/download/latest/windows`) へ向いていて、worker が
// クエリの `utm_*` と `ref` を Supabase の `app_downloads` に記録する。そこから先は
// インストーラのファイル名に埋めたトークン経由でアプリのユーザーと紐づく。
//
// ## なぜこの配管が要るのか (実測)
//
// 1. **`utm_*` が届かない。** `?utm_source=x` で着地しても、別のページを経由してから
//    DL を押すと URL からは消えている。実測で全件 NULL だった。
// 2. **外部の参照元が届かない。** ホームページは GitHub Pages 配信で `Referrer-Policy`
//    を指定する手段が無く、既定の `strict-origin-when-cross-origin` では
//    クロスオリジンの worker へ `https://www.deepmosaic.co.jp/` しか送られない。
//    実測でもそうなっていた。**サイト内のどのページから押したかすら分からない。**
//
// そこで「着地時に拾って sessionStorage へ置き、DL リンクの href に載せ直す」。
//
// ## この module の約束
//
// - **純関数だけ。** DOM / sessionStorage / location に触らない (`src/main.js` の
//   `initDownloadTracking()` だけが impure)。`node --test` でそのまま検証できる。
// - **入力を一切信用しない。** 値の出所は着地 URL のクエリで、攻撃者が自由に作れる。
//   sessionStorage の中身も由来は同じなので、読み出し時に再検証する。
// - **href の組み立ては `URL` + `searchParams.set()` だけ。** 文字列連結にすると
//   `utm_campaign` に仕込まれた `#` 以降が fragment になって worker に届かず、
//   `&` の注入も通る。`a.href = <クエリ由来の値>` の直接代入は `javascript:` への
//   すり替えが成立するので絶対にやらない。

/** worker 側 (`download-tracking.ts` の `clip`) と同じ上限。ズレると DB と GA4 が食い違う */
const MAX = { s: 120, m: 120, c: 200, r: 200 };

/**
 * 使える文字だけに絞り、上限で切る。
 *
 * 許可リスト方式。**日本語のキャンペーン名は使えない** (ローマ字にする運用)。
 * 弾いたときは値だけを `null` にして record 全体は捨てない — utm の 1 つが
 * 不正でも残りは記録したい。
 *
 * 切らないと `?utm_campaign=<10万文字>` を仕込んだリンクを踏ませるだけで
 * DL URL が URL 長制限に当たり、**ダウンロードそのものが壊れる**。
 *
 * @param {string|null|undefined} raw
 * @param {number} max
 * @returns {string|null}
 */
export function sanitizeParam(raw, max) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^[A-Za-z0-9._~+%:/ -]+$/.test(trimmed)) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * `document.referrer` が**外部サイト**なら、その origin を返す。
 *
 * - 空文字 (直接アクセス / ブックマーク) は `null`
 * - 自サイト内の回遊も `null` — 流入経路ではないので上書きしてはいけない
 * - パスとクエリは捨てる。検索語や個人情報が乗りうるものを外部へ送らない
 *
 * **`startsWith` で自オリジン判定をしないこと。** `https://www.deepmosaic.co.jp.evil.com`
 * が自サイト扱いになる (= 外部からの流入を取りこぼす)。`URL.origin` で厳密に比べる。
 *
 * @param {string|null|undefined} referrer
 * @param {string} currentOrigin
 * @returns {string|null}
 */
export function externalReferrerOrigin(referrer, currentOrigin) {
  if (typeof referrer !== 'string' || referrer === '') return null;
  if (referrer.length > 2048) return null;
  let parsed;
  try {
    parsed = new URL(referrer);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (sameSite(parsed.origin, currentOrigin)) return null;
  return sanitizeParam(parsed.origin, MAX.r);
}

/**
 * 2 つの origin が同じサイトか。
 *
 * 単純な文字列比較だと **末尾ドット付きの FQDN**（`https://www.deepmosaic.co.jp./x`）が
 * 一致せず、サイト内の回遊が「外部からの流入」として記録されてしまう
 * （正規の流入経路を上書きする）。DNS 的には同じホストなので揃えてから比べる。
 */
function sameSite(a, b) {
  const norm = (o) => o.replace(/\.(?=$|:)/, '');
  return norm(a) === norm(b);
}

/**
 * 着地したページから流入経路を組み立てる。
 *
 * `utm_*` も外部参照元も無ければ `null` を返す = 「記録するものが無い」。
 * これが `mergeAttribution` の「上書きしない」の合図になる。
 *
 * @param {{ search: string, referrer: string, origin: string }} landing
 * @returns {{s: string|null, m: string|null, c: string|null, r: string|null}|null}
 */
export function attributionFromLanding({ search, referrer, origin }) {
  let params;
  try {
    params = new URLSearchParams(search ?? '');
  } catch {
    params = new URLSearchParams();
  }
  const record = {
    s: sanitizeParam(params.get('utm_source'), MAX.s),
    m: sanitizeParam(params.get('utm_medium'), MAX.m),
    c: sanitizeParam(params.get('utm_campaign'), MAX.c),
    r: externalReferrerOrigin(referrer, origin),
  };
  const hasAny = record.s !== null || record.m !== null || record.c !== null || record.r !== null;
  return hasAny ? record : null;
}

/**
 * last non-direct。**新しい着地があったときだけ、record ごと丸ごと差し替える。**
 *
 * 項目ごとにマージしない。片方だけ更新すると
 * 「`utm_source=twitter` なのに `r=https://www.google.com`」という、
 * どちらの経路でもない行ができてしまう。
 *
 * first-touch を採らないのは、`utm_*` の業界標準が last 上書きだから。
 * referrer だけ first にすると 2 つの思想が混ざる。
 *
 * @param {object|null} stored
 * @param {object|null} landing
 * @returns {object|null}
 */
export function mergeAttribution(stored, landing) {
  return landing ?? stored ?? null;
}

/** sessionStorage へ入れる形。キーは短く保つ (容量ではなく、開発者ツールで読みやすい) */
export function serializeAttribution(record) {
  if (record === null) return '';
  return JSON.stringify({ s: record.s, m: record.m, c: record.c, r: record.r });
}

/**
 * sessionStorage から読む。**中身は外部入力として扱う** — 由来は着地 URL のクエリで、
 * 保存後にユーザーが開発者ツールで書き換えることもできる。全項目を再検証する。
 *
 * @param {string|null|undefined} json
 * @returns {object|null}
 */
export function parseStoredAttribution(json) {
  if (typeof json !== 'string' || json === '') return null;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = {
    s: sanitizeParam(raw.s, MAX.s),
    m: sanitizeParam(raw.m, MAX.m),
    c: sanitizeParam(raw.c, MAX.c),
    r: sanitizeParam(raw.r, MAX.r),
  };
  const hasAny = record.s !== null || record.m !== null || record.c !== null || record.r !== null;
  return hasAny ? record : null;
}

/**
 * DL リンクの href に流入経路を載せる。
 *
 * **base は必ずマークアップ由来の href** (`a.href` の解決済み絶対 URL)。
 * `record` は値としてしか使わない。`set` なので二度呼んでも増えない (冪等)。
 *
 * @param {string} href
 * @param {object|null} record
 * @returns {string} 組み立てられなければ `href` をそのまま返す
 */
export function decorateDownloadUrl(href, record) {
  if (record === null) return href;
  let url;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (record.s !== null) url.searchParams.set('utm_source', record.s);
  if (record.m !== null) url.searchParams.set('utm_medium', record.m);
  if (record.c !== null) url.searchParams.set('utm_campaign', record.c);
  if (record.r !== null) url.searchParams.set('ref', record.r);
  return url.toString();
}

/**
 * GA4 の `file_download` に渡すパラメータ。
 *
 * **名前は Google の公式パラメータに揃える。** 揃えておけば標準ディメンションに乗り、
 * カスタムディメンションの登録 (上限 50・反映まで 24〜48h・遡及なし) が要らない。
 *
 * `file_name` がパス形式なのは、拡張計測が送る値の定義に合わせるため。
 * `link_id` は 8 箇所ある DL ボタンを区別する唯一の手段になる。
 *
 * @param {{href: string, text: string, id: string, classes: string}} link
 */
export function ga4FileDownloadParams({ href, text, id, classes }) {
  let pathname = href;
  try {
    pathname = new URL(href).pathname;
  } catch {
    /* href がそのまま入る。イベントを落とすほどではない */
  }
  return {
    file_extension: 'exe',
    file_name: pathname,
    link_url: href,
    link_text: (text ?? '').trim().slice(0, 100),
    link_id: id ?? '',
    link_classes: classes ?? '',
  };
}
