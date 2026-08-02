# CHANGELOG

## 2026-08-02 - Feature: 「モザイク除去アプリ」という誤認の是正 (SEO / AI 認識)

「モザイクを **除去** するアプリ」だと誤認して DL・利用するユーザーが後を絶たない、
という報告を受けての対応。検索エンジンと AI（ChatGPT / Claude / Perplexity /
AI Overviews）の双方に、製品の **方向**（モザイクを付加する側）を認識させる。

調査の結論: 原因は「誤誘導する文言がある」ことではない。**「除去」「解除」
「uncensor」は製品説明文脈に 1 件も存在しなかった**。問題は逆で、
**方向を明示している箇所がほぼ無かった**こと。サイトの主要動詞は「モザイク処理」
「モザイク作業」で、日本語としてかける／外すの両方向を指す。h1 も `<title>` も
方向が空白で、FAQ 10 件に「除去できますか」は無かった。

### Phase 0 — 遮断の解除

- [ ] TICKET-SITE-24: Cloudflare の AI クローラ遮断と Managed robots.txt を解除（運用作業・コミットなし）

### Phase 1 — 単一真実源

- [x] TICKET-SITE-25: `_data/entity.yml` 新設（製品定義・できること／できないこと・分類）

### Phase 2 — 人が読む面

- [x] TICKET-SITE-26: HERO に kicker を追加 + `hero.sub` をカテゴリ宣言に + `_includes/what-is.html` 新設
- [x] TICKET-SITE-27: FAQ に誤認訂正の Q&A を 3 件追加（10 → 13 件）
- [x] TICKET-SITE-28: DL ボタン直下の注記行 + `/price/` `/spec/` のリード文に製品カテゴリ
- [x] TICKET-SITE-29: `/mosaic-removal/` 新設 + フッター導線 + `_includes/can-cannot.html` 抽出
- [x] TICKET-SITE-30: `/docs/` の定義文に否定を追記 + 「透けます」を書き換え

### Phase 3 — 機械が読む面

- [ ] TICKET-SITE-31: head の是正（`seo_title` 導入 / title サフィックス / meta robots / keywords・hreflang 削除）
- [ ] TICKET-SITE-32: JSON-LD 強化（`@id` / `disambiguatingDescription` / `featureList`）
- [ ] TICKET-SITE-33: `llms.txt` / `llms-full.txt` 新設 + `robots.txt` に方針を明文化

### Phase 4 — 画像

- [ ] TICKET-SITE-34: 画像 alt を方向が伝わる文面へ（+ `index.html:190` の alt 不一致を修正）
- [ ] TICKET-SITE-35: ヒーロー画像をモザイク適用済みのキャプチャへ差し替え

### Phase 5 — 回帰防止

- [ ] TICKET-SITE-36: CI に素通しファイルの HTML 化検知と主要文言のガードを追加

---

### 語彙ポリシー（この対応の中核となる判断）

「除去」という語を **置く面と置かない面を厳密に分ける**。打ち消しコピー自体が
「モザイク 除去」クエリとの関連度を上げ、**より多くの誤認流入を呼び込む逆効果**を
持つため。

| 面 | 「除去／解除」 | 理由 |
|---|---|---|
| `<title>` / h1 / kicker / トップ本文 | 置かない（「取り除く」で言い換え） | ランキング要因。汚すと除去クラスタへ引き寄せられる |
| トップの `meta description` | 置く（1 句） | ランキング要因ではなくスニペット専用。SERP でゼロコスト濾過できる |
| `_data/faq.yml` の質問文 | 1 件だけ置く | ユーザー自身が Ctrl+F / 検索窓に打つ語に一致させる価値が上回る |
| `/mosaic-removal/` | ここに集中 | 封じ込めシンク。**他社ツールへのリンクは張らない**（トピック関連性を渡すため） |
| JSON-LD / `llms.txt` | 置く | 検索順位に無関係な面 |

「モザイク除去」ヘッドタームを正面から狙わないのも同じ理由。あの SERP は
無修正化ツールのクラスタで、そこへ入ると Deepmosaic というエンティティが
そのクラスタへ引き寄せられる。9 ページ・被リンク僅少のブランドサイトでは
**リスクだけ取ってリターンが出ない**。`/mosaic-removal/` はブランド修飾の
ロングテール（`deepmosaic 除去` 等）だけを取りにいく。

### TICKET-SITE-25 の記録 — `_data/entity.yml`

訂正文はトップ本文 / JSON-LD の `disambiguatingDescription` / `llms.txt` / FAQ /
`/mosaic-removal/` の 5 面に出す必要があるが、**文面が食い違うと訂正として
機能しない**。単一真実源を切った。

採用した定義文の構造は「主語 → 動作 → 対象 → カテゴリ」で 1 文目を自己完結させ、
否定を独立した 2 文目にする形。**どこで切られても誤認が生じない**のが狙いで、
1 文目だけ抜き出されても製品が確定し、2 文目だけ抜き出されても主語が残る。

> Deepmosaic は、動画に映った対象（局部・顔）を AI が自動検出し、その領域に
> モザイクをかける Windows デスクトップアプリケーションです。モザイクを
> 除去・復元する機能はありません。

検討して**採らなかった**案:

- 「Deepmosaic はモザイクを『かける』ソフトです。モザイク除去ソフトではありません。…」
  — 2 文目で「モザイク除去ソフト」という文字列が**製品名の直後**に来る。断片引用で
  共起だけが残る危険があり、SERP タイトルにも出やすい
- 「モザイク処理を AI で自動化する〜」を 1 文目にする案 — 「モザイク処理」は
  方向を含まないので、1 文目だけでは誤認が残る（現行サイトの失敗そのもの）

### TICKET-SITE-26 の記録 — h1 を変えなかった理由

h1「モザイク作業を／最終確認だけに。」は TICKET-SITE-06 で根拠付きで決めた
ブランドコピーなので温存し、直前に kicker を 1 行足して方向を補う形にした。
h1 自体を「モザイクをかける作業を」に変える案も検討したが、コピーの決定を
SEO の都合で上書きしないことを優先した。`section-title.html:10` が既に
`kicker` の概念を持っているのでデザイン言語としても整合する。

`hero.sub` は第 1 文を差し替えた。移行前は「AIが全編を検出してトラッキングし」で
終わっており、**検出した後に何をするのか（モザイクをかける）が書かれていなかった**。
LLM は先頭付近の自己完結した文を製品定義として抜き出すため、ここが空白だと
誤認が訂正されない。

`_includes/what-is.html` は hero の定義文を**繰り返さず**、できること／できないことの
列挙に専念する。表・箇条書き・対比は LLM が最も抽出しやすい形式で、「できないこと」を
独立した見出し付きリストにすることで「モザイク除去はできるか」という質問に
**回答可能な塊**が本文中に生まれる。

### TICKET-SITE-27 の記録 — FAQ の配置順

先頭 2 件（「どのようなソフトですか」→「除去できますか」）は**配列の位置そのものが
設計判断**。表示の 1・2 番目になると同時に FAQPage JSON-LD の `mainEntity[0]/[1]` に
なり、LLM は前方の要素を優先的に拾う。肯定 → 否定の順にしたのは、否定から始めると
ページが弁明調になるため。

