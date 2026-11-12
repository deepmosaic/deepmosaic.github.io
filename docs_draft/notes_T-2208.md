# T-2208 (i18n1112 I18N-710) サイトのトップページ (繁体字中国語・台湾) — `zh-tw/index.html`

2026-11-12、役割: Implementer (テストを先に書いて RED を確認 → 実装 → 開発中のゲート → 全ゲートの各段を手元で確認)。コミットは次の担当 (レビューの後)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `zh-tw/index.html` (新規、LF) | ja の `index.html` を原文にした繁体字中国語 (台湾) のトップ。構造は `en/index.html` (I18N-709) と同じ形。front matter: `layout: default`・`lang: zh-tw`・`permalink: /zh-tw/`・`ja_url: /`・`source: index.html`・`source_hash` (accept-site.mjs で書いた)・`title`・`seo_title`・`description`・`schemas: [software-application, faq]` (ja と同じ) |
| `scripts/i18n/checks/pages-top-zh.mjs` (新規、LF) | check-site のモジュール (下) |
| `src/lib/i18n-site-top-zh.test.js` (新規、LF) | 仕様テスト 35 本 (下) |
| `docs_draft/notes_T-2208.md` (新規) | この notes |

- ja の `index.html`・`en/index.html`・include・データ・`_data/lang/*`・l10n・用語集の写し (`scripts/i18n/glossary*.json`・`glossary.source.json`) は触っていない。
- 構造: `compareStructure(index.html, zh-tw/index.html)` が空、`compareStructure(en/index.html, zh-tw/index.html, { allowExtraIncludes: [] })` も空 (ja-link.html の位置まで en と同じ)。
- 文のデータは l10n から: `mosaic.{scopes,controls,priority_note,note}`・`disclosure.{offline_steps,responsibility,weaknesses,accuracy_note}`・`entity.not_removal_note`・`plans.tax_note`・`faq.items`。
  数値・URL・設定 (`site.data.site.web_app.*`・`site.data.site.roi.*`・`site.data.plans.tiers`・stats の accent) は ja のデータのまま。
- hero (kicker・headline・sub) と stats の値・ラベルはページに直接書いた (spec どおり l10n を作らない)。stats は en と同じく `split` の配列を `forloop.index0` で引く。
- サイト内リンク: `/zh-tw/spec/`・`/zh-tw/price/` (2 か所)・`/zh-tw/enterprise/inquiry/`・`cta-download.html secondary_href="/zh-tw/price/"`。docs の 4 本 (`/docs`・`/docs/#detect-options`・`/docs/#detect-mosaic`・`/docs/#team`) は `ja-link.html` (印 `（日文）`)。
- 否定の注記: hero の `<p data-i18n-allow="mosaic_removal">{{ ZH.entity.not_removal_note }}</p>` (末尾の CTA の 1 本は cta-download.html が出す)。
- 画像: `src` / `width` / `height` は ja と同じ。`screenshots/*`・`detectable-objects.webp`・`samples/mosaic-detect-*`・`pr_image.webp` の alt の末尾に `（日文介面）`、mosaic-detect の 2 つの figcaption と hero の figcaption の画像の説明の直後にも `（日文介面）`。`shape-compare-*` には付けない (en と同じ線引き)。
- 金額: noscript の「月額 ¥8,940」は `8,940 日圓／月`、税は l10n の `未稅`。ページのソースと出力のどちらにも `¥` は無い (料金カードは I18N-707 の pricing-cards.html が `currency_suffix` で `日圓` を付ける)。

