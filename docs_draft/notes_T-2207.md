# T-2207 (i18n1112 I18N-709) サイトのトップページ (en) — `en/index.html`

2026-11-12、役割: Implementer (テストを先に書いて RED を確認 → 実装 → 開発中のゲート → 全ゲートの各段を手元で確認) → Fixer / Tester (レビューの指摘の修正・全ゲート・コミット。下の「レビューの指摘への対応」)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `en/index.html` (新規。index には LF で入る。`git ls-files --eol` で確認、下) | `index.html` の写しを英訳。front matter: `layout: default`・`lang: en`・`permalink: /en/`・`ja_url: /`・`source: index.html`・`source_hash` (accept-site.mjs で書いた)・`title`・`seo_title`・`description`・`schemas: [software-application, faq]` (ja と同じ) |
| `scripts/i18n/checks/pages-top-en.mjs` (新規) | check-site のモジュール (下) |
| `src/lib/i18n-site-top-en.test.js` (新規) | 仕様テスト 29 本 (下) |
| `docs_draft/notes_T-2207.md` (新規) | この notes |

- ja の `index.html`・include・データ・`_data/lang/*`・l10n は触っていない。
- 構造は ja と同じ (`compareStructure(index.html, en/index.html)` が空。id・`data-dl` (`hero`・`hero-webapp`)・`data-island` (`roi`・`tabs`)・`<img src>`・include の並び・`data-*` の名前)。
- 文のデータは l10n から: `site.data.l10n.en.mosaic.{scopes,controls,priority_note,note}`・`disclosure.{offline_steps,responsibility,weaknesses,accuracy_note}`・`entity.not_removal_note`・`plans.tax_note`・`faq.items`。
  数値・URL・設定 (`site.data.site.web_app.*`・`site.data.site.roi.*`・`site.data.plans.tiers`・`S.stats` の accent) は ja のデータのまま。
- hero (kicker・headline・sub) と stats の値・ラベルはページに英語を直接書いた (spec どおり l10n を作らない)。stats は ja と同じ `for s in S.stats` のまま、値とラベルを `split` した配列から `forloop.index0` で引く (accent は ja のデータ)。
- サイト内リンク: `/en/spec/`・`/en/price/` (2 か所)・`/en/enterprise/inquiry/`・`cta-download.html secondary_href="/en/price/"`。docs (`/docs`・`/docs/#detect-options`・`/docs/#detect-mosaic`・`/docs/#team`) は `ja-link.html`。
- DL: `href="{{ site.data.lang[page.lang].app_download_link }}" data-dl="hero"`、Web 版は ja と同じ `site.data.site.web_app.url` / `data-dl="hero-webapp"`。
- 否定の注記: hero の `<p data-i18n-allow="mosaic_removal">{{ site.data.l10n.en.entity.not_removal_note }}</p>`。
- 画像: `src` / `width` / `height` は ja と同じ。`screenshots/*`・`detectable-objects.webp`・`samples/mosaic-detect-*`・`pr_image.webp` の alt の末尾に ` (Japanese UI)`、
  mosaic-detect の 2 つの figcaption の末尾にも ` (Japanese UI)`。`shape-compare-*` (書き出した動画のフレーム、アプリの画面ではない) には付けない。

## 追加したテスト・検査
- `node --test src/lib/i18n-site-top-en.test.js` (29 本、ソースを読む。`_site` は読まない):
  構造の一致 / front matter (lang・permalink・ja_url・source・source_hash が今の ja の値・seo_title に `adds mosaic` と製品名・70 字以内・description に方向と否定・除去の連語なし・schemas と noindex などが ja と同じ) /
  本文 (コメントの外) に仮名・漢字・全角の記号なし / `site.data.mosaic.`・`disclosure.`・`entity.not_removal_note`・`faq`・`plans.tax_note` の直参照なし、l10n の参照あり / 否定の注記の印と、その外に除去の語なし /
  製品の方向の語あり・禁止語なし / リンクの接頭辞・ja-link の 4 本・DL の href / 画像の alt の (Japanese UI) / stats の件数と数字が `_data/site.yml` と同じ / `checks/pages-top-en.mjs` の陽性対照・陰性対照 14 種・レイアウトの無い模型では何もしない。
