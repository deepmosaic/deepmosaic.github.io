# T-2305 docs をサイト配布版の実態に (backlog1113 W5)

## 変更点
- `_includes/docs/01-intro.html`
  - `#install` を公開中 (origin/master) の文に戻した: インストーラ (Deepmosaic Setup) を実行・WebView2・インストーラの言語・インストール先・
    アップグレード (起動時の確認と「今すぐ更新」「あとで」、上書き実行、project.db の変換)・インストーラの途中で使用許諾。
    DL ボタンの note は公開中の文を「サインイン」の語にしたもの (「ダウンロードしてすぐ、サインインなしでお試しいただけます」)。
  - 節「インストーラ版（Deepmosaic Setup）をお使いの方へ」(2.11.1 で終了の案内) を削除。
  - ファイルメニューの「アップデートを確認」を公開中の文 (「本体 / エンジン / モデル・アセットの更新を確認します」) に戻した。
  - `#setup` の「検出エンジンと軽量の検出モデルはアプリに含まれています」・「ヘルプ」・GPU の自動取得・サインインの語はそのまま。
- `_includes/docs/06-ops.html`
  - `#update` を公開中の文 (自動確認のタイミング・今すぐ更新・あとで・手動で確認する) に戻し、ブランチの 2 行
    (検出エンジン = アプリに含まれ一緒に更新 / AI モデル = 起動時に取得) は残した。ブランチの「設定とデータ」の行は spec に無いので外した。
  - `#data` の「インストーラ版から Store 版に切り替えた場合も…」を削除。
  - `#uninstall` を公開中の文に戻した (確認画面のチェックで .deepmosaic とプロジェクトフォルダも消す)。2.13 から検出エンジンは
    アプリに含まれるので「検出エンジンと AI モデル」→「AI モデル等」だけ直した。動きは desktop `src-tauri/installer/hooks.nsh` の
    `NSIS_HOOK_POSTUNINSTALL` で確認 (更新以外では `%LOCALAPPDATA%\deepmosaic` を常に削除、チェックありで `%USERPROFILE%\.deepmosaic` と登録済みのプロジェクトフォルダも削除)。
  - `#licenses` は「Desktop 版のアプリには」。FFmpeg の「Store 版は差し替えできない」の文は Store だけの補足へ移した。
- `_includes/docs/07-team.html`: 「先にアプリをダウンロードしてインストールしてください」。
- 新しい部品 `_includes/docs/store-edition.html`: Store 版だけの補足 (入手先 = Store のボタン + ms-windows-store のリンク・インストール先・
  更新は Store が配信 / 更新ダイアログと「アップデートを確認」が無い・アプリ内に購入画面が無い・同梱 FFmpeg の差し替え不可・
  Premiere プラグイン 0.1.21 以降・アンインストールで残るもの・インストーラ版からの切り替え)。全体が
  `site.data.site.distribution.store_enabled` の if の中で、false (既定) のときは何も出ない。#install の末尾に置いた (h3 `#install-store`)。
  - 01-intro に条件を直接書かず部品にしたのは、T-2304 のテスト (`site-store-button-t2304.test.js`) が「切り替えを読むのは部品だけ」
    (01-intro は store_enabled を読まない) を固定しているため。`store-button.html` と `scripts/i18n/checks/store.mjs` のコメントの
    「この部品だけが読む」を「部品 (store-button と docs/store-edition) だけ」に直した。
  - 文は Store 前提だった版 (T-1917 / T-1922 / T-1900) の Store 向けの文を使った。掲載ページ (apps.microsoft.com) へのリンクは
    Store のボタンだけに置き、補足の中には置かない (check-store-toggle の「置き場所以外に出ない」と衝突させないため)。

## テスト
- 新規 `src/lib/site-copy-t2305.test.js` (12 件): #install / #update / #data / #uninstall / #licenses / 07-team の文、
  Store だけの補足が if の中にあり 4 点を書くこと、01 / 06 / 07 の本文に「Microsoft Store」が無いこと。先に書いて失敗を確認した。
- 期待値の書き直し (spec が許す範囲): `site-copy-t1917.test.js` の docs の 4 件 (#install / #update / #uninstall / #data) を削除し
  t2305 へ移した、`site-copy-help1111.test.js` の「アップデートを確認」、`site-copy-t924.test.js` の 01-intro のアップグレード。
- `node scripts/check-store-toggle.mjs` (true の出力) も OK。true の出力の docs に補足の節が出ることを目で確かめた。
- ja-identity: T-2305 の前のコミットの出力を基点に比べ、変わったのは `docs/index.html` だけ。

## 注意点・既知の制約
- `#install` の「インストーラの言語: 日本語（言語の選択画面は出ません）。アプリも日本語 UI です」は公開中の文のまま (2.13 は日本語固定)。
  2.14 で 3 言語を出すときは、アプリの表示言語の説明をこの行に足す必要がある (リーダーへの申し送り)。
- `02-account.html` の `#plan` に Store 版の文 (「Microsoft Store 版のアプリには購入画面がありません」) が残っている (T-2306 の対象)。
- docs は日本語だけなので accept-site は不要。

## 巻き戻し
- このコミットを revert すれば Store 前提の docs に戻る。`store-edition.html` は 01-intro からしか参照していない。
