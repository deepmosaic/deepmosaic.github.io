# T-1901: 検出対象のラベル「局部」を「身体のプライバシー部位」に統一 (サイト)

ユーザー決定 (2026-11-09、store1109)。desktop / web / dashboard も同じチケットで揃えた。公開 (master への push) はしていない。

## 変更点
- `_includes/docs/{01-intro,03-detect,04-edit,05-export,web}.html`、`_data/lang/ja.json` (`deep_learning_desc` / `find_desc`)、
  `_data/mosaic.yml`、`_data/entity.yml`、`index.html` の「局部」を「身体のプライバシー部位」に。
- アプリの画面の文と照合するテスト `src/lib/site-copy-t1362-f16.test.js` の期待文も同じコミットで揃えた
  (desktop の検出オプションの注記「…身体のプライバシー部位・顔の検出とモザイクの初期設定は使いません」と一致)。
- `CLAUDE.md` の Conventions に用語の決定を 1 行。
- 英語のページに該当語は無かった (英語表記 "Private body parts" を使う箇所なし)。

## 変えなかった箇所
`CHANGELOG.md` / `docs_draft/**` (過去の記録)、`CLAUDE.md` の用語の行。それ以外に「局部」は残っていない。

## 追加・変更したコマンド
なし。

## ロールバック
このコミットを revert する。
