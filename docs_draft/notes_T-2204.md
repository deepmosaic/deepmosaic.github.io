# T-2204 (i18n1112 I18N-706) サイトのヘッダー・フッター・言語の切り替え・対象外のリンクの印 — 作業メモ

## 変更点
- `_includes/header.html` / `_includes/footer.html`: 足したのは分岐と include の行だけ (既存の行は不変)。
  - 先頭: `{%- if page.lang == 'en' or page.lang == 'zh-tw' -%}{% include header-intl.html %}{%- else -%}` (footer も同じ形)、末尾: `</header>{% endif %}` / `</footer>{% endif %}`。
    spec は `page.lang != 'ja'` だが、`page.lang` が nil のとき (defaults の外の HTML) に英中の写しへ行かないよう、英中を明示する形にした (仮定 1)。
  - header: ダウンロードの CTA の `<a>` の直前に `{% include lang-switch.html variant="header" %}`、モバイルの `<div class="md:hidden">` の `</noscript>` の後に `variant="drawer-data"`。
  - footer: コピーライトの行の直前 (`<div class="border-t …">` の中) に `variant="footer"`。
- `_includes/header-intl.html` / `_includes/footer-intl.html` (新規): ja の分岐の写し。文は `_data/l10n/<lang>/nav.yml` (N) と `_data/lang/<lang>.json` (L)。
  訳のあるページは `{{ L.url_prefix }}` 付き。docs と法務 5 本は ja の URL のまま、フッターは `ja-link.html` で印、ヘッダーのナビの docs はラベル + 小さな印 (`<span>`)。
  `data-dl` (`header`・`mobile`・`footer`)・data-links の項目の数と行き先・`/company/` 6 本の順は ja と同じ。data-links の docs の項目に `"badge": L.ja_only_badge` を足した (MobileNav が小さな印で描く)。
- `_includes/lang-switch.html` (新規): `variant` = `header` / `footer` / `drawer-data`。行き先は台帳 (`_data/i18n_pages.yml`) にあれば対応する 3 版、無ければ各言語のトップ。
  一番外の要素に `data-i18n-switch`、各 `<a>` に `lang` と `hreflang` (`ja` / `en` / `zh-Hant-TW`)、今の言語に `aria-current="true"`。ja の見出し (aria-label) は「表示言語」、英中は `L.lang_switch_label`。変数は `ls_` で始める。
- `_includes/ja-link.html` (新規): `href`・`label`・`class`。`hreflang="ja"`、英中のときだけ後ろに `<span title="…ja_only_title">…ja_only_badge</span>`。
  変数は `jl_L` (include は呼び出し側と変数を共有するので、呼び出し側の `L` を上書きしない。I18N-709〜711 のページが別の意味で `L` を使っても壊れない)。
- `src/lib/site-lang.js` (新規): `pageLang(doc)` (`<html lang>` → `'ja'|'en'|'zh-tw'`、取れなければ ja) と `pick(byLang, lang)`。
  引数名は `byLang` (レビューの指摘: `table` は Tailwind のクラス名と同じ語で、共通の app.css に `.table{display:table}` を生む恐れ)。テストの変数名も `byLang` / `textSrc` にした。
  **ただし `.table{display:table}` は本チケットの前から出ている**: 本チケットを含まない HEAD (1248d57) を一時 worktree でビルドしても出る。出どころは T-2200 の `scripts/i18n/site-lint.mjs` の `'table', 'ul',` (Tailwind の自動検出がプロジェクト全体を走査する)。そこを外すと消えることを一時 worktree で確かめた。他チケットのファイルなので直していない → **リーダーへ**: `app.css` の先頭を `@import "tailwindcss" source(none);` にするか、`@source not "../scripts";` を足すかを W8 で判断してほしい (ja のページの class に `table` は 0 件なので見た目は変わらない)。
- `src/islands/MobileNav.svelte`: aria-label の 2 文を 3 言語の表 `TEXT` から (ja は今の文字列のまま)。`script[data-lang-links]` があればドロワーの最後に言語のリンクの段
  (区切り線 + 見出し + 3 つのリンク、今の言語に `aria-current`、`data-i18n-switch` の中に `a[hreflang]`) を足す。**既存の項目 (`aside ul li a`) とは別の段** にした
  (`mobile-nav.spec.ts` が `aside ul li a` を全部 tap して回るので、そこに混ぜない)。行き先は `/` で始まるサイト内のパスだけ受け取る。data-links の `badge` があれば小さく出す (ja の項目には無い)。
  既存の data-links の処理・DL の項目・`download` の規則・`data-dl-first` は不変。
