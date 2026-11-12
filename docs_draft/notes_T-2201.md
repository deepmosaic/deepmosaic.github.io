# T-2201 (i18n1112 I18N-703) サイトのデータの訳 1: 料金プラン・FAQ・申し込みの FAQ

2026-11-12、役割: Implementer → Fixer / Tester (レビューの LOW 2 件を反映: FAQ 2 件目の en の質問を spec の例に、範囲・見積りの訳の判断を仮定に追記)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `_data/l10n/en/plans.yml`・`_data/l10n/zh-tw/plans.yml` (新規) | `_data/plans.yml` の文だけ。トップの 4 欄 + `tiers` (4 プラン) |
| `_data/l10n/en/faq.yml`・`_data/l10n/zh-tw/faq.yml` (新規) | `_data/faq.yml` の 15 件を `items:` の下に同じ順で。プレースホルダ 4 種はそのまま |
| `_data/l10n/en/subscribe.yml`・`_data/l10n/zh-tw/subscribe.yml` (新規) | `_data/subscribe.yml` の `faq` 3 件だけ (設定値 `checkout_query` は持たない) |
| `src/lib/i18n-site-data-plans.test.js` (新規) | 仕様テスト 23 本 |

- 6 ファイルとも先頭に `_source` と `_source_hash` (`node scripts/i18n/accept-site.mjs` で書いた)。
- ja のデータ・include・ページ・`_data/lang/*` は触っていない。データを足しただけなので ja の出力は変わらない (include はまだ l10n を引いていない)。

## 追加したコマンド・テスト
- `node --test src/lib/i18n-site-data-plans.test.js` (開発中のゲート。`npm test` の glob にも入る)
- テストの中に依存なしの小さな yml の読み取り (`parseYaml`) を書いた。`src/lib/plans-yml.js` の `loadTiers` は bullets・cta を読み飛ばし、`loadSpecs` は specs だけなので、文の欄全部を読むには足りなかった。代わりに陽性対照として、自前の読み取りが ja の tiers の code と specs を `loadTiers` / `loadSpecs` と同じに読むことを確かめている。非対応の記法 (ブロックスカラー・暗黙の null・閉じない引用符) は throw する。
- テストの中身: faq の件数 (15)・各回答のプレースホルダの多重集合・空でないこと / subscribe の件数 (3)・設定値を持たないこと / plans の tiers のキー = ja の code・文の欄の対応 (ja にある欄だけ、余計な欄なし)・bullets / specs の件数・通貨の前後の文字・`tax_note`・`rollout_note` が ja と同じく空 / 込み時間などの数字が ja と同じ (specs の value と bullets) / プラン名・数値・href を持たない / 全部の文が `lintValue` を通る (除去の語も許さない、陽性対照あり) / 6 ファイルの `_source`・`_source_hash`。

## plans の l10n の欄の一覧 (I18N-707 が読む)
トップの欄 (両言語):
| 欄 | ja の元 | en | zh-tw |
|---|---|---|---|
| `tax_note` | `tax_note` 「税別」 | `excl. tax` | `未稅` |
| `rollout_note` | `rollout_note` (今は空) | `""` | `""` |
| `currency_prefix` | (無し。ja は `currency_symbol` 「¥」) | `¥` | `""` |
| `currency_suffix` | (無し) | `""` | ` 日圓` (先頭に半角スペース) |

`tiers.<code>` の欄 (ja の tier が持つ文の欄だけ):
| code | 欄 |
|---|---|
| `free` | `summary`・`bullets` (5 件)・`cta_label` |
| `light` | `summary`・`price_unit`・`specs` (3 件、`label` / `value`)・`cta_label`・`subscribe_label` |
| `pro` | `summary`・`price_unit`・`specs` (4 件)・`cta_label`・`subscribe_label` |
| `enterprise` | `summary`・`price_unit`・`price_note`・`specs` (3 件)・`note`・`cta_label` |

