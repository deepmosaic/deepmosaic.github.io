# T-1921: プライバシーポリシー §9 とクッキーポリシーを「サイト配布版 + 配信ストア版」の両方に合う文にする (2026-11-13 改訂)

## 経緯と承認
- 旧案 (ffa9731・b758444、2026-11-11) は「配布は配信ストアだけ、インストーラー版は 2.11.1 で終了」が前提だった。その後、
  デスクトップアプリ 2.13 はサイト配布版 (インストーラ) で公開し、2.14 はサイト配布版と配信ストア版の両方で出すことになった (backlog1113)。
- 文案は `D:/dm-scratch/backlog1113/privacy9-draft.md`。**ユーザー承認 (2026-11-13 夜)**: (1) §9 の全文の案と (2) クッキーポリシーの文の案で進める。
  (6) の決定: 1 記録項目を実態に合わせて書き足す (「最初に到達した際の参照元、キャンペーンパラメータ及び最初に表示したページのパス」。
  クッキーポリシーの「保存する内容は…のみ」も最初に表示したページのパスを含む文に) / 2 突き合わせの結果をサインインのご案内に使うことを書く /
  3 用語は「サイト配布版」「配信ストア版」。
- 文案の〔追加〕〔…〕の注記は本文に入れていない。

## 変更点
- `company/privacy.html` §9「9.入手経路の記録について」を文案 (1) に置き換えた。小見出しは「9-1 サイト配布版について」のように
  番号つきの段落 (`<p>`) にした (privacy.html はほかの節も `<p>7-1 …` の形で、h3 を使っていないため)。箇条書きは既存の
  `<ul><ol style="list-style-type: square">`。9-1 (サイト配布版) は両方に共通なのでページに直書き。
- 新しい部品 `_includes/legal-distribution.html` が `_data/site.yml` の `distribution.store_enabled` で出し分ける (ページは切り替えを直接読まない = T-2304 の決まり)。
  part は `privacy-9-lead` (冒頭の段落)・`privacy-9-after-site` (9-1 の後ろ)・`cookie-store` (クッキーの 1 文)。
- `company/cookie.html`「ブラウザのローカルストレージ」: 1 段落目の後半を文案 (2) に (9-3 → 9-1、「バージョン 2.11.1 以前」を削除)。
  配信ストアへ引き渡さない旨の 1 文は部品で true のときだけ。2 段落目「保存する内容は…のみ」を、最初に到達した際の記録の
  「最初に表示したページのパス（URLのクエリ等を除いた部分）」を含む文に直した。
- 最終更新日: privacy.html・cookie.html とも 2026-11-13 (signin1113 で既に 2026-11-13 だったので値は変わらない)。
  **公開日がずれたらリーダーが両方の日付と `src/lib/site-copy-t1921.test.js`・`site-copy-signin1113.test.js` の日付の期待値を合わせる。**
- `_data/legal.yml` の版 `2026-11-08` は変えていない (再同意を起こさない。版は EULA・利用規約の日付で、privacy / cookie は含まない。T-1572 / T-1656 と同じ扱い)。
- 英中のページは法務文書の対象外 (日本語だけ) なので変えていない。

## false (既定) と true の出力の違い
| | false (いま) | true (配信ストアの製品ページの公開後) |
|---|---|---|
| 冒頭 | 本ソフトウェアを「サイト配布版」として配布、の 1 文 (用語はサイト配布版だけ定義) | 2 つの方法 (サイト配布版・配信ストア・配信ストア版を定義) |
| 9-1 | サイト配布版 (共通) | 同じ + 「識別子の発行と突き合わせはサイト配布版に限る」の 1 文 |
| 9-2 | 利用目的及び第三者提供 (9-1に定める情報、配布の種類 = 「サイト配布版であること」) | 配信ストア版について (初回起動の記録・流入元を記録しない・GA・配信ストアへ引き渡さない) |
| 9-3 | 記録を希望されない場合 (配信ストア版の公開前の文 = 識別子を含まないインストーラーの案内) | 利用目的及び第三者提供 (9-1及び9-2、配布の種類は「いずれの配布方法でも」) |
| 9-4 | なし | 記録を希望されない場合 (公開後の文 = 配信ストア版をご利用ください + インストーラーの案内) |
| cookie | サイト配布版のダウンロードに使う (9-1) まで | + 配信ストアへ引き渡さず当社サーバーにも送信しない (同 9-2) |

- false では 9-2 を切り替えで外したので番号が詰まる (9-1 / 9-2 利用目的 / 9-3 希望されない場合)。文中の参照 (「9-1に定める情報」) も false 用の文にした。
- false の 9-2 の括弧は「（同項に定めるサインインのご案内を含みます。）」(「9-1に定める情報は…（9-1に定める…）」の重複を避けた。true は文案どおり「9-1に定める」)。
- 文案の 9-4「公開前の文」は false では 9-3 として出る (番号以外は文案どおり)。

## 検査 (ゲート)
- `src/lib/site-copy-t1921.test.js` を書き直した。部品を小さな描画器 (comment / if / elsif / else / endif と 2 種の条件だけ。知らないタグ・条件は例外) で
  false / true の両方に描いて、§9 とクッキーの文を固定する。部品の作りがこの範囲を外れたらテストが落ちる。
