# T-1233: 編集画面のドキュメントを新しい操作に合わせる (edit1014)

## 変更点 (`_includes/docs/04-edit.html` のみ)
- 再生コントロール: 10 コマ移動を `Shift`+矢印 → `PageUp` / `PageDown` に。Shift+→ の形の引き継ぎへの案内を追記。
- 検出枠の操作: 連続削除 (消しゴム) を `E` + 右ドラッグに。`E` を押していない右ドラッグ / 動かさずに離したときは右クリックメニュー。
- 検出枠の操作の末尾に「形を引き継いでコマ送り (Shift+→)」の行を追加 (押し始めた時点の位置・大きさ・形のまま進んだ先を上書き / Shift を離すまでが 1 操作で Ctrl+Z 1 回で戻る / その枠が無いフレームは飛ばす)。
- ツールバー: 形の選択の楕円キーを `E` → `W`。消しゴムボタンの説明を「E+右ドラッグ」に。
- ショートカット表: `step_fwd` / `step_back` のラベル更新、フレーム移動の rowspan 6 → 8、`step_fwd_10` (PageDown) / `step_back_10` (PageUp) の行を追加、`bbox_shape_ellipse` を `W`、`mouse_eraser` を `E`+右ドラッグ。

## 追加・変更したコマンド
なし。検査は `npm run build && bundle exec jekyll build && node scripts/check-docs.mjs` (OK)。

## 注意点・既知の制約
- 開発モードの det_rect 表示は書いていない (spec どおり)。スクリーンショットは差し替えていない (∞ アイコンの絵は次の撮影バッチ)。
- `step_fwd_10` / `step_back_10` の id は desktop 側の別チケットで追加される前提。desktop の `edit-shortcuts.ts` と id が一致しているかは desktop 合流後に再確認する。
- ホイールの Shift (10 コマ、`mouse_wheel_step`) は据え置き。

## ロールバック
この commit を revert する。