- 対応: ja の `cta.label` → `cta_label`、`subscribe.label` → `subscribe_label` (`secondary_cta.label` → `secondary_cta_label` は今の ja に無いので無い)。
- プラン名 (`name`)・数値 (`price_display`・`price_incl_display`・`included_hours`・`max_contracts` …)・`cta.kind` / `variant` / `href` / `external` は持たない。enterprise の `cta.href` (`/enterprise/inquiry/`) は ja のデータのまま使い、言語の接頭辞は I18N-707 の include が付ける。
- **specs の「追加契約」行**は ja でも `max_contracts` から `pricing-cards.html` が組み立てる (データに無い) ので、その行の英中の文は I18N-707 の `parts.yml` の持ち物。

## I18N-707 への申し送り
- faq は `site.data.l10n[page.lang].faq.items` (配列は `items:` の下)。subscribe は `site.data.l10n[page.lang].subscribe.faq` (ja と同じ `faq:` の下)。
- FAQ の回答のプレースホルダ (`%%LIGHT_MAX%%`・`%%LIGHT_TOTAL%%`・`%%PRO_MAX%%`・`%%PRO_TOTAL%%`) は 10 件目 (index 9) に ja と同じ回数ある。`faq-answer.html` の置換をそのまま通せばよい。
- 価格は en `¥` + `price_display`、zh-tw `price_display` + ` 日圓`。税は `tax_note` (`excl. tax` / `未稅`)。
- FAQ の中で別ページ・節を名前で指している文 (en / zh-tw): 「通信内容の開示」→ `"Data transmission disclosure"` / `「通訊內容揭露」`、「苦手なケースと制限事項」→ `"Known weaknesses and limitations"` / `「不擅長的情況與限制事項」`、「動作環境ページ」→ `system requirements page` / `系統需求頁面`、「料金ページ」→ `pricing page` / `價格頁面`。ja の FAQ の回答にリンク (`href`) は無いので、訳でも行き先を足していない。I18N-704 (disclosure / spec) と I18N-711 (ページの見出し) の訳と名前を揃えること (食い違えばこちらを直す)。

## 置いた仮定・spec との食い違い
1. **FAQ 2 件目の質問の en は `Can Deepmosaic take existing mosaic off a video?`** (spec の例どおり)。Implementer は当初 `remove existing mosaic` (間に existing が入るので禁止の連語には当たらない) にしていたが、FAQ の質問は FAQPage の JSON-LD にも載り、3・7・15 件目と言い回しを揃えるため、レビューの指摘で spec の例に差し替えた (Fixer)。zh-tw は 702 の `meta_desc` と同じ `消除` を使った (`可以消除影片中既有的馬賽克嗎？`)。
2. それ以外の「取り除く」は en `take … off`、zh-tw `拿掉` にした (除去の禁止の連語に当たらない言い回し)。
3. **箇条書き (free の bullets) と specs の値は ja に合わせて句点なし**。en の bullets は完全な文のものもあるが、ja のリストの書き方 (句点なし) に揃えた (§12.3 の「完全な文は句点で終える」より、リストの見た目の一貫性を優先)。summary・note・FAQ は句点あり。
4. 「Web 版」は用語集に無い。en `Web app`、zh-tw `網頁版` にした (desktop の辞書にもまだ英中の訳が無い)。
5. subscribe 2 件目のボタン名「メールアドレスではじめる」はアプリ / Web 版のログイン画面のラベル (desktop `src/lib/auth/login-entry.ts`、web `LoginGate.svelte`)。アプリの辞書にまだ英中が無いので、en `"Start with email"`、zh-tw `「以電子郵件開始」` と自分で訳した。3 件目の「プラン管理」も同様に en `"Manage plan"`、zh-tw `「方案管理」`。**W8 でアプリの辞書と突き合わせること** (アプリ側の訳と違えばこちらを直す)。
6. FAQ 3 件目の検出対象「モザイク」のラベルは en `"Mosaic"`、zh-tw `「馬賽克」` にした。アプリの検出対象のラベルの訳 (用語集の「既存のモザイク」= existing mosaic かもしれない) と **W8 で突き合わせること**。
7. 「維持管理費用」は en `maintenance fee`、zh-tw `維護管理費用`。「同時起動」は en `Concurrent use` / `1 device`、zh-tw `同時使用` / `1 台裝置` (ja の値「1 台」は端末の数なので `device` / `台` を補った)。「込み時間」は en `Included hours`、zh-tw `內含時數`。「プール共有」は en `shared as a pool`、zh-tw `以額度池共用`。
8. 「申し込む」(subscribe.label) は en `Subscribe`、zh-tw `訂閱` (用語集の 契約 = subscription / 訂閱 に合わせた)。「ダウンロードして申し込む」は `Download and subscribe` / `下載並訂閱`。「導入について相談する」は `Talk to us about adoption` / `洽詢導入事宜`。
9. 「1 台の PC では合計 2 時間まで」の en は `Up to 2 hours in total on 1 PC`、zh-tw `1 台 PC 最多合計 2 小時` (数字の照合のため「1」を落とさない)。
10. 「同人・個人撮影のクリエイター向け」は en `For indie creators and individual videographers`、zh-tw `適合同人與個人拍攝的創作者`。「メーカー」(AV の制作会社の意) は `production companies` / `製作公司`。
11. 「決済ポータル」は en `payment portal`、zh-tw `付款入口網站`。「粒度」は用語集の 粒 = block / 馬賽克格 から `mosaic block size` / `馬賽克格大小`。「隠蔽率」は `coverage` / `遮蔽率`。
12. 「3 営業日以内」は 3 ファイルに出てこない (W7-site.md §6 の形は使わなかった)。
13. **範囲** (用語集 required: en range / zh 範圍) は、en では文脈により `those areas` (検出した部分を指すとき) / `extent` (「位置と範囲」) と訳した。UI のラベルとしての「モザイクの範囲」(faq 7 件目) だけ `mosaic range`。zh-tw はどれも `範圍` で用語集どおり。
14. **見積り** (価格の見積、enterprise.note「別途お見積りします」) は用語集の 見積り = estimate / 預估 (残り時間の見積り) と意味が違うので、en `separate quote`、zh-tw `另行報價` にした。

