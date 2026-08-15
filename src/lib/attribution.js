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
 * **T-007 で保存先を sessionStorage から localStorage (30 日) へ広げたが、
 * 採用規則はここも含めて一切変えていない。** 変えたのは「どれだけ覚えているか」で
 * あって「どの接点を採るか」ではない。first-touch が要るなら別項目として持つこと
 * (T-008 の `dm_attr_first`)。片方の項目だけ first にすると上記の混在が起きる。
 *
 * @param {object|null} stored
 * @param {object|null} landing
 * @returns {object|null}
 */
export function mergeAttribution(stored, landing) {
  return landing ?? stored ?? null;
}

// ── 保存層 (T-007) ──────────────────────────────────────────────────────────
//
// 以前は sessionStorage に素の record を入れていたため、**タブを閉じた時点で流入元が
// 消えていた**。「Google で見つけて後日ダウンロード」が全部 direct になる。
// localStorage へ広げるが、永続に残すのは筋が悪いので有効期限を持たせる。
//
// **`serializeAttribution` / `parseStoredAttribution` は触らない。**
// あちらは `data-dl-attr` 属性のワイヤ形式で、`MobileNav.svelte` が使っている。

/** 保存した流入元を覚えておく期間。 */
export const ATTR_TTL_MS = 30 * 86_400_000;

/**
 * 保存用のエンベロープに包む。`now` は引数で受ける (この module は純関数だけ)。
 *
 * @param {object|null} record
 * @param {number} now エポック ms
 * @returns {string} 保存する文字列。record が null なら空文字
 */
export function serializeStored(record, now) {
  if (record === null) return '';
  return JSON.stringify({
    v: 2,
    exp: now + ATTR_TTL_MS,
    a: { s: record.s, m: record.m, c: record.c, r: record.r },
  });
}

/**
 * 保存されていた文字列を読む。**期限切れは `null`。**
 *
 * v1 (エンベロープ無しの素の record) も受理する — T-007 のリリースをまたいだ
 * セッションの流入元を落とさないため。中身は `parseStoredAttribution` が
 * 全項目を再検証するので、どちらの形でも「外部入力として扱う」性質は変わらない。
 *
 * @param {string|null|undefined} json
 * @param {number} now エポック ms
 * @returns {object|null}
 */
