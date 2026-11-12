// T-2210 (i18n1112、ウェーブ末尾の追い修正 2026-11-12): `/join/` の言語の切り替えで組織コードを引き継ぐ。
//
// 案内メールのリンク (`/join/#code=XXXX-XXXX-XXXX` / `/join/#admin`) で開いたページで言語を切り替えると、
// 切り替えのリンク (`/en/join/` など) にはフラグメントが無いので、行き先で「リンクが正しくない」になっていた。
// 切り替え (ヘッダー・フッター・ドロワー) と言語の案内の帯のリンクの行き先に、今のフラグメントを付け直す。
//
// - コードはフラグメントのまま (サーバー・Referer に載らない)。ログ・計測・innerHTML に出さない。
// - 付けるのは `parseJoinHash` (join-hash.js) の検証に通った値を作り直したものだけ (生の location.hash は使わない)。
// - 行き先が join の 3 版のどれかのときだけ付ける。それ以外の行き先 (サイトの外を含む) は触らない。
//
// DOM に触らない純関数だけを置く (`node --test src/lib/i18n-site-wave-end.test.js`)。DOM 側は `src/main.js` の initJoinPage。

import { parseJoinHash } from './join-hash.js';

/** 組織への参加のページ (ja / en / zh-tw) のパス */
export const JOIN_PATHS = Object.freeze(['/join/', '/en/join/', '/zh-tw/join/']);

/**
 * 切り替えのリンクの行き先に、今のページのフラグメント (検証済み) を付け直す。
 *
 * @param {unknown} href リンクの href 属性の値 (サイト内のパス)
 * @param {unknown} hash 今の `location.hash`
 * @returns {unknown} join の行き先なら `<path>#code=…` / `<path>#admin` / `<path>` (検証に通らなければフラグメントなし)。
 *   それ以外は href をそのまま返す。
 */
export function carryJoinHash(href, hash) {
  if (typeof href !== 'string') return href;
  const cut = href.indexOf('#');
  const path = cut >= 0 ? href.slice(0, cut) : href;
  if (!JOIN_PATHS.includes(path)) return href;
  const parsed = parseJoinHash(hash);
  if (parsed.kind === 'code') return `${path}#code=${encodeURIComponent(parsed.code)}`;
  if (parsed.kind === 'admin') return `${path}#admin`;
  return path;
}
