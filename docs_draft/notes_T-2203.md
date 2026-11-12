# T-2203 (i18n1112 I18N-705) サイトの head の多言語化 — 作業メモ

## 変更点
- `_data/i18n_pages.yml` (新規): 訳の台帳。鍵は ja のパス 9 本 (`/`・`/price/`・`/spec/`・`/subscribe/`・`/join/`・`/contact/`・`/enterprise/inquiry/`・`/mosaic-removal/`・`/company/about`)、値は全部 `[en, zh-tw]`。
- `_layouts/default.html`:
  - `<html lang>` を `site.data.lang[page.lang].my_lang` に。
  - `page_desc` の assign の行に `L = site.data.lang[page.lang]`・`i18n_ja_url` (`page.ja_url | default: page.url | replace: 'index.html', ''`)・`i18n_listed` (台帳の値) を足した (`{%- … -%}` の並びなので空白は増えない)。
  - 既定のタイトル: `L.seo_brand_suffix` があれば (英中) `{{ page.title }} | {{ L.seo_brand_suffix }}`、無ければ (ja) 今の `{{ page.title }}｜{{ site.data.site.seo.brand_suffix }}`。
  - canonical の後に、台帳のページだけ hreflang 4 行 (ja・en・zh-Hant-TW・x-default = en)。1 行 1 本、台帳に無いページでは空白も出ない。
  - `og:locale` を `L.og_lang` に。台帳のページだけ他の 2 言語の `og:locale:alternate` を 1 行ずつ。
  - `og:image:alt` / `twitter:image:alt` を `L.og_image_alt | default: site.data.site.seo.og_image_alt`。
  - 既存のコメント (TICKET-SITE-31 の「hreflang を削除した」を含む)・gtag・no_tracking の分岐・LINE・Cloudflare・`?v=` は変えていない。
- `_includes/schema/software-application.html`: `inLanguage` = `L.json_ld_lang | default: "ja"`、`description` = `L.meta_desc`、`downloadUrl` = `L.app_download_link`。英中 (`site.data.l10n[page.lang].entity` がある) だけ `softwareRequirements`・`disambiguatingDescription` (訳 1 つ)・`featureList` (`can`)・`keywords` を l10n の entity に差し替え。ja は同じ値 (`E.software_requirements`・ja+en の連結・`E.can | map: "ja"`・`E.keywords`) を変数経由で出す (出力はバイト一致)。
- `_includes/schema/breadcrumb.html`: 1 つ目の `name` / `item` を `{% if page.lang == 'ja' %}今の文字列{% else %}L.breadcrumb_home / 言語のトップ{% endif %}`。
- `_includes/schema/faq.html`: 既存の 2 行と `for item in faq_src` は残し、その後に英中だけ `faq_src` を `site.data.l10n[page.lang].faq.items` (faq_data があれば `site.data.l10n[page.lang][page.faq_data].faq`) に差し替える行を足した。
- `scripts/i18n/checks/head.mjs` (新規): check-site のモジュール (下の「検査」)。`parseLedger` を export。
- `src/lib/i18n-site-head.test.js` (新規): 仕様テスト 29 本 (台帳・ja のページの実在・layout / schema のソース・head.mjs の単体の陽性 / 陰性対照)。
- `organization.html`・ページ・header / footer・`_data/lang/*`・`_data/l10n/*` は触っていない。

## 検査 (`scripts/i18n/checks/head.mjs`)
- 対象は canonical を持つ HTML (= layout を通ったページ。実際の `_site` の 17 本は全部持つ)。canonical の無い **ja** の HTML は見ない。
  理由: 既存の `i18n-site-tools.test.js` の ja-lang のテストが、本物の checks/ ディレクトリで canonical の無い模型の `_site` を check-site にかけて exit 0 を期待しているため (期待値は変えられない)。
  このため英中のページに layout を通らない HTML (layout: null・front matter の書き忘れ) が置かれると head の検査を素通りする。
  **英中のページが canonical を持つことは I18N-712 の `checks/complete.mjs` で見ること** (レビュー指摘。head.mjs で英中の canonical 無しをエラーにすると、
  既存の ja-lang のテスト (canonical の無い `en/index.html`・`zh-tw/index.html` の模型で exit 0 を期待) が落ちることを全ゲートで確かめたので、ここでは入れない)。
- canonical の自己参照、台帳のページの hreflang 4 本と href、台帳に無いページの hreflang / og:locale:alternate 0 本、`<html lang>`・`og:locale`、
  SoftwareApplication の `inLanguage` と英中の `description`・`featureList`・`disambiguatingDescription` の lintText、パンくずの 1 つ目、英中の FAQPage の Question の数と `<details` の数。
- JSON-LD の英中の文の lintText は、`disambiguatingDescription` だけ `allowRemoval: true` (誤認の訂正の否定文なので)。`description` (= meta_desc) と `featureList` (= can) は既定 (除去の語も禁止) で検査する
  (I18N-704 の entity.yml の「can は除去の語を使わない」と W7-site.md §2 に合わせる。今のデータは既定でも違反 0 件。レビュー指摘で変更)。

