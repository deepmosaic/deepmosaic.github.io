# T-2231 (I18N-820) サイトの英中の訳の見直し — notes (下書き)

- 始めたときの `git log --oneline -1`: `4042434 fix: T-1921 プライバシーポリシー §9 とクッキーポリシーをサイト配布版 + 配信ストア版の両方に合う文にする`
- 起動の条件 (spec の改訂 2026-11-14 の (1)): ブランチ `backlog1113-site`・作業ツリーが空・先頭 4042434・W5 の 3 ファイルあり・基点 `B1113/_site/index.html` あり・`node_modules/.bin/vite` あり。すべて満たした。
- 担当の分け方: 英語 (en) の分 → 繁体字 (zh-tw) の分 → 最後の担当が 1 コミットにまとめる。この節までが **英語の分**。
- スクリーンショットは無い (撮らない)。見た目は Playwright (`e2e/i18n-layout.spec.ts`・`e2e/join.spec.ts`) で確かめた。

## 英語の分

### 見た範囲
- `_data/lang/en.json` (46 行)、`_data/l10n/en/` の 10 ファイル (disclosure・entity・faq・inquiry_form・mosaic・nav・parts・plans・spec・subscribe)、英語のページ 10 本 (`en/index.html`・`404`・`company/about`・`contact`・`enterprise/inquiry`・`join`・`mosaic-removal`・`price`・`spec`・`subscribe`) の front matter と本文。
- 対訳表: `D:/dm-scratch/i18n/review-w4c/T-2231/site-table.md` (lang と l10n のキーごとに ja・en・zh-tw、353 行) と ja を隠した写し `site-table.noja.md`。作った道具は同じ場所の `make-table.rb` (ruby の YAML で平らにする。リポに入れない)。ja を隠した表で逆方向に読んだ後、ja の表とページの ja の本文と突き合わせた。
- W5 の文 (nav の `dl_cta*`・`download`、parts の `dl_label_default`・`st_label`、subscribe の `store_note`・`store_only` の FAQ、`/en/join/` のダウンロードの段、ヒーローの 2 本、料金の節の sub、料金のページの本文) も読んだ。

### `store_enabled: true` の出力で読んだもの
- `npm run build && node scripts/check-store-toggle.mjs --keep` の出力の `en/index.html`・`en/subscribe/index.html`・`en/join/index.html`・`en/price/index.html`・`en/spec/index.html` (読み終えて一時フォルダは消した)。
- 出る文は `Get it from Microsoft Store` (4 か所、変えない訳)、`store_note`、FAQ「Can I subscribe in the Microsoft Store version of the app?」と答え。どれも ja の意味どおりで自然なので**直していない**。「Store 版だけ」を前提にした文は既定 (false) の英語の出力に残っていない。