## 追加したテスト・検査
- `node --test src/lib/i18n-site-top-zh.test.js` (35 本、ソースを読む。`_site` は読まない):
  構造の一致 (ja / en) / front matter (lang・permalink・ja_url・source・source_hash が今の ja の値・seo_title に `為影片加上馬賽克` と製品名・40 字以内・title / seo_title / description が繁体字で lintText 0 件・description に方向と否定 (`無法` / `不具備`)・除去の語なし・schemas と noindex などが ja と同じ) /
  本文 (コメントの外) の全行が仮名なし・`lintText('zh-tw')` 0 件 (簡体字・日本の新字体・禁止語・和製漢語) / en の英文の取り残しなし / `site.data.mosaic.` などの直参照なし・`ZH.*` の参照と `assign ZH = site.data.l10n['zh-tw']` あり・include の引数に添字なし /
  否定の注記の印とその外に除去の語なし / 製品の方向の語・`男性身體部位` / `女性身體部位`・成人向けの語なし / `¥` なし・`8,940 日圓` あり / リンクの接頭辞・ja-link の 4 本・DL の href / 画像の alt が繁体字で `（日文介面）` の有無 / stats の件数と数字が `_data/site.yml` と同じ /
  `checks/pages-top-zh.mjs` の陽性対照・陰性対照 17 種・レイアウトの無い模型では何もしない。
- `scripts/i18n/checks/pages-top-zh.mjs` (`_site/zh-tw/index.html`): pages-top-en.mjs と同じ項目を zh-tw に読み替え (存在・`<html lang="zh-Hant-TW"`・`加上馬賽克` か `套用馬賽克`・否定の注記 (`data-i18n-allow="mosaic_removal"` の要素で中身に `不具備` か `無法`) が 2 本以上・`disambiguatingDescription`・`<details` = Question = ja の件数・`%%…%%` なし・`data-dl` の集合が ja と同じ・DL の href にクエリなし・hreflang 4 本)、加えて `¥` / `&yen;` / `&#165;` が無く `日圓` がある。