## 直したいが直さなかった ja の文
- 無し (ja は触っていない)。

## 用語集の追加の候補 (W8 の I-86 へ)
- 込み時間 (en `included hours` / zh `內含時數`)、同時起動 (`concurrent use` / `同時使用`)、維持管理費用 (`maintenance fee` / `維護管理費用`)、プール共有 (`shared as a pool` / `以額度池共用`)、Web 版 (`Web app` / `網頁版`)、Microsoft Store 版 (`Microsoft Store version` / `Microsoft Store 版`)、焼き込む (`burn in` / `燒錄`)、粒度 (`block size` / `馬賽克格大小`)、隠蔽率 (`coverage` / `遮蔽率`)、決済ポータル (`payment portal` / `付款入口網站`)、違約金 (`cancellation fee` / `違約金`)、超過料金 (`overage charges` / `超額費用`)、支払方法 (`payment method` / `付款方式`)、請求書払い (`invoice` / `請款單付款`)、見積り (価格の見積) (`quote` / `報價`。既存の 見積り = estimate は残り時間の意味)。

## ウェーブ末尾の E2E で確かめてほしいこと
- このチケットは表示に出ない (include が l10n を引くのは I18N-707 以降)。I18N-707・709〜711 の後で、`/en/`・`/zh-tw/`・`/en/price/`・`/zh-tw/price/`・`/en/subscribe/`・`/zh-tw/subscribe/` の料金カードと FAQ (表示と FAQPage の JSON-LD) に英中の文が出て、プレースホルダが数値に置換されていること。

## sync の状態
- サイトだけのチケット (desktop / web の共有ファイルは触っていない)。

## ロールバックの観点
- 6 ファイルとテスト 1 本を消せば戻る。I18N-707 (pricing-cards・cta-download・contract-*・faq の include) と I18N-709〜711 (英中のページ) がこのデータを引くので、それらの後に revert すると英中の料金カードと FAQ が `| default:` の ja の文に戻る (英中のページに日本語が出て lang-text の検査が落ちる)。