## ゲートの結果
- `node --test src/lib/i18n-site-head.test.js`: 28 pass / 1 skip (隣に desktop の `src/lib/i18n/site-url.ts` が無いので照合は skip)。
- `npm test`: 863 件中 860 pass / 0 fail / 3 skip。
- `npm run build && bundle exec jekyll build --strict_front_matter`: OK。`node scripts/check-docs.mjs`: OK。
- `ja-identity` (基点 `D:/dm-scratch/i18n/site-base/W7/_site`): OK (17 files)。`check-site`: OK (3 モジュール)。
- `git diff --stat` と `--ignore-cr-at-eol` の行数は一致。

## ja のページの出力の差分 (ja-identity が消す分だけ)
- 台帳の ja のページ 9 本 × (hreflang 4 行 + og:locale:alternate 2 行) = 54 行が増える。それ以外は 1 バイトも変わらない
  (生の diff で確かめた: `/subscribe/` は 9 行目の後に hreflang 4 行、og:locale の後に alternate 2 行だけ。`/docs/`・`/404.html`・法務は差分 0)。

## 台帳とアプリの SITE_TRANSLATED_PATHS の差
- アプリ (desktop `i18n1112-integrate` の `src/lib/i18n/site-url.ts`) の 8 本 = 台帳 − `/company/about`。`git show i18n1112-integrate:src/lib/i18n/site-url.ts` で目で照合済み (一致)。
- アプリに `/company/about` を足すかはリーダーの判断 (アプリは会社概要へ直接リンクしていない見込み)。
- 統合 worktree の隣 (`D:/deepmosaic-wt/integrate/store1109/desktop`) には i18n がまだ無いのでテストの照合は skip。W8 の統合で desktop が隣に来れば効く。

## 描画の確かめ (probe、コミットしていない・消した)
- W7-site.md §5 の `en/_probe.html` は **Jekyll が `_` で始まるファイルを読まない**ので出力されなかった (spec の手順の誤り。後のチケット向けにリーダーへ)。`en/probe.html` / `zh-tw/probe.html` で確かめた。
- permalink は台帳の鍵と合うよう `/en/`・`/zh-tw/` (ja_url `/`、schemas software-application・faq・breadcrumb、本文に FAQ の件数ぶんの `<details>`) と、
  `seo_title` 無し + `faq_data: subscribe` の `/en/subscribe/` (ja_url `/subscribe/`)。
- 結果: `<html lang="en">` / `zh-Hant-TW`、hreflang 4 本 (x-default = /en/…)、og:locale `en_US` + alternate `ja_JP`・`zh_TW` (zh-tw は `zh_TW` + `ja_JP`・`en_US`)、
  og:image:alt が英中の訳、JSON-LD の inLanguage・description・softwareRequirements・disambiguatingDescription (訳 1 つ)・featureList・keywords が英中、
  パンくずの 1 つ目が `Home` / `首頁` と `/en/`・`/zh-tw/`、FAQPage の Question が l10n の訳 (プレースホルダは faq-answer.html で展開済み)、
  seo_title 無しのタイトルは `Probe page | Deepmosaic - AI software that applies mosaic to videos`。check-site OK。probe は削除済み (`git status` に無い)。

## 置いた仮定・食い違い
- 既定のタイトルの分岐は `page.lang == 'ja'` ではなく `L.seo_brand_suffix` の有無で決めた (ja.json に無いキー。結果は同じで、page.lang が想定外の値でも ja の出力になる)。
- software-application の ja の分岐は「今の式のまま」ではなく、同じ式を変数 (`sw_requirements` など) に入れて出す形にした (出力はバイト一致、ja-identity OK)。
- JSON-LD の `alternateName` (`ディープモザイク` を含む)・`name`・`operatingSystem` などは訳さない値なので英中でも ja のデータのまま (英中の lintText の対象外の欄)。
- `/join/` は noindex だが、spec どおり台帳に入れて hreflang を出す (I18N-713 の案内が alternate を読む)。

## ウェーブ末尾で確かめてほしいこと
- 英中のページ (I18N-709〜712) ができた後の `check-site` の head モジュール (台帳の 9 本 × 3 版の hreflang・og・JSON-LD・英中の FAQPage の件数)。
- Playwright は回していない。
- **公開の順番**: このコミットから台帳の ja のページ 9 本の hreflang と og:locale:alternate が `/en/…`・`/zh-tw/…` を指すが、英中のページはまだ無い (今の `_site` では指す先が 404)。
  I18N-712 の `checks/complete.mjs` (台帳の全版の存在) が通るまで master へ出さないこと。

## ロールバック
- このチケットのコミットを revert すると、台帳を読む I18N-713 (言語の案内) と I18N-712 の `checks/complete.mjs` (台帳の全版の存在) が台帳を失う。

## レビューの指摘への対応 (Fixer)
- HIGH: layout の no_tracking の照合の `
` を `?
` に (CRLF で checkout した layout でも通る。CRLF に変えた写しで照合が true になることを確認)。
- LOW: `allowRemoval` を disambiguatingDescription だけに (上の「検査」)。
- LOW: 陰性対照を追加 — hreflang が 5 本 (余分な `fr`) で「4 本でない」が出る (この検査を無効にした写しでテストが落ちることを確認)、ソースに無い `/no-such-page/` が jaPageUrls に入らない。
- LOW: 英中の canonical 無しのエラー化は、既存の ja-lang のテストの期待値 (exit 0) と衝突するので入れず、I18N-712 の complete.mjs に任せる (上の「検査」に記載)。
- LOW: 公開の順番を「ウェーブ末尾で確かめてほしいこと」に追記。
