# T-1958: 法人お問い合わせフォームに「会社の Web ページ (任意)」(サイト側)

## 変更点

- `src/lib/inquiry-validate.js`: Worker (T-1952、`desktop/worker-auth0-updater/src/inquiry-validate.ts` の `companyUrlField`) の写しとして
  `companyUrl` を追加。
  - `LIMITS.companyUrl = 500` (`https://` を補った後の長さ)、`FIELD_LABELS.companyUrl = '会社の Web ページ'`、
    enterprise の並びは `company → companyUrl → name → …` (誤りの最初の欄へフォーカスする順)。
  - 新しい公開関数 `normalizeCompanyUrl(raw)`: 空 (trim 後) は `null`、スキーム省略は `https://` を補う、http / https のみ、
    ホスト名にドット (空のラベル不可)、空白・制御文字・U+FFFD・ユーザー情報は不可。通ったら `URL#href` に正規化。
    エラー文は Worker と同じ「会社の Web ページは URL の形式で入力してください (例: https://example.co.jp)」/
    「会社の Web ページは 500 文字以内で入力してください」。
  - `validateEnterprise`: 未入力なら `fields` に `companyUrl` を持たない (Worker と同じ)。`emptyFields('enterprise')` は `companyUrl: ''`。
  - `buildPayload` (enterprise): **未入力ならキーごと載せない**と決めた (旧サイトと同じボディのまま。Worker もキー無しを未入力として扱う)。
    入力ありは正規化済みの値 (例: `example.co.jp` → `https://example.co.jp/`) を載せる。general は読まない・送らない。
- `src/islands/InquiryForm.svelte`: 会社名のすぐ後に「会社の Web ページ（任意）」の欄 (`id="inq-companyUrl"`、`name="companyUrl"`、
  `type="url"`、`inputmode="url"`、`autocomplete="url"`、placeholder `https://example.co.jp`、`maxlength=500`)。
  エラーは既存の `fieldErrors` / `describedBy` / `aria-invalid` に乗る。general (`/contact/`) には出さない。
  `website` は既存のハニーポットのまま (欄の名前に使わない)。
- `_includes/inquiry-form.html`: JS 無効時の項目一覧に「会社の Web ページ（任意）」を追加し、古い「（3 以上）」を「（1 以上）」に直した。
- `enterprise/inquiry/index.html`: description の項目列挙に「会社の Web ページ（任意）」を追加。
- テスト: `src/lib/inquiry-validate.test.js` に Worker と同じ表の正常 / 異常 / 境界値 (500 / 501 文字、補った後の超過) を追加。
  `e2e/inquiry.spec.ts` に 4 件 (欄の属性と位置 / 不正な URL でその欄のエラー + 未送信 / `example.co.jp` → `https://example.co.jp/` /
  未入力でも送れて `companyUrl` を載せない)、payload のキー一覧の固定は未入力の場合のまま (キーを増やさない)。
  `e2e/contact.spec.ts` は `/contact/` に `#inq-companyUrl` が無いことを確かめる。

## 追加・変更したコマンド

なし (`npm test` / `npm run e2e` のまま)。

## 注意点・既知の制約

- 規則を変えるときは Worker (`inquiry-validate.ts`) と同時に変える。ここが Worker より厳しくなると正当な入力が送れなくなる。
- 文字列以外の値はフォームから来ないので `String()` に寄せて検査する (Worker は型の文言を返すが、サイトでは起きない)。
- README の「固定している振る舞い」の表 (e2e の件数と payload の形) は未更新。正式なドキュメント反映はリーダーがまとめて行う:
  `会社の Web ページ` の行 (不正な URL はその欄のエラーで止まる / スキーム省略は `https://` を補う / 未入力ならキーを載せない) と、
  payload の形に「`companyUrl` は入力があるときだけ」を足す。
- Worker 側 (T-1952) が先に本番に出ていないと、入力ありの送信は旧 Worker では無視される (旧 Worker は未知のキーを読まないだけで 400 にはしない想定)。

## ロールバック

このチケットのコミットを revert する。Worker はキー無しを従来どおり受けるので、サイトだけ戻しても送信は壊れない。
