# T-2249 (サイト): 検出対象のラベルを「局部」に戻す (T-1901 の取り消し)

ユーザー指示 (2026-11-13):「ラベル名が変わっている。元に戻して。確か局部だった。」
T-1901 (0536f32) で「局部」→「身体のプライバシー部位」に変えた日本語の表示を戻す。

## 変更点

- 日本語の文 (T-1901 の変更箇所をそのまま逆にたどった。派生の言い方も T-1901 前と 1 対 1 で一致)
  - `_data/entity.yml` (definition の ja、can の 1 行目) / `_data/lang/ja.json` (deep_learning_desc・find_desc) / `_data/mosaic.yml` (クラス別の val)
  - `_includes/docs/01-intro.html` / `03-detect.html` / `04-edit.html` / `05-export.html` / `web.html` / `index.html`
  - 例: 「男性と女性の身体のプライバシー部位」→「男性と女性の局部」、「身体のプライバシー部位のみ」→「局部のみ」、「身体のプライバシー部位だけを書き出す」→「局部だけを書き出す」
- `CLAUDE.md` の用語の規約を T-2249 の決定に書き換え (ja は「局部」、英中は body areas / 身體部位 のまま)
- テスト: `src/lib/site-copy-t1362-f16.test.js` の期待値 3 箇所を「局部」に戻した。`src/lib/site-copy-t2249-label.test.js` を追加 (ja のファイルに旧語が無い・ビルド後の `_site/llms.txt` / `_site/llms-full.txt` に旧語が無く「局部」がある (`_site` が無い時は skip)・検出対象の名前は「局部」・英中の訳は変わらない)
  - レビュー (LOW) の指摘で、ソースの `llms.txt` / `llms-full.txt` を確認の対象から外した (Liquid のテンプレートで、検出対象の文は `_data/entity.yml` から差し込まれるため、ソースを見ても何も検査しない)。代わりに生成物を見る
- 英中の訳は変えていない。ja の元の文が変わったので `source_hash` だけ `node scripts/i18n/accept-site.mjs` で書き直した:
  `en/index.html` `zh-tw/index.html` `_data/l10n/{en,zh-tw}/entity.yml` `_data/l10n/{en,zh-tw}/mosaic.yml`

## 残した「身体のプライバシー部位」

- `scripts/i18n/glossary.json` の body_areas の ja (1 件): desktop の用語集の写し。リーダーが desktop を直してから写し直す (sha256 の照合があるので単独で変えない)。lang-text の検査は `_site/en`・`_site/zh-tw` だけを見るので ja の値は検査に効かない
- `docs_draft/notes_T-1901.md` / `notes_T-2200.md` / `notes_T-2202.md` (過去の記録)
- `CLAUDE.md` の規約の行 (旧語として「使わない」と明記するため 1 件)
- 法務文書 (`_data/legal*`・各規約のページ) には元から出現なし

## ja-identity (基点 D:/dm-scratch/i18n/site-base/W7s/_site との差分)

9 件。いずれも「基点の『身体のプライバシー部位』を『局部』に置き換えたもの」と、`?v=` のキャッシュの値・llms のビルドの日付を除いて一致することを 1 ファイルずつ照合した。

| ファイル | 置換の件数 |
|---|---|
| docs/index.html | 16 |
| docs/web/index.html | 2 |
| index.html | 4 |
| mosaic-removal/index.html | 2 (entity の JSON-LD) |
| price/index.html | 1 (entity の JSON-LD) |
| spec/index.html | 1 (entity の JSON-LD) |
| subscribe/index.html | 1 (entity の JSON-LD) |
| llms.txt | 2 |
| llms-full.txt | 3 |

新しい基点はリーダーが作る。

## ゲート

`npm test` (1283 pass) / `npm run build` / `bundle exec jekyll build --strict_front_matter` / `node scripts/check-docs.mjs` / `node scripts/i18n/check-site.mjs _site` がすべて通過。Playwright は回していない (e2e の spec に該当語なし)。

## ロールバック

このコミットを revert すれば T-1901 の表記に戻る (source_hash も一緒に戻る)。

## 用語集の写し (desktop / web の担当)

- S2 の横断レビューの追い修正で、desktop i18n1112-integrate e1d14f81 の `src/lib/i18n/glossary.json` (211 語) を `scripts/i18n/glossary.json` へ写した。20 行目の持ち越しはこれで済んだ。
- T-2238 の写し (sign_in / sign_out の ja、法人) も同じコミットで行った。`glossary.source.json` の desktop_commit と sha256 を更新し、`i18n-site-lang.test.js` の語数を 211 にし、T-2238 / T-2249 の版を確かめるテストを 2 つ足した。
