# T-2210 (i18n1112 I18N-712) サイトのお問い合わせ・導入相談・組織への参加・会社概要・404 の英中のページと、W7 の完成の検査・e2e

2026-11-12、役割: Implementer (テストを先に書いて RED を確認 → 実装 → 開発中のゲート → 全ゲートの各段を手元で確認)。コミットは次の担当 (レビューの後)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `en/contact/index.html`・`zh-tw/contact/index.html` (新規、LF) | `contact/index.html` の写し。`kind="general"` の include は ja と同じ呼び方。フォームの上に確認メール・返答が日本語の 1 文 |
| `en/enterprise/inquiry/index.html`・`zh-tw/enterprise/inquiry/index.html` (新規、LF) | `enterprise/inquiry/index.html` の写し。`kind="enterprise"`。同じ 1 文 |
| `en/join/index.html`・`zh-tw/join/index.html` (新規、LF) | `join/index.html` の写し。`noindex: true`・`sitemap: false`・`no_tracking: true`。`data-join*` の構造・3 つの表示・noscript・Store へのリンクは ja と同じ。インラインのスクリプトなし |
| `en/company/about.html`・`zh-tw/company/about.html` (新規、LF) | `company/about.html` の写し。社名 `Deepmosaic LLC` + 正式名 `Deepmosaic合同会社` (`data-ja-allowed`)、住所は ja と同じ式を `data-ja-allowed` の要素に |
| `en/404.html`・`zh-tw/404.html` (新規、LF) | `404.html` の写し (permalink `/en/404.html`・`/zh-tw/404.html`、noindex・sitemap: false)。`data-lang-404` は置かない |
| `404.html` (ja、1 行) | `{% include header.html %}` の次の行に `<div hidden data-i18n-switch data-lang-404></div>`。他の行は不変 (LF のまま) |
| `scripts/i18n/checks/pages-support.mjs` (新規) | 10 ページの出力の検査 (下) |
| `scripts/i18n/checks/complete.mjs` (新規) | W7 の完成の検査 (下) |
| `src/lib/i18n-site-support.test.js` (新規) | 仕様テスト 120 本 |
| `e2e/i18n-contact.spec.ts` (新規、**回していない**) | ウェーブ末尾にリーダーが回す (下) |
| `docs_draft/notes_T-2210.md` | この notes |

- 10 ファイルとも front matter: `layout`・`lang`・`permalink`・`ja_url`・`source`・`source_hash` (`accept-site.mjs` で書いた。404 は 1 行足した後の ja の値)・`title`・`seo_title`・`description`・`schemas` / `noindex` / `sitemap` / `no_tracking` (ja と同じ)。
- ja のページ (`404.html` の 1 行を除く)・include・データ・l10n・`_data/lang/*`・アイランド・`main.js`・用語集の写しは触っていない。既存のテストも触っていない。
- 用語集の写し (`scripts/i18n/glossary*.json`) は `glossary.source.json` の desktop_commit be5c5aea のまま (このチケットでは触っていない)。desktop の `i18n1112-integrate` の ef0ce366 の時点では内容が同じだったが、その後 a51894f5 までに T-2137 (GL-1〜GL-6) の改訂が入り内容が違う (GL-3 / GL-5 = settings の set、delete の remove、contact を reference に、quote・confidence・threshold などの追加)。新しいページは最新の用語集でも check-site / lang-text 0 件・`i18n-site-support.test.js` 0 fail を確認済み (Reviewer の実測)。写し直しと desktop_commit の更新は I18N-702 の持ち物なので W8 でリーダーが行う (下の「残した課題」)。

## 追加したテスト・検査
- `node --test src/lib/i18n-site-support.test.js` (120 本、ソースを読む。`_site` は読まない):
  10 ファイルの存在 / `compareStructure` が空 (ja-link.html の追加だけ許す、404 は ja の印の行を除く。en と zh-tw どうしも空) / front matter (lang・permalink・ja_url・source・source_hash・layout・schemas などが ja と同じ・join の 3 つ・404 の 2 つ・title / seo_title / description が lintText 0 件・会社概要の seo_title が `About us | Deepmosaic…`) /
  本文の全行に仮名なし (en は漢字・全角もなし。`data-ja-allowed` の要素の中は除く)・lintText 0 件 (href の値は除く) / リンクの接頭辞・必須のリンク・ja-link の行き先 / 除去の語なし /
  お問い合わせ・導入相談: include の呼び方が ja と同じ・確認メールの 1 文がフォームより前・one_liner は l10n・営業日の訳 /
  join: `<script`・`http-equiv="refresh"`・`data-dl`・schemas なし、3 つの表示が hidden・ボタン・手順の数 (3 / 2)・コピー・Store のリンク (`site.data.lang.ja.app_download_link`、別タブ・noopener)・ボタン名の引用 4 つ以上 /
  会社概要: `上大崎`・`141-0021` の直書きなし、`〒{{ site.data.company.postal_code }} {{ site.data.company.address }}` を `data-ja-allowed` の要素で参照、`Deepmosaic LLC`・`Deepmosaic合同会社`、日付 /
  404: 印なし・alt の訳 / ルートの 404: `data-lang-404` の要素が 1 つで `data-i18n-switch` を持ち、header の include の次の行 /
  `checks/pages-support.mjs` の陽性対照・canonical なしの模型で何もしない・陰性対照 16 種 / `checks/complete.mjs` の陽性対照・何もしない模型 2 種・陰性対照 13 種。
