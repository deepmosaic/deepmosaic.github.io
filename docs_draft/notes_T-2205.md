# T-2205 (i18n1112 I18N-707) サイトの共通 include とトップのアイランドの英中対応

2026-11-12、役割: Implementer (テストを先に書いて RED を確認 → 実装 → 開発中のゲート → 全ゲートの各段を手元で確認。コミットは次の担当)。

## 変更点の要約
| ファイル | 内容 |
|---|---|
| `_includes/cta-download.html` | 見出しの既定・無料の枠の 2 文・OS の行・Web 版の行・`not_removal_note` を英中では `parts` / `entity` の l10n から。`not_removal_note` の `<p>` に英中のときだけ ` data-i18n-allow="mosaic_removal"` |
| `_includes/download-button.html` | 既定のラベルを英中では `parts.dl_label_default`。href を `site.data.lang.ja.app_download_link` → `site.data.lang[page.lang].app_download_link` (3 言語とも同じ URL。spec が許した書き換え) |
| `_includes/pricing-cards.html` | summary・price_unit・price_note・specs・note・cta_label・subscribe_label・bullets を `l10n plans.tiers[code]` から (`\| default:` で ja の値)。「追加契約」・税の括弧と区切り・Free の横帯の括弧と箇条の区切りを `parts` から。通貨は `currency_prefix` / `currency_suffix`。`/subscribe/#plan-<code>` と `plan.cta.href` (`/` で始まり `//` で始まらないとき)・`secondary_cta.href` に英中は `L.url_prefix`。rollout_note も l10n |
| `_includes/contract-quota.html`・`contract-limits.html` | 英中は `parts.cq_text` / `cl_item` + `cl_sep` に数値とプラン名を `replace` で差し込む (計算の式は今のまま) |
| `_includes/what-is.html` | 見出しと sub を `parts.wi_title` / `wi_sub` (section-title の include を if / else で 2 本)、`name_origin` と `definition` を l10n `entity`。2 段落目の `lang="en"` は ja のときだけ |
| `_includes/can-cannot.html`・`disclosure-table.html` | 見出しを `parts`、行を l10n `entity.can/cannot[i]`・`disclosure.network.sent/not_sent[i].item/note` (同じ添字 `forloop.index0`) |
| `src/islands/RoiCalculator.svelte` | 画面の文 17 か所を同じファイルの 3 言語の表 `TEXT` (ja は今の文字列のまま) へ。`pick(TEXT, pageLang())`。金額は `formatYenFor(lang, n)`、内訳は `planBreakdown(tier, h, lang)` |
| `src/lib/pricing.js` | `formatYenFor(lang, n)` を追加 (ja / en `¥1,000`、zh-tw `1,000 日圓`、桁区切りは常に `'ja-JP'`)。`planBreakdown(tier, hours, lang = 'ja')`。ja の経路は今のコードのまま (英中だけ `planBreakdownIntl` へ)。`formatYen` と `RangeError` の message は不変 |
| `_data/l10n/en/parts.yml`・`_data/l10n/zh-tw/parts.yml` (新規) | include の直書きの文の訳 25 キー。平らな `key: "value"` だけ (hash は持たない = W7-site.md §3) |
| `scripts/i18n/checks/parts.mjs` (新規) | check-site のモジュール (下) |
| `src/lib/i18n-site-parts.test.js` (新規) | 仕様テスト 22 本 |

- include の書き方: ja の直書き・href・Liquid の式は**ソースにそのまま残し**、`{% if <接頭辞>_P %}訳{% else %}原文{% endif %}` を原文の位置に足した。
  `<接頭辞>_P = site.data.l10n[page.lang].parts` は ja のページでは nil なので必ず原文の分岐を通る。assign は既存の `{%- … -%}` の隣に置き、空白を生まない。
- ja の出力: `ja-identity: OK (17 files)` (基点 `D:/dm-scratch/i18n/site-base/W7/_site` とバイト一致)。