## ゲートの結果 (手元)
- RED: 実装前に `node --test src/lib/i18n-site-top-zh.test.js` → 35 fail (ファイルとモジュールが無い)
- 開発中: `node --test src/lib/i18n-site-top-zh.test.js src/lib/i18n-site-tools.test.js` → 71 pass / 0 fail
- `npm test` → 998 件 (995 pass / 0 fail / 3 skip)
- `npm run build && bundle exec jekyll build --strict_front_matter` → OK
- `node scripts/check-docs.mjs` → OK (20 ファイルの深いリンク。zh-tw のトップの `/docs/#detect-options`・`#detect-mosaic`・`#team` を含む)
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site` → OK (17 files)
- `node scripts/i18n/check-site.mjs _site` → OK (8 モジュール: head・inquiry・ja-lang・lang-text・nav・pages-top-en・pages-top-zh・parts)。lang-text は `_site/zh-tw/index.html` で 0 件
- 出力の目視: `<title>自動為影片加上馬賽克的 AI 軟體｜Deepmosaic</title>`、`<details` 15 = Question 15 (ja も 15)、hreflang 4 本、`（日文）` の印が docs の 4 本 (+ ヘッダー・フッター) に付く、否定の注記 2 本。
- 新規ファイルだけなので `git diff --stat` は空 (改行の反転なし)。3 ファイルとも作業ツリーで LF。

## 置いた仮定・spec / 設計書との食い違い
1. **spec の FAQ の書き方 `{% include faq.html items=site.data.l10n['zh-tw'].faq.items %}` は Jekyll で書けない** (include の引数の値は `[\w.-]+` だけで、添字 `['zh-tw']` を含むと `Invalid syntax for include tag` でビルドが落ちる。実際に落ちた)。
   `{%- assign ZH = site.data.l10n['zh-tw'] -%}` で変数に入れ、`ZH.faq.items`・`ZH.mosaic.scopes` など全部の参照を `ZH.*` にそろえた。テストは `assign ZH = site.data.l10n['zh-tw']` と `ZH.*` の参照を見る (en のテストの `site.data.l10n.en.*` に当たる)。
   W7b の I18N-711 / 712 の zh-tw のページも同じ形になる (spec の例をそのまま書くとビルドで落ちる) ので、リーダーから申し送ってほしい。
2. h1 の ja「最終確認だけに。」の句点は付けなかった (`只剩最終確認`)。見出しなので en (I18N-709) と同じく句点なし。kicker・seo_title も句点なし。
3. 「Desktop 版」「Web 版」は `桌面版` / `網頁版` (網頁版は parts.yml の `cta_webapp_link`・subscribe.yml と同じ)。desktop の `i18n1112-integrate` (751d5032) の `src/lib/i18n` に繁体字の「桌面版」はまだ無い。
4. 「ホーム画面」= `主畫面` (サイトのナビの「ホーム」= `首頁` とは別。アプリの画面の名前)、「編集ページ」= `編輯頁面`、「編集画面」(ja の hero の画像の alt) = `編輯畫面` (faq.yml と同じ)。
   アプリの辞書にまだ繁体字が無いので自分で訳した。**W8 でアプリの辞書と突き合わせること**: 主畫面・編輯頁面・編輯畫面・偵測選項 (用語集)・依 ID (mosaic.yml)・「モザイク」(検出対象の名前) = `馬賽克`・「申し込む」= `訂閱` (plans.yml の subscribe_label)・影片卡片・側邊欄・節目監視器 (Premiere Pro の Program Monitor の台湾の Adobe の訳)。
5. 「手作業」は ROI のアイランド (I18N-707、RoiCalculator の zh-tw の `manualLabel: '手動作業的估計'`) に合わせて `手動作業`。比較表の列名も `手動作業（公司內部）` にそろえた。
6. EXISTING MOSAIC の否定の文 (`無法去掉馬賽克，也無法還原成原本的影像。`) は除去の禁止の語 (`去馬賽克`・`去碼`・`移除馬賽克`) を含まないので `data-i18n-allow` を付けていない (ja・en と同じ。en の notes の仮定 7 と同じ理由で check の「2 本以上」を保つ)。「取り除く」は entity.yml の zh-tw と同じく `去掉`。
7. 「・」(U+30FB、仮名の範囲) の区切りは使わない。列挙は `、`、MANAGE のリンクの間は en と同じ `·` (U+00B7)。「中2〜5日」「0.5〜2 倍」は mosaic.yml と同じ全角の `～` (`2～5 天`・`0.5～2 倍`)。
8. `site.data.site.yml` の stats の「0 byte」は `0 位元組`、「12 形式」「4 段階」は `12 種格式` / `4 個階段` (数字は同じ。テストで突き合わせる)。
9. 金額の noscript は spec の例 (`8,940 日圓／月`) の形。「Light を 3 契約」は `以 Light 訂閱 3 份` (契約 = 訂閱、量詞 `份`)。
10. `glossary.source.json` は触っていない (desktop の辞書から写した文は無い)。
11. **(レビューの指摘、LOW、リーダー判断)** 除去の否定を、語の離れた形 (`去掉…馬賽克`・`解除馬賽克`) で `data-i18n-allow` なしに 2 か所書いている。
   front matter の description (`無法去掉或解除馬賽克。`) と EXISTING MOSAIC 節の太字の文 (`無法去掉馬賽克，也無法還原成原本的影像。`)。
   W7-site.md §2 (head の description には属性を付けられないので、禁止の語・連語にそのまま当たらない言い回しにする) と en (I18N-709) の `It cannot take off or undo mosaic.` の先例に従った結果で、
   ja の description が検索結果で誤認した利用者をふるい落とすために除去の否定を置いていることとも合う。ただし spec I18N-710 の本文 (「去馬賽克 系の語は description・title に書かない」、
   例「無法移除已存在的馬賽克 は 移除馬賽克 を含むので data-i18n-allow の中だけ」= 離れた形も除去の語とみなす立場) とは食い違う。`解除馬賽克` がこの「系」に入るかは spec からは決められない。
   また lang-text とテストの REMOVAL (`/去馬賽克|去碼|移除馬賽克/`) は連続した形しか検出しない (spec の例の `無法移除已存在的馬賽克` も検出されない)。
   **リーダーへ**: en と同じ扱いでよいかを決め、W7b (I18N-711 の mosaic-removal 以外のページ・I18N-712) の zh-tw の description と本文に同じ線引きを申し送ってほしい。
12. **(レビューの指摘で直した)** noscript の試算の文と ROI の注記で、全角の句点の直後に改行とインデントがあり、描画で「。 每」「。 各」「。 並」のように句点の後ろに空白が入っていた
   (Chrome は CJK の文字の間の改行を空白として描く。W7 §6 / 設計書 §12.3 の「全角の句読点の前後に空白を入れない」に反する)。3 か所とも改行をなくして 1 行に並べた (要素の構造と parity は不変)。
   ページ全体で「全角の句読点 → 改行 → 文」の形がほかに無いことを確かめた (front matter を除く)。ja のソースも同じ改行の形だが、ja は 1 バイトも変えない規則なので触っていない。

## 主な見出し・CTA・SEO の対訳
| ja | zh-tw |
|---|---|
| seo_title: 動画にモザイクを自動でかけるAIソフト｜Deepmosaic | 自動為影片加上馬賽克的 AI 軟體｜Deepmosaic |
| title: モザイク作業を最終確認だけに | 讓馬賽克作業只剩最終確認 |
| description | Deepmosaic 是由 AI 自動偵測影片中的對象並加上馬賽克的 Windows 應用程式。無法去掉或解除馬賽克。偵測對象為男性身體部位、女性身體部位、人的臉部，以及影片中既有馬賽克的位置。所有處理都在您的電腦上完成，影像不會傳送到外部。支援與 Adobe Premiere Pro 整合。 |
| kicker: 動画にモザイクをかけるAIソフト | 為影片加上馬賽克的 AI 軟體 |
| h1: モザイク作業を / 最終確認だけに。 | 讓馬賽克作業 / 只剩最終確認 |
| Microsoft Store で無料入手 | 從 Microsoft Store 免費取得 (parts.yml の dl_label_default と同じ) |
| ブラウザでお試し（N 分までの動画・インストール不要） | 在瀏覽器中試用（影片最長 N 分鐘，免安裝） |
| ドキュメントを見る | 查看說明文件 |
| 初回起動からN日間・M時間分まで無料 / クレジットカード不要 | 自首次啟動起 N 天內，最多 M 小時免費 / 不需信用卡 |
| 映像を外部送信しない完全ローカル処理 | 不將影像傳送到外部的完全本機處理 |
| 柔軟な編集機能 | 靈活的編輯功能 |
| 確認と修正の道具が揃っている | 確認與修正的工具一應俱全 |
| 手作業・外注・Deepmosaic の比較 | 手動作業、外包與 Deepmosaic 的比較 |
| 作業量から費用を試算します | 依作業量試算費用 |
| 検出結果はすべて自分の手で直せます | 所有偵測結果都能親手修正 |
| すでにかかっているモザイクを見つけて、かけ直せます | 找出影片中既有的馬賽克，並重新套用 |
| 四角い枠ではなく、物体の形に沿ってかける | 不用方形框，而是沿著物體的形狀加上馬賽克 |
| 書き出す前に、タイムラインで仕上げる | 匯出前，在時間軸上完成 |
| 動画の整理も、組織での利用も | 整理影片，也能以組織方式使用 |
| 映像は外部に送信されません | 影像不會傳送到外部 |
| Adobe Premiere Pro へワンクリックでインポート | 一鍵匯入 Adobe Premiere Pro |
| 作業量に合わせて選べる3プラン | 依作業量選擇的 3 種方案 |
| 苦手なケースと制限事項 | 不擅長的情況與限制事項 (faq.yml の zh-tw と同じ名前) |
| よくある質問 | 常見問題 |
| 料金を見る (CTA の 2 つ目) | 查看價格 (nav.yml の pricing = 價格) |
| 月 6 本 × 2 時間（月 12 時間）… Light を 3 契約（月 15 時間）で月額 ¥8,940 の固定（税別） | 每月 6 部影片 × 2 小時（每月 12 小時）時，以 Light 訂閱 3 份（每月 15 小時），固定為 8,940 日圓／月（未稅） |

- 迷った語 (台湾の語の選び方): 「完全ローカル処理」= `完全本機處理` (台湾の「本機」)、「張り付く」= `全程盯著`、「無人」= `無人值守`、「検収」= `驗收`、「納品」= `交件`、
  「仮置きの値」= `暫定值`、「安全マージン」= `安全邊距`、「引きの構図」= `遠景構圖`、「ドラッグ&ドロップ」= `拖放`、「プログラムモニタ」= `節目監視器` (Adobe 台湾)、「プラグイン」= `增效模組` (用語集)、「請求書」= `請款單` (用語集。發票は使わない)、「お見積り」= `報價` (用語集)。
- 自己検査: 見出しから順に読み、訳し戻して否定 (「取り除いたり、元の映像に戻したりすることはできません」→ 無法去掉馬賽克，也無法還原成原本的影像)・条件 (CUDA 対応 GPU 機では標準で有効、設定なし → 在搭載支援 CUDA 的 GPU 的電腦上預設啟用，沒有相關設定)・
  数値 (0.5～2 倍、4 個層級 / 4 個階段、3 種方案、6 部 × 2 小時 = 12 小時、8,940 日圓、5 種字型、10 px、2～5 天、6 位人物 / 2 位人物) が ja と同じことを確かめた。
  `敏感部位`・`私密部位`・`隱私部位`・簡体字・新字体・和製漢語・除去の語 (否定の注記の外) は無い (テストと lang-text で検査)。

## 直したいが直さなかった ja の文
- 無し。

## 用語集の追加の候補 (W8 の I-86 へ)
- 編集ページ (`editing page` / `編輯頁面`)、ホーム画面 (`home screen` / `主畫面`)、Desktop 版 (`Desktop app` / `桌面版`)、Web 版 (`Web app` / `網頁版`)、検出枠 (`detection box` / `偵測框`)、
  拡張率 (`expansion ratio` / `擴展率`)、込み時間 (`included hours` / `包含的時數`)、仮置きの値 (`placeholder value` / `暫定值`)、動画カード (`video card` / `影片卡片`)、サイドバー (`sidebar` / `側邊欄`)、
  ローカル処理 (`local processing` / `本機處理`)、焼き込み書き出し (`export with mosaic burned in` / `匯出燒錄馬賽克的影片`)。

## ウェーブ末尾の E2E で確かめてほしいこと
- `/zh-tw/` の幅ごとのはみ出し (375 / 768 / 1280)。特に hero のボタン 3 つと docs ボタンの隣の `（日文）` の印の折り返し、比較表 (横スクロール)、stats の 2 列。
- フォント: `:lang(zh)` (`zh-Hant-TW`) の字形で繁体字が日本語の字形にならないこと (例 `說`・`戶`・`骨` など)。
- ROI の試算の繁体字 (I18N-707 の RoiCalculator の表) と、JS 無効のときの noscript の文 (`8,940 日圓／月`)。句点の後ろに空白が描かれないこと (仮定 12)。
- FAQ の開閉 (15 件) と、タブ (套用範圍 / 設定項目) の切り替え。
- DL ボタン (hero・料金カード・末尾の CTA) の GA4 の link_id が ja と同じ (`hero`・`hero-webapp` …)。

## sync の状態
- サイトだけのチケット (desktop / web の共有ファイルは触っていない)。

## ロールバックの観点
- revert すると `/zh-tw/` が消え、ja / en の `/` の hreflang (zh-Hant-TW) が 404 を指す。`pages-top-zh.mjs` も一緒に消えるので check-site は通る。
  他のチケットのファイルとは独立 (en/index.html・include・l10n を触っていない)。