### 直した行 (英語、13 か所)
| ファイル | キー / 位置 | 前 | 後 | 分類 | 理由 |
|---|---|---|---|---|---|
| `en/index.html` | front matter `description` | Deepmosaic is a Windows app in which AI automatically detects targets … Supports Adobe Premiere Pro integration. (370 字) | Deepmosaic for Windows: AI automatically detects body areas, faces, and existing mosaic in videos and adds mosaic, all on your PC. It cannot take mosaic off. (157 字) | 長さ (SEO) | spec の目安 (英語 160 字) を大きく超えていた。製品の方向 (adds mosaic)・否定 (cannot)・ja の要点の「自動 (automatically)」・検出対象・ローカル処理を残す (`i18n-site-top-en.test.js` の条件も満たす。remove mosaic の連語は使わない) |
| `en/price/index.html` | `seo_title` | Pricing \| Deepmosaic - AI software that adds mosaic to videos (61) | Pricing \| Deepmosaic - AI software that adds mosaic (51) | 長さ (SEO) | 60 字の目安を超えていた |
| `en/price/index.html` | `description` | Pricing plans for Deepmosaic, which automates … with no credit card required. (359) | Deepmosaic pricing: Light ¥2,980 / month, Pro ¥9,800 / month, Enterprise ¥8,000 / account / month (excl. tax). No overage fees. Free: up to 2 hours in 7 days. (158) | 長さ (SEO) | 金額 3 つと excl. tax は ja と同じ (`i18n-site-product.test.js` の金額の検査)。無料プランの上限は ja「初回起動から7日間・累計2時間分まで」と plans.yml・FAQ のとおり 7 日と 2 時間の両方を書く (「7 日間無料」だけだと 7 日間無制限に読める) |
| `en/subscribe/index.html` | `description` | The subscription page for Deepmosaic paid plans … in both the Desktop app and the Web app. (328) | Subscribe to Deepmosaic Light or Pro (¥2,980 / ¥9,800 a month, excl. tax) with your Web app account, or from the app's profile menu if you downloaded the Windows version. (170) | 長さ (SEO) | ja「Web 版のアカウントで (このページから) 申し込む」(本文 45 行も with your Web app account) に合わせ、「Web アプリの中で申し込む」と読める `in the Web app` を避けた。T-2306 のレビューで足した「Windows 版をダウンロードしてお使いの方」の限定も残したので目安を 10 字超える (正しさを優先) |
| `en/enterprise/inquiry/index.html` | `description` | Inquiry form for the Deepmosaic Enterprise plan … within 3 business days (Japan). (368) | Contact us about Deepmosaic Enterprise (from 1 account): adoption, quotes, invoice payment, or system integration. We reply within 3 business days (Japan). (153) | 長さ (SEO) | 入力項目の列挙を落とし、相談の種類と返答の目安を残した |
| `en/spec/index.html` | `seo_title` | System requirements \| Deepmosaic - AI software that adds mosaic to videos (73) | System requirements \| Deepmosaic - AI that adds mosaic (54) | 長さ (SEO) | 60 字の目安 |
| `en/spec/index.html` | `description` | System requirements for Deepmosaic (AI software that applies mosaic to videos): … (256) | Deepmosaic system requirements: supported OS, memory, and GPU, processing speed by GPU based on production measurements, and supported load and export formats. (159) | 長さ (SEO) | |
| `en/mosaic-removal.html` | `description` | Deepmosaic is software for applying (adding) mosaic … tools that have similar names. (241) | Deepmosaic adds mosaic to videos. It cannot remove, undo, or restore mosaic, or recover the original footage. Don't confuse it with similarly named tools. (154) | 長さ (SEO) | 除去の語はこのページだけ許される (`removal: true`) |
| `en/contact/index.html` | `description` | General contact form for Deepmosaic. … our staff will reply within 3 business days (Japan). (190) | Contact Deepmosaic with questions, bug reports, or billing inquiries. Enter your email address and message, and we will reply within 3 business days (Japan). (157) | 長さ (SEO) | |
| `_data/l10n/en/faq.yml` | `items[10].a` | … Lower GPUs have not been tested. … | … GPUs below that level have not been tested. … | 英語の不自然 | 「それ未満の GPU」。`Lower GPUs` は意味が曖昧 |
| `_data/l10n/en/entity.yml` | `can[3]` | Fix the block size, opacity, edge feather, and detection box expansion ratio in settings | Set fixed values for the block size, opacity, edge feather, and detection box expansion ratio in settings | 誤訳寄り | ja「設定で固定する」。`Fix` は「直す」とも読める |
| `_data/l10n/en/subscribe.yml` | `faq[3].a` | … at the top right of the screen (you can also change your payment method there. If you downloaded the Windows version, you can also do this from "Manage plan" in the profile menu of the app). After you cancel, … | … at the top right of the screen. You can also change your payment method there. If you downloaded the Windows version, you can also use "Manage plan" in the app's profile menu. After you cancel, … | 英語の不自然 | 括弧の中に 2 文 (句点入り) があった。意味は同じで文に分けた |
| `en/join/index.html` | `data-join-download` のリンクの文 | Download Deepmosaic (Windows version) | Download Deepmosaic for Windows | 英語の不自然 | 「Windows 版」の直訳。リンク先・属性・`store-button.html` は不変 |

- 分類ごと: 長さ (SEO) 9・英語の不自然 3・誤訳寄り 1 (誤訳・用語集の違反は見つからなかった)。
- `description` の長さは front matter の値 (引用符を除く) で数えた。直した後の長さ: index 157・price 158・subscribe 170・enterprise 153・spec 159・mosaic-removal 154・contact 157 (404・about・join は元から 112・91・93)。`seo_title` は全部 60 字以下。

### 期待値を直したテスト・検査 (英語だけ)
- `src/lib/i18n-site-support.test.js` 278 行: en の正規表現 `/^Download Deepmosaic \(Windows version\)$/` → `/^Download Deepmosaic for Windows$/` (同じ行の zh-tw の正規表現は触っていない)。
- `e2e/join.spec.ts` 151 行: `/en/join/` の期待の文 `Download Deepmosaic (Windows version)` → `Download Deepmosaic for Windows`。
- `scripts/i18n/checks/*.mjs` の英語の定数は、直した文を持っていないので変えていない。

