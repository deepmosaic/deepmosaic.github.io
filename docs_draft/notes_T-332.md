# notes_T-332: 一般問い合わせフォーム `/contact/` の新設とリンク付け替え

Enterprise 導入相談 (`/enterprise/inquiry/`) に集まっていたサイト内の「お問い合わせ」導線 6 箇所を、
新設した一般窓口 `/contact/` に付け替えた。フォームは**同じ島・同じ Worker エンドポイント**で、
`data-kind` だけが項目立てと Worker 側のテンプレートを切り替える (Worker 側は T-331)。

## 変更点

| ファイル | 変更 |
|---|---|
| `contact/index.html` (新) | `/contact/` のページ。front matter (`title: お問い合わせ` / `seo_title: お問い合わせ｜Deepmosaic` / `permalink` / `description` / `schemas: breadcrumb`)、パンくず、h1「お問い合わせ」、リード (先頭は `_data/entity.yml` の `one_liner`)、Enterprise 導入相談への逃がし先 1 行、`{% include inquiry-form.html kind="general" %}` |
| `_includes/inquiry-form.html` (新) | アイランド root と `_data/inquiry.yml` → `data-*` の配線を 1 箇所に集約。`include.kind` (既定 `enterprise`) で `data-kind` と `<noscript>` の記入項目 / mailto 件名を切り替える。endpoint の本番 / dev 切替 (`jekyll.environment`) もここへ移した |
| `enterprise/inquiry/index.html` | アイランド root を include 呼び出しに置換。**T-298 のフォーム下の注記 (「Enterprise 以外のお問い合わせは…」) と、その理由を書いた comment ブロックを削除** — 一般導線は `/contact/` に移ったので逃がし先は不要 |
| `src/lib/inquiry-validate.js` | `KINDS` / `normalizeKind` / `fieldNames(kind)` を追加。`LIMITS` に `subject: 100` / `appVersion: 40`、`FIELD_LABELS` に `subject` / `appVersion`。`emptyFields(kind)` / `validateInquiry(input, kind)` / `buildPayload(fields, token, kind)` を kind 分岐 (`validateGeneral` / `validateEnterprise` に分割) |
| `src/islands/InquiryForm.svelte` | `kind` prop (既定 `enterprise`) を追加。`isGeneral` で会社名・電話・アカウント数 ⇄ 件名・ご利用中のバージョンを切り替え、本文のラベル / 必須 / placeholder も分岐。最初のエラーへのフォーカスと送信後のリセットは `fieldNames(kind)` の順に従う。Worker が返した `invalid_input` の項目は **この kind で描画しているものだけ**を赤字にする (下記) |
| リンク付け替え 6 箇所 | `_includes/header.html` (`contact_url`、ドロワー含む) / `_includes/footer.html` / `price/index.html` / `company/cookie.html` / `_includes/docs/02-account.html` / `_includes/docs/06-ops.html` |
| 据え置き (CI が固定) | `_data/plans.yml` の Enterprise CTA と `_includes/docs/07-team.html` の「導入相談」4 本は `/enterprise/inquiry/` のまま |
| `.github/workflows/jekyll.yml` | `Verify build output` の問い合わせページ検査を 2 ページ分のループに。**`data-kind` の一致も見る** (kind が落ちると `/contact/` が Enterprise の項目立てで描画され、一般の問い合わせが送れなくなる)。E2E ステップ名を「問い合わせフォーム」に |
| `src/lib/inquiry-validate.test.js` | general の仕様テスト 8 件を追加 (正常系 / 必須 4 項目 / 上限の境界 / 任意項目 / `emptyFields` / `fieldNames` / `buildPayload` / 未知の kind)。既存の `emptyFields` テストは `fieldNames('enterprise')` 基準に更新 |
| `e2e/lib/inquiry-harness.ts` (新) | 2 つの spec が使う道具立て (外部通信の遮断 / endpoint の差し替え / locator / `openInquiryPage(page, path)`) を `inquiry.spec.ts` から抽出 |
| `e2e/contact.spec.ts` (新) | kind=general の 7 ケース (項目立ての切替 / 必須 4 項目と aria / 件名 101 文字 / payload の形 / 任意項目と honeypot / **このページに無い項目のエラー** / 完了カード) |
| `e2e/inquiry.spec.ts` | ヘルパを harness に移し、**T-298 のテスト (フォーム下の注記) を削除**。payload テストに「`kind` を載せない」「`data-kind="enterprise"`」のアサートを追加 |
| `README.md` / `CLAUDE.md` | E2E 節に `/contact/` と `contact.spec.ts` / harness を追記。`npm test` の期待件数を 144 (143 pass / 1 skip) に更新 |

