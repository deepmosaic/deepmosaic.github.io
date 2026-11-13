# T-2303 ダウンロードの既定をインストーラに戻す (3 言語)

backlog1113 W5。ブランチ `backlog1113-site` (起点 store1109-integrate = 4c3f6d8)。

## 変更点
- `_data/lang/{ja,en,zh-tw}.json` の `app_download_link` を公開中の値 `https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows` に戻した。
  `app_store_protocol_link`・`app_store_product_id` は T-2304 の Store のボタン用に残した。
- DL ボタン / リンクに `download` 属性を戻した (公開中の形): `_includes/download-button.html`・`header.html` (PC のボタンとドロワーの `"download":true`)・`footer.html`・`index.html` のヒーロー、英中の `header-intl.html`・`footer-intl.html`・`en/index.html`・`zh-tw/index.html`。
- 文を公開中の形に戻した: ja「無料でダウンロード」(md 幅は「ダウンロード」)、フッター「ダウンロード」。
  英中は ja の訳: en `Download for free` (md 幅は `Download`)、zh-TW `免費下載` (md 幅は `下載`)。フッターはドロワーと同じ `N.download` (`Download` / `下載`)。
- `_data/l10n/{en,zh-tw}/nav.yml`: `store_cta*` を `dl_cta`・`dl_cta_lead`・`dl_cta_lg`・`dl_cta_tail` に置き換え、`download_store` を削除。
  en は「Download」+「 for free」なので `dl_cta_tail` が空、zh-TW は「免費」+「下載」なので `dl_cta_lead` が空 (テストは lead / tail の空を許し、短い形 = lead + tail が空でないことを確かめる)。
- `_data/l10n/{en,zh-tw}/parts.yml` の `dl_label_default` を `Download for free` / `免費下載` に (料金カードの Free の `cta_label` と同じ語)。
- JSON-LD (`_includes/schema/software-application.html`) の `downloadUrl` は `L.app_download_link` なので、値が戻ってインストーラの URL になった (出力で確認)。
- `src/lib/attribution.js` の `UNDECORATED_HOSTS` (Store へのリンクに流入元を付けない) は残した。
- `en/index.html`・`zh-tw/index.html` の `source_hash` を `accept-site.mjs` で書き直した。

## テストの期待値の変更 (spec の許可の範囲)
- `src/lib/site-copy-t1917.test.js`: DL の単一管理点 = インストーラ (3 言語)・DL の <a> に download 属性・ドロワーの DL 項目は `download: true`・ヘッダー / フッター / ヒーロー / DL ボタン / nav / parts に Store の文と URL を出さない・JSON-LD の downloadUrl。docs (#install / #update / #uninstall / #data) の期待値は T-2305 が直すので今回は変えていない。
- `src/lib/i18n-site-nav.test.js`: data-links の download は ja と同じ、英中の DL の <a> は download 属性を持つ、nav.yml のキーを `dl_cta*` に。
- `src/lib/i18n-site-parts.test.js`・`i18n-site-top-en.test.js`・`i18n-site-top-zh.test.js`: 既定のラベルとヒーローの属性 (`download data-dl="hero"`)。
- `e2e/header-enterprise.spec.ts`・`e2e/mobile-nav.spec.ts`: `origin/master` の版に戻した (「無料でダウンロード」/「ダウンロード」、ドロワーの DL 項目は `download=""`)。
- `e2e/join.spec.ts`: `/join/` のリンク先がインストーラになったことに合わせた (文は T-2307、Store のボタンは T-2304)。

## 一時的にずれている所 (後続のチケットで直す)
- `/join/` の「Microsoft Store で Deepmosaic を入手」の文が、リンク先はインストーラ (T-2307 が文を直す)。
- docs `01-intro.html` の #install の「Microsoft Store（掲載ページ…）」の `app_download_link` がインストーラを指す (T-2305 が #install を公開中の文に戻す)。
  同じく `download-button.html` の note「Microsoft Store から無料で入手でき…」(T-2305)。

## `git grep -n -E "apps\.microsoft\.com|Microsoft Store|9PDKMKWHN9RW"` の残り (このコミットの後)
- `app_store_*` のキー: `_data/lang/{ja,en,zh-tw}.json` (各 2 行)。T-2304 が使う。
- T-2304 / T-2305 (docs): `_includes/docs/01-intro.html`・`02-account.html`・`06-ops.html`・`07-team.html`。
- T-2306 (申し込み・料金): `subscribe/index.html`・`_data/subscribe.yml`・`index.html` (料金の節の sub)・`price/index.html`・`llms.txt`・`_data/l10n/{en,zh-tw}/subscribe.yml`・`en|zh-tw/subscribe/index.html`・`en|zh-tw/price/index.html`・`en|zh-tw/index.html` (料金の節の sub)。
- T-2307 (/join/): `join/index.html`・`en/join/index.html`・`zh-tw/join/index.html`。
- `src/lib/attribution.js` (UNDECORATED_HOSTS) と `attribution.test.js`。
- CI の検査: `.github/workflows/jekyll.yml:157-158` (DL リンクにクエリが焼き込まれていないこと。worker と Store の両方を見る形なので変更不要)、`scripts/i18n/checks/pages-top-{en,zh}.mjs` (同じ検査)。
- 用語集 `scripts/i18n/glossary.json` の dnt (訳さない語) の `Microsoft Store`。変えない。
- テスト: `site-copy-t1917` (docs の節の期待値 = T-2305 と、Store を出さない検査の正規表現)・`site-copy-t1922` (T-2306)・`site-copy-t2090` (T-2307)・`site-copy-t924`・`site-copy-help1111` (T-2305)・`i18n-site-parts` (Store を出さない検査)・`i18n-site-product`・`i18n-site-support`・`i18n-site-top-{en,zh}` (check モジュールの模型の HTML の URL)。
- 過去のチケットの notes (`docs_draft/notes_T-1917.md` ほか)。
- 法務文書 (`company/privacy.html`・`company/cookie.html`・`_data/legal.yml`) はこの検索に掛からない (触っていない)。

## ゲート
- `npm test`: 1314 件 (pass 1310 / skipped 4 / fail 0)
- `npm run build && bundle exec jekyll build --strict_front_matter`: 成功
- `node scripts/i18n/check-site.mjs _site`: OK (11 モジュール)
- `node scripts/check-docs.mjs`: OK
- `E2E_SKIP_BUILD=1 npx playwright test`: 150 passed / 1 skipped
- `ja-identity` (基点 `D:/dm-scratch/i18n/site-base/W7t/_site`): ja の全 17 ページが差分ありになるが、中身はヘッダー・フッター (全ページ共通) の DL リンク・文・コメント、JSON-LD の downloadUrl、ヒーロー / DL ボタン / 料金カードの DL の href と download 属性、/join/ のリンク先だけ (数ファイルで diff を目視)。基点の作り直しはリーダー。

## 巻き戻し
- このコミットを revert すれば Store だけの形に戻る。`app_download_link` の 3 行を戻すだけでは文 (「無料でダウンロード」) と `download` 属性が残るので、revert で戻す。

## リーダーへの申し送り
- 公開前に、ヘッダー・フッター・ヒーローの DL を押してインストーラが落ちてくること (worker の DL 口が 2.13 の NSIS を返すこと) を確かめる。