### 直さなかった候補 (保留)
- `if you downloaded the Windows version` (トップの料金の節・料金のページ・申し込みのページ・subscribe の FAQ): join と同じ「Windows 版」の直訳だが、`llms.txt` (このチケットの対象外) と `site-copy-t1922.test.js` 213・217 行 (T-2306 のレビューで強めた検査) が同じ文を固定しているので揃えたまま残した。直すなら llms.txt と同時に。
- `_data/lang/en.json` の古いキー (`find`・`find_desc`・`precision`・`precision_desc`・`card_image_description`・`main_phrase` など、「adult content」を含む): 英語のページから引かれていないように見えた (英中のページは使っていない)。新しく書いた語ではないので残した。使っていないなら掃除は別のチケットで。
- `nav.enterprise` = `Business inquiries` と、リンク先の題名 `Enterprise inquiries`: ja も「法人様はこちら」と「法人向けお問い合わせ」で違う。役割どおりなので残した。
- `subscribe.yml` の `store_note` の括弧 (Store 版だけの文): 意味は正しく、1 文の中の補足なので残した。
- トップの `title` (`Mosaic work, down to a final check`) と h1 (`Turn mosaic work into just a final check`) の違い: ja の title と h1 の関係と同じで残した。

### 用語集への提案 (T-2232 へ。用語集は変えていない)
- 無し (サイトの英語で用語集と食い違う語は見つからなかった。`mosaic`・`block`・`pixel size`・`edge feather`・`detection options`・`organization code`・`free allowance`・`free period`・`existing mosaic`・`confidence threshold` は用語集どおり)。

### T-2232 へ
- 末尾の「## T-2232 への申し送り (英中まとめ)」に 1 つの節としてまとめた。

### 直したい ja (直していない)
- 無し。

### ゲート (英語の分。開発中)
- `npm test`: pass 1347・fail 0・skipped 3 (ログ `D:/dm-scratch/backlog1113/logs/T-2231/en-npm-test-3.log`)。
- 参考に回したもの (全部合格): `npm run build && bundle exec jekyll build --strict_front_matter`、`node scripts/i18n/check-site.mjs _site`、`node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/B1113/_site _site`、`node scripts/check-store-toggle.mjs --keep` (読んだ後に一時フォルダを消した)、`E2E_SKIP_BUILD=1 npx playwright test e2e/join.spec.ts e2e/i18n-layout.spec.ts` (66 passed)。全ゲートの 1 行はコミットの前に最後の担当が回す。
- コミットはしていない (繁体字の担当が続ける)。

### ロールバック
- このチケットのコミットを戻すと、英中の文と英中の期待値が元に戻るだけ (ja・テンプレート・CSS は不変)。T-2232 / T-2302 / T-2233 のサイトの分はこの上に積まれるので、戻すなら上から順に。

## 繁体字の分

### 見た範囲
- `_data/lang/zh-tw.json`、`_data/l10n/zh-tw/` の 10 ファイル、繁体字のページ 10 本 (`zh-tw/index.html`・`404`・`company/about`・`contact`・`enterprise/inquiry`・`join`・`mosaic-removal`・`price`・`spec`・`subscribe`) の front matter と本文。W5 の文 (nav の `dl_cta*`・`download`、parts の `dl_label_default`・`st_label`、subscribe の `store_note`・`store_only` の FAQ、`/zh-tw/join/` のダウンロードの段、ヒーローの 2 本、料金の節の sub、料金のページの本文) も読んだ。
- 対訳表は英語の担当が作った `D:/dm-scratch/i18n/review-w4c/T-2231/site-table.md` / `site-table.noja.md` を使った (ja を隠した表で zh-tw を訳し戻した後、ja と突き合わせた)。
- 手引き §4 の早見表の語 (大陸の語・日本の語) を、一時の道具 `D:/dm-scratch/i18n/review-w4c/T-2231/zh-scan.mjs` (リポに入れない) で繁体字のファイル全部に当てた。当たったのはコメント (ja の原文) と、意味の合う用法 (「項目」= 項目・欄、「導入」= 企業の導入、「浮水印」) だけで、直すものは無かった。題名と説明の長さは `zh-len.mjs` (同じ場所) で数えた。
- スクリーンショットは無い (撮らない)。見た目は Playwright (`e2e/i18n-layout.spec.ts`) で確かめた。