`_includes/faq.html`（表示）と `_includes/schema/faq.html`（JSON-LD）が
`_data/faq.yml` の同一データ源から生成されるので、**YAML に足すだけで両方に反映**
された。include 側は無改修。TICKET-SITE-05 で作った構造の配当。
`Accordion.svelte` も `querySelectorAll('details')` で件数非依存なのでアイランド側も無改修。

### TICKET-SITE-28 の記録 — 打ち消しをどこに置くか

**採用**: ヒーロー CTA 直下の注記行 / `cta-download.html` の注記行 /
`/price/` `/spec/` のリード文 / FAQ。`cta-download.html` は トップ末尾・`/price/`・
`/spec/` の 3 箇所で展開されるので、**1 箇所の変更で 3 つの DL ボタンを塞げる**。

注記行は既存の ✓ 付き 3 項目 flex 行には**混ぜていない**。利点リストに否定文が
並ぶと読み手が引っかかるため、✓ なしの独立行にして「事実の但し書き」として読ませる。

**不採用**とその理由:

- h1 上のバッジ — TICKET-SITE-18 でレビュー指摘により削除済みの形式。同じ位置に
  同じ形で戻すのはその判断を無効化する。kicker があれば同じことを 2 回言うだけになる
- 独立した打ち消しセクション — 誤認ユーザーはヒーローで DL するので下部の
  セクションには到達しない。かつ「除去」語の露出面積が最大になる
- DL ボタン押下前の確認ダイアログ — 全訪問者に摩擦を課す一方、誤認ユーザーは
  「はい」を押すだけで通過率が高い。JS 無効時は素通りで中途半端
- フッター — TICKET-SITE-19 で会社説明ブロックを削除済み。全ページ共通なので
  `/company/privacy` 等にも出て、誤認削減に寄与しないページを冗長にする

### TICKET-SITE-29 の記録 — `/mosaic-removal/`

「モザイク除去」ヘッドタームを狙いにいくページではない。**サイト内で「除去」という
語を 1 URL に集中させるシンク**であり、SERP のタイトルに「モザイク除去ソフトでは
ありません」と出して**クリック前に自己判定させる**のが主目的。

設計上の縛りを 3 つ、ファイル冒頭のコメントにも残した:

- **`noindex` を付けない。** 付けたらインターセプトが成立しない
- **他社ツールへのリンクを張らない。** 「除去したい人はこちらへ」と親切心で外部
  リンクを張ると無修正化クラスタへトピック関連性を渡してしまい、封じ込め設計が崩れる
- **ダウンロードボタンを置かない。** 誤認して来た人を DL へ誘導するのは目的に反する

配置はリポジトリ直下の `mosaic-removal.html` + `permalink: /mosaic-removal/`。
`src/app.css:11` の `@source "../*.html"` が直下の .html を既に走査しているため、
新ディレクトリを作る場合に必要な `@source` 追加が要らない（`/spec/` 新設時は
TICKET-SITE-01 で追加が必要だった）。

`can` / `cannot` の 2 カラム markup はトップの「Deepmosaic とは」と共通なので
`_includes/can-cannot.html` に抽出した。

**フッターのアンカーテキストに「除去」が入る件**（＝全 11 ページに 1 回ずつ出る）は
意図的。ビルド出力で確認した分布は以下で、`<title>` / `<h1>` / 本文への混入は無い:

| ページ | 「除去」出現 | 内訳 |
|---|---|---|
| `/mosaic-removal/` | 10 | シンク本体 |
| `/`（トップ） | 3 | FAQ 質問文（表示 + JSON-LD）+ フッター |
| その他 9 ページ | 各 1 | フッターのアンカーのみ |

フッター内リンクはボイラープレートとして強く減点される位置であり、かつ
**アンカーテキストは「このURLがモザイク除去について書かれたページだ」という
関連度をシンク側へ渡す**ので、封じ込め設計と矛盾しない。

### TICKET-SITE-30 の記録 — `/docs/` の「透けます」

`docs/index.html` の不透明度の説明「モザイク/ぼかしの濃さ（0〜100%）。**下げると
元の映像が透けます**」は、意味としては正しいが**単独で抜粋されると「モザイクを
透かせる機能がある」と誤読され得る**、サイト内で唯一の表現だった。意味を保ったまま
「値を下げるほど隠蔽が弱くなる」に言い換え、既存の確定語彙（隠蔽率）に寄せた。
あわせて運用上の既定（通常は 100%）を明示している。

同じ設定をトップの MOSAIC タブでも説明しているため、`_data/mosaic.yml` の
「濃さ」も「不透明度」に統一した。

## 2026-07-26 (2) - Fix: 刷新後のレビュー指摘の反映 + 料金プランをデザイン準拠へ

ユーザーレビューによる指摘 5 件。うち 4 件は文言・表記の削除で、1 件 (料金プラン) は
Phase 2 に予約していた `TICKET-SITE-20` の前倒し。

- [x] TICKET-SITE-17: セクションタイトルの読点を除去 (計 7 箇所)
- [x] TICKET-SITE-18: HERO の「セットアップ後はオフラインで動作」バッジを削除
- [x] TICKET-SITE-19: フッターの会社概要ブロック (説明文・社名・住所・メール) を削除
- [x] TICKET-SITE-20: 料金プランを新デザイン準拠の 3 プラン + Free 帯に刷新
- [x] TICKET-SITE-21: 特商法ページから郵便番号・所在地・電話番号の行を削除
- [x] TICKET-SITE-22: 登録デバイス表記を「同時起動 1 台」に統一
- [x] TICKET-SITE-23: 無料トライアルの表記を全廃 + Pro に「最も選ばれています」バッジ

> 予約 ID の変更: 当初 `TICKET-SITE-20` は「`/price/` 3 プラン刷新 (課金実装がゲート)」、
> `TICKET-SITE-21` は「`free.hours` 6→3 切替」として Phase 2 に予約していた。
> 20 は前倒しでここで消化し、21 は特商法ページの修正に振り替えた。
> Free 6→3 の切替は front 側の `FREE_USAGE_LIMIT_SECONDS` 変更と同時に行う。

### TICKET-SITE-17 — 読点の除去

対象 7 箇所 (`index.html` の front matter title / `_data/site.yml` の `hero.headline_lead` /
RELIABILITY・MOSAIC・INTEGRATION の `section-title` / PRIVACY の h3 / `spec/index.html` の CTA 見出し)。

`company/privacy.html` と `company/terms.html` の条文見出し (「通知・公表または同意取得の方法、
利用中止要請の方法」等) は **対象外**。あれは列挙の読点で、体言止めの区切りとして入れている
セクションタイトルの読点とは役割が違う。

### TICKET-SITE-19 / 21 — 住所・電話番号の削除

フッターの会社概要ブロックと、特商法ページの「郵便番号 / 所在地 / 電話番号」の 3 行を削除した。
`_includes/schema/organization.html` (JSON-LD) には元々住所・電話番号を持たせていないので、
構造化データ側に表記が残ることはない。

⚠️ **特定商取引法の表示義務との関係は要確認。** 通信販売の広告では「販売業者の氏名 (名称)・
住所・電話番号」が表示義務の対象とされており、消費者庁の運用では省略可能な項目に含まれない
と理解している。加えて決済事業者の審査でこの 3 項目を求められることが多い。削除自体は
指示どおり実施したが、公開前に判断を確認すること。残す場合の代替として「請求があれば
遅滞なく開示する」旨を明記する方式がある。