- `src/app.css`: `@source "../en/**/*.html";`・`@source "../zh-tw/**/*.html";` と、`@theme` の直後に `:root:lang(zh) { --font-sans: "Roboto", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", … }`。ja の CSS は不変。
  英中のヘッダーの幅の直しは CSS ではなく英中だけの写しのクラス (`xl:gap-5`) で入れた (下の「幅」)。`:root:not(:lang(ja))` の規則は足していない。
- `_data/l10n/en/nav.yml`・`_data/l10n/zh-tw/nav.yml` (新規): 19 キー (平らな `key: "value"`)。
- `scripts/i18n/checks/nav.mjs` (新規): check-site のモジュール (下の「検査」)。ルートの 404.html の振り分けの印 (`<div hidden data-i18n-switch data-lang-404>`、I18N-712) は切り替えとして数えない (レビューの指摘)。`head.mjs` の `parseLedger` を import (head.mjs は触っていない)。
- `src/lib/i18n-site-nav.test.js` (新規): 仕様テスト 27 本。`e2e/i18n-nav.spec.ts` (新規、このチケットでは回していない)。

## なぜ header / footer を写しにしたか (W7-site.md §0-B)
header / footer はソースを照合する既存テストが多い (`site-copy-t1917` の data-links と DL の `<a>`、`t2090` の `/join/` が無いこと、`t1033` / `t1038` の `/company/` 6 本の順と `data-dl=` の数、`t1922` の `/subscribe/`)。
行内の分岐で英中の行き先を足すとこれらの期待値の書き換えが要るので、英中は写しを include する。
**今後 header.html / footer.html を直すときは写し (header-intl.html / footer-intl.html) も直すこと** (`i18n-site-nav.test.js` が data-dl・行き先の集合・data-links・`/company/` の順の一致で捕まえる)。
→ サイトの CLAUDE.md への追記の要望 (W8 でリーダーがまとめる): 「header / footer を直したら `_includes/*-intl.html` も直す。文は `_data/l10n/<lang>/nav.yml`」。

## 訳 (nav.yml)
| キー | ja | en | zh-tw |
|---|---|---|---|
| home | ホーム | Home | 首頁 |
| pricing | 料金 | Pricing | 價格 |
| docs | ドキュメント | Docs | 說明文件 |
| spec / spec_full | 動作環境 | Requirements / System requirements | 系統需求 |
| store_cta (lead + lg + tail) | Microsoft Store で入手 (md: Store で入手) | Microsoft Store (md: Store) | 在 Microsoft Store 取得 (md: 在 Store 取得) |
| enterprise (short + lg) | 法人様はこちら (md: 法人様) | Business inquiries (md: Business) | 企業方案 (md: 企業) |
| download | ダウンロード | Download | 下載 |
| contact | 問い合わせ | Contact us | 聯絡我們 |
| footer_product / footer_company | 製品 / 会社情報 | Product / Company | 產品 / 公司資訊 |
| subscribe | 有料プランのお申し込み | Subscribe to a paid plan | 申請付費方案 |
| mosaic_removal | モザイク除去について | About existing mosaic | 關於既有馬賽克 |
| download_store | ダウンロード（Microsoft Store） | Download (Microsoft Store) | 下載（Microsoft Store） |
- MobileNav: メニューを開く / 閉じる = `Open menu` / `Close menu`、`開啟選單` / `關閉選單` (用語集の メニュー = menu / 選單)。見出し 表示言語 = `Language` / `語言` (= `L.lang_switch_label`)。
- フッターの料金・会社について・お問い合わせ・法務 5 本・ドキュメントは `_data/lang/<lang>.json` の既存のキー (`price`・`company`・`contact`・`terms` … `document`) を使った。

## 置いた仮定・spec との食い違い
1. 分岐の条件は `page.lang == 'en' or page.lang == 'zh-tw'` (spec の `page.lang != 'ja'` と ja の出力は同じ。nil を ja 側に倒す安全側)。
2. **en のナビの docs は `Docs`** (spec の例どおり)。用語集の ドキュメント = `documentation` (required) と違う。幅 (md の 768px) に収めるための短い形で、フッターは `L.document` = `Documentation`。
   → 用語集の追加の候補: 「ドキュメント (ナビの短い形) = Docs」。
