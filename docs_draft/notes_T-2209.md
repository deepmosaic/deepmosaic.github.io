# T-2209 (i18n1112 I18N-711) サイトの料金・申し込み・動作環境・モザイク除去についての英中のページ (8 ファイル)

2026-11-12、役割: Implementer (テストを先に書いて RED を確認 → 実装 → 開発中のゲート → 全ゲートの各段を手元で確認)。コミットは次の担当 (レビューの後)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `en/price/index.html`・`zh-tw/price/index.html` (新規、LF) | `price/index.html` の写し。permalink `/en/price/`・`/zh-tw/price/`、`ja_url: /price/`、`source: price/index.html` |
| `en/subscribe/index.html`・`zh-tw/subscribe/index.html` (新規、LF) | `subscribe/index.html` の写し。`faq_data: subscribe`、プランのボタンは ja と同じ式 (`{{ app_base }}?{{ q }}={{ plan.code }}`・`data-dl="subscribe-{{ plan.code }}-webapp"`) |
| `en/spec/index.html`・`zh-tw/spec/index.html` (新規、LF) | `spec/index.html` の写し。`SPEC` = l10n の spec、kv-table の欄の順は ja と同じ |
| `en/mosaic-removal.html`・`zh-tw/mosaic-removal.html` (新規、LF) | `mosaic-removal.html` の写し。permalink `/en/mosaic-removal/`・`/zh-tw/mosaic-removal/` |
| `scripts/i18n/checks/pages-product.mjs` (新規、LF) | check-site のモジュール (下) |
| `src/lib/i18n-site-product.test.js` (新規、LF) | 仕様テスト 105 本 (下) |
| `docs_draft/notes_T-2209.md` (新規) | この notes |

- 8 ファイルとも front matter: `layout: default`・`lang`・`permalink`・`ja_url`・`source`・`source_hash` (`accept-site.mjs` で書いた)・`title`・`seo_title`・`description`・`schemas` (ja と同じ)・`faq_data` (subscribe だけ、ja と同じ)。
- ja のページ・include・データ・l10n・`_data/lang/*`・用語集の写し (`scripts/i18n/glossary*.json`・`glossary.source.json`) は触っていない。既存のテストも触っていない。
- 構造: 8 ファイルとも `compareStructure(ja, 訳)` が空。en と zh-tw の同じページどうしも `allowExtraIncludes: []` で空 (ja-link.html の位置まで同じ)。
- 文のデータは l10n から: 料金 = `entity.one_liner` (料金カード・CTA は I18N-707 の include が page.lang で切り替える)、申し込み = `plans` (summary・specs・price_unit・tax_note・通貨の前後・subscribe_label)・`parts` (税の括弧・追加契約)・`subscribe.faq`、
  動作環境 = `spec` (windows・performance・network・formats・macos.*・performance_note・performance_footnote)・`entity.one_liner`、モザイク除去 = `entity` (definition・disambiguation・confusion_reasons・name_origin・oss_distinction。can / cannot は can-cannot.html)。
  数値・URL・設定 (`site.data.plans.tiers` の price_display / price_incl_display / min_seats / name・`site.data.site.web_app.url`・`site.data.subscribe.checkout_query`) は ja のデータのまま。
- サイト内リンク: `/en/`・`/en/price/`・`/en/spec/`・`/en/subscribe/`・`/en/contact/`・`/en/enterprise/inquiry/`・`/en/#privacy`・`/en/#faq` (zh-tw も同じ形)。
  docs (`/docs`・`/docs#plan`・`/docs#usage`・`/docs#trouble`) は `ja-link.html`。`cta-download.html` の `secondary_href="/docs"` はそのまま、`secondary_label` は `View the documentation (Japanese)` / `查看說明文件（日文）` (印を文に含める)。
- 金額: en は `¥` + price_display、zh-tw は `日圓` (l10n plans の `currency_prefix` / `currency_suffix`)。zh-tw のソース・出力に `¥` は無い (テストと check で検査)。front matter の金額 (2,980・9,800・8,000) は ja の description と同じ数字。