### TICKET-SITE-20 — 料金プランの刷新

新デザイン (`.dc.html` L422-490 / L629-692) 準拠。**有料 3 プランをカードで並べ、Free は
その下の横帯**にする (4 枚並べるとカードが細くなり仕様行が読めない)。振り分けは
`_data/plans.yml` の `display: card | strip`。

| | 月額 (税別) | 込み時間 | 超過単価 | その他 |
|---|---|---|---|---|
| Light | ¥2,980 | 月 5 時間 | ¥800/時間 | 未使用分は翌月繰越 (最大 10 時間) |
| Pro (featured) | ¥9,800 | 月 40 時間 | ¥500/時間 | 「最も選ばれています」バッジ |
| Enterprise | ¥8,000 / シート | シート数 × 40 時間をプール共有 | ¥300/時間 | 最低 3 シート・請求書払い |
| Free (帯) | ¥0 | 累計 6 時間 | — | クレジットカード不要 |

いずれのプランも **同時起動は 1 台** (TICKET-SITE-22)。デザインの「2 台（同時起動 1 台）」は
登録 2 台がアプリ側で未実装 (device_lock は単一端末 + takeover) なので、実装済みの
「同時起動 1 台」だけを書く。`rollout_note` の対象からも外した。

**無料トライアルは全廃** (TICKET-SITE-23)。クレジットカードを登録しなければ全員が Free
プランとして使えるので、試用期間を別に用意する意味がない (再トライアルの穴も作らない)。
`plans.yml` の `trial_days` は全プラン 0 で、`trial_days > 0` 駆動だったバッジは
データ駆動の `badge` フィールドに置き換えた (Pro = 「最も選ばれています」)。
サイト側の表記は `docs/`・`faq.yml`・カード・CTA からすべて外した。
**アプリ側の機能としての 7 日トライアル削除は front リポジトリ側の作業**
(`auth/env.rs::TRIAL_DAYS` / `auth/license.rs` / `src/lib/license.ts` / Stripe /
Supabase)。front の CHANGELOG を参照。

変更したファイル: `_data/plans.yml` (SSOT) / `_includes/pricing-cards.html` /
`_includes/download-button.html` (`variant` 追加) / `index.html` (PRICING 節・noscript・比較表) /
`price/index.html` (全面書き換え) / `docs/index.html` / `_data/faq.yml` /
`src/islands/RoiCalculator.svelte` / `src/lib/pricing.js` (新規) / `src/lib/pricing.test.js` (新規)。

**デザインからあえて変えた点** (いずれも「実在しないものは出さない」既存方針の維持):

1. **Free の込み時間は 6 時間のまま** — デザインの既定は 3 だが、アプリの
   `auth/env.rs::FREE_USAGE_LIMIT_SECONDS` は 6h を強制している。3 と書くと実挙動と食い違う
2. **「時間の計測ルール」表は移植しない** — デザインの 7 行のうち「同一ファイルの再処理は
   非計上」「インポート前の金額提示」「月額上限キャップ」「決済失敗時の 7 日猶予」は
   アプリ側で未実装。実装済みの計測仕様だけを `/docs/#usage` から参照させる形にした
3. **Enterprise の CTA は「デモに申し込む」→「導入について相談する」** — 予約基盤が無いため
   「申し込む」は約束になる (Phase 1 の削除方針を踏襲)
4. **リード文はサイト上での申し込みを約束せず、アプリ内手続きへ誘導する** — デザインの
   「上限時間と超過単価をすべて明記しています…」の代わりに、有料プランの申し込みが
   アプリ内 (プラン管理 → 決済ポータル) で行われる旨を書く。サイトに Checkout 導線が
   無いことと矛盾しない

**未実装であることの開示** — 上限時間・超過課金・登録デバイス数はアプリ側で未強制なので、
`plans.yml` の `rollout_note` が料金カード直下に注記を出す。トップ / `/price/` / `/docs/` の
3 箇所で同じ文が出る。課金実装 (front の TICKET-BILL Phase 1〜6) の出荷後に
`rollout_note: ""` とすれば注記だけが消え、他は 1 文字も変えなくてよい。

**ROI 計算機の修正 (実害のあったバグ)** — Enterprise の `included_basis: pooled` を
単純な「基本料 + 超過」で計算すると最低シート数を無視して **1 シート分 ¥8,000** になり、
Light (¥8,580) より安く見えて常に Enterprise が「適合プラン」に選ばれていた。
`seatsFor()` で `max(min_seats, ceil(hours / included_hours))` を取るよう修正。

計算ロジックは DOM 非依存の純関数として `src/lib/pricing.js` に切り出し、Node 組み込みの
test runner で回帰を固定した (`npm test` = `node --test src/lib/*.test.js`。vitest / jsdom は
足していない)。テストは **`_data/plans.yml` の実データを読む**ので、料金を変えると落ちる。
CI (`.github/workflows/jekyll.yml`) の build ジョブにも入れたので、表示と計算機が食い違った
まま公開されることはない。

実測での確認 (Jekyll serve + CDP):

| 月間 | 適合プラン | 月額 | 内訳 |
|---|---|---|---|
| 12h (既定) | Light | ¥8,580 | 月 5 時間込み ・ 超過 ¥800/時間 ・ 翌月繰越 (最大 10 時間) |
| 14h | Pro | ¥9,800 | 月 40 時間込み ・ 超過 ¥500/時間 ・ 7 日間トライアル |
| 90h | Enterprise | ¥24,000 | 3 シート (120 時間をプール共有) ・ 超過 ¥300/時間 |

既定値の年間削減額は ¥1,625,040 (現状 ¥1,728,000 − Deepmosaic ¥102,960) で、
移植時に設計した期待値と一致。

**副作用として直したもの** — `/price/` に h1 が無く見出し階層が h2 から始まっていたのを修正
(`title` + パンくず + `breadcrumb` schema を `/spec/` と同じ形に揃えた)。
`index.html` の noscript が `site.data.plans.tiers[1]` を index で参照しており、プランを
増やすと別プランを指す事故になっていたのを確定値の直書きに変更。

## 2026-07-26 - Feature: 売上拡大施策に基づくサイト刷新 (Phase 0+1)

設計: `front/docs/deepmosaic-growth-strategy.md` 施策③ (SEO) / ④ (訴求の変更) / ⑦ (変換資産)
新デザイン: Claude Design "Deepmosaic Site Renewal"

**移植方針** — 新デザインは 4 ページを 1 ファイルに内包した SPA 形式 (`state.page` 切替) で
URL が変わらず、施策③ の中核である SEO が構造的に成立しない。よって **4 ページに分割**して
既存 URL にそのまま載せる (`/` `/price/` `/docs/` + 新設 `/spec/`)。**リダイレクトは一切不要**。

公開は段階移行にする。新デザインには **まだ存在しない製品・機能・実績への言及** が広範に
含まれるため (Mac 版 / Light・Enterprise プラン / 確認支援ビュー / 検査結果 PDF / 導入事例)、
一括公開すると施策④ が獲得しようとしている信頼そのものを壊す。

### Phase 0 — 基盤 (見た目変化ゼロ)