- `scripts/i18n/checks/pages-top-en.mjs` (`_site/en/index.html`): 存在 (ja の index がレイアウトを通っているとき) / `<html lang="en"` / `adds mosaic` か `apply mosaic` / 否定の注記 (`data-i18n-allow="mosaic_removal"` の要素で中身に `no feature` か `cannot` を含むもの) が 2 本以上 (hero と CTA) /
  `disambiguatingDescription` / `<details` の数 = FAQPage の Question の数 = ja の `<details` の数 / `%%…%%` の残り無し / `data-dl` が 1 つ以上で値の集合が ja と同じ / DL の href にクエリの焼き込み無し / hreflang 4 本。

## ゲートの結果 (手元)
- 開発中: `node --test src/lib/i18n-site-top-en.test.js src/lib/i18n-site-tools.test.js` → 65 pass / 0 fail (Fixer の修正の後)
- `npm test` → 959 件 (956 pass / 0 fail / 3 skip)
- `npm run build && bundle exec jekyll build --strict_front_matter` → OK
- `node scripts/check-docs.mjs` → OK (19 ファイルの深いリンク。英語のトップの `/docs/#detect-options`・`#detect-mosaic`・`#team` を含む)
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site` → OK (17 files)
- `node scripts/i18n/check-site.mjs _site` → OK (7 モジュール: head・inquiry・ja-lang・lang-text・nav・pages-top-en・parts)
- 出力の目視: `<details` 15 = Question 15 (ja も 15)、`<title>AI software that adds mosaic to videos | Deepmosaic`、ja-link の印 `(Japanese)` が docs の 4 本に付く。
- 新規ファイルだけなので `git diff --stat` は空 (改行の反転なし)。

## 置いた仮定・spec / 設計書との食い違い
1. **check のモジュールはレイアウトを通ったページ (`<link rel="canonical"` を持つ) だけを見る**。既存の `i18n-site-tools.test.js` の `checks/ja-lang` のテストが、実際の checks/ 全部を
   レイアウトの無い `_site` の模型 (`en/index.html` に lang と og:locale だけ) で回して exit 0 を期待しているため (期待値は変えられない)。checks/head.mjs と同じ線引き。
   en/index.html が無いことは、ja の index.html がレイアウトを通っているとき (= 実際のビルド) だけエラーにする。
2. **hero の「ドキュメントを見る」ボタン**は中にアイコンの include があるので、`{% capture docs_label %}{% include icon.html … %}View the documentation{% endcapture %}` を
   `ja-link.html label=docs_label class="btn-secondary btn-lg"` に渡した (include の並びは icon.html のまま = parity が通る)。印 `(Japanese)` はボタンの外 (flex の隣の項目) に出る。
3. 「Desktop 版」「Web 版」は用語集に語が無いので、I18N-703 / 707 の `Web app` に合わせて `Desktop app` / `Web app` とした。
4. stats の「0 byte」は英語の複数形 `0 bytes`、「12 形式」「4 段階」は `12 formats` / `4 stages` (数値は同じ)。
5. 「・」(U+30FB、仮名の範囲) の区切り (MANAGE のリンクの間) は `·` (U+00B7) にした。「中2〜5日」は `2–5 days` (en dash)。「0.5〜2 倍」は `0.5x–2x` (I18N-704 の mosaic.yml の `0.5x–2x` と同じ)。
6. 節の見出しの kicker (COMPARISON・CALCULATOR …) は ja でも英語なのでそのまま。section-title の `sub` の中の引用符は `&quot;` で書いた (include の引数の `"` を閉じないため)。
7. EXISTING MOSAIC の否定の文 (`It cannot take mosaic off or restore the original footage.`) は除去の禁止の語・連語に当たらないので `data-i18n-allow` を付けていない (ja も印なし)。
   レビューで「付けてそろえる」案 (LOW・任意) が出たが付けない: 付けると出力の否定の注記が 3 本になり、check の「2 本以上」が hero の注記の消失を捕まえられなくなる。
   付けるなら check を「hero の注記」と「CTA の注記」を個別に見る形に変える必要がある (zh-tw の 710 も同じ扱いにそろえること)。
8. 「検出支援できる物体」の figcaption は本文が続くので、` (Japanese UI)` を画像の説明の直後 (最初の文の末尾) に置いた (spec の「後ろに付ける」の解釈)。
9. desktop の辞書から写した文は無い (アプリの画面の名前は mosaic.yml などの l10n が持つ) ので、`scripts/i18n/glossary.source.json` は触っていない。
   W8 でアプリの辞書と突き合わせること: 「編集ページ」= `editing page`、「ホーム画面」= `home screen`、「検出オプション」= `detection options` (用語集)、「ID 別」= `By ID` (mosaic.yml)、
   「モザイク」(検出対象の名前) = `Mosaic`、「申し込む」= `Subscribe` (plans.yml)、「動画カード」= `video card`。