## 追加したテスト・検査
- `node --test src/lib/i18n-site-product.test.js` (105 本、ソースを読む。`_site` は読まない):
  8 ファイルの存在 / 構造の一致 (ja・en と zh-tw どうし) / front matter (lang・permalink・ja_url・source・source_hash が今の ja の値・layout・schemas と faq_data などが ja と同じ・title / seo_title / description が lintText 0 件・seo_title に製品名) /
  料金・申し込みの description の金額の集合 = ja の description の金額の集合 ⊆ `_data/plans.yml` の price_display、税の語 (`excl. tax` / `未稅`・`日圓`) /
  本文 (コメントの外) の全行に仮名なし (en は漢字・全角の記号もなし)・lintText 0 件 (除去の語は mosaic-removal だけ許す) /
  ja のデータの文の直参照なし (`site.data.entity.`・`site.data.spec`・`site.data.subscribe.faq`・`site.data.plans.tax_note`・`plan.summary`・`s.label` など)・l10n の参照あり・zh-tw は `assign ZH = site.data.l10n['zh-tw']`・include の引数に添字なし /
  リンクの接頭辞・必須のリンク・ja-link の行き先の一覧・cta-download の副ボタン / 申し込みのボタンの式と FAQ の l10n / kv-table の欄の順 / モザイク除去の方向と否定の語・`lang` 属性なし・変数 `E` を使わない (下の仮定 1) /
  除去の語が mosaic-removal 以外に無い / zh-tw に `¥` なし / `checks/pages-product.mjs` の陽性対照・陰性対照 18 種・レイアウトの無い模型では何もしない。
- `scripts/i18n/checks/pages-product.mjs` (`_site` の 8 ページ): 存在と `<html lang>` (en / zh-Hant-TW)・`%%…%%` が無い /
  料金: `data-dl` があり集合が ja と同じ・`/<lang>/enterprise/inquiry/` へのリンク・l10n plans の enterprise の `price_note` (維持管理費用) の訳がある・zh-tw に `¥` / `&yen;` / `&#165;` が無く `日圓` がある /
  動作環境: `data-dl` がある・`class="kv-row` の数が ja と同じ / 申し込み: `?checkout=` の href の集合が ja と同じ・`<details` = Question = ja の件数 /
  モザイク除去: l10n parts の `cc_can_title` / `cc_cannot_title` の見出しと l10n entity の can (8)・cannot (4) の全項目・`adds mosaic` / `加上馬賽克`。
  レイアウトを通ったページ (`<link rel="canonical"`) だけを見る (pages-top-en.mjs と同じ線引き)。英中のページが無いことは、ja のページがレイアウトを通っているときだけエラー。