- [x] TICKET-SITE-01: デザイントークン14種追加 + components 層 + `@source` に `/spec/` 追加
- [x] TICKET-SITE-02: `icon.html` に lucide 14種追加 + 1行→複数行整形
- [x] TICKET-SITE-03: `_data/` 新設 (site/plans/faq/spec/disclosure/mosaic) — 料金と数値の単一真実源
- [x] TICKET-SITE-04: `_includes` 新設 (kv-table/pricing-cards/cta-download/faq/disclosure-table)

### Phase 1 — トップ刷新 + /spec/ 新設

- [x] TICKET-SITE-05: description のページ単位化 + JSON-LD 分離 + jekyll-seo-tag 除去
- [x] TICKET-SITE-06: トップ前半 (HERO / TRUST BAR / STATS / COMPARISON) — 未検証の数値は出さない
- [x] TICKET-SITE-07: 未検証の数値と未実装機能の言及を全ページから棚卸し
- [x] TICKET-SITE-08: 実測値の取得 (`detection_runs` から算出)
- [x] TICKET-SITE-09: `RoiCalculator.svelte` アイランド (React 廃止)
- [x] TICKET-SITE-10: トップ後半 (RELIABILITY / STANDARDS / PRIVACY / WORKFLOW / DISCLOSURE / FAQ / CTA)
- [x] TICKET-SITE-11: `/spec/` 新設 (Mac は「開発中」表記のみ、DL ボタンなし)
- [x] TICKET-SITE-12: フッター再構成 + 全未接続リンク接続 + `price/index.html:54` の切れた導線修正
- [x] TICKET-SITE-13: 画像最適化 (WebP / width,height / loading / srcset)
- [x] TICKET-SITE-14: 未参照アセット削除 (`assets/img/docs/` 22MB / `assets/videos/` 14MB)
- [x] TICKET-SITE-15: SEO 配管 (sitemap 復活 / robots.txt / meta_desc 誤記 / front matter title)
- [x] TICKET-SITE-16: `/docs/` 差分マージ (`#review` `#usage` 追加、既存アンカーID は不変)

### ヒーローコピーの確定

新デザインの既定は B 案「1本8時間のモザイク作業を、40分に。」だが、**2 つの数値がいずれも
現時点で出せない**ため、B の構造 (工数削減訴求) を維持しつつ数値を外した形に確定した。

- 「8時間」 — 社内にデータが無い (ユーザー確認で根拠なしと確定)
- 「40分」 — 比較表で「うち目視確認 約35分」と内訳が定義されており、**確認支援ビュー
  (未実装) で「抽出された数十箇所だけ確認する」前提の数値**。現状の製品では 2 時間の作品は
  全編目視になる

確定コピー:

> **モザイク作業を、最終確認だけに。**
> 処理はすべてお使いのPC内で完結します。AIが全編を検出してトラッキングし、
> あなたは検出結果の確認と修正だけを行います。

根拠となる実装済み機能: AI 検出 + SeqTrack トラッキング / 検出結果の編集 (bbox 追加・削除・
ドラッグ) / **欠落フレームジャンプ (`[` `]`)** / モザイク焼き込み書き出し / Premiere Pro 連携 /
完全ローカル処理。数値は `_data/site.yml` 経由にして、実測が取れたら 1 行で差し替えられる形にする。

### 意図的に出さない要素

実在しない導線は **リンク先を用意するのではなく要素ごと削除**する。「準備中」ボタンや
グレーアウトは、このサイトが獲得しようとしている信頼を毀損する。

- **導入事例カード2枚** — 実在顧客なしの公開は景表法 (優良誤認) に該当。取材完了後に追加
- **検査結果 PDF** — カードごと削除。同じ行の「オフラインでの動作」(実在・ユーザー自己検証可能
  = 最も強い証明) を 2 カラム幅に拡大
- **資料ダウンロード** — PDF 未作成
- **デモ申込** — 「導入について相談する」に改名 (予約基盤が無いため「申し込む」は約束になる)
- **料金3プランカード** — Phase 1 では出さない。アプリが「Pro 無制限」を売っている状態で
  3 プランを出すと特商法・景表法の実害
- **DISCLOSURE の伏字「○時間・○シーン」** — 節は残し「検出率の実測値は、計測条件とあわせて
  公開します」に書き換え

### TICKET-SITE-05 の記録

**description のページ単位化** — 移行前は全ページが同一の `meta_desc` を出しており、
`description` を持つページが **1 つも無かった**。リポジトリ `CLAUDE.md` の
「全ページに layout / title / description を必ず指定 (SEO)」という規約が守られていない
状態だったので、規約に合わせた。`og:title` もページ単位にした。

**構造化データを `_includes/schema/*` へ分離** し、front matter の `schemas:` で選ぶ形にした。

| include | 出力対象 | データ源 |
|---|---|---|
| `organization.html` | 全ページ | ハードコード (会社情報) |
| `software-application.html` | `/` `/price/` (+ 後で `/spec/`) | `_data/plans.yml` の `AggregateOffer` |
| `faq.html` | `/` | `_data/faq.yml` |
| `breadcrumb.html` | `/docs/` (+ 後で `/spec/` `/guides/*`) | `page` |

移行前の問題を 3 つ解消した:

1. **SoftwareApplication が全ページに重複出力**されていた (会社概要ページにもアプリの
   構造化データが載っていた)
2. **FAQPage が二重管理**だった (`default.html` にハードコード 5 件 / `index.html` の
   `<details>` 5 件)。同一データから生成する形にした
3. `"price": "0"` / `operatingSystem` / 説明文がハードコードで、料金改定・Mac 対応で腐る
   構造だった。`AggregateOffer` (lowPrice / highPrice / offerCount) を `_data` から組む

**あわせて直したもの**

- `index.html` の FAQ 節を `{% include faq.html %}` に差し替えた。JSON-LD だけ 9 件に
  増やして表示が 5 件のままだと **公開した時点で不整合**になるため、同じチケット内で解消した
- `company/privacy.html` と `company/asct.html` の front matter `title` が
  **どちらも「会社概要」のまま**だった (`<title>` に直接出る)。それぞれ
  「プライバシーポリシー」「特定商取引法に基づく表示」に修正
- `jekyll-seo-tag` を **Gemfile と `_config.yml` の両方から**除去。`{% seo %}` が
  呼ばれておらず無効だったため。⚠️ `_config.yml` の `plugins:` に残っていると
  `Dependency Error: you don't have jekyll-seo-tag` でビルドが落ちる (実際に踏んだ)

検証: `--strict_front_matter` ビルド成功後に、6 ページの title / og:title / description /
JSON-LD 種別を出力から抽出し、**description が全ページで異なること**、
**FAQ の JSON-LD 9 件と表示 9 件が一致すること**、**`/company/about` に
SoftwareApplication が出ていないこと**、**seo-tag の痕跡が無いこと**を機械確認。

### TICKET-SITE-04 の記録

**抽出基準** — 「2 ページ以上で使う」か「`_data` ループで生成する」もののみ include 化した。
1 ページでしか使わないセクションはページ本体に置く (Jekyll の include はネストが深いと
追跡不能になる)。

