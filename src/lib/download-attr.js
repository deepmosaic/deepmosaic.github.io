// `<a download>` の属性値 (T-231)。
//
// `download` は**真偽属性ではない** (`hidden` / `disabled` とは違う)。値は保存時の
// ファイル名で、空文字なら「サーバの Content-Disposition / URL 末尾の名前で保存」。
// Svelte 5 で `download={!!flag}` と書くと `download="false"` が出力され、同一オリジンの
// リンクが "false.html" という名前の強制ダウンロードになる — スマホのドロワーで
// 料金 / ドキュメント / ホーム / 動作環境が開けなかった原因。クロスオリジンの DL 項目
// (r2-proxy) は download 属性がブラウザに無視されるので動き続け、バグを隠していた。
//
// 出力は `''` (属性を空値で付ける) か `undefined` (属性を付けない) の二択。
// Svelte は `undefined` で属性を外し、`''` で `download=""` を出す。
// CI (.github/workflows/jekyll.yml の Verify build output) がバンドルと HTML を検査する。

/**
 * @param {unknown} flag `data-links` の `download` (JSON 由来なので型を信用しない)
 * @returns {'' | undefined}
 */
export function downloadAttr(flag) {
  return flag ? '' : undefined;
}
