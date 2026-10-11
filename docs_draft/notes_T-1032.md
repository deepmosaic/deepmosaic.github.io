# T-1032 会社住所の SSOT `_data/company.yml` と 4 面

## 変更点
- 新規 `_data/company.yml`: 社名・英名・代表者・郵便番号・住所 (region / locality / street / 連結) の単一真実源。
- `company/asct.html` (特商法): 「所在地・電話番号」の 1 行を「所在地」(company.yml 参照) と「電話番号」(ご請求があれば開示) の 2 行に分割。
- `company/about.html` (会社概要): 所在地を `東京都品川区` → company.yml 参照 (〒 + 郵便番号 + 住所)。資本金は未確認のため変えていない。
- `company/privacy.html` (問い合わせ窓口): 所在地の 1 行だけ company.yml 参照に変更。最終更新日・他の本文は T-1036 の担当。
- `_includes/schema/organization.html` (JSON-LD): `address` (PostalAddress) を追加。値は `jsonify` で JSON 文字列として出す。
- `src/lib/site-copy-t943.test.js`: 方針転換に追従 (電話番号の開示行 / 所在地の参照 / 電話番号の非印字)。
- 新規 `src/lib/site-copy-t1032.test.js`: company.yml の値、4 面の参照、直書きの不在 (drift 防止) を検査。

## 方針転換
- 住所は公開する。撤回した旧方針: TICKET-SITE-19 / TICKET-SITE-21 / T-933 / T-943 の「住所を印字しない」(住所についてのみ)。
- 電話番号は提供が無いため引き続き「ご請求があれば遅滞なく開示」。company.yml に `phone` は持たない。
- 特商法第 11 条ただし書の省略に関する施行規則の条番号は要確認 (asct.html のコメントに明記)。

## 追加・変更したコマンド
- なし (`npm test` が新テストを拾う)。

## 注意点・既知の制約
- dashboard `src/lib/dashboard/company.ts` の `ADDRESS` / `REPRESENTATIVE` は company.yml の転記 (T-1051 の担当)。変えるときは両方同時に。
- Stripe ダッシュボードの公開住所 (T-933 で手作業) は別途、手で更新が必要。
- company.yml は `key: "value"` の 1 階層だけ (テストの極小パーサが他の形を throw する)。

## ロールバック
- company.yml を消すと 4 面の Liquid が空文字になる (「〒 」だけが残る / JSON-LD の値が null)。戻すときは company.yml だけでなく、
  4 面と t943 / t1032 テストをこのコミットごと revert する。