- `scripts/i18n/checks/pages-support.mjs` (`_site`): 10 ページの存在 (ja がレイアウトを通っているとき) と `<html lang>` / お問い合わせ・導入相談: アイランド・ja と同じ `data-kind`・root の直下の `<noscript>`・確認メールの 1 文 /
  join: robots noindex・referrer no-referrer・計測 (googletagmanager・cloudflareinsights・line-scdn) なし・`data-join` の 11 の属性 / 会社概要: `Deepmosaic LLC` と正式名の `data-ja-allowed` / 英中の 404 に印なし・ルートの 404 に印あり。
- `scripts/i18n/checks/complete.mjs` (`_site`、ja のトップがレイアウトを通っているときだけ): 台帳の全部の鍵に en / zh-tw があり、ja / en / zh-tw の 3 版が `_site` にあり、3 版のそれぞれが hreflang で 3 版 + x-default (= en) を指す /
  `sitemap.xml` に英中の索引対象 (台帳から `/join/` を除いた 8 鍵 × 2) があり、英中の join・404 が無い / `_site/en/**`・`_site/zh-tw/**` の `.html` が台帳の英中の版 + 英中の 404 とちょうど同じ / `assets/dist/app.js` に `data-lang-404`。
  台帳の読み取りは `checks/head.mjs` の `parseLedger` を import して使う (head.mjs は変えていない)。
- RED: 実装前に `node --test src/lib/i18n-site-support.test.js` → 120 本中 119 fail (台帳の前提の 1 本だけ pass)。

