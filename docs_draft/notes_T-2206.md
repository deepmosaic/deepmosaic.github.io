# T-2206 (i18n1112 I18N-708) サイトの問い合わせフォームと組織への参加・404 の JS の英中対応

- 作業キー: I18N-708。spec: `D:/dm-scratch/i18n/spec/I18N-708.md`。security: true。
- 作業場所: 統合 worktree `D:/deepmosaic-wt/integrate/store1109/deepmosaic.github.io` (ブランチ `store1109-integrate`)。

## 変更点の要約

| ファイル | 中身 |
|---|---|
| `src/lib/inquiry-validate.js` | 言語の表 `LABELS` (画面の項目名)・`INLINE_LABELS` (文の中の項目名、en だけ小文字の名詞句)・`MESSAGES` (検証と送信の失敗の文) を足した。`labelsFor(kind, lang = 'ja')` を新設、`validateInquiry(input, kind, lang = 'ja')`・`normalizeCompanyUrl(raw, lang = 'ja')`・`describeFailure(outcome, { supportEmail, lang })` に言語を足した。**ja の文面・戻り値・既存の export (名前と値) は変えていない** (ja の表は既存の定数と今の文面のコピー)。`LIMITS`・正規表現・正規化・`buildPayload`・`normalizeKind`・`fieldNames`・`emptyFields` は無変更 |
| `src/islands/InquiryForm.svelte` | 画面の文の 3 言語の表 `TEXT` (22 キー) と `pick(TEXT, pageLang())`。項目名は `labelsFor(formKind, lang)`。`validateInquiry`・`describeFailure` に言語を渡す。Turnstile の `language` を `T.turnstileLanguage` (`ja` / `en` / `zh-tw`) に。英中だけ完了の後に `mailJaNote` の 1 文 |
| `_includes/inquiry-form.html` | noscript を `{%- if inquiry_tx -%}` (英中) → `{%- elsif inquiry_kind == "general" -%}` (ja の general、元の文のまま) → `{%- else -%}` (ja の enterprise、元の文のまま) の形にした。`inquiry_tx = site.data.l10n[page.lang].inquiry_form`。island の root の `data-*` は無変更 |
| `src/main.js` | (1) `/join/` のコピーの文を `COPY_TEXT` (3 言語の表、ja は既存の定数 `COPY_DONE` / `COPY_FAILED` を参照) と `pick(COPY_TEXT, pageLang())` に。(2) 404 の振り分け `redirectLang404()` を `init()` の先頭に (印 `[data-lang-404]` があり、`lang404Target(location.pathname)` が行き先を返したときだけ `location.replace` して以後の初期化をしない)。(3) 末尾に「i18n の初期化」の区切りのコメント 1 行 (I18N-713 用) |
| `src/lib/lang-404.js` (新規) | `lang404Target(pathname)` の純関数 |
| `_data/l10n/en/inquiry_form.yml`・`_data/l10n/zh-tw/inquiry_form.yml` (新規) | noscript の文・mailto の件名 (英語)・項目の一覧 |
| `scripts/i18n/checks/inquiry.mjs` (新規) | check-site のモジュール (下の「追加したテスト・検査」) |
| `src/lib/i18n-site-inquiry.test.js` (新規) | 仕様テスト 20 本 |

## 表のキー

- `InquiryForm.svelte` の `TEXT` (ja / en / zh-tw で同じ 22 キー): `requiredNote`・`optional`・`emailHelp`・`phoneHelp`・`seatsHelp(n)`・`generalMessagePh`・`enterpriseMessagePh`・`turnstileFailed`・`checkInput`・`turnstileLoadFailed`・`turnstileWait`・`sendingLive`・`receivedLive`・`doneTitle`・`doneBody`・`doneMailSent`・`mailJaNote` (ja は null)・`close`・`sending`・`submit`・`usageNote`・`turnstileLanguage`。
- `inquiry-validate.js`:
  - `LABELS[lang][kind]` = 画面の項目名 (company・companyUrl・name・email・phone・seats・message)。ja は既存の `FIELD_LABELS` / `GENERAL_LABELS` そのもの。
  - `MESSAGES[lang]`: `required`・`tooShort`・`tooLong`・`forbiddenChar`・`emailFormat`・`phoneFormat`・`seatsInteger`・`seatsMin`・`seatsMax`・`urlFormat`・`network`・`rateLimited`・`turnstile`・`invalidGeneric`・`invalidField` (ja は null)・`contactWith(email)`・`contactWithout`・`delivery(contact)`・`unknown(contact)`。