| include | 根拠 |
|---|---|
| `kv-table.html` | ラベル\|値 の定義表が /spec/ ・/price/ ・/docs/ で **15 箇所以上** 重複 |
| `pricing-cards.html` | トップの PRICING 節と /price/ で完全重複 |
| `cta-download.html` | トップ末尾・/price/ 末尾・/spec/ 末尾 の 3 箇所 |
| `faq.html` | 表示本体と FAQPage JSON-LD を **同一データから生成** (食い違いを構造的に防ぐ) |
| `disclosure-table.html` | 通信内容の対比表。施策④-2 の中核 |

- `section-title.html` に `align="left"` を追加 (2 カラム構成の節用)。**第 2 バリアントは
  作らない** — デザイン差分の再現よりトークンの一貫性を優先する
- `download-button.html` (未使用だった) は `cta-download.html` の中身として再利用。
  DL URL の単一管理点になる
- **`spec-table.html` は破棄**。未使用なだけでなく内容が誤っていた
  (メモリ「32GB以上」/ CPU「Intel 第7世代」。現行 index.html は「8GB以上」)

**Liquid の罠 2 件を回避**

1. `include.zebra | default: true` は使えない — Liquid の `default` は `false` を「空」と
   みなして既定値に置き換えてしまう。`{% if include.zebra == false %}` で明示判定した
2. `{% if a and b | filter %}` は書けない — `if` 条件にフィルタを置けないので、
   zebra の偶奇判定は先に `assign` している
3. Liquid に桁区切りフィルタが無いため、料金は数値 (`price`、計算用) と表示文字列
   (`price_display`) を分けて `_data` に持たせた

検証: 一時ページをビルドして kv-row 8 / kv-alt 3 (zebra=false が効いている) /
FAQ details 9 / 開示リスト 11 / プランカード 2 / `¥9,800` の桁区切り /
`align=left` / **新 include に生ヘックスなし** を機械確認。

### TICKET-SITE-13 の記録 — 画像最適化

参照されている画像 14 枚を WebP に変換した (ffmpeg / libwebp / quality 82)。

| | 変換前 | 変換後 |
|---|---|---|
| 対象 14 枚の合計 | 3,530 KB | **368 KB** (10%) |
| トップページの画像転送量 | 約 2,000 KB | **216 KB** |
| `assets/` 全体 | 52 MB (未参照削除前) | **6.4 MB** |

`edit-player.png` は 627 KB → 39 KB、`pr_image.png` は 695 KB → 75 KB。
`app-icon-128.png` と `logo-font-cropped.png` は小さく互換性を優先して PNG のまま。
favicon (`assets/img/ico/`) も対象外。

**運用の穴を塞いだ** — スクリーンショットは front リポの `screenshots.mjs` が **PNG で**
出力し、手で `assets/img/screenshots/` にコピーする運用になっている。変換を手作業に
すると、次に撮り直したとき PNG に戻って **参照だけ `.webp` のまま残り画像が消える**。
`scripts/optimize-images.mjs` としてスクリプト化し、`CLAUDE.md` に「コピー後に必ず
通すこと」と明記した。

ビルドに組み込まない理由: Jekyll プラグインは ImageMagick / libvips を CI ランナーに
要求する (年数回しか変わらないアセットのためにデプロイの故障点を増やしたくない)。
Vite に通すと `/assets/img/…` の URL が全部変わる。

検証: ビルド出力の **ローカルアセット参照 229 件を全数検査してリンク切れ 0 件**。

### TICKET-SITE-16 の記録 — /docs/ 差分マージ

**丸ごと差し替えず、差分だけをマージした。** Claude Design の成果物の docs は
全アンカーを改名しており (`#about`→`#doc-intro` 等 19 本すべて)、さらに 2026-07-25 に
追加したばかりの `#detect-options` 節 (スクショ 3 枚) を持っていない。改名の利得はゼロで、
損失は既存の被リンク・アプリ内ヘルプからのディープリンクの全損。

- **既存 18 アンカー ID は 1 つも変えていない** (before/after を機械比較して確認)
- 追加は `#review` (検出漏れの確認) と `#usage` (使用時間の計測) の 2 本のみ
- `detectable-objects.png` を `#detect` 配下の `<details>` へ移設。**alt も一緒に移した** ——
  画像だけ外して alt がトップに残ると、決済審査・法人稟議・将来の広告出稿という
  移設の目的 (施策④-5) を達成できない
- `#spec` は動作環境の要点だけ残し、実測値・対応フォーマット・macOS 版の状況は
  新設した `/spec/` へ誘導する形にした (二重管理をやめる)

**未実装機能を書かないこと** を両新設節で徹底した:

- `#review` は「確認支援ビュー」(低信頼区間の自動抽出) が未実装なので、
  実装済みの道具だけを列挙 (欠落フレームジャンプ / タイムライン / 信頼度しきい値 /
  安全マージン / 手動追加・削除)
- `#usage` は **現行の計測ルールをそのまま書いた**。「同一ファイルの再インポートは非計上」
  「月次リセット」は課金基盤 (TICKET-BILL 群) の出荷前に書くと虚偽記載になる

トラブルシューティングへの `data-island="accordion"` 付与は **見送った**。
既存マークアップが `<ul>` で、`Accordion.svelte` は `<details>` 前提のため、
付けても無効な島になるだけだから。

### TICKET-SITE-11 / 12 / 14 / 15 の記録

**`/spec/` 新設** — 動作環境ページ。GPU と処理速度の表は **本番テレメトリの実測値**
(`_data/spec.yml`)。Claude Design の成果物は「RTX40以降 = 25fps 以上」等と書いていたが
実測より大幅に過大だったため置き換えた。macOS は **「開発中」の事実だけ**を書き、
ダウンロードボタンも先行登録フォームも置かない (存在しない製品への導線は施策④-4 に反する)。

**導線の整備** — ヘッダーのデスクトップナビ / モバイルドロワー / `<noscript>` の 3 経路すべてに
「動作環境」を追加。フッターに製品リンクと **会社住所・連絡先** を追加した (施策④-5:
特商法ページだけでは見られないため、法人稟議・決済審査での信頼度に直結する)。
`price/index.html` の「問い合わせフォーム」がリンクになっていなかった導線切れも修正。

**未参照アセットの削除** — `assets/` が **52MB → 9.7MB (42.5MB 削減)**。

| 削除 | サイズ |
|---|---|
| `assets/img/docs/` (旧サイト時代の手順画像 151 枚) | 22MB |
| `assets/videos/` (mp4 3 本) | 14MB |
| `assets/others/` (PDF 3 本) | 6.2MB |

⚠️ 判定方法に注意: ファイル名 (`1.png` 等) での grep は**部分一致で誤検出する**
(151 件中 53 件が「参照あり」と出た)。**パス接頭辞 (`assets/img/docs`) で判定**したところ、
参照は CHANGELOG.md と CLAUDE.md のみで、ページからの参照はゼロだった。
削除後にビルド出力の **ローカルアセット参照 228 件を全数検査してリンク切れ 0 件**を確認。

**SEO 配管**

- 手書き `sitemap.xml` / `assets/sitemap.xml` / `assets/img/sitemap.xml` を削除。
  **ルートに手書き sitemap があると `jekyll-sitemap` は生成をスキップする**ため、
  7 URL・`lastmod` 2026-02-11 固定の嘘 sitemap だけが配信されていた。削除して
  プラグインを有効化し、9 ページ + 動的 `lastmod` になった