## ゲートの結果 (手元)
- 開発中: `node --test src/lib/i18n-site-support.test.js src/lib/i18n-site-tools.test.js` → 156 pass / 0 fail
- `npm test` → 1223 件 (1220 pass / 0 fail / 3 skip)
- `npm run build && bundle exec jekyll build --strict_front_matter` → OK
- `node scripts/check-docs.mjs` → OK (2 ページ、38 ファイルの深いリンク。英中の `/docs` のリンクを含む)
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site` → OK (17 files。`404.html` の差分は `data-i18n-switch` の要素の行だけ。llms*.txt・robots.txt も一致)
- `node scripts/i18n/check-site.mjs _site` → OK (11 モジュール。lang-text は英中 20 ページで 0 件)
- `git diff --stat` と `--ignore-cr-at-eol` は一致 (`404.html | 1 +`)。新しいファイルは全部 LF。
- 既存の `site-copy-t2090`・`site-copy-t1032`・`contact-email` を含む全部の node テストが通る (`npm test` の中)。

## 置いた仮定・spec / 設計書との食い違い
1. **join のボタン名は辞書から写せなかったので自分で訳した** (タスクの指示どおり)。desktop の `i18n1112-integrate` (ef0ce366) の `messages/account_login.ts` は空 (`defineMessages({})`、W5 の I18N-504 がまだ)。
   3 つの文 (「エンタープライズプランの方はこちら」「メールアドレスではじめる」「パスワードで登録済みの方はこちら」) はアプリの画面 (`src/lib/components/AuthDialog.svelte`・`src/lib/auth/login-entry.ts`) の文で、
   Auth0 のログイン画面の文ではない (アプリの中のダイアログ) ので、spec の「日本語のまま `data-ja-allowed` + `(shown in Japanese)`」ではなく訳した。訳は下の「W8 でアプリの辞書と突き合わせること」。
2. 「アプリで開く」(サイトのボタン) = en `Open in app` / zh-tw `以應用程式開啟`。「押します」= en `Select` / zh-tw `按下`。
3. 「案内メールは日本語で届きます」の 1 文は join に足さなかった (spec の「足してよい」= 任意。利用者は日本語の案内メールのリンクから来るので既に読んでいる)。
4. **会社概要の資本金**: ja は「百万円」(数字なし)。en `¥1,000,000`、zh-tw `1,000,000 日圓` (通貨の規則 COMMON §4)。
5. 会社概要の title / h2 は en `About us` / zh-tw `關於我們` (フッターのリンクの `_data/lang/*.json` の `company` と同じ語。spec の seo_title の形 `About us | …`)。seo_title は ja (`会社概要｜Deepmosaic合同会社`) に合わせて `About us | Deepmosaic LLC` / `關於我們｜Deepmosaic LLC`。
6. 会社概要の ja のコメントアウトした節 (代表略歴・代表実績、HTML コメントの中) は写していない (表示されない節で、parity もコメントを除いて比べる)。
7. 正式な社名と住所の `data-ja-allowed` の要素に `lang="ja"` も付けた (読み上げとフォント)。parity は `data-*` の名前だけを比べるので影響なし。
8. 導入相談の名前: title / パンくず en `Enterprise inquiries` / zh-tw `Enterprise 導入洽詢` (I18N-711 の「導入相談」= `Enterprise inquiries` / `導入洽詢` に合わせた)。h1「Enterprise 導入について相談する」= en `Talk to us about adopting Enterprise` / zh-tw `洽詢 Enterprise 的導入`。
9. 「Enterprise（1 アカウントから）」= en `Enterprise (available from 1 account)` / zh-tw `Enterprise（1 個帳號起）`。ja の 1 は直書きなので英中も直書き (ja と同じ)。
10. 404 の描画: ja の `404.html` は permalink なしで `/404.html`。英中は `/en/404.html`・`/zh-tw/404.html`。`e2e/lib/serve.mjs` は未知のパスに `_site/404.html` を 404 で返す (確認した) ので、(f) は skip にしていない。
11. contact の確認メールの 1 文は spec の文のまま (en `The confirmation email and our reply will be in Japanese.` / zh-tw `確認電子郵件與回覆將以日文寄送。`)。島の完了カードの `mailJaNote` (I18N-708、`The confirmation email is in Japanese.`) とは別の文で、両方出る。
12. 電話番号を空にしたときの英文は `Enter at least 5 characters for your phone number.` (ja も空のときは「最低 5 文字」の文。inquiry-validate.js の最小長 5 の規則のまま)。e2e (d) はこの文を期待する。
13. `complete.mjs` は ja のトップ (`_site/index.html`) が canonical を持つときだけ動く (既存の `i18n-site-tools.test.js` の ja-lang の模型 = canonical の無い HTML で check-site を全モジュールで回して exit 0 を期待しているため)。

## join のボタン名: 辞書から写したか
| ja (アプリの画面) | en | zh-tw | 出所 |
|---|---|---|---|
| エンタープライズプランの方はこちら | Enterprise plan users | Enterprise 方案使用者 | 辞書に無い → 用語集 (エンタープライズ = Enterprise、プラン = plan / 方案) から訳した |
| メールアドレスではじめる | Start with email | 以電子郵件開始 | 辞書に無い → I18N-703 の subscribe.yml と同じ訳 |
| パスワードで登録済みの方はこちら | Registered with a password | 已使用密碼註冊 | 辞書に無い → 用語集 (パスワード = password / 密碼) から訳した |
| コピー (サイト) | Copy | 複製 | 用語集 |

## W8 でアプリの辞書と突き合わせること
- 上の表の 3 つ (アプリの AuthDialog の主ボタン・副ボタン・組織コードの区画の見出し) が、W5 の I18N-504 (`account_login`) の en / zh-TW と同じか。違えば英中の join (`en/join/index.html`・`zh-tw/join/index.html` の手順の 3 行・カード・noscript) を辞書に合わせる (ja は変えない)。
- 「ログイン画面」= en `sign-in screen` / zh-tw `登入畫面`、「管理者」= `admin` / `管理員`、「案内メール」= `invitation email` / `邀請電子郵件` がアプリの文と揃っているか。
- `main.js` の `COPY_TEXT` (I18N-708) とアプリの「コピーしました」(W5) の言い回し。
- 「メールアドレスではじめる」の訳 en `Start with email` / zh-tw `以電子郵件開始` は、用語集の必須語 (kind: required) `email address` / `電子郵件地址` を含まない。サイトの lintText に L6 が無いので検査では落ちないが、アプリの辞書 (desktop の L6 を通る) と食い違いやすいので L6 の観点で要確認。

## 直したいが直さなかった ja の文
- 無し。

## 用語集の追加の候補 (W8 の I-86 へ)
- 導入相談 = en `Enterprise inquiries` / zh-tw `導入洽詢` (I18N-711 と同じ。nav の「法人様はこちら」= `Business inquiries` / `企業方案` と揺れている)。
- 営業日 = en `business days (Japan)` / zh-tw `工作天（以日本的工作天計算）` (I18N-708 と同じ)。
- 銀行振込 = en `bank transfer` / zh-tw `銀行轉帳`。請求書払い = en `pay by invoice` / zh-tw `以請款單付款`。
- 会社概要の表: 社名 `Company name` / `公司名稱`、設立日 `Established` / `成立日期`、所在地 `Address` / `地址`、資本金 `Capital` / `資本額`、事業内容 `Business` / `營業項目`。
- 不具合の報告 = en `bug reports` / zh-tw `錯誤回報`。

## L11 / L13 / L16 / L17 の警告
- サイトには desktop の lint が無い (lintText だけ)。数える文は `1 account` / `1 個帳號` (ja の直書きの 1)。文を `+` で組み立てていない。

## ウェーブ末尾の E2E で確かめてほしいこと
- `npx playwright test` (既存 45 件 + `i18n-nav` + `i18n-contact`)。`e2e/i18n-contact.spec.ts` は 9 本: (a)(b)(c) を en・zh-tw の `/contact/` で、(d) `/en/enterprise/inquiry/` の電話番号、(e) `/en/join/#code=ABCD-EFGH-JKLM` のコピーと計測なし、(f) `/en/nope/` → `/en/404.html`。
- 画面: `/en/contact/`・`/zh-tw/contact/`・`/en/enterprise/inquiry/`・`/zh-tw/enterprise/inquiry/` のフォームの上の 1 文と、フォームの幅 (375 / 768 / 1280)。
  `/en/join/#admin`・`#code=…`・`#x` の 3 つの表示、`/zh-tw/join/` の手順の改行。`/en/company/about`・`/zh-tw/company/about` の表の折り返し (正式名・住所の日本語)。
  `/zh-tw/nope` → `/zh-tw/404.html` と、ja の存在しないパス (`/nope`) が移らないこと。
- **join の言語の切り替えでコードが残るか**: `/join/#code=ABCD-EFGH-JKLM` → ヘッダーの English → `/en/join/#code=ABCD-EFGH-JKLM` でコードの表示のまま (今は hash が落ちて invalid になる。上の「残した課題」。直すチケットが入るまでは失敗が期待どおり)。

## sync の状態
- サイトだけのチケット (desktop / web の共有ファイルは触っていない)。

## ロールバックの観点
- revert すると英中の 10 ページと 2 つの検査のモジュールが消え、ルートの 404 の印が外れる (main.js の振り分けは印が無ければ何もしないので ja の 404 は今どおり)。
  英中のヘッダー・フッター・料金・トップの `/en/contact/`・`/en/enterprise/inquiry/` へのリンク (I18N-706・707・709〜711) と、台帳 (`_data/i18n_pages.yml`) の join・contact・inquiry・about の hreflang が 404 を指す。
  他のチケットのファイルは触っていないので独立に revert できる。

## W7 全体のまとめ (リーダーが CHANGELOG と W8 に使う)

### 英中のページ (台帳 9 鍵 × 2 = 18 + 404 の 2 = 20)
| ja | en | zh-tw | チケット |
|---|---|---|---|
| `/` | `/en/` | `/zh-tw/` | I18N-709 (en) / I18N-710 (zh-tw) |
| `/price/`・`/spec/`・`/subscribe/`・`/mosaic-removal/` | `/en/…` | `/zh-tw/…` | I18N-711 |
| `/contact/`・`/enterprise/inquiry/`・`/join/` (noindex・計測なし)・`/company/about` | `/en/…` | `/zh-tw/…` | I18N-712 |
| `/404.html` (noindex) | `/en/404.html` | `/zh-tw/404.html` | I18N-712 |

### l10n のファイルと持ち主
| ファイル | 持ち主 |
|---|---|
| `_data/lang/en.json` (作り直し)・`_data/lang/zh-tw.json` | I18N-702 (`_data/lang/ja.json` は不変) |
| `_data/l10n/<lang>/plans.yml`・`faq.yml`・`subscribe.yml` | I18N-703 |
| `_data/l10n/<lang>/spec.yml`・`disclosure.yml`・`mosaic.yml`・`entity.yml` | I18N-704 |
| `_data/i18n_pages.yml` (台帳 9 本) | I18N-705 |
| `_data/l10n/<lang>/nav.yml` | I18N-706 |
| `_data/l10n/<lang>/parts.yml` | I18N-707 |
| `_data/l10n/<lang>/inquiry_form.yml` | I18N-708 |
| アイランド・JS の 3 言語の表 | I18N-706 (MobileNav)・I18N-707 (RoiCalculator・VideoLightbox・pricing.js)・I18N-708 (InquiryForm・inquiry-validate・main.js)・I18N-713 (lang-suggest) |
| 英中のページ固有の文 | 各ページのファイル (I18N-709〜712) |

### 検査のモジュール (`scripts/i18n/checks/`、check-site が名前の順に実行。今 11 本)
`complete` (712)・`head` (705)・`inquiry` (708)・`ja-lang` (701)・`lang-text` (702)・`nav` (706)・`pages-product` (711)・`pages-support` (712)・`pages-top-en` (709)・`pages-top-zh` (710)・`parts` (707)。
ほかに `ja-identity.mjs` (基点の `_site` と ja の全 .html・llms*.txt・robots.txt をバイト単位で比べる、CI には載せない)・`parity.mjs`・`source-hash.mjs` / `accept-site.mjs`・`site-lint.mjs`。I18N-713 が足すものはその notes。

### ja-identity の結果
- T-2210 の時点で OK (17 files)。許した差分は hreflang / og:locale:alternate の行と `data-i18n-switch` の要素 (ルートの 404 の印を含む) だけ。

### 残した課題
- `VideoLightbox.svelte` はどのページからも使われていない (`data-island="video-lightbox"` の参照 0、I18N-707 が 3 言語の表だけ足した)。消すか残すかはリーダーの判断。
- `_site/scripts/` (`check-docs.mjs`・`check-plan-catalog.mjs`・`optimize-images.mjs`) が公開物に出ている (`_config.yml` の exclude は `scripts/i18n` だけ。i18n 以前からの既存の状態)。exclude に `scripts` を足すかはリーダーの判断 (`_config.yml` は I18N-701 の持ち物)。
- `/company/about` をアプリの `SITE_TRANSLATED_PATHS` (desktop `src/lib/i18n/site-url.ts`、8 本) に足すかどうか。足さないとアプリの「会社について」のリンクは英中でも ja の `/company/about` を開く (台帳は 9 本。差の扱いは T-2203 の notes の「台帳とアプリの SITE_TRANSLATED_PATHS の差」)。
- 英中のスクリーンショット: 今は ja の画面を流用し alt / figcaption に `(Japanese UI)` / `（日文介面）`。英中の画面のスクリーンショットに差し替えるかは W8 以降。
- I18N-711 の notes の仮定 14 (フッターの `About existing mosaic` / `關於既有馬賽克` とモザイク除去のページの title の違い) のリーダーの判断。
- I18N-708 の notes の zh-tw の `詢問內容` / `諮詢內容` の分け方のリーダーの判断。
- **組織への参加のページで言語を切り替えると組織コードが消える** (レビューの指摘、MEDIUM。持ち主外のファイルなのでこのチケットでは直していない)。英中の join ができたので ja の `/join/` (案内メールの着地点) のヘッダー・フッターの言語の切り替えが実際に使えるが、行き先は `/en/join/`・`/zh-tw/join/` でフラグメント (`#code=…` / `#admin`) が付かず、`parseJoinHash("")` は invalid になる (「This link isn't valid.」の表示)。
  (1) `/join/` の言語の切り替え (`nav.yml`・header / footer-intl、I18N-706) と I18N-713 の言語の案内の帯は、行き先に `location.hash` を引き継ぐ必要がある (例: `main.js` で `[data-join]` のページだけ切り替えのリンクに hash を付ける)。
  (2) ウェーブ末尾の E2E に「`/join/#code=…` → English → `/en/join/#code=…` でコードが残る」を足す (下の E2E の節)。
- 用語集の写し (`scripts/i18n/glossary*.json`) が desktop の `i18n1112-integrate` の最新 (a51894f5、T-2137 の GL-1〜GL-6) より古い (be5c5aea のまま)。隣に desktop が無いと `npm test` の「用語集の写し: 隣に desktop の用語集があれば同じ内容」が skip になり、ずれが見えない。写し直しと `glossary.source.json` の desktop_commit の更新は W8 / リーダーの判断 (今の出力は最新の用語集でも lang-text 0 件)。

## レビューの指摘への対応 (Fixer / Tester)
- MEDIUM (join の言語の切り替えで組織コードが消える): 持ち主外 (nav・main.js・I18N-713) なので直さず、「残した課題」と E2E の節に書いた。
- LOW (用語集の写しの記述が古い、2 件): 変更点の要約の記述を直し、「残した課題」に足した。写しと `glossary.source.json` は触っていない。
- LOW (「メールアドレスではじめる」の訳と L6): 訳はそのまま。「W8 でアプリの辞書と突き合わせること」に 1 行足した。
- LOW (zh-tw の contact で「請透過」と `<a>` の間に空白が無い): `zh-tw/contact/index.html` の `<a>` の前に半角スペースを 1 つ入れた (en・ja は不変)。

## ウェーブ末尾の追い修正 (2026-11-12、リーダーの決定。T-2200 / T-2210)

先に失敗するテストを足してから直した (`src/lib/i18n-site-lang.test.js` の 3 本・`src/lib/i18n-site-support.test.js` の 4 本・新しい `src/lib/i18n-site-wave-end.test.js` の 9 本のうち 8 本は、直す前に落ちることを確かめた。FAQ の言い回しの 1 本は直した後に書いた)。

### 1. 用語集の写し直し (T-2200 の持ち物)
- `scripts/i18n/glossary.json`・`glossary-chars.json` を desktop のローカルのブランチ `i18n1112-integrate` (4c2ce498、用語集の最後の変更は e0c89c46 = T-2137 の横断レビュー) から `git show` で写した (fetch / checkout はしていない)。210 語、禁止字の表に 3 つ目の `zh_non_tw_variant` (37 字)、zh-TW の禁止語 13 語の追加 (創建・碼率・比特率・置信度・內置・反饋・線程・顯存・打印・訪問・批量・賬單・賬戶) と allow_in の追加 (文件・支持・在線・表示)。
- `glossary.source.json` の `desktop_commit` を 4c2ce498ca3d9ece6d24383dc3f2a55f03435aeb に、sha256 を LF にそろえた内容の値に更新した。
- `scripts/i18n/site-lint.mjs` の zh-tw の検査に `zh_non_tw_variant` を足した (規則名 `variant`、`use` は台湾の字形。desktop の lint-core.ts の L5 と同じ。表の無い古い写しでも落ちない)。
- テスト: variant の陽性 (爲・衆・啓・裏・着) と陰性 (為・眾・啟・裡・著)、新しい禁止語 7 語の陽性と訳語の陰性、allow_in の合成語 (的支持與・相關文件) を許すこと、写しの版 (210 語・3 つ目の表・必須語 8 語の en / zh / kind)。
- 新しい表での確認: `npm test` (英中の辞書・l10n・ページ・JS の言語の表を lintValue / lintText にかけるテストを含む) と `check-site` の lang-text が 0 件。英中のソース全体 (`_data/l10n/zh-tw`・`zh-tw/`・`_data/lang/zh-tw.json`・`src`・`_includes`) を `zh_non_tw_variant` の字と新しい禁止語で走査し、当たりは日本語のコメント・ja の文 (着地・吸着) だけ。
- 必須語の突き合わせ (自動の検査は禁止語だけなので目で見た): お見積り = quote / 報價、信頼度 = confidence / 信賴度、メニュー = menu / 選單、検索 = search / 搜尋、エンタープライズ = Enterprise、作成 = create / 建立 は用語集どおりだった。**直した 1 件**: `_data/l10n/zh-tw/mosaic.yml` の「信頼度しきい値」の訳 `信賴度門檻` → `信賴度臨界值` (しきい値 = 臨界值)。ウィンドウ は英中の対象のページに出ない。

### 2. /join/ の言語の切り替えで組織コードが消える (T-2210 の残した課題)
- 純関数 `carryJoinHash(href, hash)` (`src/lib/join-switch.js`、新規): 行き先が join の 3 版 (`/join/`・`/en/join/`・`/zh-tw/join/`) のときだけ、`parseJoinHash` (join-hash.js、T-2090) の検証に通った値を**作り直して** `#code=<正規化した code>` / `#admin` を付ける。検証に通らなければフラグメントを付けない (前に付けたものも外す)。それ以外の行き先 (サイトの外・`//`・`javascript:`・クエリ付き) は触らない。生の `location.hash` は href に入れない。
- `src/main.js` の `initJoinPage` (join のページだけ): 読み込み時と `hashchange` で `[data-i18n-switch] a[hreflang], .lang-suggest a[hreflang]` (ヘッダー・フッター・ドロワー・言語の案内の帯) の href を付け直し、後から描かれるドロワーと帯のために `click` / `auxclick` の capture 相でも押した瞬間に付け直す。`setAttribute('href', …)` だけ (innerHTML・ログ・計測・通信なし)。ja の HTML の出力は変わらない (ja-identity OK)。
- e2e: `e2e/i18n-contact.spec.ts` に (g) `/join/#code=ABCD-EFGH-JKLM` → フッターの English → `/en/join/#code=ABCD-EFGH-JKLM` でコードの表示が残る、(h) `/en/join/#admin` → 繁體中文 → `/zh-tw/join/#admin`、不正なフラグメント (`#code=<b>x</b>`) は引き継がない、を足した。**Playwright はこの担当では回していない** (ウェーブ末尾の E2E で回す)。ヘッダーの切り替えは xl 幅でだけ見えるのでフッターを押す。

### 3. 英中のページの canonical (T-2210 の checks/complete.mjs)
- 入っていなかった: `checks/head.mjs` は canonical の無いページを見ない設計で、そのコメントは「英中の canonical は complete.mjs で見る」と書いていたが、complete.mjs は hreflang の対称しか見ていなかった。
- `checks/complete.mjs` に、台帳の英中の版が自分自身を指す canonical をちょうど 1 本持つことと、3 版とも hreflang がちょうど 4 本 (ja・en・zh-Hant-TW・x-default) であることを足した。今の `_site` は 0 件。
- テスト (i18n のテストの仕様の変更): complete の模型を自己参照の canonical にし (`completeSite`)、`unbuilt` を「canonical の行を全部除く」に変えた (pages-support の模型にも同じ意味)。陰性対照 4 本 (en の canonical が ja を指す・zh-tw に canonical が無い・canonical が 2 本・hreflang が 5 本) を足した。

### 4. 訳の小さな直し (T-2201 の持ち物を リーダーの決定で)
- `_data/l10n/en/faq.yml`: 1 件目の答えの `…where mosaic processing is required.` → `…where mosaic must be applied.` (T-2207 の notes の案)。DeepMosaics の答えの `"DeepMosaics," which` → `"DeepMosaics", which` (`_data/l10n/en/entity.yml` の書き方に揃えた)。
- `_source_hash` は ja の `_data/faq.yml` の値で、ja を変えていないのでずれない (`i18n-site-tools.test.js` の source_hash の検査が通る)。

### 5. 決定の反映 (コードは変えない)
- `D:/dm-scratch/i18n/spec/W7-site.md` §2 の誤認の訂正の項に (a) zh-tw の「除去できない」の否定は en と同じ扱い、§3 の表の後に (b) 問い合わせフォームの zh-tw の項目名は今の分け方 (詢問內容 / 諮詢內容) を残す、を 1 行ずつ追記した。
- 同じく §5 の probe の手順を直した: `en/_probe.html` は Jekyll が出力しない (`_` で始まるファイル) ので `en/probe.html` (permalink `/en/probe/`) に。

### 6. Tailwind の自動検出が scripts/ の語を拾う (T-2204 の notes)
- `src/app.css` に `@source not "../scripts";` を足した (Tailwind 4.3.3。`@source not "<path>"` と `@source not inline("…")` は `node_modules/tailwindcss/dist/lib.js` の `@source` の解析で対応を確かめた。同じファイルの既存の `@source not "../_site";` と同じ書き方)。
- **scripts/ を外すだけでは `.table` は消えなかった**: i18n で増えた node テスト (`i18n-site-inquiry.test.js` の変数 `table`) と作業メモ (`docs_draft/notes_T-2202.md`・`notes_T-2204.md`) にも語 `table` がある。docs_draft/ と node テストを丸ごと外すと、基点のビルドにあった規則 (`.ml-3`・`.lg:inline-flex`・`[exp:f16]` など、どのページも使っていない) が消えて「基点と同じ」にならなかった。そこで**語を指定して** `@source not inline("table");` を足した。あわせて英語のページの本文の語 shrink (`Enlarge or shrink detection boxes …`) が生んでいた `.shrink{flex-shrink:1}` も `@source not inline("shrink");` で止めた (基点に無く、どのページも class に使っていない)。
- 確認: ビルドした `_site/assets/dist/app.css` を基点 (`D:/dm-scratch/i18n/site-base/W7/_site/assets/dist/app.css`) と規則の単位で比べ、**基点にあって今無い規則は 0** (`xl:grid-cols-2` は同じ規則が別の media のまとまりへ移っただけ)。今だけにある規則は言語の切り替え (ja のページの許した差分の要素が使う `gap-x-4`・`gap-y-1`・`xl:-ml-4`・`xl:flex`)・英中のヘッダー (`xl:inline`・`xl:gap-5`)・`:root:lang(zh)`・言語の案内の帯 (`.lang-suggest*`) だけ。`.table`・`.shrink` は無い。
- 既知の制約: 今後 class に `table` / `shrink` を使うと規則が出ない (使うなら app.css の 2 行を外す)。
- テスト: `i18n-site-nav.test.js` の app.css の本文の sha (jaCssBody) は、この 3 行 (`@source not "../scripts"`・`inline("table")`・`inline("shrink")`) を除いて比べる形に直した (リーダーが許した直し)。`i18n-site-wave-end.test.js` で 3 行があることを固定した。

### 7. `_site/scripts/` にビルド用の道具が出ていた件 (i18n より前から)
- `_site` 全体 (html・css・js・sitemap.xml・llms*.txt・robots.txt) を `scripts/check-docs`・`check-plan-catalog`・`optimize-images`・`/scripts/` で走査し、参照 0 件を確かめてから `_config.yml` の exclude を `scripts/i18n` → `scripts` にした (scripts/i18n を含む)。ビルド後の `_site/scripts/` は無い。CI (`.github/workflows/jekyll.yml`) はリポの `scripts/…` を直接実行するので影響しない。
- テスト: `i18n-site-tools.test.js` の「exclude に scripts/i18n がある」を「scripts/i18n か、それを含む scripts がある」に直した (i18n のテストの仕様の変更)。`i18n-site-wave-end.test.js` で `scripts` の行を固定した。

### ゲートの結果 (コミット前)
- `npm test`: 1272 件 / pass 1269 / fail 0 (skip 3 は既存)。`npm run build`・`bundle exec jekyll build --strict_front_matter`: OK。`node scripts/check-docs.mjs`: OK。
- `ja-identity`: OK (17 files)。`check-site`: OK (11 モジュール)。
- `git diff --stat` と `git diff --stat --ignore-cr-at-eol` の行数が一致 (改行の反転なし)。

### ロールバックの観点
- revert すると用語集が be5c5aea の版に戻り (variant の検査は表が無ければ何もしない)、join の切り替えでコードが落ちる元の挙動に戻り、`_site/scripts/` が再び公開物に出る。ja のページの HTML は revert の前後で変わらない (app.css は `.table`・`.shrink` が戻るだけ)。

## ウェーブ末尾の Playwright (Tester、2026-11-12)

### 結果
- 1 回目: 98 件中 合格 93 / 失敗 4 / skip 1。失敗は全部 `e2e/i18n-nav.spec.ts` の (a) (幅 768 / 900 / 1024 / 1280)。
  - 原因は spec の誤り。`header [data-i18n-switch]` がヘッダーの切り替え (div) と、ドロワーへ渡す言語の表 `<script type="application/json" data-i18n-switch data-lang-links>` の 2 つに当たって strict mode で落ちていた。script に data-i18n-switch を付けるのは設計どおり (ja-identity がこの要素を除いて比べる) なので、製品は直さず、spec のセレクタを `header > div > div[data-i18n-switch]` に絞った。
- 既存の spec (i18n-*.spec.ts 以外) は全部合格。期待値は書き換えていない。
- 修正後: 105 件中 合格 104 / 失敗 0 / skip 1 (skip は inquiry-cors.spec.ts。E2E_BASE_URL のときだけ回るもので以前から)。

### 追加の確認で見つけて直したもの (英中のページだけ。ja の HTML は ja-identity で同一)
1. 日本語だけのページ (docs) へのリンクに hreflang="ja" が無いものがあった。
   - CTA の副ボタン (`cta-download.html` の secondary_href="/docs"、英中の price / spec): 任意の引数 `secondary_hreflang` を足し、渡したときだけ hreflang と印の title を付ける。ja のページは渡さない。
   - ドロワー (`MobileNav.svelte`) の Docs の項目: badge のある項目にだけ hreflang="ja" を付ける (ja の項目は badge が無いので付かない。i18n-nav (c) の「ja のドロワーの項目に hreflang が無い」はそのまま通る)。
2. 英中のトップのヒーローの「View the documentation」ボタンの印「(Japanese)」がボタンの外の兄弟要素で、flex の折り返しで印だけが次の行に浮いていた (幅 1280)。`ja-link.html` に任意の引数 `inside=true` を足し、英中のページでは印をボタンの中に入れ、title をリンクに付ける。class は既存のもの (text-[11px] text-ink-3) なので CSS の規則は増えない。
- 回帰のテストとして `e2e/i18n-nav.spec.ts` に (e) を足した (英中の 6 ページで docs・法務へのリンクが全部 hreflang="ja"、/en/price/ のドロワーの Docs が hreflang="ja" と印を持つ)。修正前に 7 件とも落ちることを確かめた。

### 確認できたこと (ビルドした _site とブラウザ)
- 英中 20 ページで html lang (en / zh-Hant-TW)・title・description が訳されている。h1 は about だけ無いが、ja の about にも h1 は無い (元の構造)。
- フッターの言語の切り替えで、9 ページ × 3 言語を行き来でき、戻り先も一致する。
- /join/#code=ABCD-EFGH-JKMN は 3 言語 × 3 言語の 9 通りでクリックの後も hash が残る。
- ja のページに hreflang ja / en / zh-Hant-TW / x-default (= /en/) の 4 本。404 は hreflang なし・noindex。
- 英中の 404 (/en/no-such-page/ → 404, lang=en。zh-tw も同じ)。join は英中でも noindex, nofollow。
- スクリーンショットは D:/dm-scratch/i18n/site-shots/ (幅 390 / 768 / 1280 / 1440 × /, /en/, /zh-tw/, /en/price/, /zh-tw/price/)。どれも文書の横スクロールは 0px。

### 直さなかったもの (リーダーへ)
- トップのヒーローの「Web 版を試す」ボタン (`a[data-dl="hero-webapp"]`、btn-secondary btn-lg、折り返さない) が幅 320〜390 で左右の画面外にはみ出す (390 で ja は左 -51px、en は -63px、zh-tw は -5px)。文書の横スクロールにはならないが文字が切れる。**ja のページでも以前から同じ** なので、直すと ja の見え方が変わる。ja を含めて直すかの判断が要る (例: btn に whitespace-normal を許す、モバイルだけ短い文言)。
- 英中のトップのヒーローの画像 (検出支援できる物体 / 男性器・女性器・人間の顔) は日本語の文字の画像のまま (直下の説明文に英中の訳と「(Japanese UI)」がある)。

### ロールバックの観点
- revert すると spec のセレクタが戻って (a) が落ち、英中の CTA の副ボタン・ドロワーの Docs から hreflang が消え、ヒーローの印がボタンの外に戻る。ja のページの HTML は前後で変わらない。