## parts.yml のキー (どの include のどの文か)
| キー | include | ja の原文 | en | zh-tw |
|---|---|---|---|---|
| `cta_title_default` | cta-download | 無料でご利用いただけます | Available for free | 可免費使用 |
| `cta_free_line` | cta-download | 初回起動から{日}日間、累計{時間}時間分の動画インポートが無料。クレジットカード不要。 | Import up to %HOURS% hours of video in total for free for %DAYS% days from the first launch. No credit card required. | 自首次啟動起 %DAYS% 天內，可免費匯入累計 %HOURS% 小時的影片。不需信用卡。 |
| `cta_offline_line` | cta-download | セットアップ後はネットワークを切断した状態でも動作します。 | After setup, it works even when disconnected from the network. | 完成設定後，即使中斷網路連線也能運作。 |
| `cta_os_line` | cta-download | Windows 10 / 11（64bit） | Windows 10 / 11 (64-bit) | Windows 10 / 11（64 位元） |
| `cta_webapp_before` / `_link` / `_after` | cta-download | インストール不要の [Web 版]（Chrome / Edge 対応）もご利用いただけます。お試し用（1 本 {分} 分まで）です。動画はサーバーに送信されず、お使いのブラウザ内で処理します。 | You can also use the [Web app], which needs no installation (Chrome / Edge). It is for trials (up to %MINUTES% minutes per video). Videos are not sent to a server; they are processed in your browser. | 也可使用免安裝的[網頁版]（支援 Chrome / Edge）。僅供試用（每部影片最長 %MINUTES% 分鐘）。影片不會傳送至伺服器，而是在您的瀏覽器中處理。 |
| `dl_label_default` | download-button | Microsoft Store で無料入手 | Get it free on Microsoft Store | 從 Microsoft Store 免費取得 |
| `pc_tax_open` / `pc_tax_sep` / `pc_tax_incl` / `pc_tax_close` | pricing-cards | （税別・税込 ¥N） | ` (` / `, ` / `%PRICE% incl. tax` / `)` | `（` / `，` / `含稅 %PRICE%` / `）` |
| `pc_extra_contracts` | pricing-cards | 追加契約 | Additional subscriptions | 額外訂閱 |
| `pc_strip_open` / `pc_strip_close` / `pc_bullet_sep` | pricing-cards (Free の横帯) | （ / ） / ` ／ ` | ` (` / `)` / ` / ` | `（` / `）` / `／` |
| `cq_text` | contract-quota | 最大 {n} 契約（月 {h} 時間まで） | Up to %MAX% subscriptions (up to %HOURS% hours / month) | 最多 %MAX% 份訂閱（每月最多 %HOURS% 小時） |
| `cl_item` / `cl_sep` | contract-limits | {プラン名} は最大 {n} 契約 / 、 | up to %MAX% subscriptions for %NAME% / `, ` | %NAME% 最多 %MAX% 份訂閱 / 、 |
| `wi_title` / `wi_sub` | what-is | Deepmosaic とは / モザイクを「かける」ためのソフトです。すでに入っているモザイクを取り除くためのものではありません。 | What is Deepmosaic / Software for applying mosaic. It is not for taking off existing mosaic. | 什麼是 Deepmosaic / 這是用來「套用」馬賽克的軟體，並非用來去掉既有馬賽克的軟體。 |
| `cc_can_title` / `cc_cannot_title` | can-cannot | できること / できないこと | What it can do / What it cannot do | 可以做到的事 / 無法做到的事 |
| `dt_sent_title` / `dt_not_sent_title` | disclosure-table | 送信するもの / 送信しないもの | What is sent / What is not sent | 會傳送的資料 / 不會傳送的資料 |

- **除去の語を許したキー: 無し**。`wi_sub` も除去の語 (remove など) を使わない言い回し (`taking off` / `去掉`、I18N-704 の entity に合わせた)。
  `not_removal_note` の `<p>` には spec どおり英中で `data-i18n-allow="mosaic_removal"` を付けた (I18N-704 の訳は除去の語を使わないので無くても通るが、付けても害は無い)。