## 主な見出し・CTA・SEO の対訳
| ja | en |
|---|---|
| seo_title: 動画にモザイクを自動でかけるAIソフト｜Deepmosaic | AI software that adds mosaic to videos \| Deepmosaic |
| title: モザイク作業を最終確認だけに | Mosaic work, down to a final check |
| description (方向・否定・検出対象・ローカル・Premiere) | Deepmosaic is a Windows app in which AI automatically detects targets in a video and adds mosaic to them. It cannot take off or undo mosaic. … |
| kicker: 動画にモザイクをかけるAIソフト | AI software that adds mosaic to videos |
| h1: モザイク作業を / 最終確認だけに。 | Turn mosaic work into / just a final check |
| Microsoft Store で無料入手 | Get it free on Microsoft Store (parts.yml の dl_label_default と同じ) |
| ブラウザでお試し（N 分までの動画・インストール不要） | Try it in your browser (videos up to N minutes, no installation) |
| ドキュメントを見る | View the documentation |
| 初回起動からN日間・M時間分まで無料 / クレジットカード不要 | Free for N days from the first launch, up to M hours / No credit card required |
| 映像を外部送信しない完全ローカル処理 | Fully local processing that never sends footage outside |
| 確認と修正の道具が揃っている | A full set of tools for review and correction |
| 手作業・外注・Deepmosaic の比較 | Manual work, outsourcing, and Deepmosaic compared |
| 作業量から費用を試算します | Estimate costs from your workload |
| 検出結果はすべて自分の手で直せます | You can correct every detection result yourself |
| すでにかかっているモザイクを見つけて、かけ直せます | Find mosaic that is already in your footage and apply it again |
| 四角い枠ではなく、物体の形に沿ってかける | Apply mosaic along the shape of objects, not in a square box |
| 書き出す前に、タイムラインで仕上げる | Finish on the timeline before you export |
| 動画の整理も、組織での利用も | Organize your videos, and use it as an organization |
| 映像は外部に送信されません | Your footage is never sent outside |
| Adobe Premiere Pro へワンクリックでインポート | Import into Adobe Premiere Pro with one click |
| 作業量に合わせて選べる3プラン | 3 plans to match your workload |
| 苦手なケースと制限事項 | Known weaknesses and limitations (faq.yml の訳と同じ名前) |
| よくある質問 | Frequently asked questions |
| 料金を見る (CTA の 2 つ目) | See pricing |
| Light を 3 契約（月 15 時間）で月額 ¥8,940 の固定です（税別） | 3 Light subscriptions (15 hours a month) cost a fixed ¥8,940 / month (excl. tax) |

- 迷った訳: 「モザイク作業を最終確認だけに」は「作業を最終確認だけにする」の意味で `Turn mosaic work into just a final check` (h1)、title は名詞句の `Mosaic work, down to a final check`。
  「処理中の拘束」= `Time tied up during processing`、「未公開素材の外部持ち出し」= `Unreleased footage leaving your hands`、「仮置きの値」= `placeholder value`。
- 自己検査: 見出しから順に読み、訳し戻して否定 (「取り除いたり、元の映像に戻したりすることはできません」→ cannot take mosaic off or restore)・条件 (CUDA 対応 GPU 機では標準で有効)・数値 (0.5–2、4 段階、3 プラン、6 本 × 2 時間 = 12 時間、¥8,940、5 種類、10 px、2〜5 日) が ja と同じことを確かめた。
  `private`・`genital`・`nude`・`censor`・`pixelate`・`Please`・`log in`・`mosaics`・除去の連語は無い (テストでも検査)。

## 直したいが直さなかった ja の文
- 無し。

## 用語集の追加の候補 (W8 の I-86 へ)
- 編集ページ (`editing page` / 編輯頁面)、ホーム画面 (`home screen`)、検出枠 (`detection box`、I18N-704 と同じ)、拡張率 (`expansion ratio`)、ふちのなじませ (`edge feather`、I18N-704 と同じ)、
  仮置きの値 (`placeholder value`)、込み時間 (`included hours`)、Desktop 版 (`Desktop app`)。

