# T-1941: Enterprise に「御社システムへの導入」(料金カード・トップ・相談ページ)

## 変更点

| ファイル | 内容 |
|---|---|
| `_data/plans.yml` | enterprise に `note: "御社のシステム・サービスへの導入（組み込み）もご相談ください。内容に応じて別途お見積りします。"` を追加。描画は既存の `_includes/pricing-cards.html` の `{% if plan.note %}` (/price/ とトップの PRICING 節の両方) |
| `index.html` | 「組織で使う（Enterprise）」カードの箇条書きの末尾に同じ趣旨の 1 項目 |
| `enterprise/inquiry/index.html` | description とリード文に「自社システムへの導入のご相談」を例として追加 |
| `src/islands/InquiryForm.svelte` | Enterprise の「ご相談内容」の placeholder 1 か所に「自社システムへの導入のご相談」を追加 (一般の問い合わせの placeholder は不変。T-1958 の URL 欄には触れていない) |
| `src/lib/site-copy-t1941.test.js` | 新規。ソースの文言・CTA・維持管理費用・提供していない機能名 (API / SDK / オンプレ / ライブラリ / OEM) を出さないことを固定 |
| `e2e/enterprise-integration.spec.ts` | 新規。ビルド出力の `/price/` と `/` の ENTERPRISE カードに note・「維持管理費用」・`href="/enterprise/inquiry/"` の CTA、トップの組織カードの 1 文、相談ページのリード文を確認 |

## 追加・変更したコマンド

なし (`npm test` と `npm run e2e` に新しいテストが入るだけ)。

## 注意点・既知の制約

- 提供しているのはデスクトップ版と Web 版だけなので、導入形態の具体名は書かず「ご相談ください・内容に応じて別途お見積り」に留めた。
- `price/index.html` の description は金額の列挙で、`pricing.test.js` が金額の一致を検査しているため変えていない。
- `llms-full.txt` のプラン節は `summary` と `specs` だけを出しており `note` は出ない (今回は変えていない)。
- `_data/lang/en.json` は使われていないので触っていない。

## ロールバック

このチケットのコミットを revert する (データ 1 行・HTML 3 か所・placeholder 1 か所とテスト 2 本だけ)。

## OpenAPI に足す内容

なし (サイトのみ)。
