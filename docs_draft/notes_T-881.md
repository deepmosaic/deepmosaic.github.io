# T-881 公開サイト: docs の「契約本数」→「契約アカウント数」

## 変更点
- `_includes/docs/02-account.html`「プランを選ぶ」節の本文 (「契約本数」を選べます → 「契約アカウント数」を選べます) と、スクリーンショット `plan-select.webp` の alt を「契約アカウント数」に置換。
- 回帰テスト `src/lib/docs-account-terms.test.js` を追加: `_includes/docs/*.html` の見える部分 (Liquid / HTML コメントを除く) に「契約本数」が無いこと、本文と alt が「契約アカウント数」であること。
- スクリーンショットは再撮影していない (alt だけ)。

## 据え置き (意図的)
- コメント内の「契約本数」(`02-account.html` / `06-ops.html` の TICKET-SITE-CONTRACT-SSOT 注記、`_data/faq.yml` / `.github/workflows/jekyll.yml` のコメント) は内部メモなので変えない。
- `src/lib/plan-catalog.js` の CI 用ラベル「契約本数の上限が食い違っている」は検査スクリプトの内部ラベルなので変えない。
- `_includes/contract-limits.html` は「最大 N 契約」で「N 本」を含まないため変更なし。
- 動画の本数 (「動画を 1 本選んで」等) は意味が違うので変えない。

## 追加・変更したコマンド
- なし (`npm test` に新しいテストファイルが自動で含まれる)。

## 注意点・既知の制約
- スクリーンショット画像の中の文言は旧表記 (「契約本数」) のまま。次回の撮り直しで揃う。

## ロールバック
- 本コミットの revert だけで戻る (データ・設定の変更なし)。