## I18N-710 (zh-tw) への申し送り
- 同じ構造で作る: `en/index.html` を土台にして `lang: zh-tw`・`permalink: /zh-tw/`・`ja_url: /`、l10n の参照は `site.data.l10n['zh-tw']` (ハイフンのため添字。`site.data.l10n.zh-tw` は書けない)。
  文のデータの参照 10 本 (mosaic 4・disclosure 4・entity 1・plans.tax_note 1) と `faq.html items=site.data.l10n['zh-tw'].faq.items` を揃える。
- include の引数: `section-title.html` の `title` / `sub` は訳を渡す (kicker は英語のまま)。`cta-download.html secondary_href="/zh-tw/price/" secondary_label=…`。
  what-is・pricing-cards・disclosure-table は引数なしで page.lang に切り替わる。docs の 4 本は `ja-link.html` (印は `（日文）`)。hero の docs ボタンは capture でアイコンごと label に渡す。
- stats は `split` の配列で値とラベルを書く (`0 位元組` など)。ja の `_data/site.yml` の stats と件数・添字で対応するので、件数と数字の部分を突き合わせるテスト
  (en の「stats の値とラベルの数が ja (_data/site.yml の stats) の件数と同じ」) を zh-tw にも作ること。ja の stats を増減・並べ替えたら en / zh-tw の split も直す。`(Japanese UI)` は `（日文介面）`。check のモジュールは `pages-top-zh-tw.mjs` のように別ファイルで (この `pages-top-en.mjs` は en/index.html だけを見る)。

## ウェーブ末尾の E2E で確かめてほしいこと
- `/en/` の幅ごとのはみ出し (375 / 768 / 1280)。特に hero のボタン 3 つと docs ボタンの隣の `(Japanese)` の印の折り返し、比較表 (横スクロール)、stats の 2 列。
- ROI の試算の英語 (I18N-707 の RoiCalculator の表) と、JS 無効のときの noscript の文。
- FAQ の開閉 (15 件) と、タブ (Scope / Settings) の切り替え。
- DL ボタン (hero・料金カード・末尾の CTA) の GA4 の link_id が ja と同じ (`hero`・`hero-webapp` …)。

## sync の状態
- サイトだけのチケット (desktop / web の共有ファイルは触っていない)。

## ロールバックの観点
- revert すると `/en/` が消え、ja の `/` の hreflang (en・x-default) が 404 を指す。`pages-top-en.mjs` も一緒に消えるので check-site は通る。
  I18N-710 (zh-tw) がこの notes の構造を写していても、ファイルは独立なので影響しない。

## レビューの指摘への対応 (Fixer / Tester)
| 重さ | 指摘 | 対応 |
|---|---|---|
| MEDIUM | 陰性対照「data-dl が無い」が `dl.length === 0` を単独で捕まえていない | 直した。BAD_CASES に ja 側の変更 (省略可) を足し、この対照は ja からも data-dl を消し、needle を `計測が止まる` に絞った。`dl.length === 0` の行を外した写しで、この対照だけが落ちることを確かめた |
| LOW | 否定の注記の検査が属性の有無だけ (中身が空でも通る、CTA の 1 本で hero の消失を隠す) | 直した。中身 (次のタグまで) に `no feature` か `cannot` を含む要素が 2 本以上 (hero と CTA) あることを見る。陰性対照に「中身が空」「hero の注記が消えて CTA の 1 本だけ」「中身に否定の語が無い」を足した。検査を外した写しでこの 4 本が落ちることを確かめた |
| LOW ×2 | stats の split の固定配列が `_data/site.yml` の stats の件数・値の変化に気づかない | 直した。テストを 1 本足した (件数・ラベルの数・数字の部分 `[\d,]+\+?` が ja と同じ)。I18N-710 への申し送りにも書いた |
| LOW | EXISTING MOSAIC の否定文に data-i18n-allow を付けてそろえる (任意) | 付けない。理由は仮定 7 |
| LOW | notes の「LF」と作業ツリーの改行が合わない | notes の表を直した。コミットの前に `git ls-files --eol` で 4 ファイルが i/lf であることを確かめた |
| LOW | `_data/l10n/en/faq.yml` 8 行目の `mosaic processing` (I18N-703 の持ち物) | このチケットでは直さない。リーダー経由で I18N-703 の持ち主か W8 へ: 1 件目の答えの `…video production where mosaic processing is required.` を方向のある `…where mosaic must be applied.` などに。`/en/` では本文と FAQPage の JSON-LD の 2 か所に出る |