3. **en の DL ボタンは `Microsoft Store` (md は `Store`)**。spec の例 `Get it on Microsoft Store` は lg (942px の行) で概算 960px になりはみ出すため短くした。textContent (GA4 の link_text) は全幅で `Microsoft Store`。
4. en の法人向けは `Business inquiries` (md は `Business`)。spec の例 `For businesses` / `Business` は「短い形 + lg で足す」の組み立て (ja と同じ textContent の規則) にできないため。zh-tw は spec の例どおり `企業方案` / `企業`。
5. ヘッダーの docs の印 `(Japanese)` / `（日文）` は **xl (1280px) 以上だけ** 見せる (md / lg は幅が足りない)。どの幅でもリンクに `title="L.ja_only_title"` と `hreflang="ja"`。ドロワー・noscript・フッターは常に印を出す。
6. **フッターの「モザイク除去について」は en `About existing mosaic` / zh-tw `關於既有馬賽克`** (レビューの指摘で変更。決定)。footer-intl は英中の全ページに出るので、除去の系統の語 (`mosaic removal`・`去除馬賽克`) は W7-site.md §2・COMMON の用語の規則 (除去の語は `/…/mosaic-removal/` と `data-i18n-allow="mosaic_removal"` の否定の注記の中だけ) に反する。site-lint の `lintValue` は `About mosaic removal` / `關於去除馬賽克` を素通しする (禁止の連語に当たらない) ためゲートでは捕まらない。`data-i18n-allow` を付けて残す案は、否定の注記専用の印なので採らなかった。行き先 (誤認の訂正のページ) の趣旨 = 既にあるモザイクの扱い、を表す語にした。W8 の対訳表のレビューの対象。
7. spec の probe のファイル名 `en/_probe.html` は Jekyll が `_` 始まりを無視して出力しないので、`en/probe.html` (permalink `/en/_probe/`) で確かめ、消した (コミットに入れていない)。
8. 英中の 404 (`/en/404.html`) は台帳に無いので、切り替えの行き先は各言語のトップ (I18N-712 が作るときもこのままでよい)。

## 幅 (英中のヘッダー)
- Playwright を回せないので概算 (Roboto 14px・CJK 14px)。md 768px (行 706px): ja 約 686px / en 約 640px / zh-tw 約 690px。lg 1024px (行 942px): ja 約 922px / en 約 900px / zh-tw 約 890px。
  xl 1280px (行 1120px、切り替え + docs の印が増える): ja 約 1100px、en 約 1130px → 英中の写しだけ行の gap を `xl:gap-5` (20px) に詰めて約 1090px。
- ja のヘッダーは xl で切り替え (約 160px) が増えるだけ。gap は変えていない (切り替えは `xl:-ml-4`)。**xl での ja の余白は約 20px と見積もり**なので、ウェーブ末尾の e2e で必ず確かめてほしい。

## 検査 (`scripts/i18n/checks/nav.mjs`)
- `<header>` と canonical を持つページが対象。言語はディレクトリで決める。
- 全ページ: `data-i18n-switch` がちょうど 3 か所 (ヘッダーの要素・`script[data-lang-links]`・フッターの要素)。`data-lang-404` を持つ要素 (404 の振り分けの印) は数えない。単体テストの「正しい模型」に印付きの 404.html を入れてある。行き先 = canonical のパスから接頭辞を除いた鍵が台帳にあれば 3 版、無ければ各言語のトップ。
  lang / hreflang の並び、aria-current (JSON は `current`) が今の言語だけ。
- 英中のページ: ヘッダー・フッターの見える文 (切り替えの中を除く) と data-links に仮名が無い。docs・法務 5 本へのリンクは接頭辞なし・`hreflang="ja"`・リンクの中かすぐ後ろの `<span>` に印。
- 今の `_site` (ja 17 本) で 0 件。単体テストは模型の `_site` で陽性・陰性対照。

## app.css の ja 不変の機械の確認 (レビューの指摘で強化)
- 旧: セレクタに `:lang(` を含む規則だけを調べていたので、ja に効く普通の規則を足しても捕まらなかった。
- 新: `jaCssBody(css)` = 英中の `@source` 2 行と `:lang(` を含む規則 (入れ子ごと) を除き、コメントを消して空白を詰めた本文。その sha256 が基点 (10678af) の app.css と同じ
  (`BASE_JA_CSS_SHA256 = 3c3b15ab…`) ことを確かめる。陽性対照 (`:root:not(:lang(ja))` の規則・入れ子を足しても同じ)、陰性対照 (`.btn-primary { color: red; }`・`body { font-size: 30px; }`・既存の値の変更で落ちる) を同じテストの中に置いた。
