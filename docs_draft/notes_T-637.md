# T-637 公開ドキュメントの効果・フェード・つなぎの画像と本文 (feat/T-637 に準備だけ)

## 変更点
- `_includes/docs/04-edit.html` (796 行、節 ID と目次は不変)
  - 冒頭の Liquid コメント (T-544 の記述) を T-637 の記述に置き換えた。
  - `#edit-overview` の「タイムライン」の行: 「効果」のパレットの文を「クリップの継ぎ目のはさみを押すと、フェードかつなぎを選べます」に。
  - `#timeline-edit` の「継ぎ目」の行: はさみ → 「フェード」「つなぎ」の小さなメニュー → サイドバーの該当タブがその継ぎ目にフォーカスして開く。
  - `#edit-fade`: 導入と kv を書き直し (はさみから選ぶ / 全体のフェード / クリップのフェード (選択中の継ぎ目・選択中のクリップの節) / 秒数の調整 / 置けない所 / 先頭へ・末尾へ)。
    パレット・チップのドラッグ・キーボードのチップ・反対側の端の説明を削除。edit-effects の figure を撤去し、edit-join-menu の figure を追加。edit-fade の alt にランプの写りを追記。
  - `#edit-transition`: 導入と kv を書き直し (置き方 = はさみ → つなぎ → サイドバー / 帯とバッジ / 空白のある継ぎ目 (行に理由) / クリップのフェード (書き出しで無視の注記) / プレビュー)。
- `index.html`: TIMELINE の「フェードとトランジション」のカードとコメントを新しい導線に。
- `assets/img/screenshots/edit-effects.webp` を削除 (git rm)。
- 回帰テスト
  - `src/lib/docs-edit-effects.test.js` を新しい契約 (5 項目) で書き直し: 19 件。
    修正前のツリー (HEAD 3129a12 の本文・画像) では **19 件中 9 件 FAIL + 1 件 todo**。
  - `src/lib/top-page-features.test.js` のカードの検査を「はさみ / フェード / つなぎ / クリップごと」あり・「「効果」/ チップ」なしに。修正前は 1 件 FAIL。
  - `docs-edit-timeline.test.js` は不変 (NEW_SCREENSHOTS の edit-fade / edit-transition は緑)。

## 撮影 (未実施 — リーダー作業)
- Implementer はアプリの起動 (screenshots.mjs) を禁止されているため、撮影していない。
- **edit-join-menu.webp がまだ無い。** `docs-edit-effects.test.js` の「edit-join-menu.webp の実ファイルがあり、寸法が一致する」は
  ファイルが無い間だけ `todo` (失敗を表示し続けるが exit 0)。置いた時点で通常の検査になる。
- edit-fade.webp / edit-transition.webp は旧撮影 (T-542) のまま。alt は T-636 の撮影プラン (同じ fixture・同じ opener) に合わせてある。
- リーダーの手順 (ウェーブ末尾の E2E runner の後、他の desktop アプリが無いことを確かめて):
  ```bash
  cd <desktop main checkout> && node scripts/e2e/screenshots.mjs --kill-existing --only=edit-join-menu,edit-fade,edit-transition
  # report.json の MISS が 0 件であること
  cp screenshots/{edit-join-menu,edit-fade,edit-transition}.png <wt>/deepmosaic.github.io/assets/img/screenshots/
  cd <wt>/deepmosaic.github.io && node scripts/optimize-images.mjs --apply && node scripts/check-docs.mjs --fix-dims
  npm test   # todo が 0 件になること
  ```
  撮った絵が alt (はさみの下に「フェード」「つなぎ」のメニュー、継ぎ目の斜線の帯) と合わなければ alt を直す。

## 実行したコマンド
- `npm test` (= `node --test src/lib/*.test.js`): 308 件、pass 306 / fail 0 / todo 1 (edit-join-menu の実ファイル)。
- `node scripts/check-docs.mjs --fix-dims`: 書き換えなし (edit-join-menu はファイルが無いので対象外)。
- `npm run build && bundle exec jekyll build && node scripts/check-docs.mjs`: 実行した。問題は 1 件だけ
  「画像ファイルが無い: /assets/img/screenshots/edit-join-menu.webp」(撮影待ち)。
- `optimize-images.mjs --apply`: 撮影していないので未実行。

## 注意点・既知の制約
- 公開しない (質問 8)。master への merge / push / PR / Pages の起動はしない。
- 申し送り: ショートカットの表に Ctrl+Shift+B (T-626) と W (T-632) が無い (`docs-edit-timeline.test.js` の写しも 56 個のまま)。範囲外。
- 「ランプのクリックでサイドバーの「フェード」が開く」「バッジのホバーで種類と秒数」は desktop main (09ed5425) の
  TimelineJoinMarks / 撮影プランの opener から読んだ現行の挙動として残した。

## 公開の手順 (リーダー向け)
アプリのリリースの後に、撮影と上の後処理を済ませ、`npm run build && bundle exec jekyll build && node scripts/check-docs.mjs`
が緑であることを確かめてから feat/T-637 を master へ merge して push する。

## ロールバック
feat/T-637 を捨てれば元に戻る (master は 3129a12 のまま)。