- `main.js` の `COPY_TEXT`: `done`・`failed`。
- `inquiry_form.yml` (en / zh-tw で同じキー): `js_required_before`・`js_required_after`・`general_subject`・`enterprise_subject`・`general_items` (2 件)・`enterprise_items` (7 件)。

## 英中で Worker の `detail` を出さない方針

- `describeFailure` の `invalid_input` は、ja では今どおり Worker の `message` (日本語) を出す。英中では出さず、欄が既知なら `invalidField` (en `Check this field.` / zh-tw `請確認此欄位的內容。`)、欄が不明なら `invalidGeneric` (en `Check your entries.` / zh-tw `請確認輸入的內容。`)。`kind` と `field` は言語に依らない。
- `InquiryForm` で、欄が既知でもこのフォームに描いていない欄 (Worker を巻き戻したときなど) は、英中では欄の汎用の文ではなく `T.checkInput` を警告に出す (ja は今どおり `failure.message`)。
- 送る内容: `buildPayload` は無変更で言語を受け取らない。言語は送らない・保存しない (COMMON §9)。

## 追加したテスト・検査

- `node --test src/lib/i18n-site-inquiry.test.js` (20 本): 言語なし = ja の一致、英中の誤りの欄の集合が ja と同じ (空・長すぎる・形式・電話の短さ・使えない文字・seats の下限 / 上限)、英中の文が `lintValue` を通り仮名が無い、通る入力の `fields` が言語に依らない、`buildPayload` の JSON が言語に依らない、`labelsFor`、`describeFailure` の各 outcome (network / 429 / 403 / 400 turnstile / 400 invalid ×3 / 502 / 500) で英中が detail を含まない、ソースの 3 言語の表 (InquiryForm・main.js) のキーの集合と ja の値、InquiryForm の表の外に日本語の直書きが無い (t1941 の placeholder の literal を除く)、`inquiry_form.yml`、include の data-* と ja の件名、`lang404Target`、`checks/inquiry.mjs` の陽性対照・陰性対照。
- `scripts/i18n/checks/inquiry.mjs`: 英中の `/contact/`・`/enterprise/inquiry/` (あれば) に `data-island="inquiry-form"`・ja と同じ `data-kind`・`data-endpoint`・`<noscript>` があり、noscript の文に仮名が無い。ルートの `404.html` に `data-lang-404` があれば `en/404.html`・`zh-tw/404.html` がある。
- 描画の確かめ (コミットしない):
  - probe (`en/probe-t2206.html`・`zh-tw/probe-t2206.html`、`/en/_probe/`) に両方の kind の include を置いてビルドし、noscript の英中を読んで消した (出力は `D:/dm-scratch/i18n/t2206-probe-site`)。**W7-site.md §5 の `en/_probe.html` は Jekyll が `_` で始まるファイルを読まないので出力されない** (I18N-709 以降の probe は `_` で始めない名前にすること)。
  - 旧 (HEAD) と新の `InquiryForm.svelte` を svelte の SSR で描き比べ、ja の HTML (ハイドレーションのコメントを除く) が kind 3 種 × Turnstile の有無で一致することを確かめた (スクリプトは scratchpad の `ssr-compare.mjs`、出力は `D:/dm-scratch/i18n/t2206-ssr`)。英中の SSR も読んだ。

## ゲートの結果 (手元)

