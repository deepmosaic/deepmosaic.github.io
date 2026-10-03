# T-924 メモ (2026-10-03、ブランチ `feat/T-924`、push しない)

## 変更点
- **最低アカウント数 3 の撤廃 (R9)**: `_data/plans.yml` の Enterprise を `min_seats: 1`、要約文を「1 アカウントから。」に
  (旧「最低 3 アカウント（¥24,000〜）」。維持管理費用が別にかかるため金額は書かない)。
  `07-team.html` は「（{{ ent.min_seats }} アカウントから）」と「減らせる下限 = 使用中の数未満・1 アカウント未満にはできません」、
  `contact/index.html` / `enterprise/inquiry/index.html` は「1 アカウントから」。
  `inquiry-validate.js` の `LIMITS.seatsMin` を 1 (フォームの `min` と既定値も 1)。Worker 側の `seatsMin` は T-922。
- **ROI 計算機 (`pricing.js::cheapestPlan`)**: アカウント共有型 (Enterprise) は月次プランで賄えないときだけ候補にする。
  単価だけなら Enterprise 1 アカウント (8,000 円 / 20 時間) が Light×3 / Pro より安く見えるが、維持管理費用 (見積) が
  計算に入らないため。これで既定 (月 12 時間 → Light×3 ¥8,940 / 年間削減 1,620,720 円) と切替点 (41 時間で Enterprise)
  は変わらない。トップの noscript の記述 (`index.html` L247-253) もそのまま正しい。
- **お問い合わせフォーム (R14)**: 本文欄の「4000 文字まで」(`inq-message-help`) を削除し、`aria-describedby` もエラー文だけを指す。
  `maxlength` とエラー文は残す。
- **docs (R15)**: `06-ops.html` の更新ダイアログを「今すぐ更新」「あとで」の 2 択に (スキップの行を削除)、
  `01-intro.html` のアップグレードに 2 択を案内、`web.html` の WebGPU の行に 2.6.5 の速度 (検出 約 2.5 倍・精緻化 約 2 割短縮)。
- テスト: `src/lib/site-copy-t924.test.js` (新規: 公開面の文言)、`pricing.test.js` / `inquiry-validate.test.js` を 1 に追従、
  `e2e/inquiry.spec.ts` (下限の入力を 0 に) / `e2e/contact.spec.ts` (`aria-describedby` = `inq-message-error`)、
  `e2e/inquiry-cors.spec.ts` (公開後の CORS 確認で送る不正本文を seats=2 → seats=0 に。新旧どちらの Worker でも seats で弾かれる)。

## 追加・変更したコマンド
- なし (`npm test` に新しいテストファイルが自動で入る)。

## 注意点・既知の制約
- `scripts/check-plan-catalog.mjs` は plans.yml と本番 Supabase `plan_catalog` を突き合わせる (期待値をスクリプトに持たない)。
  **T-922 の migration (min_seats 3 → 1) が本番に適用されるまで、鍵ありの CI では「最低シート数が食い違っている」で落ちる**。
  master への merge は migration 適用と同時に (T-953)。
- `web.html` の「処理速度は Desktop 版の半分以下が目安です」(Desktop 版との違いの表) は spec の範囲外なので触っていない。
- e2e の spec は書き換えただけで実行していない (リーダー)。

## ロールバック
- このブランチを master に merge しなければ公開面は変わらない。merge 後に戻すなら該当 commit の revert
  (Supabase を 3 に戻すなら T-922 の migration も逆向きに)。