## RoiCalculator の表 (ja → en / zh-tw)
| キー | ja | en | zh-tw |
|---|---|---|---|
| videosLabel / videosValue | 月間の本数 / {n} 本 | Videos per month / {n} video(s) | 每月影片數 / {n} 部 |
| lengthLabel / lengthValue | 1 本の完成尺 / {h} 時間 | Finished length per video / {h} hour(s) | 每部影片的成品長度 / {h} 小時 |
| costLabel / costHelp | 現状の 1 本あたりコスト / 社内で行う場合は「作業時間 × 時給」、外注の場合は発注単価を入れてください。 | Current cost per video / For in-house work, enter "work hours × hourly wage". For outsourced work, enter the unit price you pay. | 目前每部影片的成本 / 若在公司內部作業，請輸入「作業時數 × 時薪」；若委外，請輸入委託單價。 |
| hoursLabel / hoursValue | 月間の消費時間 / {h} 時間 | Hours used per month / {h} hour(s) | 每月使用時數 / {h} 小時 |
| planLabel / perMonth | 適合プラン / ` / 月` | Best-fit plan / ` / month` | 適合的方案 / ` / 月` |
| enterpriseHint | 月 {h} 時間を超える運用は複数人での利用が想定されるため、Enterprise もご検討ください。 | Usage over {h} hours a month is likely to involve several people, so consider Enterprise as well. | 每月超過 {h} 小時的使用量通常會由多人共同使用，建議您也考慮 Enterprise。 |
| currentLabel / dmLabel / savingLabel | 現状の年間コスト / Deepmosaic の年間費用 / 年間の差額 | Current annual cost / Annual cost of Deepmosaic / Annual difference | 目前的年度成本 / Deepmosaic 的年度費用 / 年度差額 |
| savingNone | この作業量では現状のコストの方が低くなります。 | At this workload, your current cost is lower. | 以此作業量而言，目前的成本較低。 |
| manualLabel / manualNote | 手作業の想定 / Deepmosaic は処理中の操作が不要で、完了後の確認作業のみです。 | Estimated manual work / Deepmosaic needs no operation while it processes. You only review the results after it finishes. | 手動作業的估計 / Deepmosaic 在處理期間不需要操作，只需在完成後確認結果。 |

- `planBreakdown` の英中: en `3 subscriptions (15 hours / month included)`・`1 account (20 hours shared as a pool)`・`2 hours in total`・`Unlimited`・`7-day free trial available`、区切り ` · `。
  zh-tw `3 份訂閱（每月含 15 小時）`・`1 個帳號（20 小時以額度池共用）`・`累計 2 小時`・`無限制`・`提供 7 天免費試用`、区切り `，`。
  ja の区切り ` ・ ` の中黒 (U+30FB) は仮名の範囲なので英中では使わない。

## 追加したテスト・検査
- `node --test src/lib/i18n-site-parts.test.js` (22 本): 既存テストの照合の対象 (t1656 の文・t1444 の 1 行・t942 の税込・t1922 の分岐の順と href・t1941 の `if plan.note`・t1917 の `<a … app_download_link … data-dl>`) が残っている陽性対照 /
  8 つの include が `site.data.lang.ja.` を持たず `page.lang` を持つ / include が引く parts のキーが en・zh-tw の両方にある /
  英中の href の接頭辞 / not_removal_note の印 / what-is・can-cannot・disclosure-table の l10n の引き方 / parts.yml のキーの集合・印・lintValue・括弧の形 /
  `formatYenFor`・`planBreakdown` (ja は引数なしと同じ、英中は数値が同じで仮名なし・lintValue を通る) / `RangeError` と `formatYen` のソースが不変 /
  RoiCalculator の表のキーの集合・ja の文・英中の lintValue・マークアップに日本語の直書きが無い / `checks/parts.mjs` の陽性対照と陰性対照 (作った `_site` の模型)。