### `store_enabled: true` の出力で読んだもの
- `node scripts/check-store-toggle.mjs --keep` の出力の `zh-tw/index.html`・`zh-tw/subscribe/index.html`・`zh-tw/join/index.html`・`zh-tw/price/index.html`・`zh-tw/spec/index.html` (読み終えて一時フォルダは消した)。
- 出る文は `從 Microsoft Store 取得` (4 か所、変えない訳)、`store_note`、FAQ「可以在 Microsoft Store 版的應用程式中訂閱嗎？」と答え。どれも ja の意味どおりで台湾の言い方として自然なので**直していない**。「Store 版だけ」を前提にした文は既定 (false) の繁体字の出力に残っていない。

### 直した行 (繁体字、10 か所・8 ファイル)
| ファイル | キー / 位置 | 前 | 後 | 分類 | 理由 |
|---|---|---|---|---|---|
| `zh-tw/index.html` | front matter `description` | Deepmosaic 是由 AI 自動偵測影片中的對象並加上馬賽克的 Windows 應用程式。無法去掉或解除馬賽克。偵測對象為…支援與 Adobe Premiere Pro 整合。(148 字) | Deepmosaic 是由 AI 偵測影片中的身體部位、臉部與既有馬賽克，並加上馬賽克的 Windows 應用程式。無法去掉馬賽克。所有處理都在您的電腦上完成。(80 字) | 長さ (SEO) | 目安 80 字を大きく超えていた。製品の方向 (加上馬賽克)・否定 (無法)・検出対象・ローカル処理を残す (`i18n-site-top-zh.test.js` の条件を満たす) |
| `zh-tw/index.html` | 比較の表の行見出し (ja「未公開素材の外部持ち出し」) | 未公開素材帶出外部 | 未公開素材外流 | 繁体字の不自然 | 日本語の語順の直訳。台湾の慣用の「外流」に |
| `zh-tw/price/index.html` | `seo_title` | 價格｜Deepmosaic - 為影片加上馬賽克的 AI 軟體 (32) | 價格｜Deepmosaic - 加上馬賽克的 AI 軟體 (28) | 長さ (SEO) | 目安 30 字。en の同じ直しと揃えた |
| `zh-tw/price/index.html` | `description` | 自動化為影片加上馬賽克作業的 Deepmosaic 價格方案。…不需信用卡。(149) | Deepmosaic 價格（每月，未稅）：Light 2,980 日圓、Pro 9,800 日圓、Enterprise 每個帳號 8,000 日圓。無超額費用，7 天內可免費試用 2 小時。(95) | 長さ (SEO) | 金額 3 つ・未稅・日圓は ja と同じ (`i18n-site-product.test.js` の金額の検査)。無料プランの上限は ja「7日間・累計2時間分まで」のとおり 7 天と 2 小時の両方を書く。英数字が多いので 80 字の目安を超える (正しさを優先) |
| `zh-tw/spec/index.html` | `seo_title` | 系統需求｜Deepmosaic - 為影片加上馬賽克的 AI 軟體 (34) | 系統需求｜Deepmosaic - 加上馬賽克的 AI 軟體 (30) | 長さ (SEO) | 目安 30 字 |
| `zh-tw/spec/index.html` | `description` | Deepmosaic（為影片加上馬賽克的 AI 軟體）的系統需求。說明…(89) | Deepmosaic 的系統需求：支援的作業系統、記憶體與 GPU，依正式環境實測的處理速度參考值，以及支援的載入與匯出格式。(63) | 長さ (SEO) | |
| `zh-tw/subscribe/index.html` | `description` | Deepmosaic 付費方案（…，未稅）的申請頁面。以網頁版的帳號使用信用卡付款。也可從…都能使用。(130) | 以網頁版帳號申請 Deepmosaic 付費方案（Light 每月 2,980 日圓、Pro 每月 9,800 日圓，未稅）。下載使用 Windows 版的使用者也可從應用程式申請，桌面版與網頁版共用同一帳號。(105) | 長さ (SEO) | 金額・未稅・日圓は ja と同じ。T-2306 の「下載使用 Windows 版的使用者」の限定 (本文・FAQ と同じ表記) と、このページの要点の ja「同じアカウントで Desktop 版と Web 版の両方で」を残した (そのため目安を超える) |
| `zh-tw/contact/index.html` | `description` | Deepmosaic 的一般詢問表單。歡迎傳送您的問題…負責人員將於 3 個工作天內（以日本的工作天計算）回覆您。(88) | Deepmosaic 的一般詢問表單。歡迎傳送問題、錯誤回報或帳單相關事項，我們將於 3 個工作天內（以日本的工作天計算）回覆。(64) | 長さ (SEO) | 入力項目の説明を落とし、相談の種類と返答の目安を残した |
| `zh-tw/enterprise/inquiry/index.html` | `description` | Deepmosaic Enterprise 方案（1 個帳號起）的導入洽詢表單。請填寫公司名稱…回覆您。(140) | 洽詢 Deepmosaic Enterprise 方案（1 個帳號起）的導入、報價、請款單付款與系統整合。將於 3 個工作天內（以日本的工作天計算）回覆。(77) | 長さ (SEO) | 入力項目の列挙を落とした (en と同じ方針) |
| `_data/l10n/zh-tw/subscribe.yml` | `faq[3].a` | …「方案管理」進行（付款方式也在同一個畫面變更。下載使用 Windows 版的使用者，也可從…「方案管理」進行）。取消訂閱後… | …「方案管理」進行。付款方式也在同一個畫面變更。下載使用 Windows 版的使用者，也可從…「方案管理」進行。取消訂閱後… | 繁体字の不自然 | 括弧の中に句点入りの 2 文があった。意味は同じで文に分けた (en の同じ直しと揃えた) |

