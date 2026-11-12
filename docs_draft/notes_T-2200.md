# T-2200 (i18n1112 I18N-702) サイトの言語の値と共通の辞書・用語集の写し・英中の文の検査

2026-11-12、役割: Implementer (コミットは次の担当がレビューの後に行う)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `_data/lang/en.json` (作り直し) | 旧 deepmosaic.xyz の残骸 (別製品の文・`""` キーの重複・`keywords_seo`) を捨て、ja.json の全 36 キーの訳 + 英中だけの 8 キー = 44 キー |
| `_data/lang/zh-tw.json` (新規) | en.json と同じ 44 キー。繁体字 (台湾) |
| `scripts/i18n/glossary.json`・`glossary-chars.json` (新規、写し) | desktop の `src/lib/i18n/` の確定版をバイト単位で写した (blob の hash が一致することを `git hash-object` で確認) |
| `scripts/i18n/glossary.source.json` (新規) | 出所 (`desktop_commit`・`desktop_ref`) と sha256 |
| `scripts/i18n/site-lint.mjs` (新規) | `visibleTexts(html)`・`lintText(lang, text, { allowRemoval })`・`lintValue(lang, value)` (+ 補助の `decodeEntities`) |
| `scripts/i18n/checks/lang-text.mjs` (新規) | check-site のモジュール。`_site/en/**`・`_site/zh-tw/**` に visibleTexts → lintText。今は英中のページが無いので 0 件 |
| `src/lib/i18n-site-lang.test.js` (新規) | 仕様テスト 29 本 (うち 1 本は隣の desktop に用語集が無いので skip) |

ja.json・`_data/site.yml`・layout・include・ページは触っていない (ja-identity OK)。

## 用語集の写し
- 写し元: desktop のローカルのブランチ **`i18n1112-integrate`** (リーダーの指示。W1 は統合済みだが未 push のため origin/main ではない)。commit `be5c5aea7f0593fc8cf597ecc32d71d858d82436`。本体 checkout では `git show` だけで、fetch / pull / checkout はしていない。
- sha256 (LF の内容): `glossary.json` = `d1a060f1bda26a60ea9544f6a46ff396e1242d74128b6bbaa23169de80e49c40`、`glossary-chars.json` = `407556032e9f2855796c39804dd40fad739e53ce1cbe580bda127e746fc1df02`。
- **W8 (I-86) で確定版を写し直すとき**は、同じ `git show` で 2 本を上書きし、`glossary.source.json` の `desktop_commit` と sha256 を書き直す (テスト「sha256 が glossary.source.json と一致する」が書き忘れを捕まえる)。

## 追加したコマンド・テスト
- `node --test src/lib/i18n-site-lang.test.js` (開発中のゲート、`npm test` の glob にも入る)
- `node scripts/i18n/check-site.mjs _site` に `lang-text` のモジュールが加わった (2 モジュール)