## 対訳表 (自己検査: 全行を読み、訳し戻しで意味・否定・条件・数字を確かめた)

### plans
| 欄 | ja | en | zh-tw |
|---|---|---|---|
| tax_note | 税別 | excl. tax | 未稅 |
| free.summary | まずは無料で試せます | Try it for free first | 可先免費試用 |
| free.bullets[0] | 初めて起動した日から 7 日間、累計 2 時間分の動画インポートが無料（登録なしは 30 分） | Import up to 2 hours of video in total for free for 7 days from the day you first launch the app (30 minutes without signing up) | 自首次啟動當日起 7 天內，可免費匯入累計 2 小時的影片（未註冊為 30 分鐘） |
| free.bullets[1] | 7 日間か累計 2 時間のどちらか早い方で無料期間は終わります | The free period ends after 7 days or 2 hours in total, whichever comes first | 免費期間於 7 天或累計 2 小時兩者中較早到達時結束 |
| free.bullets[2] | 1 台の PC では合計 2 時間まで（アカウントを作り直しても同じ） | Up to 2 hours in total on 1 PC (even if you create a new account) | 1 台 PC 最多合計 2 小時（重新建立帳號也相同） |
| free.bullets[3] | クレジットカードの登録は不要 | No credit card required | 不需登記信用卡 |
| free.bullets[4] | 無料期間の終了後も、既存プロジェクトの編集・書き出しは続けてご利用いただけます | After the free period ends, you can keep editing and exporting existing projects | 免費期間結束後，仍可繼續編輯與匯出既有專案 |
| free.cta_label | 無料でダウンロード | Download for free | 免費下載 |
| light.summary | 同人・個人撮影のクリエイター向け。月 1〜3 本のペースに合わせた枠です。 | For indie creators and individual videographers. An allowance sized for 1–3 videos a month. | 適合同人與個人拍攝的創作者。額度依每月 1 至 3 部影片的步調設計。 |
| light/pro.price_unit | / 月 | / month | / 月 |
| light.specs | 込み時間 / 月 5 時間・同時起動 / 1 台・支払方法 / クレジットカード | Included hours / 5 hours / month・Concurrent use / 1 device・Payment method / Credit card | 內含時數 / 每月 5 小時・同時使用 / 1 台裝置・付款方式 / 信用卡 |
| light/pro.cta_label | ダウンロードして申し込む | Download and subscribe | 下載並訂閱 |
| light/pro.subscribe_label | 申し込む | Subscribe | 訂閱 |
| pro.summary | フリーランス編集者・専業に近い個人向け。 | For freelance editors and individuals working close to full time. | 適合自由接案的剪輯師與接近全職的個人。 |
| pro.specs | 込み時間 / 月 20 時間・同時起動 / 1 台・支払方法 / クレジットカード・解約 / いつでも可能・違約金なし | Included hours / 20 hours / month・Concurrent use / 1 device・Payment method / Credit card・Cancellation / Anytime, no cancellation fee | 內含時數 / 每月 20 小時・同時使用 / 1 台裝置・付款方式 / 信用卡・取消訂閱 / 隨時可取消，無違約金 |
| enterprise.summary | メーカー・ポストプロダクション向け。1 アカウントから。 | For production companies and post-production houses. Starting from 1 account. | 適合製作公司與後製公司。從 1 個帳號起。 |
| enterprise.price_unit | / アカウント・月 | / account / month | / 帳號 / 月 |
| enterprise.price_note | + 維持管理費用 / 月 | + maintenance fee / month | + 維護管理費用 / 月 |
| enterprise.specs | 込み時間 / アカウント数 × 20 時間をプール共有・請求 / ご利用月ごとに請求書を発行・支払方法 / 請求書払い（銀行振込） | Included hours / Number of accounts × 20 hours, shared as a pool・Billing / An invoice is issued for each month of use・Payment method / Invoice (bank transfer) | 內含時數 / 帳號數 × 20 小時，以額度池共用・帳單 / 依使用月份開立請款單・付款方式 / 請款單付款（銀行轉帳） |
| enterprise.note | 御社のシステム・サービスへの導入（組み込み）もご相談ください。内容に応じて別途お見積りします。 | We can also discuss integrating it into your company's systems and services. We will provide a separate quote depending on the scope. | 也歡迎洽詢導入（整合）至貴公司系統與服務的相關事宜。我們將依內容另行報價。 |
| enterprise.cta_label | 導入について相談する | Talk to us about adoption | 洽詢導入事宜 |