## ゲートの結果 (手元)
- RED: 実装前に `node --test src/lib/i18n-site-product.test.js` → 105 fail (ページとモジュールが無い)
- 開発中: `node --test src/lib/i18n-site-product.test.js src/lib/i18n-site-tools.test.js` → 141 pass / 0 fail
- `npm test` → 1103 件 (1100 pass / 0 fail / 3 skip)
- `npm run build && bundle exec jekyll build --strict_front_matter` → OK
- `node scripts/check-docs.mjs` → OK (28 ファイルの深いリンク。英中のページの `/docs#plan`・`#usage`・`#trouble` を含む)
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site` → OK (17 files)
- `node scripts/i18n/check-site.mjs _site` → OK (9 モジュール。lang-text は 8 ページで 0 件)
- 新規ファイルだけなので `git diff --stat` は空 (改行の反転なし)。全ファイル LF。

## 置いた仮定・spec / 設計書との食い違い
1. **モザイク除去のページの変数は spec の `E` ではなく `EL`**。`can-cannot.html` が include の中で `{%- assign E = site.data.entity -%}` (ja のデータ) を実行し、Jekyll の include は呼び出し側と変数を共有するので、
   ページの変数を `E` にすると can-cannot の後の `E.confusion_reasons`・`E.name_origin`・`E.oss_distinction` が ja のデータ (日本語・ハッシュ) になった (実際にビルドして lang-text が 151 件で落ちた)。
   `EL` に変えて解消し、テストに「ページの変数に `E` を使わない」を足した。ja のページは同じ `site.data.entity` を入れ直すだけなので影響なし。
2. **zh-tw は `{%- assign ZH = site.data.l10n['zh-tw'] -%}` を入れてから `ZH.*` で引く** (spec の `site.data.l10n['zh-tw'].subscribe.faq` を include の引数に書くと Jekyll の構文でビルドが落ちる。I18N-710 の notes の申し送りどおり)。
3. **モザイク除去の「モザイクの除去をお探しの方へ」の囲みの先頭に、spec の要点の 1 文を足した**: en `Deepmosaic adds mosaic to videos. It cannot remove it.`、zh-tw `Deepmosaic 是為影片加上馬賽克的軟體，無法去除馬賽克。`。
   ja の囲みには無い文だが、ja の h1・段落が言っている内容の要約で、spec が「明記」を求めているため (原文に無い情報は足していない)。外すなら囲みの中の 1 文だけ消せばよい (テストの `cannot remove` / `無法去除` は本文のどこかにあればよいので、消すならテストも合わせて見直す)。
4. **h1 の「「かける」」の強調**: en `Deepmosaic is software that <span class="text-accent">adds mosaic</span>`、zh-tw `Deepmosaic 是<span class="text-accent">加上馬賽克</span>的軟體`。
   強調を `adds mosaic` / `加上馬賽克` の連語に掛けた (check の `adds mosaic` / `加上馬賽克` を 1 続きのテキストで拾うため。鉤括弧は英中で付けない)。
5. **ja の `<p lang="en">{{ E.disambiguation.en }}</p>`** は、英中では `lang` 属性を付けずに `{{ EL.disambiguation }}` (spec どおり)。
6. **seo_title**: ja の料金・動作環境は `seo_title` を持たない (既定のサフィックス) が、W7 §2 で英中は必須なので、`Pricing | Deepmosaic - AI software that adds mosaic to videos` のように既定のサフィックス (`seo_brand_suffix` に近い形) を手で書いた。
   申し込みは ja と同じく `<名前>｜Deepmosaic`、モザイク除去は ja の seo_title の訳 (`Deepmosaic is not mosaic removal software` / `Deepmosaic 並不是去除馬賽克的軟體`)。
7. **申し込みのボタン**: ja の `{{ plan.name }} を{{ plan.subscribe.label }}` は、en `{{ T.subscribe_label }} to {{ plan.name }}` (= `Subscribe to Light`)、zh-tw `{{ T.subscribe_label }} {{ plan.name }}` (= `訂閱 Light`)。T = l10n plans の tiers[code]。
8. **「法人様向け、{n} アカウントから」**: 数値は ja と同じ `{{ ent.min_seats }}`。en は 1 のとき `account`、それ以外 `accounts` を Liquid で分けた。zh-tw は量詞 `{{ ent.min_seats }} 個帳號起`。
9. **「導入相談」のリンクの文字**: en `Enterprise inquiries` / zh-tw `導入洽詢` (en / zh-tw のトップ (I18N-709 / 710) の同じリンクに合わせた)。
10. **zh-tw の段落は 1 行に並べた** (ja は文ごとに改行しているが、CJK の改行は空白として描かれ「。 」になるため。I18N-710 の notes の仮定 12 と同じ)。要素の構造と parity は不変。
11. **パンくずの aria-label**: en `Breadcrumb` / zh-tw `導覽路徑`。表示の「ホーム」は `_data/lang/*.json` の `breadcrumb_home` と同じ `Home` / `首頁` (JSON-LD のパンくずと同じ語)。
12. **込み時間**: zh-tw の本文と description は l10n plans の specs の `內含時數` にそろえた。en は `Included hours` / `included hours`。
13. 「維持管理費用」の注記は I18N-703 の `price_note` (`+ maintenance fee / month` / `+ 維護管理費用 / 月`) がそのまま料金カードに出る (ページでは書いていない)。check はその値が出力にあることを見る。
14. **zh-tw のモザイク除去のページの title は `關於去除馬賽克`** (ja の「モザイク除去について」の直訳。このページは除去の語を許す)。一方、フッターのこのページへのリンクの文字は I18N-706 の nav の `mosaic_removal: 關於既有馬賽克` (除去の語を避けた別の名前)。
    en も同じで、title `About mosaic removal` に対しフッターの nav は `About existing mosaic`。リンクの文字とページの見出しが違うので、**リーダーの判断**: そろえるなら nav (I18N-706 の持ち物) か、このページの title のどちらか。
15. `/en/contact/`・`/zh-tw/contact/`・`/en/enterprise/inquiry/` は I18N-712 で作られる (今はまだ無い = リンク切れ。W7b の統合で解消)。
16. desktop の辞書から写した文は無い (`scripts/i18n/glossary.source.json` は触っていない)。

## 主な見出し・CTA・SEO の対訳
| ja | en | zh-tw |
|---|---|---|
| 料金 (title / h1) | Pricing | 價格 |
| description (料金) | Pricing plans for Deepmosaic, which automates the work of applying mosaic to videos. Light ¥2,980 / month, Pro ¥9,800 / month, Enterprise ¥8,000 / account / month (all excl. tax). … | 自動化為影片加上馬賽克作業的 Deepmosaic 價格方案。Light 每月 2,980 日圓、Pro 每月 9,800 日圓、Enterprise 每個帳號每月 8,000 日圓（皆為未稅）。… |
| 時間の計測について | How usage time is measured | 使用時間的計算方式 |
| ドキュメントの「プランの変更」 | Changing your plan (in the documentation) | 說明文件中的「變更方案」 |
| ドキュメントの「使用時間の計測」 | Measuring usage time (in the documentation) | 使用時間的計算 |
| ドキュメントを見る (CTA の副ボタン) | View the documentation (Japanese) | 查看說明文件（日文） |
| 有料プランのお申し込み | Subscribe to a paid plan | 申請付費方案 (nav.yml の subscribe と同じ) |
| お申し込みの流れ | How to subscribe | 申請流程 |
| プランを選ぶ | Choose a plan | 選擇方案 |
| {Plan} を申し込む | Subscribe to {Plan} | 訂閱 {Plan} |
| よくあるご質問 | Frequently asked questions | 常見問題 |
| 動作環境 (title / h1) | System requirements | 系統需求 (nav.yml の spec と同じ) |
| GPU と処理速度の目安 | GPU and processing speed guide | GPU 與處理速度的參考值 |
| ネットワーク / 対応フォーマット | Network / Supported formats | 網路 / 支援的格式 |
| 通信内容の開示 | disclosure of communications | 通訊內容的揭露 |
| GPU の認識状況はアプリの設定画面で確認できます | You can check whether your GPU is recognized in the app's settings | 可在應用程式的設定畫面確認 GPU 的辨識狀態 |
| トラブルシューティング | Troubleshooting | 疑難排解 |
| 動作環境を満たしていればすぐに始められます (CTA) | If your PC meets the requirements, you can get started right away | 只要符合系統需求，就能立即開始使用 |
| モザイク除去について (title) | About mosaic removal | 關於去除馬賽克 |
| seo_title: Deepmosaicはモザイク除去ソフトではありません | Deepmosaic is not mosaic removal software | Deepmosaic 並不是去除馬賽克的軟體 |
| h1: Deepmosaicはモザイクを「かける」ソフトです | Deepmosaic is software that adds mosaic | Deepmosaic 是加上馬賽克的軟體 |
| できること / できないこと | What it can and cannot do | 可以做到的事／無法做到的事 (can-cannot.html の見出しと同じ語) |
| なぜ混同されるのですか | Why is it confused with other tools? | 為什麼會被混淆？ |
| モザイクの除去をお探しの方へ | If you are looking to remove mosaic | 給正在尋找去除馬賽克方法的人 |
| Deepmosaicが解決すること | What Deepmosaic solves | Deepmosaic 能解決的問題 |

- 迷った訳: 「Web 版のアカウントでお申し込みいただけます」= `with your Web app account` / `以網頁版的帳號申請`。「そのままご利用いただけます」= `use it … as it is` / `可直接…使用`。
  「お見積りによるご契約」= `is subscribed to on a quote basis` / `採報價方式簽約` (用語集: 見積り = quote / 報價、契約 = subscription)。
  「加算されます / 加算対象ではありません」= `Time is added … / is not counted` / `計入 / 不列入計算`。「端末識別子」= `device identifier` / `裝置識別碼` (端末 = device / 裝置)。
  「検出オプション画面」= `detection options screen` / `偵測選項畫面` (用語集)。「推論モデル」= `inference model` / `推論模型`。
- 自己検査: 8 ページを見出しから読み、訳し戻して金額 (2,980 / 9,800 / 8,000、税込 3,278 / 10,780 / 8,800 はデータから)・税 (excl. tax / 未稅、incl. tax / 含稅)・
  条件 (無料は初回起動から 7 日・累計 2 時間・カード不要、Enterprise は 1 アカウントから・見積り)・否定 (購入画面がない・ファイル名や映像を送信しない・除去・解除・復元はできない・問い合わせも受けない)・
  macOS の「開発中・提供時期は未定・先行の受付なし・Windows 版のみ」(l10n spec の値) が ja と同じことを確かめた。
  `private`・`genital`・`censor`・`pixelate`・`Please`・`log in`・`mosaics`・簡体字・新字体・和製漢語は無い (テストと lang-text で検査)。除去の語はモザイク除去の 2 ページだけ。

## 直したいが直さなかった ja の文
- 無し。

## 用語集の追加の候補 (W8 の I-86 へ)
- 込み時間 (`included hours` / `內含時數`、I18N-703 の specs と同じ)、推論モデル (`inference model` / `推論模型`)、端末識別子 (`device identifier` / `裝置識別碼`)、
  ハッシュ値 (`hash value` / `雜湊值`)、ライセンスサーバー (`license server` / `授權伺服器`)、トラブルシューティング (`troubleshooting` / `疑難排解`)、導入相談 (`Enterprise inquiries` / `導入洽詢`)。

## W8 でアプリの辞書と突き合わせること
- 「メールアドレスではじめる」(`Start with email` / `以電子郵件開始`、I18N-703 の subscribe.yml と同じ)・「プランの管理」系・「申し込む」(`Subscribe` / `訂閱`、plans.yml) は Web 版・アプリのボタン名と同じか。
- 「検出オプション」(`detection options` / `偵測選項`)・「設定画面」(`settings` / `設定畫面`) のアプリの画面の名前。

## L11 / L13 / L16 / L17 の警告
- サイトには desktop の i18n-lint が無い (lintText だけ)。数える文は量詞 (`1 台裝置`・`1 個帳號`・`2 個`) と en の単複 (`account` / `accounts`) を付けた。文を `+` で組み立てていない (税の括弧は I18N-707 の parts の部品を料金カードと同じ並びで使った)。

## ウェーブ末尾の E2E で確かめてほしいこと
- `/en/price/`・`/zh-tw/price/` の料金カードの幅 (375 / 768 / 1280): `/ account / month (excl. tax, ¥8,800 incl. tax)` の折り返し、zh-tw の `8,000 日圓` の桁の幅。
- `/en/subscribe/`・`/zh-tw/subscribe/` の申し込みのボタンが ja と同じ Web 版の URL (`?checkout=light` / `?checkout=pro`、言語のクエリ無し) へ行き、GA4 の link_id が `subscribe-light-webapp` などで ja と同じ。料金カードの「Subscribe」/「訂閱」が `/en/subscribe/#plan-light` などの該当のカードに飛ぶ (`scroll-mt-24`)。
- `/en/spec/`・`/zh-tw/spec/` の性能の表 (28 行) の幅と kv-table の折り返し。macOS の「In development」/「開發中」のバッジ。
- `/en/mosaic-removal/`・`/zh-tw/mosaic-removal/` の can-cannot の 2 列と、フッターのこのページへのリンクの文字 (仮定 14)。
- `（日文）` / `(Japanese)` の印が docs のリンクの直後に付き、段落の中で句点の前に余計な空白が出ないこと。

## sync の状態
- サイトだけのチケット (desktop / web の共有ファイルは触っていない)。

## ロールバックの観点
- revert すると 8 ページが消え、ja / en / zh-tw の `/price/`・`/spec/`・`/subscribe/`・`/mosaic-removal/` の hreflang (I18N-705 の台帳 `_data/i18n_pages.yml`) と、料金カード・トップ・ヘッダー / フッター (I18N-706 / 707 / 709 / 710) の英中のリンクが 404 を指す。
  `checks/pages-product.mjs` も一緒に消えるので check-site は通る。他のチケットのファイルは触っていないので独立に revert できる。

## レビューの指摘への対応 (Fixer)
- LOW 料金の計測の項目 (en/price、zh-tw/price): ja の「エンコード（書き出し）」は画面の操作の意味なので、用語集の encode_op に合わせ en `Exporting is not counted.`・zh-tw `匯出不列入計算。` に直した (`Encoding`・`編碼` は encode_tech の文脈だけ)。
- LOW en/spec の description: 「読み込み・書き出しフォーマット」を表の見出し (`Load` / `Export`) と用語集 #58 に合わせ `the supported load and export formats` に直した。
- LOW zh-tw/mosaic-removal.html の Liquid のコメント: 「変数 ZH → E」を実際の変数名 EL に直した (出力は不変)。
- 同じ趣旨の重複した指摘 (2 件ずつ) は上の 3 つで両方とも解消。誤りと判断した指摘は無し。