## Worker との契約 (T-331)

```jsonc
// kind=general (phone / seats は無い)
{ "kind": "general", "name": "…", "email": "…", "subject": "…(<=100)",
  "message": "…", "appVersion": "2.3.7", // 任意。空なら**キーごと載せない**
  "website": "", "turnstileToken": "…" } // website=ハニーポット、token は空なら載せない

// kind=enterprise は **`kind` を載せない** (Worker の既定 = 旧サイト互換)
{ "company": "…", "name": "…", "email": "…", "phone": "…", "seats": 12, "message": "…", "website": "" }
```

`desktop/docs_draft/notes_T-331.md` はこのチケットの実装時点で未作成だったため、
**項目名は既存の enterprise payload の流儀 (`message` / `website` / `turnstileToken`) に合わせた**。
公開前に Worker 側のスモーク (general の 1 通) で `subject` / `appVersion` の名称を確認すること。

## 追加・変更したコマンド

新しいコマンドは無い。ゲートは既存のまま:

```bash
npm test                                           # 144 件 (143 pass / 1 skip)
npm run build && bundle exec jekyll build          # 2 段ビルド
node scripts/check-docs.mjs                        # docs の回帰ガード (要 _site)
E2E_SKIP_BUILD=1 npx playwright test               # 19 pass / 1 skip (inquiry-cors は外部向けで skip)
```

## 注意点・既知の制約

- **`data-kind` が落ちると静かに壊れる。** 島は未知の kind を enterprise に倒すので、
  `/contact/` が会社名・電話番号・アカウント数必須のフォームとして描画される (見た目は動く)。
  CI の `data-kind` grep と `contact.spec.ts` の 1 本目がこの事故を捕まえる。
- **general の本文 (`message`) はサイト側だけ必須にしている。** Worker は Enterprise と同じく
  本文任意で受ける想定だが、件名だけの問い合わせは返答のしようがないためフォームで止める。
  「サイトは Worker より厳しくしない」という `inquiry-validate.js` の原則に対する**意図的な例外**
  (関数の docstring に明記)。緩めたい場合は `validateGeneral` の `message.length === 0` の分岐を外す。
- **公開順は Worker (T-331) が先。** `/contact/` の送信は `kind: 'general'` を載せるので、
  Worker が未対応のままサイトを公開すると general の送信が 400 になる
  (enterprise 側は `kind` を載せないので影響なし)。
- Turnstile のサイトキーは空のまま (`_data/inquiry.yml`)。`/contact/` も widget を描画せず
  トークンを送らない — ハニーポット + KV レート制限 + DO のメール予算だけで守る現状の縮退運用のまま。
- **Worker のエラー項目は kind ごとに読み替える。** `describeFailure` が返す項目名は全 kind の
  和集合 (8 個) なので、そのまま `fieldErrors` に入れると **この kind で描画していない項目**の
  文面がどこにも出ない。現実に踏むのは「Worker だけを T-331 より前に巻き戻した」ときで、
  `/contact/` の送信に「会社名を入力してください」が返り、汎用の一文だけが出て手詰まりになる。
  島側で `fieldNames(kind)` に含まれるときだけ赤字にし、含まれなければ Worker の文面を
  警告欄にそのまま出す (`contact.spec.ts` の「このページに無い項目のエラー…」が固定)。
- `emptyFields` の初期値で prop を読む箇所は `untrack` で包んである (Svelte の
  `state_referenced_locally` 警告を出さないため)。島は data-* から 1 度だけ mount され
  props は後から変わらないので、初期値として読むのは意図どおり。

## ロールバック

- サイトは `git revert` + push (公開 = push)。`/contact/` を消すとヘッダ / フッタ / docs /
  クッキーポリシーの「お問い合わせ」も同時に `/enterprise/inquiry/` へ戻るので、
  **リンクだけ先に戻す必要は無い** (同じコミットに入っている)。
- 部分的に戻す場合: `_includes/header.html` / `footer.html` / `price/index.html` /
  `company/cookie.html` / `_includes/docs/02-account.html` / `_includes/docs/06-ops.html` の
  `href="/contact/"` を `href="/enterprise/inquiry/"` に戻し、`contact/index.html` を削除する。
  CI の `for entry in …` から `contact:general` を外すこと (出力が無くなるとガードが落ちる)。
- Worker 側 (T-331) を先に戻した場合、サイトを戻すまで `/contact/` からの送信が 400 になる。