## 置いた仮定・spec との食い違い
1. **sha256 は改行を LF にそろえた内容の値**。このホストは `core.autocrlf=true` で、commit 後の checkout では json が CRLF になり、生のバイトの sha256 が変わるため。テストも LF にそろえてから比べる。隣の desktop との比較も同じ。`.gitattributes` (I18N-701 の持ち物) は触っていない。
2. `glossary.source.json` に spec の 2 欄 (`desktop_commit`・`sha256`) に加えて `desktop_ref` と `note` を足した (情報の追加だけ)。
3. **en の禁止語の境界**: 前後が文字・数字・`_` でないこと (大文字小文字を無視)。語の中の空白は 1 個以上の空白に当てる (`log  in` も捕まえる)。`private` は違反、`Privacy` は違反でない。`It cannot remove existing mosaic.` は `remove mosaic` の連語にならないので違反でない (W7-site.md §2 の例どおり)。
4. **en の仮名**: Unicode の Script=Katakana に入らない長音 `ー`・中黒 `・` も捕まえるよう、ブロックの範囲 (U+3040–U+30FF・U+31F0–U+31FF・半角カナ) で見る。zh-tw の仮名も同じ範囲 (zh-tw に `・` があれば違反になる。繁體では `、` か `·` を使う)。
5. **visibleTexts の meta**: `description`・`og:*`・`twitter:*` の content のうち、URL の値 (`https://…`・`/…`・`ms-windows-store:` などスキームで始まるもの) は文として拾わない (`og:url`・`og:image` が対象の語の部分一致で誤検出しないため)。`og:locale` の `zh_TW` などは拾うが違反にならない。
6. **visibleTexts の head**: `<head>` の中の文は `<title>` だけを拾う。`<script>`・`<style>`・`<template>` は中身を読み飛ばす。`<noscript>`・`<textarea>` の中身は見える文として拾う。
7. 要素自身に `data-i18n-allow="mosaic_removal"` があるときは、その要素の `alt`・`title` などの属性の文にも allowRemoval を付ける。
8. allowRemoval でも、除去の語 (en: `remove mosaic`・`removes mosaic`・`mosaic removal tool`・`decensor`・`uncensor`・`unblur`、zh-tw: `去馬賽克`・`去碼`・`移除馬賽克`) 以外の禁止語 (`private`・`敏感部位` など) は違反のまま。
9. 違反は 1 つの文の中の簡体字を 1 字ごとに出し、禁止語の一致 (`视频 → 影片`) も別に出す (desktop の L5 と同じ粒度)。
10. ja の `contact` (「問い合わせ」) は用語集の「お問い合わせ」に合わせて `Contact us` / `聯絡我們` にした。`company` (「会社について」) は footer の `/company/about` への導線なので `About us` / `關於我們`。

