// T-2090 (login1111): `/join/` (法人の案内メールのリンクの着地点) のフラグメントの解釈。
//
// メール本文に `deepmosaic://` を直接書くとメールソフトが開けない / 警告を出すので、案内メールには
//   メンバー: https://www.deepmosaic.co.jp/join/#code=XXXX-XXXX-XXXX
//   管理者:   https://www.deepmosaic.co.jp/join/#admin
// の https リンクを入れ、このページから利用者がボタンでアプリを開く。
// アプリ (desktop 2.13、T-2087〜T-2089) が受ける URL は `deepmosaic://join?code=…` と `deepmosaic://login` の 2 つだけ。
//
// 組織コードを**フラグメント (#…)** に置いているのは、フラグメントはブラウザからサーバーへ送られない
// (HTTP のリクエストにも Referer にも載らない) ため。配信元 (GitHub Pages / Cloudflare) のログにコードが残らない。
//
// DOM に触らない純関数だけを置く (`node --test src/lib/join-hash.test.js`)。DOM 側は `src/main.js` の initJoinPage。

/** 組織コードの形 (大文字化・前後の空白除去の後に照合する)。 */
export const ORG_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** これより長いフラグメントは読まない (正しいリンクは `code=` + 14 文字)。 */
export const MAX_HASH_LENGTH = 64;

/** アプリが受ける URL (desktop 2.13)。 */
export const APP_JOIN_URL = 'deepmosaic://join';
export const APP_LOGIN_URL = 'deepmosaic://login';

const INVALID = Object.freeze({ kind: 'invalid' });
const ADMIN = Object.freeze({ kind: 'admin' });

/** パーセントエンコードを解く。壊れた列 (`%E0%A4` など) は null。 */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * `location.hash` を解釈する。
 *
 * - `#code=<組織コード>` → `{ kind: 'code', code }` (code は大文字化・空白除去済みで、形の検証に通ったもの)
 * - `#admin` → `{ kind: 'admin' }`
 * - それ以外 (空・不正な形・長すぎ・余計な値) → `{ kind: 'invalid' }`
 *
 * 検証に通らない値は返さない (呼び出し側が画面に出せないようにする)。
 *
 * @param {unknown} hash `location.hash` (先頭の `#` はあってもなくてもよい)
 * @returns {{ kind: 'code', code: string } | { kind: 'admin' } | { kind: 'invalid' }}
 */
export function parseJoinHash(hash) {
  if (typeof hash !== 'string') return INVALID;
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (body.length === 0 || body.length > MAX_HASH_LENGTH) return INVALID;

  if (body.trim().toLowerCase() === 'admin') return ADMIN;

  const match = body.match(/^code=([^&]*)$/i);
  if (match === null) return INVALID;
  const decoded = safeDecode(match[1]);
  if (decoded === null) return INVALID;
  const code = decoded.trim().toUpperCase();
  return ORG_CODE_PATTERN.test(code) ? { kind: 'code', code } : INVALID;
}

/**
 * 組織コードからアプリを開く URL を作る。形の検証に通らない値は null (href に入れない)。
 *
 * @param {string} code
 * @returns {string | null}
 */
export function joinAppUrl(code) {
  if (typeof code !== 'string' || !ORG_CODE_PATTERN.test(code)) return null;
  return `${APP_JOIN_URL}?code=${encodeURIComponent(code)}`;
}