- 分類ごと: 長さ (SEO) 8・繁体字の不自然 2 (誤訳・用語集の違反・大陸の語は見つからなかった)。
- 直した後の長さ (front matter の値): description は index 80・price 95・subscribe 105・enterprise 77・spec 63・contact 64・mosaic-removal 79 (元のまま)・404 42・about 39・join 38。`seo_title` は全部 31 字以下 (spec の 30 は「系統需求｜Deepmosaic - 加上馬賽克的 AI 軟體」)。price と subscribe は金額 (英数字) を含むため 80 字の目安を少し超える。

### 期待値を直したテスト・検査 (繁体字)
- 無し (直した文を固定しているテスト・検査は無かった)。`i18n-site-top-zh.test.js` (description の方向・否定・除去の語、seo_title 40 字以内)・`i18n-site-product.test.js` (金額・未稅・日圓) の条件は直した後も満たす。

### 直さなかった候補 (保留)
- `/zh-tw/join/` の「下載 Deepmosaic（Windows 版）」: en は `for Windows` に変えたが、繁体字の括弧の形は台湾の言い方としておかしくないので残した (`i18n-site-support.test.js` 278 行・`e2e/join.spec.ts` 152 行の zh の期待値も不変)。
- 「下載使用 Windows 版的使用者」(トップの料金の節・料金のページ・申し込みのページ・subscribe の FAQ): やや硬いが意味は正しく、`site-copy-t1922.test.js` 218 行が固定しているので残した。
- `nav.enterprise` = `企業方案` (ja「法人様はこちら」、リンク先は「Enterprise 導入洽詢」): ナビの短いラベルとして自然なので残した。
- 「刊登於」と「刊載於」がページとデータで混在 (どちらも台湾で使う)。意味の違いは無いので残した。
- 「PC」と「電腦」が混在 (FAQ・meta_desc は PC、トップの本文は電腦)。ja も「PC」「パソコン」が混在しているので残した。
- `_data/lang/zh-tw.json` の古いキー (`find`・`find_desc`・`precision_desc`・`main_phrase`・`demo_apply` = 申請示範 など): 繁体字のページから引かれていないように見えた。英語の分と同じく残した。
- `inquiry_form.yml` の `general_subject` / `enterprise_subject` が英語 (`Inquiry`)。メールの件名で ja の受け手向けと見て残した (意図の確認は T-2232 で)。
- `zh-tw/spec/index.html` の見出し「可在應用程式的設定畫面確認 GPU 的辨識狀態」と本文「偵測選項畫面會顯示…」: ja の見出しと本文の関係と同じなので残した。

### 用語集への提案 (T-2232 へ。用語集は変えていない)
- 無し (サイトの繁体字で用語集と食い違う語は見つからなかった。`馬賽克格`・`像素大小`・`邊緣羽化`・`偵測選項`・`組織代碼`・`免費額度`・`免費期間`・`既有馬賽克`・`信賴度臨界值`・`登入`・`身體部位` は用語集どおり)。