- `scripts/i18n/checks/parts.mjs` (check-site): `en/`・`zh-tw/` のページで同じパスの ja のページがあるものについて、料金カードの数・プラン名・価格と税の注記の数値・Free の横帯の数値が ja と同じ、
  zh-tw に `¥` が無く `日圓` がある、data-dl の値の多重集合が ja と同じ、cta-download の not_removal_note の `<p>` が `data-i18n-allow="mosaic_removal"` を持つ。英中のページがまだ無い今は何もしない。

## ゲートの結果 (手元)
- 開発中: `node --test src/lib/i18n-site-parts.test.js src/lib/pricing.test.js` → 48 pass / 0 fail
- `npm test` → 913 件 (910 pass / 0 fail / 3 skip)
- `npm run build && bundle exec jekyll build --strict_front_matter` → OK
- `node scripts/check-docs.mjs` → OK / `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site` → OK (17 files) / `node scripts/i18n/check-site.mjs _site` → OK (5 モジュール)
- `git diff --stat` と `--ignore-cr-at-eol` の行数が一致 (pricing-cards・download-button は CRLF のまま)。
- 描画の確かめ: probe (`en/probe-707.html`・`zh-tw/probe-707.html`) に 8 つの include と `data-island="roi"` を並べてビルドし、英中の出力を目で読み、check-site (lang-text を含む) が OK、
  `parts.mjs` の正規表現が実際の料金カード (ja の `/`・`/price/` と probe) を拾うことを確かめてから消した (`git status` に残っていない)。

## 置いた仮定・spec / 設計書との食い違い
1. **分岐の条件は `page.lang == 'ja'` ではなく l10n の有無 (`{% if cd_P %}`)**。`cd_P = site.data.l10n[page.lang].parts` は ja (と page.lang が無いページ) で nil になるので、
   ja の分岐を必ず通る (page.lang が欠けても英中の分岐に落ちない安全側)。spec のテストの「各 include が `page.lang` を持つ」は assign の行で満たす。
2. **probe のファイル名**: W7-site.md §5 の `en/_probe.html` は Jekyll が `_` で始まるファイルを読まないので出力されない。`en/probe-707.html` (permalink `/en/_probe/`) で確かめた。後のチケットへの申し送り。
3. what-is の section-title は、include の引数に英中の値を渡すため `{% if %}{% include … 英中 %}{% else %}{% include … ja (今の呼び出しのまま) %}{% endif %}` の 2 本にした
   (parity は英中のページのソースの include の並びを見るので、ページ側には影響しない)。
4. pricing-cards の download-button の呼び出しも同じく if / else の 2 本 (ja の `label=plan.cta.label` をソースに残すため)。
5. `plan.badge` (今の ja のデータに無い) と `secondary_cta.label` (今使うプランが無い) は l10n に欄が無い。badge はそのまま、secondary_cta は `pc_T.secondary_cta_label | default:` と行き先の接頭辞だけ用意した。
6. en の時間の単位は `hour` / `hours` (1 のときだけ単数)。0.5 などは `hours`。parts.yml の `%HOURS% hours` は今の値 (2・15・40) では常に複数なので plural を書いていない (1 になったら `1 hours` になる。W8 で plural にするか判断)。
7. Free の横帯の箇条の区切りは en ` / `、zh-tw `／` (前後に空白なし = 全角の記号の規則)。
8. 「追加契約」は用語集の 契約 = subscription / 訂閱 (プランの契約) に合わせて `Additional subscriptions` / `額外訂閱`。量詞は `份訂閱`。
9. desktop のアプリの辞書から写した文は無い (サイトの文だけ) ので、`scripts/i18n/glossary.source.json` は触っていない。「Web 版」は I18N-703 と同じ `Web app` / `網頁版`。
10. `formatYenFor` は `'zh-TW'` (大文字) も zh-tw として扱い、知らない言語は ja と同じ表記。

## 直したいが直さなかった ja の文
- 無し。

## 用語集の追加の候補 (W8 の I-86 へ)
- 追加契約 (`additional subscriptions` / `額外訂閱`)、完成尺 (`finished length` / `成品長度`)、適合プラン (`best-fit plan` / `適合的方案`)、
  プール共有 (`shared as a pool` / `以額度池共用`、I18N-703 と同じ)、お試し用 (`for trials` / `僅供試用`)、無料トライアル (`free trial` / `免費試用`)。

