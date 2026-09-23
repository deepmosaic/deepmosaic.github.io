# T-516 (サイト側) — お問い合わせ (一般) から 氏名 / 件名 / ご利用中のバージョン を削除

2026-09-23 のユーザー決定。`/contact/` (kind=general) のフォームを **メールアドレス + お問い合わせ内容**
の 2 項目にする。Enterprise 導入相談 (`/enterprise/inquiry/`、kind=enterprise) は**変えない**。
Worker 側 (`desktop/worker-auth0-updater`) は別チェーン (B) で同じ契約に変える。

## 変更点

- **`src/lib/inquiry-validate.js`** — general の契約を Worker と同じ `email` + `message` に。
  - `fieldNames('general')` = `['email', 'message']`、`emptyFields('general')` = `{ email, message, website }`
  - `validateGeneral` は氏名・件名・バージョンを**読まない** (入力に付いていても検査も送信もしない)。
    本文必須 (サイトだけ Worker より厳しい、T-332 から不変)。
  - `buildPayload(…, 'general')` = `{ kind: 'general', email, message, website }` (+ `turnstileToken`)。
    `fields` に旧項目が混ざっていても載せない。
  - `LIMITS.subject` / `LIMITS.appVersion` と `FIELD_LABELS.subject` / `.appVersion` を削除。
    `describeFailure` は Worker が `field: 'subject' | 'appVersion'` を返しても項目に紐づけない
    (島が Worker の文面を警告にそのまま出す — 既存の「描画していない項目」経路)。
  - enterprise の規則・ボディ (kind を載せない旧互換) は不変。
- **`src/islands/InquiryForm.svelte`** — general から氏名 / 件名 / ご利用中のバージョンの入力を外した。
  氏名は enterprise のときだけ (会社名と同じ `{#if !isGeneral}` へ)。general ではメールアドレスを
  2 列ぶん (`sm:col-span-2`) に広げる。T-516 の Worker が本番に出る前の旧 Worker が返す
  「氏名を入力して…」も既存の経路で警告に出ることをコメントに追記。
- **`_includes/inquiry-form.html`** — JS 無効時 (noscript) の記入項目を「メールアドレス / お問い合わせ内容」に。
- **`contact/index.html`** — front matter の `description` を「メールアドレスとお問い合わせ内容を…」に。
- **`CLAUDE.md`** — ブラウザ E2E の説明 (`e2e/contact.spec.ts` が固定するもの) を更新。
- **テスト**
  - `src/lib/inquiry-validate.test.js` — general 節を書き直し (12 件): 2 項目だけを正規化して返す /
    旧項目 (正常値・旧規則なら弾かれた値の両方) を無視して通す / 必須 2 項目のエラーだけ /
    空白だけの本文は未入力 / 本文の上限ちょうどと +1 / メール形式と本文の制御文字 /
    `emptyFields` / `fieldNames` / 廃止項目名の `describeFailure` は field=null /
    `buildPayload` の形 (旧項目が混ざっても送らない)。U+FFFD の general ケースは件名 → 本文へ。
  - `e2e/contact.spec.ts` — 7 件を 2 項目の契約で書き直し: 欄の有無 (旧 3 項目が無い) / 必須 2 項目の
    エラーと aria / **本文 4000 文字超過** (旧: 件名 100 文字超過) / payload のキーが
    `email, kind, message, website` だけ / ハニーポット / **旧 Worker が `field: 'name'` を返しても
    警告に出して手詰まりにしない** / 完了カードを閉じるとメールアドレスにフォーカス。
  - `e2e/inquiry.spec.ts` (enterprise) と `e2e/lib/inquiry-harness.ts` は変更不要 (enterprise は不変)。

## 追加・変更したコマンド

新規コマンドは無し。実行したもの:

```bash
cd deepmosaic.github.io
npm test                                                   # 201 件 (pass 200 / skip 1)
npx playwright test e2e/contact.spec.ts e2e/inquiry.spec.ts  # 16 passed (Chromium 導入済み、build → jekyll build → 4173 で配信)
npx playwright test                                        # 全 spec (inquiry-cors は E2E_BASE_URL 無しで skip)
```

Playwright は外部通信を abort し、送信先は `page.route` のスタブ。本物の Worker は叩いていない。

## 注意点・既知の制約

- **公開の順序 (必須)**: Worker 側 (T-516 Worker) を dev → 本番に出してから、このサイトを公開する。
  逆順だと旧 Worker が general の送信に 400 `invalid_input` (`field: 'name'`「氏名を入力してください」)
  を返し、フォームは Worker の文面を警告に出すだけで送信できない (E2E で固定済みの縮退表示)。
- 旧サイト (公開中) → 新 Worker は問題ない: 新 Worker は name / subject / appVersion を受け取って無視する契約。
- 本文の placeholder (「発生した操作、画面に出たメッセージ…」) は変えていない。バージョンの記入を
  促す文言を足すかは未決 (docs 06-ops は「フッターのバージョンを添えて」と案内している)。

## ロールバック

このコミットを revert すればフォーム・前検査・テストが T-332 の形に戻る。ただし Worker 側だけが
新契約のまま残っても旧フォーム (name / subject / appVersion 付き) は受け付けられる (無視されるだけ)。
逆にサイトだけ新契約で Worker を巻き戻すと上の 400 になるので、Worker を戻すならサイトも戻す。