(表の「・」は欄の区切りで、データには無い。zh-tw の enterprise.price_unit は「・」が仮名の範囲の字で lang-text に当たるため `/ 帳號 / 月` にした。)

### faq (質問だけ。回答は `_data/l10n/*/faq.yml` を参照、全文を読んで確かめた)
| # | ja | en | zh-tw |
|---|---|---|---|
| 1 | Deepmosaic はどのようなソフトですか？ | What kind of software is Deepmosaic? | Deepmosaic 是什麼樣的軟體？ |
| 2 | モザイクを除去することはできますか？ | Can Deepmosaic take existing mosaic off a video? (答え: No. … applying (adding) mosaic …) | 可以消除影片中既有的馬賽克嗎？ (答え: 無法。…) |
| 3 | すでにモザイクがかかっている動画はどうなりますか？ | What happens to videos that already have mosaic? | 已經有馬賽克的影片會怎麼樣？ |
| 4 | 映像は本当に外部に送信されないのですか？ | Is my footage really never sent outside? | 影像真的不會傳送到外部嗎？ |
| 5 | 審査に通ることは保証されますか？ | Do you guarantee that my video will pass review? (答え: No, we cannot guarantee it.) | 能保證通過審查嗎？ (答え: 無法保證。) |
| 6 | 検出漏れがあった場合はどうなりますか？ | What happens if there are missed detections? | 如果有漏偵測會怎麼樣？ |
| 7 | 一度かけたモザイクを後から外せますか？ | Can I take mosaic off later after applying it? (答え: プロジェクトなら変更可、焼き込んだ動画からは不可) | 套用後的馬賽克之後還能拿掉嗎？ |
| 8 | 処理にはどのくらい時間がかかりますか？ | How long does processing take? (倍率 1.1 / 1.3 / 2.1 / 2.8、10〜25、約 3 倍は原文どおり) | 處理需要多少時間？ |
| 9 | 無料で使えますか？ | Can I use it for free? (7 日・2 時間・30 分は原文どおり) | 可以免費使用嗎？ |
| 10 | 上限時間を超えたら処理は止まりますか？ | Will processing stop if I go over the hour limit? (プレースホルダ 4 種) | 超過時數上限後處理會停止嗎？ |
| 11 | GPU は必須ですか？ Mac には対応していますか？ | Is a GPU required? Do you support Mac? | 必須要有 GPU 嗎？支援 Mac 嗎？ |
| 12 | どの Adobe 製品と連携できますか？ | Which Adobe products does it work with? | 可以與哪些 Adobe 產品搭配使用？ |
| 13 | アプリのアップデートはどうすればよいですか？ | How do I update the app? | 如何更新應用程式？ |
| 14 | 解約はいつでもできますか？ | Can I cancel anytime? | 可以隨時取消訂閱嗎？ |
| 15 | オープンソースの DeepMosaics と同じものですか？ | Is it the same as the open-source DeepMosaics? (答え: No, it is a different product.) | 與開源的 DeepMosaics 是相同的東西嗎？ (答え: 不是，兩者是不同的產品。) |

### subscribe
| # | ja | en | zh-tw |
|---|---|---|---|
| 1 | Microsoft Store 版のアプリで申し込めますか？ | Can I subscribe in the Microsoft Store version of the app? | 可以在 Microsoft Store 版的應用程式中訂閱嗎？ |
| 2 | アプリと同じアカウントで申し込む必要がありますか？ | Do I need to subscribe with the same account as the app? | 需要使用與應用程式相同的帳號訂閱嗎？ |
| 3 | プランの変更や解約はどこで行いますか？ | Where do I change or cancel my plan? | 要在哪裡變更方案或取消訂閱？ |