- `robots.txt` を新規作成。⚠️ `_config.yml` の `defaults` が全ページに `layout: default` を
  当てるため、**`layout: null` を明示しないと robots.txt が HTML になる** (実際に踏んだ)
- `404.html` に `sitemap: false` を追加
- `_data/lang/ja.json` の `meta_desc` を修正。「Adobe **After Effects** へインポート」という
  **誤記** (実装は Premiere Pro 連携) を直し、検索結果に直接出る露骨表現も
  決済審査・法人稟議を考えて言い換えた (施策④-5)

### TICKET-SITE-06 / 07 / 09 / 10 の記録 — トップページ刷新

**HERO** は確定コピー (数値なし)。`detectable-objects.png` をトップから撤去した
(alt も一緒に外している。画像だけ外して alt が残ると施策④-5 の目的を達成できない)。

**STATS** は旧「25fps+ 自動処理速度」「6時間 無料で利用可能」を、検証できる 4 つの事実に
差し替えた: `0 byte`(映像の外部送信量) / `100,000+`(学習画像) / `12 形式`(読み込み対応) /
`4 段階`(検出パイプライン)。

**COMPARISON** は時間・金額の数値を出さず「判断の軸」だけを並べる形にした。
手作業側の所要時間は社内に実測データが無いため。Deepmosaic 側の実測は `/spec/` へ誘導する。

**RELIABILITY** は「確認支援ビュー」(低信頼区間の自動抽出) が未実装なので、
**実装済みの道具だけ**を書いた: 欠落フレームジャンプ (`[` `]`) / 安全マージン (0.5〜2倍) /
適用範囲 4 段階 / 信頼度フィルタ。

**MOSAIC (旧 STANDARDS)** も「審査基準準拠プリセット」が未実装なので、
実装済みの設定項目を説明する形に縮小した。

**ROI 計算機 (TICKET-SITE-09)** は React を捨てて Svelte 5 アイランドで実装。
プラン価格は `data-plans` で `_data/plans.yml` から渡す。見出しと注記はアイランドの外に
置き、`<noscript>` フォールバックも用意した (JS 無効でも何の計算機か読める)。
「手作業の想定」が仮置きであることを UI 上に明示している。

**タブ (Tabs.svelte)** は **DOM を生成しない挙動だけのアイランド**。JS 無効なら全パネルが
縦に並んで見える (比較表なので全部見えても情報として成立する)。矢印キー / Home / End にも対応。

**気付いて直したこと**: セクションの説明を HTML コメントで書いていたため、
「25fps は実測と乖離するため撤去」といった **社内向けの記述が公開 HTML に出力されていた**。
Liquid コメント (`{%- comment -%}`) に変換して出力から除いた。

検証 (ビルド出力に対する機械チェック 20 件、全 PASS): 確定コピー / 未検証の数値 3 種が
出力に無い / 検出対象画像と露骨表現が無い / STATS 4 項目 / 比較表 / ROI アイランドと
plans と noscript / タブ 2 枚 / 通信開示 / オフライン手順 / 料金カード 2 枚 / 責任の明記 /
苦手なケース 5 行 / **FAQ 表示 9 件 = JSON-LD 9 件** / CTA / **全画像に width/height** /
生ヘックスなし / `href="#"` なし。

### TICKET-SITE-08 の記録 — 「25fps+」は実測で裏付けが取れない

本番テレメトリ (`detection_runs`) から処理速度を実測した。**現行サイトに載っている
「25fps+ 自動処理速度」は代表値として成立しない**という結果になった。

集計条件: `status=completed` / 範囲指定なし (全編検出) / 集計対象外アカウント除外 /
2026-06-15〜07-25 / **34 件 / 10 ユーザー**

| 指標 | 実測 |
|---|---|
| 端から端まで (準備→前処理→検出→解析) の処理 fps | **中央値 7.4** / 最良 27.1 |
| 動画長の何倍かかるか | **中央値 4.2 倍** / 上位25% 2.5 倍 / 最良 1.1 倍 |
| 検出ステージのみ (`dur_detect_ms`) の fps | 中央値 16.4 / 最大 43.9 |

GPU 別 (幅 1080〜1920px に揃えた中央値):

| GPU | 件数 | 全体 fps | 実時間倍率 |
|---|---|---|---|
| RTX 4070 Ti | 11 | 11.7 | 3.2 倍 |
| RTX 3070 Ti | 9 | 4.8 | 6.3 倍 |
| RTX 4060 | 1 | 15.2 | 2.0 倍 |
| RTX 3070 | 1 | 27.1 | 1.1 倍 |
| GTX 1070 Ti | 1 | 16.0 | 1.9 倍 |
| GPU なし | 2 | 1.9 | 12.8 倍 |

**判断**

- 「25fps+」を **STATS 帯から外す**。25fps を超えたのは 34 件中 1 件 (RTX 3070) だけで、
  最良ケースの一点を代表値として出すのは景表法 (優良誤認) のリスクを負う
- Claude Design の `/spec/` GPU 表 (「RTX40以降 = 25fps 以上」「RTX30 = 20〜25fps」) は
  **実測より過大**。実測値に差し替えた (`_data/spec.yml`)
- 「CPU のみ 2fps 前後」は実測 2.1 で **正確**。そのまま使う
- 2 時間の作品は中央値で **約 8.4 時間** かかる。「40分」は成立しない
  (ヒーローから数値を外した判断が実測でも裏付けられた)
- STATS 帯は検証できる事実に差し替える: `0 byte`（映像の外部送信量。設計上の事実で
  ユーザー自身が検証できる = 最も強い主張）/ `100,000+`（学習画像データ。自社が持つ事実）/
  `12 形式`（読み込み対応フォーマット。実装と一致）/ `4 段階`（検出パイプライン。UI と一致）

**注意**: `detection_runs.avg_fps` 列は 101 件すべて NULL だった (列はあるが充填されていない)。
本集計は `total_frames / (dur_total_ms / 1000)` で算出している。`avg_fps` の充填は別チケット。
`encode_runs.source_duration_seconds` も全件 NULL でエンコード側の実測は取れていない。

### TICKET-SITE-03 の記録

`_data/` を新設し、料金と数値の単一真実源を作った。Claude Design の成果物は料金を
**料金カードの markup と `renderVals()` の計算ロジックの 2 箇所にハードコード**しており、
必ず片方だけ更新されて破綻する構造だった。これは移植しない。

| ファイル | 内容 |
|---|---|
| `site.yml` | ヒーローコピー / ROI 既定値 / **実測値 (SITE-08)** / STATS 帯 |
| `plans.yml` | 料金プラン。**アプリが実際に強制している値だけ** (Free 6h / Pro ¥9,800 無制限) |
| `faq.yml` | FAQ 9 件。表示本体と FAQPage JSON-LD を同一データから生成する |
| `spec.yml` | 動作環境。GPU 表は実測値。macOS は「開発中」表記のみで DL ボタンなし |
| `disclosure.yml` | 通信内容の開示 / オフライン検証手順 / 苦手なケース / 責任の明記 |
| `mosaic.yml` | モザイク設定。**「審査基準準拠プリセット」は未実装**なので、実装済みの設定項目を説明する形に縮小した |