## en / zh-tw の対訳表 (全 44 キー)
| キー | ja | en | zh-tw |
|---|---|---|---|
| url | https://www.deepmosaic.co.jp | (同じ) | (同じ) |
| app_download_link | https://apps.microsoft.com/detail/9PDKMKWHN9RW | (同じ) | (同じ) |
| app_store_protocol_link | ms-windows-store://pdp/?productid=9PDKMKWHN9RW | (同じ) | (同じ) |
| app_store_product_id | 9PDKMKWHN9RW | (同じ) | (同じ) |
| importer_download_link | https://github.com/deepmosaic/deepmosaic.github.io/releases/download/v1.0.3/deepmosaic.importer.zxp | (同じ) | (同じ) |
| my_lang | ja | en | zh-Hant-TW |
| og_lang | ja_JP | en_US | zh_TW |
| meta_desc | Deepmosaic は、動画に映った対象を AI が自動検出してモザイクをかける Windows 向けデスクトップアプリです。手作業で行っているモザイク処理を自動化します。すでに入っているモザイクを取り除く機能はありません。検出対象は男性器・女性器・人間の顔と、すでにかかっているモザイクの位置（上からかけ直します）です。処理はすべてお使いの PC 内で完結し、映像を外部に送信しません。検出したモザイク情報は Adobe Premiere Pro へインポートできます。 | Deepmosaic is a Windows desktop app that uses AI to automatically detect targets in your videos and apply mosaic. It automates the mosaic work you now do by hand. It cannot remove existing mosaic. It detects male and female body areas, human faces, and the position of existing mosaic (it applies mosaic over it again). All processing stays on your PC, and your footage is never sent outside it. The detected mosaic information can be imported into Adobe Premiere Pro. | Deepmosaic 是一款 Windows 桌面應用程式，由 AI 自動偵測影片中的對象並套用馬賽克，將以往手動進行的馬賽克處理自動化。本軟體不具備消除影片中既有馬賽克的功能。偵測對象為男性與女性的身體部位、人的臉部，以及影片中既有馬賽克的位置（會在其上重新套用馬賽克）。所有處理皆在您的 PC 上完成，不會將影像傳送至外部。偵測到的馬賽克資訊可匯入 Adobe Premiere Pro。 |
| main_phrase | AIで動画編集を一段上のレベルに | Take video editing to the next level with AI | 以 AI 讓影片剪輯更上一層樓 |
| card_image_description | アップロードされたファイルは修正が必要な箇所があれば、モザイク処理が実施された上でここに表示されます | If the uploaded file has areas that need correction, it is shown here after mosaic is applied. | 若上傳的檔案中有需要修正的部分，會在套用馬賽克處理後顯示於此。 |
| export_file_blurred | Image | Image | 圖片 |
| export_json_blurred | JSON | JSON | JSON |
| payload_too_large | アップロードできるファイルは{}MBまでです | You can upload files of up to {} MB. | 可上傳的檔案大小上限為 {} MB。 |
| invalid_parameter_missing | ファイルがアップロードできていません | The file was not uploaded. | 檔案未能上傳。 |
| invalid_parameter_invalid | アップロードできるファイルはpngとjpegのみです | Only PNG and JPEG files can be uploaded. | 僅能上傳 PNG 與 JPEG 檔案。 |
| deep_learning | ディープラーニング | Deep learning | 深度學習 |
| deep_learning_desc | 身体のプライバシー部位の自動検出にはディープラーニングが使われています。ディープラーニングは様々なサンプルデータから身体のプライバシー部位の特徴を理解して、未知の画像から身体のプライバシー部位を自動で検出します。 | Deep learning is used to automatically detect body areas. It learns the features of body areas from a wide range of sample data and automatically detects body areas in images it has never seen. | 身體部位的自動偵測採用了深度學習。深度學習會從各種範例資料中學習身體部位的特徵，並從未曾見過的圖片中自動偵測身體部位。 |
| find | 成人向けコンテンツの自動検出 | Automatic detection of adult content | 自動偵測成人內容 |
| find_desc | 男性と女性の身体のプライバシー部位を自動的に検出し、モザイク処理します。成人向けコンテンツの面倒な修正作業を自動化することができます。検出箇所の編集機能も用意しています。 | Automatically detects male and female body areas and applies mosaic. You can automate the tedious correction work on adult content. Tools for editing the detected areas are also included. | 自動偵測男性與女性的身體部位並套用馬賽克，可將成人內容繁瑣的修正作業自動化。另提供偵測位置的編輯功能。 |
| precision | 安全なインターネットへの貢献 | Contributing to a safe internet | 為安全的網路環境做出貢獻 |
| precision_desc | 画像・動画コンテンツを扱うサービスでは、成人向けコンテンツの監視が課題となります。人手では対処しきれないコンテンツの監視を自動化することで誰もが安全に使えるインターネットへ貢献します。 | For services that handle images and videos, monitoring adult content is a challenge. By automating content monitoring that is too much to handle by hand, we contribute to an internet that everyone can use safely. | 在處理圖片與影片內容的服務中，成人內容的監控是一大課題。我們將人力難以負荷的內容監控自動化，為人人都能安心使用的網路環境做出貢獻。 |
| contact | 問い合わせ | Contact us | 聯絡我們 |
| company | 会社について | About us | 關於我們 |
| terms | 利用規約 | Terms of Service | 服務條款 |
| privacy | プライバシーポリシー | Privacy Policy | 隱私權政策 |
| cookie | クッキーポリシー | Cookie Policy | Cookie 政策 |
| eula | 使用許諾契約書 | End User License Agreement | 使用者授權合約 |
| asct | 特定商取引法に基づく表示 | Legal Notice (Specified Commercial Transactions Act) | 特定商業交易法標示 |
| title_index | AIによる動画モザイク処理の自動化 | Automating video mosaic processing with AI | 以 AI 自動化影片馬賽克處理 |
| setting | 設定 | Settings | 設定 |
| signout | ログアウト | Sign out | 登出 |
| login | ログイン | Sign in | 登入 |
| signup | 開始する | Get started | 開始使用 |
| demo_apply | デモに申し込む | Request a demo | 申請示範 |
| document | ドキュメント | Documentation | 說明文件 |
| price | 料金 | Pricing | 價格 |
| url_prefix | (無し = 空文字) | /en | /zh-tw |
| json_ld_lang | (無し) | en | zh-Hant-TW |
| seo_brand_suffix | (`_data/site.yml` seo.brand_suffix) Deepmosaic - 動画にモザイクをかけるAIソフト | Deepmosaic - AI software that applies mosaic to videos | Deepmosaic - 為影片套用馬賽克的 AI 軟體 |
| og_image_alt | (`_data/site.yml` seo.og_image_alt) 動画に自動でモザイクをかけるAIソフト Deepmosaic | Deepmosaic, AI software that automatically applies mosaic to videos | 自動為影片套用馬賽克的 AI 軟體 Deepmosaic |
| breadcrumb_home | (`_includes/schema/breadcrumb.html`) ホーム | Home | 首頁 |
| ja_only_badge | (無し) | (Japanese) | （日文） |
| ja_only_title | (無し) | This page is in Japanese. | 此頁面為日文。 |
| lang_switch_label | (無し) | Language | 語言 |

