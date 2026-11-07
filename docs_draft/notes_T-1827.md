# T-1827: ショートカット表に BBox のコピー / 貼り付け

## 変更点

- `_includes/docs/04-edit.html`
  - ショートカット表の「BBox 編集」に `bbox_copy` (Ctrl+C) / `bbox_paste` (Ctrl+V) の 2 行 (`delete_bbox` の直後、rowspan 13 → 15)。
  - `timeline_copy` / `timeline_paste` の説明に「最後にタイムラインを操作したとき」。
  - 表の上の箇条書き (Delete の効き先) に Ctrl+C / V も同じ規則であることを追記。
- `src/lib/docs-edit-timeline.test.js`: `EDIT_SHORTCUTS_FIXTURE` に 2 件 (desktop と同じ並び)、`SHORTCUT_ROW_COUNT` 72 → 74、
  Ctrl+C / V の行が効き先を書き分けていることのテストを追加。

## 追加・変更したコマンド

- なし (`npm test`)。

## 注意点・既知の制約

- master への push は公開になる。desktop の実処理 (T-1832) とリリースに合わせて公開する。

## ロールバック

- 表の 2 行と rowspan、説明の追記、テストの写しを戻す。
