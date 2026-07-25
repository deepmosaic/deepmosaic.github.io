# CHANGELOG

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
- [ ] TICKET-SITE-04: `_includes` 新設 (kv-table/pricing-cards/cta-download/faq/disclosure-table)

### Phase 1 — トップ刷新 + /spec/ 新設

- [ ] TICKET-SITE-05: description のページ単位化 + JSON-LD 分離 + jekyll-seo-tag 除去
- [ ] TICKET-SITE-06: トップ前半 (HERO / TRUST BAR / STATS / COMPARISON) — 未検証の数値は出さない
- [ ] TICKET-SITE-07: 未検証の数値と未実装機能の言及を全ページから棚卸し
- [x] TICKET-SITE-08: 実測値の取得 (`detection_runs` から算出)
- [ ] TICKET-SITE-09: `RoiCalculator.svelte` アイランド (React 廃止)
- [ ] TICKET-SITE-10: トップ後半 (RELIABILITY / STANDARDS / PRIVACY / WORKFLOW / DISCLOSURE / FAQ / CTA)
- [ ] TICKET-SITE-11: `/spec/` 新設 (Mac は「開発中」表記のみ、DL ボタンなし)
- [ ] TICKET-SITE-12: フッター再構成 + 全未接続リンク接続 + `price/index.html:54` の切れた導線修正
- [ ] TICKET-SITE-13: 画像最適化 (WebP / width,height / loading / srcset)
- [ ] TICKET-SITE-14: 未参照アセット削除 (`assets/img/docs/` 22MB / `assets/videos/` 14MB)
- [ ] TICKET-SITE-15: SEO 配管 (sitemap 復活 / robots.txt / meta_desc 誤記 / front matter title)
- [ ] TICKET-SITE-16: `/docs/` 差分マージ (`#review` `#usage` 追加、既存アンカーID は不変)

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
