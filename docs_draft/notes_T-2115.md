# T-2115 notes (signin1113、2026-11-13)

公式サイトの「ログイン」「ログアウト」を「サインイン」「サインアウト」に統一し、2.13 の新しいサインイン画面
(「サインイン」と「組織コードをお持ちの方（法人）」の 2 つ。押すと「法人サインイン」の面) の手順に合わせた。
正本は `D:/dm-scratch/signin1113/spec/T-2115.md` (リポの外)、語の対応は COMMON §2・リーダーの決定 1〜16。
作業場所は統合 worktree (`store1109-integrate`、基点 `9e3206e`)。

## 変更点の要約

- ja の docs 6 ファイル (`_includes/docs/01-intro`・`02-account`・`03-detect`・`06-ops`・`07-team`・`web`)、
  トップ (`index.html` の 1 文)、`/join/`、`/subscribe/`、データ 3 本 (`_data/subscribe.yml`・`_data/disclosure.yml`・`_data/docs_toc.yml`)、
  `llms.txt` (目次の「サインインとライセンス / Sign-in and license」)、`_data/lang/ja.json` (`login` / `signout` の値だけ。キーは同じ)。
  - 02-account の `#license`: 「サインインする」の手順 4 行、入口の表 3 行 → 2 行 (「サインイン」「組織コードをお持ちの方（法人）」)、
    未確認の案内文とボタンの入れ替わりの説明の段落 2 つを削除、T-2094 のコメントを signin1113 のコメントに置き換え。
  - 06-ops の `#trouble`「サインインとプラン」: パスワードの入口・入れ替わるボタンの説明を消し、
    「認証画面に移動しています…」のまま / 確認コードが届かない / 以前からパスワードでお使いの方 / 受け付けられない案内 (`guard_unavailable` の文) の形に。
  - パスワードの入口 (Shift の隠し入口・パスワードでのサインイン・再設定) はサイトのどこにも書いていない (COMMON §1 の 2)。
- 法務 3 ページ (privacy / cookie / asct): 語の言い換えだけ (意味は変えない)。最終更新日を 2026-11-13 に進めた。
  `_data/legal.yml` (version `2026-11-08`)・terms・eula・about は据え置き = 再同意なし (前例 T-1572 / T-1656 / T-1921 と同じ扱い)。
  改定の記録はページのコメントに書かず、ここに書いた:
  - privacy: 1 項 (取得する情報)・14-1 などの「ログイン」→「サインイン」、9 項「ブラウザで本サービスにサインインした状態で」、
    10 項「サインインした状態で / サインインしていない状態で」、同時利用の制限「サインインしている端末の識別子」。
  - cookie: 「サインインの状態の維持」「サインインの状態を維持するために欠かせないクッキー」「サインイン画面を提供する外部の認証サービス」。
  - asct: 役務の提供の時期「ダウンロード又はサインイン後、ただちに」。
- 英中のページのボタン名の引用 12 箇所 (`en/join`・`zh-tw/join` 各 4、`en/subscribe`・`zh-tw/subscribe` 各 1、`_data/l10n/{en,zh-tw}/subscribe.yml` 各 1)。
- `source_hash` 10 本を `scripts/i18n/accept-site.mjs` で書き直した。うち 4 本 (`en/index.html`・`zh-tw/index.html`・`_data/l10n/en/disclosure.yml`・
  `_data/l10n/zh-tw/disclosure.yml`) は訳を読んで (en `…by entering it when signing in` / `(while you are signed in, it is linked to your account)`、
  zh-TW `…在登入時輸入即可加入` / `（登入期間會與帳號連結）`) ja の意味が変わらないことを確かめ、訳は変えずに hash だけ書き直した。
- テスト: 新規 `src/lib/site-copy-signin1113.test.js`、書き直し `src/lib/site-copy-t2094.test.js` (3 段の入口 → 2 つの入口)、
  期待値を直したもの 15 ファイル (t2090・i18n-site-support (コメントだけ)・docs-team-org・docs-team-quote・docs-web-refresh・help1111・t1572・t1656・
  t1037・t1061・t1444・t1921・t1035・t1038・`e2e/join.spec.ts`)。t1038 の同日のテストは asct / cookie の 2 ページに狭めた (about は 2026-10-12 のまま)。
  Playwright (`e2e/join.spec.ts`) は回していない (ウェーブ末尾にリーダーが回す)。

## 英中のボタン名 (決定 4 の値) と辞書の照合

