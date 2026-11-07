# T-1854: 編集ページのショートカット表に BBox A→B をつなぐ (Y / Esc)

## 変更点

- `_includes/docs/04-edit.html`: ショートカット表の「BBox 編集」に `bbox_bridge` (Y) と `bbox_bridge_cancel` (Esc) の 2 行を `bbox_paste` の直後に追加 (rowspan 15 → 17)。
  Y の行には「つなぐ元」「もう一度押す」「滑らかにつなぐ」、右クリックの「ここからつなぐ」「ここへつなぐ」、Ctrl+Z 1 回で戻る、効き先 (最後にプレイヤーを操作したとき) を書いた。
- `src/lib/docs-edit-timeline.test.js`: desktop `EDIT_SHORTCUTS` の写しに 2 行、行数 74 → 76、Y / Esc の行の文言のテスト。

## 追加・変更したコマンド

なし (`npm test`)。

## 注意点・既知の制約

- 土台は `bridge1107-integrate` (f9af7e2、T-1827 の表を含む、未 push)。`smooth1108-integrate` がサイトに無かったため。
- desktop の公開 (T-1845 系) と同時にサイトを出す前提。push はしていない。

## ロールバック

表の 2 行と rowspan、テストの写し 2 行・行数・追加したテストを戻す (このチケットのコミットを revert)。