### T-2232 へ
- 末尾の「## T-2232 への申し送り (英中まとめ)」に 1 つの節としてまとめた。

### 直したい ja (直していない)
- 無し。

### ゲート (繁体字の分。開発中)
- `npm test`: pass 1347・fail 0・skipped 3 (ログ `D:/dm-scratch/backlog1113/logs/T-2231/zh-npm-test-1.log`)。
- 参考に回したもの (全部合格): `npm run build && bundle exec jekyll build --strict_front_matter` (`zh-build-1.log`)、`node scripts/i18n/check-site.mjs _site` (`zh-check-site.log`、12 モジュール OK)、`node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/B1113/_site _site` (`zh-ja-identity.log`、17 files OK)、`node scripts/check-store-toggle.mjs --keep` (`zh-store-toggle-keep.log`、読んだ後に一時フォルダを消した)、`E2E_SKIP_BUILD=1 npx playwright test e2e/i18n-layout.spec.ts` (`zh-playwright-layout.log`、48 passed)。
- 全ゲートの 1 行 (spec の (5)) とコミットは最後の担当が行う。コミットはしていない。

## T-2232 への申し送り (英中まとめ)

アプリの辞書は desktop の本体 checkout の `src/lib/i18n/messages/{progress,account_login,account}.ts` の該当キーだけを読んで照らした (再帰の検索はしていない)。

### 食い違い (確定。T-2231 ではサイトの文を変えていない)
1. **「プラン管理」の項目名 (英中・ja とも)**: `_data/l10n/en/subscribe.yml` faq[3].a の `"Manage plan"` (2 か所) と `_data/l10n/zh-tw/subscribe.yml` faq[3].a の「方案管理」(2 か所)。アプリのプロフィールメニューにこの名前の項目は無い。実際の項目は `account_login.menu_portal_label` = en `Change plan, number of accounts, or cancel` / zh-TW `變更方案或數量／取消訂閱` / ja `プラン・本数の変更 / 解約` (desktop `account_login.ts` 221〜224 行。web も同じキー)。`account.ts` の `delete_open_portal_label` (368 行付近) も `Open plan management` / `開啟方案管理` で、メニューの項目名ではない。ja の「プラン管理」も同じく食い違う。**サイトをアプリの項目名に揃えるか (ja の改訂が要る)、アプリ側を改めるかを T-2232 で決めてほしい**。一致しているのはメニューの名前 (`account_login.menu_aria` = `Profile menu` / `個人資料選單`) だけ。
2. **処理の段階の「前處理」(繁体字)**: `zh-tw/index.html` 418 行「準備 → 前處理 → 偵測 → 分析」 ↔ desktop `progress.ts` `stage_preprocess` zh-TW「前置處理」(en `Preprocess`)。ほかの 3 段 (`stage_prepare` 準備・`stage_detect` 偵測・`stage_analyze` 分析) は一致。**サイトを「前置處理」に揃える**のがよい (段の名前の引用なので)。
3. **「馬賽克（的）精細化」(繁体字)**: `_data/l10n/zh-tw/faq.yml` 22 行 (処理時間の答え、「不進行馬賽克的精細化」)・`_data/l10n/zh-tw/spec.yml` 29 行 `performance_note`・同 86 行 (GPU 無しの行、「不進行馬賽克精細化」) ↔ `progress.ts` `stage_segment` zh-TW「精修馬賽克」(en `Refine mosaic`、ja「モザイクの精緻化」)。段の名前として引用している文 (faq の CPU の説明・spec の GPU 無しの行) は「精修馬賽克」に揃えるのがよい。説明文の「精細化」(トップの比較画像の alt など) はそのままでよい。

### 一致を確認したもの (繁体字)
- `mosaic.ts` の 設定像素大小・自動像素大小・最粗的馬賽克格・銳利色彩・全部 / 依類別 / 依 ID / 依場景・信賴度臨界值、`detection_options.ts` の 偵測選項・馬賽克、`account_login.ts` の 個人資料選單 (レビューでの照合)。join の signin1113 の値 (登入・組織登入・組織代碼・持有組織代碼者（企業）) は変えていない。