export function parseStoredEnvelope(json, now) {
  if (typeof json !== 'string' || json === '') return null;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // v1: 素の record ({s,m,c,r})。エンベロープが無いので期限も無い
  if (raw.a === undefined) return parseStoredAttribution(json);
  if (typeof raw.exp !== 'number' || !Number.isFinite(raw.exp)) return null;
  // **`<=` で切る。** 境界ちょうどを「まだ有効」にすると期限の定義が曖昧になる
  if (raw.exp <= now) return null;
  return parseStoredAttribution(JSON.stringify(raw.a));
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

// ── 初回接触 (first-touch) と計測実行マーカー (T-008) ────────────────────────
//
// 上の `mergeAttribution` は **last non-direct**。「最後にどこから来たか」は分かるが
// 「そもそもどこで知ったか」が残らない。first-touch は**別のキーで別に持つ** —
// 同じ record の一部だけ first にすると 2 つの思想が混ざる (mergeAttribution の注記)。
//
// `dm=1` (計測が走った印) も同時に運ぶ。これが無いと、ダッシュボード側で
// 「ブックマークや直打ち (真の直接アクセス)」と「JS が走らず何も取れなかった」を
// 区別できない (T-002 で「直接アクセス」という語彙を引退させた理由)。

/** first-touch を覚えておく期間。last-touch (30 日) より長く持つ。 */
export const FIRST_TTL_MS = 180 * 86_400_000;

/**
 * 着地ページの**パスだけ**を通す。
 *
 * クエリと fragment は受け取らない (検索語や個人情報が乗りうる)。
 * `..` を含むもの、`//` で始まるもの (プロトコル相対 URL に化ける)、
 * 許可文字以外を含むものは `null`。
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function sanitizeLandingPath(raw) {
  if (typeof raw !== 'string') return null;
  const p = raw.trim();
  if (p === '' || !p.startsWith('/')) return null;
  if (p.startsWith('//')) return null;
  if (p.includes('..')) return null;
  if (!/^[A-Za-z0-9._~/-]+$/.test(p)) return null;
  return p.length > 200 ? p.slice(0, 200) : p;
}

/**
 * 着地したページから first-touch を組み立てる。
 *
 * **`attributionFromLanding` と違って `null` を返さない。** 流入元が取れない
 * (＝直接アクセス) 場合も「最初に着いたページ」は残す価値がある。
 * 直接アクセスが first-touch であることそのものが事実。
 *
 * @param {{ search: string, referrer: string, origin: string, pathname: string }} landing
 * @returns {{s: string|null, r: string|null, lp: string|null}}
 */
export function firstTouchFromLanding({ search, referrer, origin, pathname }) {
  let params;
  try {
    params = new URLSearchParams(search ?? '');
  } catch {
    params = new URLSearchParams();
  }
  return {
    s: sanitizeParam(params.get('utm_source'), MAX.s),
    r: externalReferrerOrigin(referrer, origin),
    lp: sanitizeLandingPath(pathname),
  };
}

/** first-touch の保存形。`serializeStored` と同じエンベロープだが TTL が違う。 */
export function serializeFirst(record, now) {
  if (record === null) return '';
  return JSON.stringify({
    v: 1,
    exp: now + FIRST_TTL_MS,
    f: { s: record.s, r: record.r, lp: record.lp },
  });
}

/**
 * first-touch を読む。**中身は外部入力として再検証する。**
 *
 * @param {string|null|undefined} json
 * @param {number} now エポック ms
 * @returns {{s: string|null, r: string|null, lp: string|null}|null}
 */
export function parseFirstEnvelope(json, now) {
  if (typeof json !== 'string' || json === '') return null;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.f === null || typeof raw.f !== 'object' || Array.isArray(raw.f)) return null;
  if (typeof raw.exp !== 'number' || !Number.isFinite(raw.exp)) return null;
  if (raw.exp <= now) return null;
  const record = {
    s: sanitizeParam(raw.f.s, MAX.s),
    r: sanitizeParam(raw.f.r, MAX.r),
    lp: sanitizeLandingPath(raw.f.lp),
  };
  const hasAny = record.s !== null || record.r !== null || record.lp !== null;
  return hasAny ? record : null;
}

/**
 * DL リンクの href に流入経路を載せる。
 *
 * **base は必ずマークアップ由来の href** (`a.href` の解決済み絶対 URL)。
 * `record` は値としてしか使わない。`set` なので二度呼んでも増えない (冪等)。
 *
 * **`dm=1` は record が null でも必ず付ける** (T-008)。「計測が走ったのに
 * 流入元が無かった = 真の直接アクセス」を、「JS が走らなかった」と区別するため。
 * 逆に `dm=0` を素の href へ焼き込むことはしない — JSON-LD の `downloadUrl` にも
 * 同じ URL が出るうえ、「付いていない = 不明」で必要な区別は足りる。
 *
 * @param {string} href
 * @param {object|null} record last-touch
 * @param {object|null} [first] first-touch
 * @returns {string} 組み立てられなければ `href` をそのまま返す
 */
export function decorateDownloadUrl(href, record, first = null) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  url.searchParams.set('dm', '1');
  if (record !== null) {
    if (record.s !== null) url.searchParams.set('utm_source', record.s);
    if (record.m !== null) url.searchParams.set('utm_medium', record.m);
    if (record.c !== null) url.searchParams.set('utm_campaign', record.c);
    if (record.r !== null) url.searchParams.set('ref', record.r);
  }
  if (first !== null && first !== undefined) {
    if (first.s !== null) url.searchParams.set('futm_source', first.s);
    if (first.r !== null) url.searchParams.set('fref', first.r);
    if (first.lp !== null) url.searchParams.set('lp', first.lp);
  }
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