サイトは決定 4 の値で書いた: 主ボタン `Sign in` / `登入`、法人の入口 `Have an organization code? (business)` / `持有組織代碼者（企業）`、
法人の面の題名 `Organization sign-in` / `組織登入`、入力欄 `Organization code` / `組織代碼`。
コミット前の照合 (2026-11-13、`D:/deepmosaic-wt/integrate/login1111/desktop` の HEAD `5fde1870`): T-2112 は統合済みで、
`account_login.sign_in_label`・`account_login.org_title`・`account_login.org_code_label`・`team_members.enterprise_entry_label` の en / zh-TW は上の値と**一致**した。

## ja-diff-review.mjs の結果 (ja-identity の代わり)

`node D:/dm-scratch/signin1113/T-2115/ja-diff-review.mjs D:/dm-scratch/i18n/site-base/W7/_site _site D:/dm-scratch/signin1113/T-2115/ja-diff.txt`

変わったファイルは期待どおりの 10 本 (増えた / 消えた / 意図しないファイル / 直し漏れ は 0)。行数:

| ファイル | - | + |
|---|---|---|
| company/asct.html | 2 | 2 |
| company/cookie.html | 3 | 3 |
| company/privacy.html | 8 | 8 |
| docs/index.html | 73 | 68 |
| docs/web/index.html | 4 | 4 |
| index.html | 2 | 2 |
| join/index.html | 6 | 6 |
| llms-full.txt | 2 | 2 |
| llms.txt | 2 | 2 |
| subscribe/index.html | 9 | 9 |

- `-` と `+` の行を全部読んだ (語の単位で突き合わせ)。どれも文の一覧 A〜J の変更 (docs の目次の「サインインとライセンス」2 行・docs-h2 の題・
  /subscribe/ の FAQ は JSON-LD と本文の 2 か所に出る) で、崩れたタグ・一覧に無い文の削除は無かった。
- **道具の結果は NG (2 件)**: `llms.txt` の `- 最終更新 / Last updated: 2026-11-12` と `llms-full.txt` の `生成日 / Generated: 2026-11-12 — …` が
  `2026-11-13` に変わった行。どちらも `{{ site.time | date: '%Y-%m-%d' }}` (ビルドした日) の行で、このチケットの変更ではない
  (基点 W7 は 2026-11-12 にビルド、今回のビルドは 2026-11-13)。spec の「道具を緩めて通さない」に従い `REMOVED_OK` は直していない。
  ja-identity も `llms*.txt` をバイト単位で比べるので、日をまたいだビルドどうしでは同じく落ちる。
  リーダーへ: W7s を作るときの `cmp ja-diff.txt ja-diff-W7s.txt` も、W7s を 2026-11-13 以外にビルドすると、この日付の行だけで一致しなくなる。
- 最後に読んだ `ja-diff.txt` の sha256: `0cc666c38ce212a0563d7f9e346568d54475c44ae3c4912e4a117fe7cbdc5bae` (2026-11-13 のビルド)。

## ゲート (2026-11-13)

- gatesQuick: 17 ファイル 326 件すべて pass (直す前は 37 件 fail = 先に落ちることを確かめた)。
- gatesFull: `npm test` (1282 件、fail 0)・`npm run build`・`bundle exec jekyll build --strict_front_matter`・`check-docs.mjs` (OK)・
  `check-site.mjs _site` (OK) は通過。`ja-diff-review.mjs` は上の日付の 2 行で NG。
- 素通しファイル: `_site/llms.txt`・`llms-full.txt`・`robots.txt` の 1 行目に `<!doctype` は無い。
- 英中の旧い引用 0 件、変えてはいけないもの (`_data/legal.yml`・terms・eula・about・`scripts/i18n`・`i18n-site-lang.test.js`・en / zh-tw の lang・
  `CLAUDE.md`・`CHANGELOG.md`・`package*.json`・`playwright.config.ts`・`_config.yml`) は変わっていない。
- 改行: `git diff --stat` と `--ignore-cr-at-eol` は同じ (43 files, +267 -272)。

## 残した古い語の件数と理由

- 触ったファイルのコメント 14 件 (受け入れの内訳どおり): 02-account 1 (無料枠のコメント「未ログインの 30 分」)・06-ops 1 (「ログインとライセンス」と同じ文)・
  07-team 6 (冒頭の流れ・T-485 のコメント・スクリーンショットのメモ・T-2094 のリンクの流れのコメント 2 行)・web 1 (LoginGate の説明)・
  subscribe/index 1・`_data/subscribe.yml` 3 (Web 版の深いリンクの説明)・privacy 1 (T-1572 の HTML コメント)。