- 開発中のゲート: `node --test src/lib/i18n-site-inquiry.test.js src/lib/inquiry-validate.test.js src/lib/join-hash.test.js` → pass 109 / fail 0。
- 全ゲート: `npm test` (934 件中 pass 931・fail 0) → `npm run build` → `bundle exec jekyll build --strict_front_matter` → `check-docs` OK → `ja-identity` OK (17 files) → `check-site` OK (6 モジュール)。
- CI の Verify build output 相当: `_site/contact/index.html`・`_site/enterprise/inquiry/index.html` に `data-island="inquiry-form"`・`data-kind`・`<noscript>` があることを grep で確認。
- `git diff --stat` と `--ignore-cr-at-eol` の行数は一致 (CRLF のファイルは CRLF のまま書き換えた)。

## 置いた仮定・spec / 設計書との食い違い

1. **既存のテスト `site-copy-t1941` が `placeholder={isGeneral ? '…' : '…'}` の literal をソースで照合する**ので、ja の placeholder は textarea の属性に literal のまま残し、英中だけ後ろの spread `{...messagePlaceholder}` で上書きした (Svelte 5 は後に書いた属性が勝つ)。表の `ja.generalMessagePh` / `ja.enterpriseMessagePh` にも同じ文を置き、literal と一致することを新しいテストで固定した (ja の文が 2 か所にある。直すなら両方)。
2. 「お問い合わせ内容」(general) と「ご相談内容」(enterprise) の訳: spec の en `Message` / `Details of your inquiry` をこの順に general / enterprise に当てた。zh-tw は spec が `諮詢內容` の 1 つだけなので、enterprise を `諮詢內容`、general を `詢問內容` にした。
3. en の検証の文は語順のため、文の中では小文字の名詞句 (`your company name` など、`INLINE_LABELS`) を使い、画面の項目名 (`Company name`) と分けた (spec の「`label` + 文の連結で作らない、雛形で吸収」に従う)。
4. 英中の数は桁区切りを付ける (`10,000`・`4,000`)。ja は今の文面のまま区切らない。
5. `mailJaNote` は完了の文と `mailSent` の文の後に置いた (受付確認メールが送れなかったときも、返答が日本語で届く案内として出す)。ja は null で要素を出さない。
6. 「3 営業日以内」は en `within 3 business days (Japan)`、zh-tw `3 個工作天內（以日本的工作天計算）` (W7-site.md §6)。
7. 送信ボタンは用語集の send (reference) の「フォームを送る = submit / 送出」に従い en `Submit`・zh-tw `送出`。`turnstileWait` の「送信する」もそれに合わせた。
8. noscript の英中の件名は en / zh-tw とも英語 (`Inquiry` / `Enterprise inquiry`、spec どおり)。include が `uri_escape` する (`Enterprise%20inquiry`)。
9. 404 の振り分けは、振り分けたら `init()` の残り (流入経路の記録・アイランドのマウント) をしない (`location.replace` の後に 404 のパスを first-touch として書かないため)。ja の 404 とそれ以外のページの処理は変わらない。`lang404Target` は大文字小文字を区別し、`/en` (末尾の `/` なし) は振り分けない。
10. アプリの辞書・用語集との突き合わせ: このチケットの文はサイトだけのもので、アプリの辞書に同じキーは無い (`組織コード` = `organization code` / `組織代碼`、`コピー` = `copy` / `複製` は用語集どおり)。**W8 でアプリの辞書と突き合わせること**: アプリの法人参加の画面 (W5) の「コピーしました」「組織コードを選択してコピー」の訳と、`main.js` の `COPY_TEXT` の en / zh-tw の言い回しを揃える。

## 直したいが直さなかった ja の文

- なし (ja は 1 文字も変えていない)。

## 用語集の追加の候補 (W8 の I-86 へ)