### 照らしていないもの (英語。T-2232 で en と照らしてほしい)
- `_data/l10n/en/mosaic.yml`: `"Set pixel size"` 画面・`Auto pixel size`・`Fixed`・`"Coarsest blocks"`・`Sharp colors`・`By ID` / `By class` / `By scene` / `All`・`Confidence threshold`・`Size (bbox expansion ratio)`。
- `_data/l10n/en/spec.yml` の `performance_footnote`: `"Areas to review"`。`_data/l10n/en/faq.yml` の `items[2].a`: 検出対象の `"Mosaic"`。
- 英語のトップの処理の段階 (繁体字の 2 と同じ箇所) と「refine」の言い方 (繁体字の 3 と同じ箇所) も、`stage_preprocess` = `Preprocess`・`stage_segment` = `Refine mosaic` と照らしてほしい。
- `en/join/index.html` の `"Open in app"`・`"Organization sign-in"`・`"Organization code"`・`"Sign in"`・`"Have an organization code? (business)"` は signin1113 の値 (変えていない)。
- 繁体字の残りの候補 (`spec.yml` の「需要確認的部分」、`faq.yml` の「通訊內容揭露」「不擅長的情況與限制事項」、`inquiry_form.yml` の件名が英語の `Inquiry`) も T-2232 で確かめてほしい。

### 用語集への提案
- 無し (英中とも)。

## レビューの指摘への対応 (最後の担当、2026-11-14)
| 指摘 | 対応 |
|---|---|
| MEDIUM `en/price` description の無料の条件 (2 件の重複) | 直した: `… No overage fees. Free: up to 2 hours in 7 days.` (158 字) |
| MEDIUM `en/index` description に automatically が無い | 直した: `Deepmosaic for Windows: AI automatically detects …` (157 字)。値に「: 」が入るので引用符で囲んだ (囲まないと jekyll の YAML が落ちる。npm test では捕まらなかった) |
| MEDIUM notes の "Manage plan" の記述 | 直した: 上の申し送りの 1 (英中まとめ) |
| MEDIUM `zh-tw/price` description の 2 小時の欠け | 直した: `無超額費用，7 天內可免費試用 2 小時。` (95 字) |
| MEDIUM notes の繁体字の「T-2232 へ」を確定の形に | 直した: 上の申し送りの 2・3 と「一致を確認したもの」 |
| LOW `zh-tw/subscribe` description の要点の欠けと表記 | 直した: `下載使用 Windows 版的使用者也可從應用程式申請，桌面版與網頁版共用同一帳號。` (105 字) |
| LOW `en/subscribe` description の `in the Web app` | 直した: `with your Web app account` (170 字。正しさを優先) |
| LOW notes の英語の件数とゲートの節 | 直した: 13 か所・長さ (SEO) 9、下に「ゲート (全ゲート)」 |
| LOW `en/spec` seo_title の添え書きの揃え | **却下**: 直すと 63 字で、短くした理由の 60 字の目安を超える。料金の `AI software that adds mosaic` と動作環境の `AI that adds mosaic` は意味が同じで、誤解は生まない |

## ゲート (全ゲート、コミットの前に 1 回)
spec の (5) の 1 行を 1 本ずつ順に回した (ログ `D:/dm-scratch/backlog1113/logs/T-2231/final2-<n>-*.log`)。
| コマンド | 結果 |
|---|---|
| `npm test` | 合格 (tests 1350・pass 1347・fail 0・skipped 3) |
| `npm run build` | 合格 |
| `bundle exec jekyll build --strict_front_matter` | 合格 (1 回目は `en/index.html` の description の「: 」で YAML が落ちた → 引用符で囲んで回し直し) |
| `node scripts/i18n/check-site.mjs _site` | 合格 (12 モジュール) |
| `node scripts/check-docs.mjs` | 合格 (2 ページ、38 ファイルの深いリンク) |
| `node scripts/check-store-toggle.mjs` | 合格 (store_enabled: true の出力に 4 か所 × 言語の Store のボタン) |
| `E2E_SKIP_BUILD=1 npx playwright test` | 合格 (155 passed・1 skipped) |
| `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/B1113/_site _site` | 合格 (17 files、差分 0) |

## 残った問題
- `src/lib/*.test.js` の front matter の読み取り (`fmScalar`) は YAML として正しくない値 (引用符なしの「: 」) を通してしまう。jekyll のゲートで捕まるので実害は無いが、英中の front matter を `npm test` だけで確かめると見落とす (別チケットの候補)。