- 注意: `@source` の文字列の glob は `/*` `*/` を含むので、コメントを消す前に除く。
- **i18n1112 の後に ja の見た目を意図して変えるときは、この定数を新しい app.css から取り直す** (サイトの CLAUDE.md への追記の候補)。

## 追加したテスト・コマンド
- `node --test src/lib/i18n-site-nav.test.js` (27 本)。`npm test` の glob に入る。
- `node scripts/i18n/check-site.mjs _site` に `nav` が加わった。

## レビューの指摘への対応 (Fixer)
- HIGH (nav.mjs が 404 の印で 4 個になる): 直した (上の「検査」)。
- MEDIUM (app.css のテストが陰性対照として働かない): 直した (上の「app.css の ja 不変の機械の確認」)。
- MEDIUM (フッターの mosaic_removal の訳が除去の語): 直した (仮定 6)。
- LOW (en の DL ボタン・法人向けの訳が spec の例と違う): 今の訳のまま。根拠は Playwright を回していない概算 (仮定 3・4) なので、ウェーブ末尾の e2e で `/en/` の lg 幅に `Get it on Microsoft Store` が収まるかを見て、収まるなら spec の例に戻すことを W8 で検討してほしい。用語集の追加の候補として W8 の対訳表のレビューの対象。
- LOW (ja の xl の余白): 未確認のまま (Playwright を起動しない規則)。はみ出したら lang-switch の header の variant を 2xl (1536px) 以上に上げる。下の E2E の項に記載。
- LOW (`.table` の CSS が増えた): site-lang.js の引数名は直した。ただし `.table` の出どころは T-2200 の `scripts/i18n/site-lint.mjs` で本チケットではない (上の site-lang.js の項)。リーダーへの連絡事項。
- LOW (ja-link.html の `L` の上書き): 直した (`jl_L`)。

## ゲートの結果 (コミット前、Fixer / Tester の再実行)
- `npm test`: 891 件 / pass 888 / fail 0 (skip 3 は既存)。`npm run build`・`bundle exec jekyll build --strict_front_matter`・`node scripts/check-docs.mjs`: OK。
- `ja-identity`: OK (17 files)。`check-site`: OK (4 モジュール)。

## ゲートの結果 (コミット前、Implementer)
- `npm test`: 890 件 / pass 887 / fail 0 (skip 3 は既存)。`npm run build`・`bundle exec jekyll build --strict_front_matter`: OK。`node scripts/check-docs.mjs`: OK。
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site`: OK (17 files。ja の差分は `data-i18n-switch` の要素だけ)。
- `node scripts/i18n/check-site.mjs _site`: OK (4 モジュール)。
- probe (en / zh-tw、`ja_url: /price/`) で英中のヘッダー・フッター・ドロワーの JSON・lang-text の検査を目で確かめた (lang-text は 0 件)。

## ウェーブ末尾の E2E で確かめてほしいこと
- `npx playwright test e2e/i18n-nav.spec.ts e2e/header-enterprise.spec.ts e2e/mobile-nav.spec.ts`
  - ja の `/` の幅 1280px で切り替えが見え、法人様が一番右・はみ出しなし (余白の見積もりが約 20px と小さい)。768 / 900 / 1024 では見えない。
  - `/en/`・`/zh-tw/` (W7b の後) で幅 320〜1280 のはみ出しなし・法人向けが一番右。英中のページが無い間は (b) と (d) の一部が skip になる。
  - モバイルのドロワーの言語の段 (3 リンク・aria-current・download なし)。`mobile-nav.spec.ts` の既存の項目の数が変わっていないこと。
- 目で: 繁体字のページの書体 (Noto Sans TC / Microsoft JhengHei) が効いているか。

## ロールバックの観点
- revert すると、I18N-707〜712 の英中のページのヘッダー・フッターが日本語の部品になり、I18N-713 (言語の案内) が頼る `[data-i18n-switch] a[hreflang]` が消える。
- `checks/nav.mjs` は `checks/head.mjs` の `parseLedger` に依存する (I18N-705 を revert すると落ちる)。
