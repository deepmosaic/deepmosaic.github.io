# T-2233 (サイトの分) サイトの CLAUDE.md の多言語化の節を仕上げる

spec: I18N-822 の「リーダーの改訂 2」(2) / (3) と「リーダーの改訂 (2026-11-14)」(3) の「サイト `CLAUDE.md`」の項。

## 起動の条件 (確かめた結果)
- 統合 desktop `backlog1113-integrate` に T-2233 (`b0a9e2bb`)、統合 web に T-2233 (`741f5745`) がある。
- `backlog1113-site`、追跡ファイルの変更 0 行、`--grep T-2231 --grep T-2232` が 2 行 (a229422・5001542)。
- 基点 `D:/dm-scratch/i18n/site-base/B1113/_site/index.html` がある。
- T-2302 のサイトの分は**まだ入っていない** (このコミットは T-2302 のサイトの分の**前**)。

## 変えたもの (`CLAUDE.md` だけ)
- `### ディレクトリ` の `en/` / `zh-tw/` の行: 「W7 で作る」→「各 10 ファイル (404 を含む)、公開済み」(`git ls-files en zh-tw` で 10 + 10)。
- `### i18n` の最初の段落: 「W7 で英中のページを作る」を「作って公開済み (ヘッダーの言語の切り替えと案内の帯から行ける)」に。ja を意図して変えるときは基点を作り直す旨、アプリの表示言語 (2.13 は ja だけ・2.14 から 3 言語、公開の手順の正は desktop `docs/release.md`)、画面の文の規則の正は desktop `docs/i18n.md`。
- `_data/l10n` の「1 ファイルを 1 チケットが持つ」の表: 表は残し、「i18n1112 の間だけの決まりで、もう終わった」と注記。
- `checks/lang-text.mjs` の「(W7 で作る)」を消し、本体 `site-lint.mjs` と `checks/store.mjs` を 1 文ずつ。
- 新しい項「用語集の写し」: desktop が正本、サイトで直接直さない、`glossary.source.json` の `desktop_commit` (40 桁)・`desktop_ref` (消えない名前、例 `backlog1113 (T-2232)`)・LF の sha256・note を直す、`i18n-site-lang.test.js` が照合。
- 新しい項「Store のボタンの切り替え」(T-2304): `_data/site.yml` の `distribution.store_enabled` (既定 false)。false は `check-site` (`checks/store.mjs`)、true は `check-store-toggle.mjs` で両方を確かめる。
- `#### ブラウザ E2E` に 2 行: `e2e/i18n-layout.spec.ts` (2 つの幅・はみ出し・日本語の残り)・`DM_I18N_SHOTS=1`・`e2e/i18n-allow.json` (`{ version, entries[] }`、reason 必須) と、ほかの英中の spec 3 本 (contact・nav・suggest)。
- ja-identity の基点の行 (`build-site-base.sh`、リーダーがウェーブの開始時に作る) はそのまま。`D:/dm-scratch` のパスは書いていない。

## 確かめた事実 (作業ツリーの実物)
- `package.json` の scripts: build・dev・test・e2e・e2e:install。
- `git ls-files e2e scripts`: i18n-layout / i18n-contact / i18n-nav / i18n-suggest の spec、i18n-allow.json、check-store-toggle.mjs、scripts/i18n/checks/ の 12 モジュール (store.mjs を含む)。
- `e2e/i18n-layout.spec.ts` 3〜4 行のコマンド、`src/lib/i18n-overflow.js` 93〜101 行 (allow の形と reason 必須)。
- `playwright.config.ts`: `E2E_BASE_URL` のときだけ testMatch で絞る → 通常は英中の spec も全件に入る。
- `_config.yml` の exclude に `CLAUDE.md`・`docs_draft` → `_site` に出ない (ビルド後に確かめた)。
- `_data/site.yml` 74 行 `store_enabled: false`。
- 統合 desktop `docs/i18n.md` 263・325〜326 行の書き方 (サイトの E2E・用語集の写し) に合わせた。

## ゲート (ログ: D:/dm-scratch/backlog1113/logs/w4c-site/t2233-g*.log)
- `npm test`: pass 1347 / fail 0 / skipped 3
- `npm run build && bundle exec jekyll build --strict_front_matter`: OK
- `node scripts/i18n/check-site.mjs _site`: OK (12 モジュール)
- `node scripts/check-docs.mjs`: OK
- `node scripts/check-store-toggle.mjs`: OK
- `E2E_SKIP_BUILD=1 npx playwright test`: 155 passed / 1 skipped
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/B1113/_site _site`: 終了コード 0 (17 files、差分 0)

## リーダーへ
- 親リポの `CLAUDE.md` への文案 (任意): 「画面の文を足す・直すときの規則は desktop の `docs/i18n.md`。公式サイトの英中は deepmosaic.github.io の `CLAUDE.md` の `### i18n`」。
- T-2302 のサイトの分へ: このコミットの「アプリの表示言語は 2.13 が日本語だけ、2.14 から 3 つ」の 1 文は T-2302 の後の事実と合う。T-2302 では直さなくてよい。