- 導入相談 = en `Enterprise inquiry` (件名・ナビの `Business inquiries` と揺れている) / zh-tw (未定、今回は件名を英語にした)。
- 営業日 = en `business days (Japan)` / zh-tw `工作天（以日本的工作天計算）`。
- 利用アカウント予定数 = en `Planned number of accounts` / zh-tw `預計使用的帳號數`。
- 認証部品 (Turnstile) = en `verification widget` / zh-tw `驗證元件`。
- 全角 / 半角 = zh-tw `全形` / `半形` (en は語を使わず `Full-width digits`)。

## L11 / L13 / L16 / L17 の警告

- サイトには desktop の lint (L11 など) が無い。`lintValue` (仮名・漢字・全角・禁止語・簡体字・新字体・和製漢語) は全部通る。

## ウェーブ末尾の E2E で確かめてほしいこと (I18N-712 の `e2e/i18n-contact.spec.ts`)

- `/en/contact/`・`/zh-tw/contact/`・`/en/enterprise/inquiry/`・`/zh-tw/enterprise/inquiry/` で: 項目名・必須の印の説明・補足・placeholder が英中、空のまま送信 → 欄ごとの検証エラーが英中 (欄の数は ja と同じ)、送信中の `Submitting…` / `送出中…`、完了の見出し・本文・`mailJaNote`、429 のスタブで `rateLimited` の文、400 invalid_input のスタブで Worker の日本語の `message` が画面に出ないこと。
- Turnstile のサイトキーがあるとき widget の言語が `en` / `zh-tw` になること。
- 既存の ja の e2e (`contact.spec.ts`・`inquiry.spec.ts`) が今どおり通ること。
- `/en/join/#code=…` のコピーの結果の文が英中。英中の 404 (存在しない `/en/xxx`) が `/en/404.html` に移ること、ja の存在しないパスでは移らないこと (I18N-712 の後)。

## sync の状態

- サイトは sync の対象外 (desktop / web の `sync-manifest.json` に関係しない)。

## ロールバックの観点

- revert すると I18N-712 (英中の `/contact/`・`/enterprise/inquiry/`・`/join/`・404) の英中の画面が日本語に戻り、`checks/inquiry.mjs` が消える。I18N-713 は `main.js` の末尾の区切りのコメントの下に import と呼び出しを足すので、その後で revert すると衝突する。ja の出力には影響しない。

## レビューの指摘への対応 (Fixer)

- **MEDIUM (checks/inquiry.mjs の noscript の検査がページ全体を見ていた)**: 直した。英中のページはヘッダー (`_includes/header-intl.html` のモバイルナビ) にも `<noscript>` があるので、ページ全体の有無では問い合わせフォームの noscript の欠けを見逃していた。`ISLAND_RE` に当たった位置から後ろに `^<div … data-island="inquiry-form" …>\s*<noscript>(…)</noscript>` を当て、アイランドの root の直下の最初の noscript だけで有無と仮名を調べる。陰性対照に「ヘッダーの noscript があり、アイランドの noscript が無い」「ヘッダーの noscript に仮名があってもアイランドが英中なら合格」「ヘッダーがあってもアイランドの noscript の仮名は捕まえる」と、ヘッダー付きの陽性対照を足した (旧の実装ではヘッダーだけのケースが `[]` になり落ちる)。
- **LOW (zh-tw の general の message を `詢問內容`、enterprise を `諮詢內容` に分けた)**: 今の分け方のまま残した (仮定 2)。ja が「お問い合わせ内容」(general) と「ご相談内容」(enterprise) で語を分けているのに合わせたもので、`_data/l10n/zh-tw/inquiry_form.yml` の `general_items` とも揃っている。**リーダーの判断事項**: spec どおり両方を `諮詢內容` にするか、この分け方を残すか。残すなら W8 の用語集の追加の候補に「お問い合わせ内容 = 詢問內容 / ご相談内容 = 諮詢內容」を加える (下の候補にも書いた)。

## 用語集の追加の候補 (追記)

- お問い合わせ内容 = zh-tw `詢問內容` / ご相談内容 = zh-tw `諮詢內容` (en は `Message` / `Details of your inquiry`)。