`plans.yml` に新プラン (Light ¥2,980 等) は **入れていない**。サイトの記述がライセンス
サーバーの挙動と食い違うと虚偽記載になるため、課金実装 (TICKET-BILL 群) の完了後に
TICKET-SITE-20 で差し替える。

`--strict_front_matter` ビルドと Liquid からの参照 (9 パス) を確認済み。

### TICKET-SITE-01 の記録

Claude Design の成果物は生ヘックスを全面インライン直書きしており、グレーが L\* で約3%しか
違わない 8 階調 (`#d0d0d0` / `#c8c8c8` / `#c0c0c0` / `#a8a8a8`) に発散していた。この発散は
移植せず、`--color-ink-body` に 3 階調を統合し `#a8a8a8` は既存 `--color-ink-2` に吸収した。

`@source` に `../spec/**/*.html` と `../_guides/**/*.md` を追加。**これが漏れると新ページで
しか使わないユーティリティが全部 purge され「/spec/ だけスタイルが当たらない」形で出る。**

既存 markup とのクラス名衝突を 19 クラス × 全 html で確認済み (衝突なし)。

### TICKET-SITE-02 の記録

`_includes/icon.html` は全 22 アイコンが **1 行 3KB** に詰まっており、14 個追加すると
保守不能になる。パスデータは手書きせず `front/node_modules/lucide-svelte@0.460.1` の
`iconNode` から機械生成し、`{% when %}` 1 個 = 1 行に整形した (22 → 36 種、53 行)。

- `AlertTriangle` は lucide 0.46 で `triangle-alert` に改称済み (`alert-triangle` は alias)。
  ファイル名は `triangle-alert.svelte` を参照している
- **既存 22 アイコンの描画は不変** — `_site/index.html` と `_site/docs/index.html` を
  変更前後でビルドして diff を取り、差分が cache-busting のタイムスタンプ
  (`?v={{ site.time }}`) だけ = **SVG markup はバイト一致**であることを確認
- 全 36 アイコンが実際に形状要素を持つことを一時ページのビルド出力で機械検証
  (36/36 ブロック、形状要素 112 個)

## 2026-07-25 - Docs: 動画の読み込み / 検出オプションの解説を拡充

ドキュメントに「動画を読み込んだ後に出る検出オプション画面」の説明が一切無く、
読み込み方法も 1 文だけだった。実アプリのキャプチャを撮り直して両節を書き起こす。

- [x] DOC-IMPORT-01: 「動画の読み込み」節を拡充 — 3 つの読み込み経路 (ファイル選択 /
  フォルダ選択 / ドラッグ&ドロップ)、対応形式 12 種、複数まとめ読み込み時の挙動
  - フォルダ選択の実挙動を明記: **直下のみ (サブフォルダ非対象)** / ファイル名昇順 /
    最大 100 件 / 映像として読めないファイルは除外 (front `folder_scan.rs` + `+layout.svelte` 準拠)
  - 複数読み込み時は「1 本目の設定が全件に適用される」「検出範囲の指定だけは 1 本目のみ有効」
- [x] DOC-IMPORT-02: 「検出オプション」節を新設 — プレビュー / 検出範囲 (複数範囲) /
  検出対象トグル / モザイク初期設定 / GPU 表示と使用モデル。目次にも追加
  - 「AI検出」節の導入文から新節へリンク。トラブルシューティングに 2 項目追加
    (プレビューが出ない / フォルダで動画が見つからない)
  - `_includes/icon.html` に `Trash2` を追加 (未定義のアイコン名は空 SVG になるため)
- [x] DOC-IMPORT-03: スクリーンショット (`import-menu.png` / `detect-options.png` /
  `detect-options-panel.png`) を `assets/img/screenshots/` に追加。撮影は front リポの
  `node scripts/e2e/screenshots.mjs --only-options` (実アプリを CDP 駆動)

**検証結果 (2026-07-25)**
- `npm run build` + `bundle exec jekyll build --strict_front_matter` 成功
- ローカル配信 (port 4123) を Playwright で実機確認: 目次 17 → 18 項目、`#detect-options`
  へのアンカー、画像 3 枚の表示、Trash2 アイコンの描画、節間リンクを確認
- ⚠️ CLAUDE.md 記載の `bundle exec jekyll build --strict_front_matter --strict_variables` は
  jekyll 4.4.1 で `invalid option: --strict_variables` になる (`--strict_front_matter` のみで実行)

## 2026-07-19 - Fix/Feature: ダウンロードリンクを R2 へ + モバイルドロワー修正

- [x] **ダウンロードリンクを Cloudflare R2 の "latest" エイリアスへ**: `app_download_link` を旧 `desktop_app_support` v1.0.3 (GitHub) → `https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows`（**版数非依存**）。front は private のため直リンク不可 → R2 (public worker) 配信を利用。全 CTA(9ページ)に反映。
  - **latest エイリアスの実装（別リポ `front/worker-r2-proxy/src/index.ts`）**: `GET /download/latest/windows`（`/download/latest`）を `latest.json` の現行 Windows インストーラ URL へ **302 リダイレクト**する追加専用ルートを実装。→ 新リリース公開時もサイト側リンクの更新不要（`latest.json` を辿るため自動追従）。現行の転送先は v1.0.11（署名済み・HEAD 200 確認）。
  - ⚠️ **要デプロイ（ユーザー操作）**: この worker 変更は未デプロイ。`cd front/worker-r2-proxy && npx wrangler deploy` を実行するまでエイリアスは 401 のまま。**worker を先にデプロイしてからサイトを公開**すること（順序が逆だとダウンロードが一時的に 401）。CF 資格情報が無いため当環境ではデプロイ不可。
- [x] **モバイルドロワー修正**: sticky ヘッダの `backdrop-filter` が `position:fixed` の containing block を生成し、ドロワー/オーバーレイが 60px ヘッダ内に閉じ込められて背景が崩れヒーローに被る不具合。overlay+drawer を `document.body` へ portal して解消（全画面高さで正常表示、実機確認済み）。

## 2026-07-19 - Feature: ダークテーマ全面リニューアル（新アプリ準拠デザイン）

Claude Design のエクスポート `ui_kits/website/index.html` を本番実装。ライト版から**ダークテーマ**へ全面刷新し、コンテンツも新アプリ準拠に更新（新機能・4段階パイプライン・Pro プラン ¥9,800・16章の新ドキュメント）。スタック（Jekyll + Tailwind v4 + Svelte アイランド）は維持し、SPA ではなく実 URL のマルチページとして実装。

- [x] DR-01: ダークデザイントークン（`@theme`: surface/panel/accent #4f8be8 等）+ `.btn-*`/`.rich-prose`(dark) + `_includes/icon.html`(lucide SVG 20種) + 新画像/スクショ複製
- [x] DR-02: 共通テンプレ ダーク化（sticky blur ヘッダ / footer / section-title）、default.html の theme-color #1f1f1f・meta・FAQ JSON-LD(新5問) 更新、MobileNav ダーク
- [x] DR-03: home 実装（Hero/Stats/Features5/Pipeline/Premiere/Steps3/Spec/Faq5/Cta）。実機QA・FAQ単一開閉確認
- [x] DR-04: pricing（Free ¥0 / Pro ¥9,800 featured）+ docs（17章・サイドバーTOC・Scrollspy・スクショ7枚）
- [x] DR-05: legal/404 ダーク追従（クラス置換のみ・文言verbatim）+ 最終検証

