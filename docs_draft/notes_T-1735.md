# T-1735: ピクセルサイズ設定モーダルへの統一の docs

## 変更点
- _data/mosaic.yml、_includes/docs/03-detect.html、04-edit.html、web.html、index.html を新仕様の文言へ。llms-full.txt / llms.txt には該当語が無いので変更なし。
- 検出オプションの「モザイクの精緻化」の行は機能の説明を残し、画面の案内の記述を外した (機能と進捗の段は残るため)。
- 「ブロック分割数」の行と「Premiere Pro と同じ方式」の記述を削除 (領域の幅で割る方式が無くなったので事実でなくなった)。

## 追加・変更したコマンド
なし。

## 注意点・既知の制約
- スクリーンショットは差し替えていない。detect-options-panel.webp と、モザイク設定の画像、index.html の mosaic-detect-2-reapplied.webp (alt に「最小セル・最大セルともに 10 px」) は旧 UI のまま。撮り直しのときに alt も直す。
- 次回のアプリ公開と一緒に出す。それまで master へ push しない。

## ロールバック
このチケットのコミットを revert する。