- `src/lib/site-copy-t1444.test.js` §9 の突き合わせの文を新しい文 (サイト配布版・本ソフトウェア) に。
- `scripts/i18n/checks/store.mjs`: 法務文書の除外 (`LEGAL_RE`) をやめた。false: 法務文書にも Store のボタン・掲載ページへのリンクが無く、
  さらに privacy / cookie の本文 (HTML のコメントを除く) に「配信ストア」の語が無い。true: `LEGAL_STORE_MARKS` (privacy の「9-2 配信ストア版について」
  「配信ストア版をご利用ください」、cookie の「配信ストアへ引き渡さず」) がある。`scripts/check-store-toggle.mjs` は説明の 1 行だけ。
  `src/lib/site-store-button-t2304.test.js` の模型 (陽性対照と陰性対照) をこれに合わせた。`docs_draft/notes_T-2304.md` の「法務文書は対象外」は当時の記録として残した。
- `src/lib/site-copy-signin1113.test.js` の日付の期待値は 2026-11-13 のままで合っている (変更なし)。
- ゲート: npm test (1347 合格 / 0 失敗) → `npm run build && bundle exec jekyll build --strict_front_matter` → `node scripts/i18n/check-site.mjs _site` (OK)
  → `node scripts/check-docs.mjs` (OK) → `node scripts/check-store-toggle.mjs` (OK、true の出力の §9 とクッキーの文も目で確かめた)
  → `E2E_SKIP_BUILD=1 npx playwright test` (155 合格 / 1 skip)。ja-identity は直前のコミットの出力と比べて差分が company/privacy.html と company/cookie.html だけ。
  ログ: `D:/dm-scratch/backlog1113/logs/site-T-1921-*.log` (false / true の出力の抜き出しは `site-T-1921-false-output.txt`・`site-T-1921-true-output.txt`)。

## Web 版の流入元の扱いの確認 (文案 (6) の 5)
- サイトは Web 版への導線 (`data-dl="hero-webapp"` など) にも `a[data-dl]` の装飾で utm / ref / futm_source / fref / lp / dm を付けている (`src/main.js` の decorateLinks、`src/lib/attribution.js` の decorateDownloadUrl)。
- web 本体 checkout (6e0297c6) の `app/src`・`worker/src` を git grep した結果、**Web 版はこれらの値を読まず、記録もしていない**:
  `utm_source` 等は Web 版が自分の外向きのリンク (問い合わせ `app/src/lib/billing/contact.ts`、BFF の Desktop 版の DL `worker/src/routes/api/desktop-download.ts`) に
  付けるだけ。`location.search` を読むのはサインインのエラー表示 (`login-entry.ts`)・申し込みのプラン (`checkout-deeplink.ts`)・表示言語・開発用の設定だけで、
  `ref`・`lp`・`fref`・`futm_source`・`dm` を読む所は無い。エラー診断 (Sentry) は breadcrumb の URL からクエリを落としている (`app/src/lib/sentry.ts` stripQuery)。
- よってクッキーポリシーに Web 版の 1 文は**足していない**。
- 注意 (リーダー向け): web の Worker は `observability: { enabled: true }` (wrangler.jsonc) で、Worker が処理したリクエストは基盤のログに URL ごと残りうる。
  アプリが流入元として記録するものではないので文には入れていないが、気になるなら Web 版のページ配信が Worker を通るかを確かめる。

## アプリのコードで確かめた事実 (desktop a4a3e35b、web 6e0297c6、文案の (4) F1〜F12 を再確認)
- 配信 Worker の記録項目: referrer・utm_source/medium/campaign・国コード・User-Agent・版、**初回接触の `first_referrer`・`first_utm_source`・`landing_path`**
  (`desktop/worker-r2-proxy/src/download-tracking.ts` 202-206、326-328。クエリの `fref`・`futm_source`・`lp` から)。
- サイト配布版の初回起動の報告: `source` が `token` / `missing` (識別子が無くても送る) (`src-tauri/src/telemetry/install_source.rs` 102-104)。
  配信ストア版は `source = "store"` 固定でファイルを読まない (同 118・229)。
- 配信ストア版は `GET /install-origin` を問い合わせない = サインインのご案内はサイト配布版だけ (`src-tauri/src/commands/web_origin.rs` 33-34)。
- 配布の種類 `distribution` は Sentry のタグ (`src-tauri/src/telemetry/sentry.rs` 101-106) と実行ログの `spawn` 行 (`src-tauri/src/subprocess/runner_log.rs` 529-530) に、どちらの配布でも入る。
- サイトのローカルストレージ: 直近 (30 日) は utm_source/medium/campaign と参照元の origin、初回接触 `dm_attr_first` (180 日) は utm_source・参照元・着地ページのパス (`lp`、
  クエリと fragment は受け取らない) (`src/lib/attribution.js` serializeStored / firstTouchFromLanding / sanitizeLandingPath)。掲載ページ (`apps.microsoft.com`) へは載せない (UNDECORATED_HOSTS)。

## 注意点・既知の制約
- 配信ストアの製品ページが公開されたら `_data/site.yml` の `store_enabled` を true にするだけで、§9 の 9-2 / 9-4 とクッキーの 1 文が出る。
  **その日に privacy.html・cookie.html の最終更新日をその日に進める** (法務文書の文が変わるため)。文の変更なので版 (legal.yml) は据え置きでよい (再同意は不要の扱い。判断はリーダー)。
- `_data/disclosure.yml` の送信内容の一覧に「配布の種類」は無い (動作記録の一部とみなした、旧 notes と同じ)。

## ロールバック
このコミットを revert (未公開のブランチ上なので公開前は影響なし)。部品だけを消すと privacy / cookie のビルドが落ちるので、revert で戻す。