### 自己検査 (訳し戻し)
- meta_desc: en「AI で動画の対象を自動検出してモザイクをかける Windows のデスクトップアプリ。手作業のモザイク作業を自動化。既存のモザイクは取り除けない。男女の身体部位・人の顔・既存のモザイクの位置 (その上に再度かける) を検出。処理は PC 内で完結し映像を外に送らない。検出したモザイク情報は Premiere Pro へ取り込める」= 原文と一致。「すでに入っている / かかっているモザイク」は用語集の existing_mosaic (`existing mosaic` / `既有馬賽克`、kind: required) にそろえ、否定の注記は W7-site.md §2 の例どおり `It cannot remove existing mosaic.` とした (`remove existing mosaic` は禁止の連語 `remove mosaic` に当たらず lintText を通る。レビューの指摘で `take away mosaic that is already in a video` から直した)。zh-tw の「取り除く」は `消除`。
- 「男性器・女性器」は用語集 (男性体 / 女性体 → `male body areas` / `female body areas`、`男性身體部位` / `女性身體部位`) に従い、`male and female body areas` / `男性與女性的身體部位` にまとめた。
- 「人間の顔」: 用語集の「顔」は `face` / `臉部`。zh は「人的臉部」。
- 「成人向けコンテンツ」は spec どおり `adult content` / `成人內容` (原文にある語の訳。新しい語は足していない)。
- 否定の文 (`invalid_parameter_missing` 「アップロードできていません」→ `was not uploaded` / `未能上傳`) は意味が一致。
- 英中の文は全部 `lintValue` を通る (テスト 3)。

## 参照 0 の旧キー (ja でも参照されていない。キーの集合をそろえるために訳した、ja.json は変えない)
`importer_download_link`・`app_store_product_id`・`url`・`main_phrase`・`card_image_description`・`export_file_blurred`・`export_json_blurred`・`payload_too_large`・`invalid_parameter_missing`・`invalid_parameter_invalid`・`deep_learning`・`deep_learning_desc`・`find`・`find_desc`・`precision`・`precision_desc`・`title_index`・`setting`・`signout`・`login`・`signup`・`demo_apply` (22 キー)。
- 2026-11-12 の grep (`site.data.lang.ja.<key>` / `site.data.lang[...]`、8 ファイル) で参照があるのは 14 キー: `app_download_link` (8)・`contact` (2)・`meta_desc` (2)・`app_store_protocol_link`・`asct`・`company`・`cookie`・`document`・`eula`・`my_lang`・`og_lang`・`price`・`privacy`・`terms` (各 1)。
- 旧 en.json にだけあった `keywords_seo` は ja.json に無いので捨てた (キーの集合の規則 `keys(en) − keys(ja)` = 英中だけの 8 個)。

## 直したいが直さなかった ja の文
- `payload_too_large` 「{}MBまで」・`invalid_parameter_invalid` 「pngとjpeg」(数と単位の間の空白・大文字)。参照 0 なので実害なし。
- `meta_desc` の「男性器・女性器」は用語集の ja (男性体 / 女性体) と表記が違う。ja は変えない。