- サイトの `CLAUDE.md` (L133 の「他端末ログイン」ほか): 決定 9 で T-2238 が直す。
- `scripts/i18n/glossary.json` (sign_in の ja =「ログイン」): 用語集の写し。T-2238 が写し直す (サイトの検査は `forbidden` だけを使う)。
- 識別子: `_data/lang/*.json` のキー名 `login` / `signout`、`deepmosaic://login`、`?login=`。
- YAML のコメント: `_data/plans.yml` L94・`_data/site.yml` L46・L48。
- 履歴: `docs_draft/`・`CHANGELOG.md`、テストの冒頭の履歴のコメント (t2094 の T-2094 当時の段落を含む)・`pricing.test.js` L89 のコメント・
  `top-page-features.test.js` (`?login=` の説明)・`i18n-site-lang.test.js` L226 (仮名の検出の入力)。
- テストの中の旧い語は、廃止した語が出ないことを見る否定の表明と `REMOVED_LABELS` だけ。
- 画像 `assets/img/screenshots/profile-menu.webp` の中の「ログイン」「ログアウト」は残っている (範囲外。desktop の S2 の後に撮り直す)。

## その他

- サイトの `CLAUDE.md` の「ja.json は変えない」「ja のページの出力は 1 バイトも変えない」の signin1113 の例外で、ja.json の `login` / `signout` の値と
  ja の出力を変えた (ja.json の 2 つは テンプレートから参照されていないので出力は変わらない)。ja-identity の基点は W7 → W7s (リーダーが作る)。
- docs が引用するアプリの文 (「他の端末でサインイン済みです」「もう一度サインインしてください」「高精度モデルの利用にはサインインが必要です」
  「サインインで N時間に増量」「未サインイン」「最終サインイン」「いまはサインインを受け付けられません。…」) は S2 の T-2238 / T-2239 の spec の新しい文と同じ
  (spec どうしは 2026-11-13 に照合済み)。今の desktop の辞書はまだ旧い語 (例 `team_members.last_sign_in_label` の ja =「最終ログイン {date}」) で、S2 で揃う。
- 追加・変更したコマンド: なし (点検の道具 `ja-diff-review.mjs` はリポの外)。
- ロールバック: このコミットを revert し、ゲートの基点を W7 に戻す。

## レビュー (Role: Reviewer) の指摘と対応 (2026-11-13、Role: Fixer / Tester)

- 指摘は LOW 1 件だけ (CRITICAL / HIGH / MEDIUM は 0)。内容: gatesFull のうち `ja-diff-review` だけが `llms.txt` の「最終更新 / Last updated」と
  `llms-full.txt` の「生成日 / Generated」の 2 行 (`{{ site.time | date }}` = ビルドした日) で NG になる。レビューは、同じ日にビルドした変更なしの HEAD
  `9e3206e` を基点にすると `ja-diff-review: OK` で、期待した 10 ファイルだけが変わり、差分は日付の 2 行を除いて `ja-diff.txt` と同じことを確かめた。
- 対応: **コードと文は直さない** (実装の誤りではない。spec の「道具を緩めて通さない」に従い `REMOVED_OK` も変えない)。判断はリーダーへ:
  (a) 同じ日にビルドした W7 の写しを基点にして点検する、または (b) `llms*.txt` の日付の 2 行だけが違うことを確かめたうえで既知の NG として受け入れる。
- **リーダーへ (基点の作り直しの 2)**: `cmp ja-diff.txt ja-diff-W7s.txt` は、W7s を 2026-11-13 以外にビルドすると日付の 2 行 (と NG の行) だけで一致しなくなる。
  その場合は日付の行を除いて照合する (例: 両方から `Last updated:` / `Generated:` を含む行を除いて `diff`)。
- 再実行した gatesFull (2026-11-13): `npm test` 1282 件 (pass 1279・skip 3・fail 0)・build・jekyll build・check-docs OK・check-site OK。
  `ja-diff-review` は上の日付の 2 行で NG (2 件) のまま。`ja-diff.txt` の sha256 は `0cc666c38ce212a0563d7f9e346568d54475c44ae3c4912e4a117fe7cbdc5bae` で変わらない
  (Fix で ja の出力を変える手直しはしていない)。
- 残った古い語の grep: 12 行・14 箇所 (07-team L117 と `_data/subscribe.yml` L9 は 1 行に 2 箇所)、どれもコメントの行。英中の旧い引用 0 件。
  変えてはいけないファイルの差分なし。改行: `git diff --stat` と `--ignore-cr-at-eol` はどちらも 43 files, +267 -272。
- 基点 W7s は作っていない (spec の「基点の作り直し」と禁止事項で、`build-site-base.sh` の実行はリーダーの作業)。
- コミットの帰属の行は、このセッションのシステム指示が指定する 1 行 (タスクの指示どおり) を付けた。