## L11 / L13 / L16 / L17 の警告
- サイトには desktop の i18n-lint が無い (lintValue だけ)。数える文は量詞 (部・份・個・小時) を付けた。連結は parts の印の置き換え (`replace`) と `join` だけで、文を `+` で組み立てていない。

## 英中のページ (I18N-709〜711) への申し送り
- `{% include cta-download.html title=… secondary_href=… secondary_label=… %}` の `title` / `secondary_label` は呼び出し側が訳を渡す (title を省けば `cta_title_default`)。`secondary_href` に言語の接頭辞を付けること (例 `/en/price`)。
  `sub` を渡すなら訳を渡す。
- `faq.html` は `items=site.data.l10n[page.lang].faq.items`、`kv-table.html` は `rows=site.data.l10n[page.lang].spec.<欄>` のように訳を渡す (I18N-703 / 704 の notes)。
  `section-title.html` の `kicker` / `title` / `sub` も訳を渡す。
- pricing-cards・what-is・can-cannot・disclosure-table・contract-quota・download-button は引数なしで英中になる (page.lang で切り替わる)。
- `data-island="roi"` は `<html lang>` で言語を選ぶので、英中のページでも ja と同じ属性で置けばよい。
- `VideoLightbox.svelte` はどのページからも使われていない (`data-island="video-lightbox"` の参照 0。`src/main.js` の mount だけ) ので触っていない。

## ウェーブ末尾の E2E で確かめてほしいこと
- I18N-709〜711 の後で、`/en/`・`/zh-tw/` の ROI 計算機: ラベル・単位 (`6 videos` / `6 部`、`2 hours` / `2 小時`)・`¥` と `日圓`・内訳文・Enterprise の案内・差額 0 の文が英中で出て、日本語が残らないこと。スライダーで 1 本 / 1 時間にしたとき en が単数になること。
- `/en/price/`・`/zh-tw/price/` の料金カード: 申し込むボタンが `/en/subscribe/#plan-light` などへ、Enterprise が `/en/enterprise/inquiry/` へ行くこと。DL ボタンの GA4 の link_id が ja と同じ。
- ja の `/`・`/price/`・`/spec/` の表示が変わっていないこと (ja-identity で確認済み)。

## sync の状態
- サイトだけのチケット (desktop / web の共有ファイルは触っていない)。

## ロールバックの観点
- revert すると include は ja の直書きだけに戻り、英中のページ (I18N-709〜711) の料金カード・CTA・what-is などに日本語が出て lang-text の検査が落ちる。parts.yml と `checks/parts.mjs` は一緒に消える。
- I18N-703 / 704 の l10n は読むだけなので影響しない。

## レビューの指摘への対応 (Fixer)
- HIGH (テストが LF の前提): `src/lib/i18n-site-parts.test.js` の `read()` で CRLF を LF にそろえて読むようにした。RoiCalculator.svelte・pricing-cards.html・pricing.js を一時的に CRLF にして実行し、23 本とも通ることを確かめた (確認後に元へ戻した)。
- LOW (バッジ): `pricing-cards.html` のバッジを `{% if pc_PL %}{{ pc_T.badge | default: plan.badge }}{% else %}{{ plan.badge }}{% endif %}` にそろえた。今の plans.yml は badge を持たないので出力は変わらない。ja に badge を戻したら l10n の tiers.<code>.badge に訳を足すこと (足さないと英中に日本語が出て lang-text が捕まえる)。
- LOW (rollout_note): 英中は `pc_PL.rollout_note | default: site.data.plans.rollout_note` にして、空の <p> にならないようにした (訳が無いときは ja が出て lang-text が捕まえる)。
- LOW (pricing.js): `planBreakdown` の言語の表を `Object.hasOwn` で引くようにした。'constructor' / '__proto__' / 'toString' / 'fr' / '' / null / undefined が ja に戻るテストを足した。