## 用語集の追加の候補 (サイトにだけ出る語、W8 の I-86 へ)
- 「維持管理費用」(法人の料金) / 「導入相談」(法人の問い合わせ) / 「営業日」(en `business days (Japan)`、zh `工作天`)
- 「成人向けコンテンツ」→ `adult content` / `成人內容` (サイトの旧キーと SEO で 2 か所以上)
- 「ホーム」→ `Home` / `首頁` (パンくず・ナビ)
- 「会社概要 / 会社について」→ `About us` / `關於我們`
- 「料金」→ `Pricing` / `價格` (ナビ・ページ見出しで多数)
- 「デモ」→ `demo` / `示範`
- 「深層学習 / ディープラーニング」→ `deep learning` / `深度學習`
- 「クッキーポリシー」→ `Cookie Policy` / `Cookie 政策` (用語集の法務の語の並びにそろえる)

## W8 でアプリの辞書と突き合わせること
- `login` / `signout` / `setting` / `document` / `contact` は desktop の辞書の同じ語 (`登入` / `登出` / `設定` / `說明文件` / `聯絡我們`) と一致させた。アプリの辞書に別の訳 (例: 「お問い合わせ」のボタン名) が入ったら突き合わせる。

## ウェーブ末尾の E2E で確かめてほしいこと
- このチケットは画面を変えない (英中のページはまだ無い)。I18N-705 以降で `<html lang>`・`og:locale`・`og:image:alt`・既定の `<title>` の後ろ・パンくずの JSON-LD に en.json / zh-tw.json の値が出ていること。

## sync の状態
- サイトには web への sync は無い。desktop の用語集の写しは `glossary.source.json` で出所を固定。

## ロールバックの観点
- revert すると `_data/lang/en.json` が旧サイトの残骸に戻り、`zh-tw.json`・用語集の写し・lang-text の検査が消える。I18N-705〜713 (en.json / zh-tw.json のキーを引く layout・include・ページ、`site-lint.mjs` を使う検査) が壊れるので、それらより先に revert しない。

## レビューの指摘への対応 (2026-11-12)
- MEDIUM (2 件、同じ内容) `isUrlLike` が「語 + コロン」で始まる文 (`Deepmosaic: …`・`FAQ: …`) や `/` で始まる文 (`/ month`・`/en/ is …`) を URL とみなし、description・og:*・twitter:* の content が検査から外れていた → URL とみなすのを「空白を含まず、`scheme://`・`mailto:`・`ms-windows-store:`・`/` のどれかで始まる値」に絞った。陽性対照 (description `Deepmosaic: a decensor tool for private parts`・og:title `FAQ: private`・`/en/ is …`・`/ month` は拾い、og:image・og:url `/en/`・mailto は拾わない) を足した。
- MEDIUM 日本の新字体の規則に陰性対照が無い → `zh_simplified` に無く `ja_shinjitai` にだけある `仏`・`両`・`亀` で `rule === 'shinjitai'` を確かめるテストを足した (簡体字の表に無いことも同じテストで確かめる)。
- LOW body の `<style>` の除外の対照 → SAMPLE の `<body>` に `<style>` (`スタイル`) を置き、除外のテストの正規表現に足した。
- LOW (2 件) 閉じタグの省略と引用符の無い `…/>` → 自己終了は「属性の原文の末尾の `/` の直前が空白・引用符・先頭」のときだけにした (`href=/x/` は自己終了でない)。li・dt・dd・option・tr・td・th は同じ種類の開始タグで、p はブロック要素 (p を含む) の開始タグで暗黙に閉じるようにした。テストを足した。
  - 既知の制約: 暗黙の閉じはスタックの先頭だけを見る (`<li><b>x<li>` のように間に別の要素が開いたままだと畳まない)。HTML の省略規則の完全な実装ではない。Jekyll / kramdown の出力は閉じタグを書くので実害の見込みは小さい。印 (data-ja-allowed など) を付ける要素には閉じタグを書くこと。
- LOW en の meta_desc の「すでに入っている / かかっているモザイク」→ 用語集の existing_mosaic にそろえて `It cannot remove existing mosaic.`・`the position of existing mosaic` に直した (対訳表・自己検査の行も合わせた)。
