# T-943 notes (特商法の不足 / DeepMosaics との区別)

## 変更点
- `company/asct.html`: コメントアウトされていた「運営責任者 高田茂臣」を表示 (氏名は dashboard `company.ts` の `REPRESENTATIVE` と同じ)。
  「所在地・電話番号」行を追加し、値は「ご請求があれば遅滞なく開示いたします。下記のメールアドレスまでご連絡ください。」だけ (住所・電話番号そのものは印字しない = TICKET-SITE-21 / T-933 の方針)。
  最終更新日を `2020-7-1` → `2026-10-03` (ISO 形式)。
- `_data/entity.yml`: `oss_distinction` (ja / en) を追加。「オープンソースの DeepMosaics とは別製品、開発元も機能も無関係」。本文用なので「除去」は使わず「取り除く」。
- `mosaic-removal.html`: 「なぜ混同されるのですか」の名称の由来の直後に `E.oss_distinction.ja` を表示 (リンクは張らない)。
- `llms.txt`: 「重要 / IMPORTANT」の箇条に `E.oss_distinction.ja` / `.en` を追加。
- `_data/faq.yml`: 末尾に「オープンソースの DeepMosaics と同じものですか？」を追加 (YAML は Liquid を通らないので entity.yml と同趣旨を直書き)。FAQPage JSON-LD と llms-full.txt にも自動で載る。
- `src/lib/site-copy-t943.test.js`: 上記の回帰テスト (特商法 3 項目 / 住所・電話の非印字 / 3 面の注記 / 語彙ポリシー)。

## 追加・変更したコマンド
- なし (`npm test` に新テストが含まれる)。

## 注意点・既知の制約
- FAQ の項目は T-942 と衝突しないよう末尾に追加しただけ。
- 「除去」の語彙ポリシー (CLAUDE.md) を守るため、FAQ の質問・回答と entity.yml の ja は「取り除く」。英語は llms.txt 用なので "removing" を使う。
- 「所在地・電話番号」の行名は新設 (特商法第 11 条の表示事項の省略に伴う開示文)。文言は事業判断で変えてよい。

## リーダーが確かめること
- `bundle exec jekyll build` 後に `_site/company/asct/index.html` の表、`_site/mosaic-removal/index.html`、`_site/llms.txt` の注記を目視。

## ロールバック
- このブランチの T-943 コミットを revert するだけ (データ・設定の変更なし)。
