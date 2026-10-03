# T-942 メモ (deepmosaic.github.io、ブランチ feat/T-942 = feat/T-924 の上)

## 変更点
- 「上限時間の適用は順次開始」と、その前提の文 (「開始日は事前にお知らせします」「現在ご利用中のお客様の条件は変わりません」「適用が始まるまでは…上限はありません」) を削除。
  対象: `_data/faq.yml` (上限時間を超えたら…)、`_includes/docs/02-account.html` (#plan)、`_includes/docs/06-ops.html` (#usage の「上限の適用」)。
  超過料金なし・追加契約の説明は残した。
- Pro の `badge: "最も選ばれています"` を `_data/plans.yml` から削除 (仕組み `plan.badge` は汎用として残す)。
- 税込併記: `_data/plans.yml` に `tax_rate_percent: 10` と有料 3 プランの `price_incl_display` (3,278 / 10,780 / 8,800) を追加。
  料金カード (`_includes/pricing-cards.html`) は「/ 月（税別・税込 ¥3,278）」の形、`llms-full.txt` の見出しにも併記。
  規則は `src/lib/pricing.js::taxIncluded(price, ratePercent)` (整数演算、1 円未満切り捨て)。
- 古いコメントの整理: `plans.yml` 冒頭の「上限時間はまだ強制されていない」「Free は 6 のまま」、`06-ops.html` の「方針文 (順次開始) は原文維持」。
- テスト: `src/lib/site-copy-t942.test.js` (文言の不在 / 開示の残存 / バッジ無し / taxIncluded の境界値と失敗系 / 写しと規則の一致 / カードの併記)。

## 追加・変更したコマンド
- なし (`npm test` に新しいテストファイルが自動で入る)。

## 注意点・既知の制約
- 価格や税率を変えたら `price_incl_display` も直す (テストが落ちて気づける)。Liquid に桁区切りが無いため写しを持つ。
- `/price/` の meta description (front matter) と `index.html` の noscript の試算文は税別表記のまま (「いずれも税別」と明記済み)。税込併記はカードと llms-full のみ。
- Free 枠の数字 (5 時間 / 3 時間) は T-954 の担当なので触っていない。
- T-924 の変更 (min_seats / 07-team / InquiryForm 等) には触れていない。

## リーダーの確認手順
- `bundle exec jekyll build` 後、`/price/` とトップの料金カードで「税別・税込 ¥…」が出ること、Pro にバッジが無いこと、`/docs/#plan` `/docs/#usage` と FAQ に「順次開始」が無いことを目視。

## ロールバック
- このブランチのコミットを revert すれば元に戻る (データ・テンプレートのみ、サーバー側の変更なし)。