**検証結果（2026-07-19）**
- `npm run build` + `jekyll build --strict_front_matter` 成功
- 実機QA（Playwright）: home/pricing/docs/legal をダークで確認。モバイルドロワー(#1f1f1f)・FAQ単一開閉・docsスクロールスパイ(17 TOC)動作
- SEO 不変: JSON-LD(Organization/SoftwareApplication/FAQPage=新5問)・OG・canonical・sitemap(7)・feed・gtag 維持、theme-color #1f1f1f、FAQ DOM=JSON-LD一致
- 依存: materialize/jquery/lity 参照ゼロ継続、全ページに app.css
- アセット: detectable-objects/app-icon-128/logo-font-cropped + スクショ7枚を複製

> **注意（公開前確認）**: 料金 ¥4,800/Enterprise → ¥9,800/Pro、新機能・新ドキュメントに刷新。実製品と一致するか最終確認のうえ公開（コミット/プッシュはユーザー承認後）。

## 2026-07-19 - Feature: Materialize/jQuery 撤去 → Tailwind CSS + Svelte アイランド

Materialize.css 1.0.0（EOL）/ jQuery / lity を全撤去し、CSS を Tailwind CSS v4、対話部品を Svelte 5 アイランドへ書き直し。Jekyll はコンテンツ/SEO 層として継続。

- [x] TICKET-001: ビルド基盤（package.json / vite.config.js / src/app.css / src/main.js / islands）。`npm run build` → `assets/dist/app.{css,js}`。.gitignore / _config.yml 更新
- [x] TICKET-002: Tailwind トークン（@theme: navy/accent/sky/success）+ 自己ホスト Roboto（assets/css/fonts.css）+ 移植スタイル。scroll-reveal は `.js` ガードで JS 無効時も表示
- [x] TICKET-003: Svelte アイランド 4種（MobileNav / Accordion / Scrollspy / VideoLightbox）+ back-to-top/scroll-reveal 素JS移植。全てプログレッシブ・エンハンスメント。ブラウザ実機で挙動確認済み
- [x] TICKET-004: 全ページ markup を Materialize→Tailwind 書換（_layouts/default.html, _includes/*, index, docs(42 section scrollspy), price, company/*5, 404）。Material Icons 7種をインライン SVG 化。docs は Scrollspy アイランド配線
- [x] TICKET-005: 不要アセット削除（index.css/header.css/index.js/lity css・js）+ CI に Node ビルド段追加（setup-node@v7 → npm ci → npm run build）+ CLAUDE.md/README 更新 + 検証完了

**検証結果（2026-07-19）**
- `npm run build` + `bundle exec jekyll build --strict_front_matter` 成功
- `_site` 依存撤去確認: materialize / jquery / lity 参照ゼロ、全ページに `app.css`
- 実機QA（Playwright）: index(PC/モバイル)/docs/price/company 表示良好。モバイルドロワー・FAQ単一開閉・動画ライトボックス(youtube-nocookie/Esc)・docs スクロールスパイ(42 TOC・sticky) 動作確認
- プログレッシブ・エンハンスメント: scroll-reveal を `.js` ガードし JS 無効でもコンテンツ表示
- SEO 不変: JSON-LD(Organization/SoftwareApplication/FAQPage)・OG・canonical/hreflang・sitemap(7 URL)・feed・gtag すべて維持
- 追加改善: 自己ホスト Roboto で Google Fonts 依存を撤去、内部ドキュメント `CLAUDE.md` を publish 対象から除外、404 画像に `alt` 追加、外部リンクに `rel="noopener noreferrer"`

> 次回 push で確認: CI の Node ビルド段 + ruby 3.4 で Pages デプロイが green になること

## 2026-07-19 - Maintenance: 依存パッケージ最新化

- [x] TICKET-001: Ruby gem 最新化（`bundle update` で Gemfile 制約内の全 gem を更新。jekyll-seo-tag 2.8→2.9 ほか。liquid/rouge 等は Jekyll 4.4 制約により据え置き。ビルド成功）
- [x] TICKET-002: CDN ライブラリ更新（video.js 8.21.0→8.23.9 に更新。Materialize 1.0.0 と jQuery 3.7.1 は据え置き＝下記「据え置き判断」参照）
- [x] TICKET-003: GitHub Actions 更新（checkout v4→v7、configure-pages v5→v6、upload-pages-artifact v3→v5、deploy-pages v4→v5、ruby-version 3.3→3.4。setup-ruby は floating `@v1` のため据え置き）
- [x] TICKET-004: vendored アセット整理（未使用の animate.min.css を削除＝サイト内でクラス参照ゼロ、約58KB削減。lity 2.4.1 は最新のため据え置き）
- [x] TICKET-005: Jekyll ビルド検証（`bundle exec jekyll build --strict_front_matter` 成功。_site 出力から animate.min.css / video.js 8.21.0 が消えていることを確認）

### 据え置き判断（ライブラリ版数はライブレジストリで確認済み・2026-07-19 時点）
- **Materialize 1.0.0 → 据え置き**: cdnjs は 1.0.0 が終端（オリジナルは非メンテ）。メンテ版は fork `@materializecss/materialize` 2.3.3 だが jQuery 依存を廃した破壊的リライトで、`$('.scrollspy').scrollSpy()` 等の初期化を全面書き換え＋CDN 移行が必要。sidenav/scrollspy/collapsible を全ページで多用しているため、専用の移行タスクに分離。
- **jQuery 3.7.1 → 据え置き**: 既に 3.x 最終版（3.7.2 は存在しない）。4.0.0 は GA だが、上記 Materialize 1.0.0 が jQuery 4 で未検証のため、Materialize 移行と同時に対応。

### 次回デプロイで確認が必要な項目（bump-with-care）
- ruby-version 3.3→3.4: Gemfile は既に csv/base64/bigdecimal/webrick の 3.4+ shim を持つため低リスク。次回 push 時の Actions ビルドが green になることを確認。
- upload-pages-artifact v5 / deploy-pages v5: 対で更新（artifact フォーマット整合のため）。次回デプロイの成功を確認。

## 2026-03-09 - Maintenance: Ruby/Gem最新化 & リファクタリング

- [x] TICKET-001: Gemfile最新化（Jekyll 4.4+, minima削除, 依存関係整理）
- [x] TICKET-002: _config.yml整備（サイト設定の集約、exclude, defaults設定追加）
- [x] TICKET-003: 共通パーツのinclude化（spec-table.html, download-button.html）
- [x] TICKET-004: dead code除去（コメントアウト済みHTML、未使用CSS約300行削除）
- [x] TICKET-005: Gemfile.lock削除（bundle install再実行で再生成が必要）
- [x] TICKET-006: canonical URL正規化（index.html除去、_siteをgit追跡から除外）
- [x] TICKET-007: .gitignore整備（_site, .jekyll-cache, .sass-cache, vendor追加）
- [x] TICKET-008: GitHub Actions Jekyll 4.4デプロイワークフロー追加（GitHub Pages標準ビルドはJekyll 3.9固定のため）
