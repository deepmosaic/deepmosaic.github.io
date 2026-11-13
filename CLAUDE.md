# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepMosaic 公式サイト。Jekyll ベースの静的サイト (GitHub Pages 配信)。製品紹介、ドキュメント、価格、企業情報、ダウンロードページを含む。

## Commands

フロントエンドは **2 段ビルド**。Vite が Tailwind CSS + Svelte アイランドを `assets/dist/app.{css,js}` に出力し、その後 Jekyll がサイトを生成する。**`npm run build` を先に実行してから** `jekyll build/serve` すること。

```bash
# 依存インストール (初回)
bundle install      # Ruby gem
npm install         # Node (Tailwind v4 / Svelte 5 / Vite)

# フロントエンドアセットをビルド (assets/dist/app.css, app.js)
npm run build

# ローカル dev server (port 4000) ※ 先に npm run build 済みであること
bundle exec jekyll serve

# 反復開発: 別ターミナルで Vite watch を回す
npm run dev         # = vite build --watch (assets/dist/ を保存時に再生成)

# 本番ビルド (出力: _site/)
npm run build && bundle exec jekyll build
```

> Windows では `jekyll serve --detach` は `fork()` 未実装のため不可。`--detach` を付けずに実行する。
> `assets/dist/` と `node_modules/` は gitignore 対象で CI で再生成される。`package-lock.json` はコミットする。

## Architecture

### ディレクトリ

| パス | 役割 |
|---|---|
| `_config.yml` | Jekyll 設定 (サイト全体) |
| `_layouts/` | テンプレート (`default.html`) |
| `_includes/` | パーツ (`header.html`, `footer.html`, `download-button.html`, `spec-table.html`) |
| `_data/` | YAML データ |
| `_data/lang/` | 言語の辞書 `ja.json` (変えない) / `en.json` / `zh-tw.json` (i18n、下の節) |
| `_data/l10n/` | 英中の部品・データの文 `<en\|zh-tw>/<name>.yml` (1 ファイル 1 チケット) |
| `_site/` | Jekyll ビルド出力 (gitignore 対象) |
| `src/` | フロントエンド source: `app.css` (Tailwind v4), `main.js`, `islands/*.svelte` (Svelte 5) |
| `assets/dist/` | Vite ビルド出力 `app.css` / `app.js` (gitignore 対象・CI 再生成) |
| `assets/` | css (`fonts.css` 等) / js / img / fonts / videos |
| `vite.config.js` / `package.json` | フロントエンドビルド設定 |
| `docs/` | ドキュメントページ |
| `company/` | 企業情報ページ |
| `price/` | 価格ページ |
| `index.html` / `404.html` | トップページ / 404 |
| `mosaic-removal.html` | `/mosaic-removal/`。「モザイク除去」誤認の封じ込めページ |
| `en/` / `zh-tw/` | 英語 / 繁体字中国語のページ (`/en/…`・`/zh-tw/…`。各 10 ファイル (404 を含む)、公開済み。front matter に `lang`・`source`・`source_hash` が必須) |
| `scripts/i18n/` | 多言語化の検査の道具 (ja-identity・check-site・parity・source_hash・用語集の写し)。公開しない |
| `CNAME` | カスタムドメイン |
| `BingSiteAuth.xml` / `sitemap.xml` / `robots.txt` | SEO |
| `llms.txt` / `llms-full.txt` | AI 向けのサイト概要 (`layout: null` 必須) |

### i18n

多言語化 (i18n1112、2026-11-12〜。T-2199 で土台、W7 で英中のページを作って公開済み。ヘッダーの言語の切り替えと ja のページの案内の帯から行ける)。**日本語が正本**で、英語と繁体字中国語 (台湾向け) の写しを置く。**ja のページの出力は 1 バイトも変えない** (ja-identity で毎チケット検査。ja を意図して変えるチケットだけは、リーダーが基点を作り直す)。アプリの表示言語は 2.13 が日本語だけ、2.14 から日本語・英語・繁体字中国語の 3 つ (公開の手順の正は desktop の `docs/release.md`)。画面の文の規則の正は desktop の `docs/i18n.md`。

- **URL**: ja は今のまま (`/`・`/price/` …)。英語は `/en/…`、繁体字は `/zh-tw/…`。対象は `/`・`/price/`・`/spec/`・`/subscribe/`・`/mosaic-removal/`・`/contact/`・`/enterprise/inquiry/`・`/join/`・`/company/about`・`/404.html` (英中の 404 は `/en/404.html`・`/zh-tw/404.html`)。自動のリダイレクトはしない。
- **対象外 (日本語のページだけ)**: docs (`/docs/`・`/docs/web/`・`_includes/docs`)、法務 (`/company/{terms,privacy,cookie,eula,asct}`、`_data/legal.yml`)、`llms.txt` / `llms-full.txt` / `robots.txt`、`feed.xml`。英中のページからこれらへのリンクは日本語のページへ向け、`{% include ja-link.html … %}` で「日本語のページ」の印を付ける。
- **`page.lang`**: ja は `_config.yml` の defaults (`path: ""` の `values` の `lang: ja`) で決まる。**英中のページは front matter に `lang: en` / `lang: zh-tw` を必ず書く**。`scope: { path: "en" }` の defaults は置かない (Jekyll の前方一致で `enterprise/` にも当たる)。英中のページの front matter は `lang`・`permalink` (`/en/` / `/zh-tw/` で始まる)・`ja_url`・`source` (元の ja のファイル)・`source_hash`・`title`・`seo_title`・`description` ほか ja と同じ値。
- **辞書**: `_data/lang/ja.json` は**変えない**。`_data/lang/{en,zh-tw}.json` は ja.json の全キーの訳 + 英中だけのキー (`url_prefix`・`json_ld_lang` など。ja では nil になるので `| default:` か ja の分岐で今の出力を保つ)。Liquid では `site.data.lang[page.lang]`・`site.data.l10n[page.lang].<name>` (ハイフンがあるので添字で引く)。
- **部品・データの文**: `_data/l10n/<en|zh-tw>/<name>.yml` に置く。作ったときは 1 ファイルを 1 チケットが持った (`plans`・`faq`・`subscribe` = T-2201 / `spec`・`disclosure`・`mosaic`・`entity` = T-2202 / `nav` = T-2204 / `parts` = T-2205 / `inquiry_form` = T-2206。この持ち物の決まりは i18n1112 の間だけのもので、もう終わった。表は出所の記録として残す)。数値・URL・コード・並びの正は ja のデータだけ。データの写し (`plans` ほか) は先頭に `_source` / `_source_hash` を持つ。訳のあるページの台帳は `_data/i18n_pages.yml` (hreflang を出すページ)。
- **ja のソースの日本語の直書きは残す**: 既存の node テストが include のソースの日本語・href・Liquid の式を照合しているため、共通部品は行内の `{% if page.lang == 'ja' %}原文{% else %}{{ 訳 }}{% endif %}` か `{{ tx.x | default: 元の式 }}` で英中の値だけを引く。header / footer は英中用の写し `_includes/header-intl.html` / `_includes/footer-intl.html` を include する。アイランドと JS は `<html lang>` を読む (`src/lib/site-lang.js`) か、同じファイルの中の 3 言語の表 (`const TEXT = { ja, en, 'zh-tw' }`、ja は今の文字列のまま)。
- **英中の見た目の直し**は `:root:not(:lang(ja))` の下だけ (ja の CSS を変えない)。
- **検査の道具** (`scripts/i18n/`、`_config.yml` の exclude で公開しない。依存なし):

  ```bash
  # ja のページ (en/・zh-tw/ 以外の全 .html) が基点の _site とバイト一致 (許した差分 = ?v=<数字>・hreflang の link・og:locale:alternate・data-i18n-switch の要素だけ除く)。0 = 一致 / 1 = 差分 / 2 = 使い方
  node scripts/i18n/ja-identity.mjs <基点の _site> _site
  # ビルド出力の検査 (scripts/i18n/checks/*.mjs を名前の順に実行。CI の Verify build output からも呼ぶ)。0 = OK / 1 = エラー / 2 = ディレクトリが無い
  node scripts/i18n/check-site.mjs _site
  # ja のソースを直したら英中も直してから、英中のページ / l10n の hash を書き直す
  node scripts/i18n/accept-site.mjs en/price/index.html zh-tw/price/index.html _data/l10n/en/plans.yml
  # 基点の _site を作る (リーダーがウェーブの開始時に 1 回。チケットでは実行しない)
  bash scripts/i18n/build-site-base.sh <commit> <出力の _site>
  ```

  - `source-hash.mjs`: ja のソースの正規化 (CRLF・コメント・行末の空白・空行を除く) の sha256。`src/lib/i18n-site-tools.test.js` が英中の全ページと l10n の hash の一致を検査する (`npm test`)。
  - `parity.mjs`: ja と英中のソースの構造 (`id`・`data-dl`・`data-island`・`data-*` の名前・`<img src>`・include の並び) の一致。各ページのチケットの node テストが使う。
  - `checks/ja-lang.mjs`: `<html lang>` と `og:locale` (ja `ja`/`ja_JP`、en `en`/`en_US`、zh-tw `zh-Hant-TW`/`zh_TW`)。`checks/lang-text.mjs`: 英中のページの見える文に仮名・簡体字・禁止語が無いこと (本体は `scripts/i18n/site-lint.mjs`、用語集の写しを読む)。`checks/store.mjs`: Store のボタンの出し分け (下の項)。
  - 検査を足すときは `scripts/i18n/checks/<名前>.mjs` (`export default function check(ctx)` がエラーの文字列の配列を返す) を足すだけ。node テストは `src/lib/i18n-site-<名前>.test.js` (`_site` を読まない)。
- **用語集の写し**: `scripts/i18n/glossary.json`・`glossary-chars.json` は desktop の `src/lib/i18n/glossary.json`・`glossary-chars.json` (正本) の写しで、**サイトで直接直さない**。語を足す・直すときは desktop で直してから 2 つをそのまま写し、`scripts/i18n/glossary.source.json` の `desktop_commit` (写した desktop のコミットの 40 桁の sha)・`desktop_ref` (消えない名前。例 `backlog1113 (T-2232)`)・`sha256` (改行を LF にそろえた内容の値、2 つ)・`note` を直す。`npm test` の `src/lib/i18n-site-lang.test.js` が sha256 を照合する。desktop・web・サイトの 3 者を同じ版の組で揃える (手順は desktop の `docs/i18n.md`)。
- **Store のボタンの切り替え** (T-2304): `_data/site.yml` の `distribution.store_enabled` (既定 `false`) 1 か所で、`true` のときだけ 3 言語で「Microsoft Store で入手」のボタンと Store 版だけの説明 (申し込みのページ・FAQ・法務文書の配信ストア版の記述) が出る。英中の訳や部品を直したら、`false` の出力は `node scripts/i18n/check-site.mjs _site` (`checks/store.mjs`)、`true` の出力は `node scripts/check-store-toggle.mjs` (`_data` の写しで切り替えて丸ごとビルドし、本物の `_data`・`_site` は触らない) で両方を確かめる。

## Conventions

- 用語 (T-2249、T-1901 の取り消し): 検出対象 (label 0) の日本語の表示名は「局部」(T-1901 の「身体のプライバシー部位」は使わない)。英中の訳は `body areas` (`private` を付けない) / `身體部位` のまま。識別子 (`porn` / `detect_genitalia` / label の数値 / env 名 / API の欄名) と過去の記録 (CHANGELOG / docs_draft) は変えない
- Jekyll の Liquid テンプレート構文
- 画像は `assets/img/` に配置。**WebP 必須** (TICKET-SITE-13)
  - スクリーンショットは front リポの `node scripts/e2e/screenshots.mjs` が **PNG で**出力する。
    `assets/img/screenshots/` にコピーしたら **必ず** `node scripts/optimize-images.mjs --apply`
    を通すこと。忘れると参照だけ `.webp` のまま残り、画像が表示されなくなる
  - 変換は ffmpeg (libwebp) で quality 82。ビルドには組み込まない
    (CI に ImageMagick/libvips を要求したくない。Vite に通すと URL が全部変わる)
  - `optimize-images.mjs` の既定の対象は **`assets/img/screenshots/` 直下だけ** (どこから実行しても同じ、T-522)。
    別の場所は `node scripts/optimize-images.mjs <dir> [--apply]` (cwd 基準、直下の PNG のみで再帰しない)。
    まず `--apply` なしで一覧を見る: `[DRY]` = 変換して元 PNG を削除 / `[KEEP]` = 参照あり / `[SKIP]` = 互換性優先
  - サイトの原稿 (HTML / `_includes` / JSON-LD / Markdown / YAML / CSS / アイランド) から `.png` のまま参照されている
    PNG は `--apply` でも**変換も削除もしない** (例: `logo-font.png` は `_includes/schema/organization.html` の JSON-LD、
    favicon 群は `_layouts/default.html`)。変換したいときは先に参照を `.webp` に書き換えてから実行する。
    判定は `src/lib/image-optimize.js` (`npm test`)。Liquid / HTML のコメント内と `docs_draft/` / `scripts/` / `e2e/` /
    README・CLAUDE・CHANGELOG / `*.test.js` の記述は参照に数えない。Liquid で組み立てたパスは検出できない
  - `<img>` には **`width` / `height` を必ず付ける** (CLS 対策)。ヒーローだけ
    `fetchpriority="high"` で lazy にしない (LCP 要素のため)、それ以外は
    `loading="lazy" decoding="async"`
- 動画は `assets/videos/` に配置。トップの hero は `assets/videos/hero-shape.webm` (T-710: Pexels 素材 ID 8379044 を
  Deepmosaic で検出・精緻化して書き出した 1080p から 6 秒 / 1280px / VP9 / ≤ 3 MB を切り出し、poster は
  `assets/img/hero/hero-shape-poster.webp`、`<video>` の中の `<img>` は video 非対応のフォールバック)。
  四角い枠と形に沿ったモザイクの比較静止画は `assets/img/samples/shape-compare-N-{rect,shape}.webp` (同じフレームを設定だけ変えて
  書き出したもの。**未加工のフレームは公開しない**、figcaption に「素材: Pexels」)。差し替え手順は親リポの
  CHANGELOG の T-710 (デスクトップで複製 → 写しを「形を変更 → すべて → 四角」→ 両方を 1080p で書き出し → ffmpeg で切り出し →
  `node scripts/optimize-images.mjs <dir> --apply`)。`src/lib/top-page-features.test.js` が属性・実在・容量を固定する
- **docs (`/docs/`, `/docs/web/`) の構成** (TICKET-SITE-42〜48)
  - `docs/index.html` / `docs/web/index.html` は front matter + 目次 + `{% include docs/*.html %}` の骨組みだけ。
    本文は章ごとに `_includes/docs/NN-*.html` (Desktop 6 章) と `_includes/docs/web.html`
  - 目次は `_data/docs_toc.yml` が単一情報源 (`_includes/docs-toc-list.html` が描画)。節を足したら
    本文の `<section id>` と目次の両方に書く。**既存 20 個の節 ID (about … trouble) はアプリ内ヘルプ /
    `/price/` / `/spec/` / `llms.txt` が参照する契約** — 改名・削除しない (`src/lib/docs-check.js` の
    `LEGACY_DOCS_IDS` が CI で強制する)
  - 節見出しは `{% include docs-h2.html kicker="章名" title="節名" %}`、定義表は `.kv / .kv-row / .kv-key /
    .kv-val / .kv-alt` をマークアップで直接使う (生ヘックス禁止)、キーは `<kbd>`
  - 検査: `node scripts/check-docs.mjs` (ビルド後)。スクショを差し替えたら
    `node scripts/check-docs.mjs --fix-dims` で `<img>` の width/height を実寸に同期する
  - スクリーンショットは desktop リポの `node scripts/e2e/screenshots.mjs --kill-existing --with-encode`
    (T-167、既定素材は 4K の非露骨サンプル) → `screenshots/*.png` を `assets/img/screenshots/` へコピー →
    `node scripts/optimize-images.mjs --apply` → `--fix-dims`。撮れない画面 (初回セットアップ中 /
    アップデート通知 / オフラインバナー / 他端末のサインイン) は文章のみ
  - 未実装・無効の機能は書かない (`Pro（無制限）` は非公開プラン。モザイクの精緻化 (**公開面 = 本文 / alt / figcaption / llms.txt / アセット名に「SAM」の語やモデル名を書かない、T-719。呼び方は「モザイクの精緻化」「物体の形に沿ったモザイク」。`top-page-features.test.js` が固定**) は 2.5.0 から GPU 機で既定 ON なので 03-detect / 04-edit に載せる (2.6.0 からは設定なしの標準機能)、Web 版は 2.6.1 から WebGPU の shader-f16 に対応した環境でだけ有効 = `web.html` にはその条件と「対応しない環境では四角い枠」を書く)。
    「使用時間の計測」の上限適用の方針文は事業判断なので勝手に変えない
- **スタイルは Tailwind CSS v4**。デザイントークン/移植した独自スタイルは `src/app.css` の `@theme` / `@layer components`、それ以外は markup に Tailwind ユーティリティを直書き。Materialize.css は撤去済み。
- **対話部品は Svelte 5 アイランド** (`src/islands/*.svelte`)。`src/main.js` が `[data-island="…"]` 要素にマウントする（プログレッシブ・エンハンスメント: JS 無効でも動作）。jQuery / lity は撤去済み。back-to-top と scroll-reveal は `main.js` の素の JS。
- **DL 計測の目印は `data-dl` 属性** (TICKET-SITE-37)。`src/main.js` の `initDownloadTracking()` が
  `a[data-dl]` **だけ**を見て href に `utm_*` / `ref` を載せ、GA4 の `file_download` を送る。
  Web 版への導線 (DL ではない) は `data-dl` の id の末尾を `-webapp` にすると `web_app_open` で送られる
  (`attribution.js` の `ga4EventNameFor`、T-1444)。Web 版の導線を足すときはこの命名に揃える。
  **DL ボタンを増やしたら `data-dl` を必ず付ける**（付け忘れると計測から静かに漏れる。CI が
  ページ単位で存在をチェックする）。値は GA4 の `link_id` になるので置き場所ごとに変える。
  純ロジックは `src/lib/attribution.js`（DOM に触らない。`node --test` で検証）。
  **素の href にクエリを焼き込まないこと** — 全訪問者とクローラに同じ utm が配られる。
- 新クラス追加時は Tailwind の `@source`（`src/app.css`）が対象 HTML を走査していること。新ディレクトリの HTML は `@source` に追加。
- Front matter: 全ページに `layout` / `title` / `description` を必ず指定 (SEO)
  - `title` はパンくず JSON-LD とナビが使う。SERP 用の文字列は `seo_title` に書く
    (無ければ `title｜<共通サフィックス>` が自動で組まれる)。**全角 30 文字以内**に収めること
- **製品説明の文言は `_data/entity.yml` が単一真実源** (TICKET-SITE-25)。トップの
  「Deepmosaic とは」/ JSON-LD の `disambiguatingDescription` / `llms.txt` /
  `/mosaic-removal/` / `/price/` `/spec/` のリード文が全てここを参照する。
  ページ側に直書きすると訂正として機能しなくなる
- **語彙ポリシー**: 「モザイクを *除去* するアプリ」という誤認が続いているため、
  製品説明では**方向を含む動詞**を使う。「モザイク処理」「モザイク作業」は日本語として
  かける／外すの両方向を指すので、単独では使わない (「モザイクをかける」「焼き込む」)。
  「除去」という語を置いてよいのは以下だけ:
  - トップの `meta description` (ランキング要因ではなくスニペット専用)
  - `_data/faq.yml` の質問文 1 件 (ユーザーが検索窓に打つ語との一致)
  - `/mosaic-removal/` (封じ込めシンク)
  - JSON-LD の `disambiguatingDescription` / `llms.txt`

  `<title>` / `h1` / kicker / 本文には置かない。打ち消しコピー自体が「モザイク 除去」
  クエリとの関連度を上げ、**より多くの誤認流入を呼び込む逆効果**を持つため。
  詳細は CHANGELOG の 2026-08-02 エントリを参照
- ⚠️ `<meta name="robots">` に **`noarchive` / `nocache` を追加しない**。Bing は
  これを Copilot での生成 AI 利用の可否として扱うため、入れると Copilot から消える

## Dependencies

**Ruby (`Gemfile`)**
- `jekyll` (~> 4.4)
- 関連プラグイン (`jekyll-feed`, `jekyll-seo-tag`, `jekyll-sitemap`)

**Node (`package.json`, devDependencies)**
- `tailwindcss` + `@tailwindcss/vite` (v4, CSS-first)
- `svelte` (v5, `mount()` API) + `@sveltejs/vite-plugin-svelte`
- `vite`

**外部 (CDN, 条件付き)**
- `video.js` (docs のみ・`needs_video: true` 時)

---

## Harness Binding (Agent Orchestration Contract)

ユーザー global `CLAUDE.md` のハーネス設計を本リポジトリで起動するためのバインディング。

### ドメインエージェント (`.claude/agents/`)

| Agent | 担当境界 |
|---|---|
| `jekyll-engineer` | `_config.yml` `_layouts/` `_includes/` `_data/` `Gemfile` (Jekyll 構造) |
| `content-engineer` | `index.html` `404.html` `docs/` `company/` `price/` (ページコンテンツ) |
| `frontend-engineer` | `assets/css/` `assets/js/` `assets/fonts/` `assets/img/` `assets/videos/` `assets/others/` |
| `seo-engineer` | `CNAME` `BingSiteAuth.xml` `sitemap.xml` `robots.txt` (SEO / 配信設定) |

並列起動: 4 エージェントは互いに素。`_config.yml` / `_layouts/default.html` の変更は全ページに影響するので architect 経由で共有してから着手。

### ゲート検証コマンド (Gate Verification Commands)

#### Jekyll ビルド (構文チェック)
```bash
npm run build && bundle exec jekyll build --strict_front_matter
```

> ⚠️ **`--strict_variables` は使えない** (TICKET-SITE-31 で判明)。Jekyll 4.4 の CLI に
> そのフラグは存在せず、付けると `invalid option` で落ちる。`_config.yml` の
> `liquid.strict_variables` として有効化することはできるが、`page.noindex` /
> `page.schemas` / `page.seo_title` など**未定義キーの分岐を全て例外にする**ため、
> このサイトの設計とは両立しない。ゲートは `--strict_front_matter` のみ。

front matter が YAML として読めるか (引用符なしの値の中の `: `・値の先頭の YAML の記号・引用符の閉じ忘れ・タブのインデントなど) は `npm test` の `src/lib/front-matter.test.js` (T-2322) が全ページを先に見る (YAML の依存を足さない小さな検査で、見る形・見ない形は `src/lib/front-matter.js` の先頭のコメント。テストの front matter の読み取り `fmScalar` もここにある)。

#### ビルド出力の回帰チェック
CI (`.github/workflows/jekyll.yml` の `Verify build output`) が実施する。ローカルで
同じことを確認したいときは、素通しファイルが HTML 化していないかを見るのが要点。

```bash
head -1 _site/llms.txt _site/robots.txt _site/llms-full.txt   # <!doctype が出たら NG
```

#### リンクチェック (オプション)
```bash
bundle exec jekyll build && find _site -name "*.html" | head -3
```

#### ブラウザ E2E（問い合わせフォーム・T-286 / T-332）

```bash
npm run e2e:install            # 初回のみ (Chromium)
npm run e2e                    # build → jekyll build → _site/ を 4173 で配信 → Playwright
E2E_SKIP_BUILD=1 npm run e2e   # ビルド済みの _site/ を使う (CI と同じ経路)
```

`e2e/inquiry.spec.ts` は `/enterprise/inquiry/` の送信フロー（検証エラーの aria 属性 /
全角電話の正規化 / 200・429・502 の文面 / 完了カードのフォーカス / honeypot / payload の形）を
固定する。`e2e/contact.spec.ts` (T-332、T-516 でメール + お問い合わせ内容の 2 項目に) は
`/contact/` の kind=general 側（項目立ての切り替え / 本文の上限 / `kind: 'general'` を載せた
payload に廃止した氏名・件名・バージョンが載らないこと）を固定する。
共通の道具立ては `e2e/lib/inquiry-harness.ts`。
**送信先は spec が `page.route` で差し替え、それ以外の外部通信は abort する** ため
本物の Worker は叩かない。endpoint と kind はビルド出力の `data-endpoint` / `data-kind` から
読むので、`_data/inquiry.yml` や `_includes/inquiry-form.html` の受け渡しが切れたら落ちる。

`e2e/mobile-nav.spec.ts` (T-291) はモバイルドロワーを Pixel 7 エミュレーションで **tap** し、
同一オリジンのリンクに `download` 属性が無いこと / 保存が起きず遷移することを固定する
（T-231 の再発防止。CI の grep ガードは `download={!!…}` の形しか拾えず、`Boolean(x)` は素通りする）。
この spec だけは本番へ向けられる — 公開後の確認に使う:

```bash
E2E_BASE_URL=https://www.deepmosaic.co.jp npx playwright test   # 配信サーバを立てず、mobile-nav だけを実行
```

`E2E_BASE_URL` を渡すと `playwright.config.ts` が対象を読み取りだけの spec に絞る
（問い合わせフォームの spec を本番へ向けない）。解析系のリクエストは spec が abort する。

英中のページ (i18n): `E2E_SKIP_BUILD=1 npx playwright test e2e/i18n-layout.spec.ts` (T-2215) が台帳 `_data/i18n_pages.yml` の英中のページを 2 つの幅 (1280×800 と Pixel 7) で開き、横スクロール・はみ出し・日本語の残りが無いことを見る。`DM_I18N_SHOTS=1` を足すと全ページの全面のスクリーンショットも撮る。許可の一覧は `e2e/i18n-allow.json` (`{ version, entries[] }`、足してよいのは検査の誤検出だけで各項目に理由が必須)。
ほかに `e2e/i18n-contact.spec.ts` (英中のお問い合わせ・導入相談・参加・404)・`e2e/i18n-nav.spec.ts` (言語の切り替え)・`e2e/i18n-suggest.spec.ts` (ja のページの言語の案内の帯と選んだ言語の記憶) がある。どれも `npx playwright test` の全件に入る。

⚠️ **E2E 一式 (`e2e/` `playwright.config.ts`) は `_config.yml` の `exclude` に入れる。**
外すと Jekyll が `_site/` に複製して配信してしまう（CI の `Verify build output` が検知する）。

#### dev server スモーク
```bash
bundle exec jekyll serve --port 4000 &
sleep 3 && curl -s http://localhost:4000/ | grep -q "<html"
```

### プロジェクト固有チェックリスト

#### code-reviewer 観点
- [ ] 全ページに front matter (`layout` / `title` / `description`) があるか
- [ ] `<title>` が全角 30 文字以内か (超えるなら `seo_title` を書く)
- [ ] Liquid 構文エラーがないか (`{{ }}` / `{% %}`)
- [ ] 英中の文は `_data/lang/{en,zh-tw}.json` / `_data/l10n/<lang>/` から引き、ja の直書きは変えていないか (ja-identity が通る)
- [ ] 製品説明の文言を `_data/entity.yml` 経由で参照しているか (直書き禁止)
- [ ] 「モザイク処理」を方向を明示せずに単独で使っていないか (語彙ポリシー)
- [ ] レスポンシブ (モバイル) でレイアウトが崩れていないか
- [ ] 画像に `alt` 属性と `width` / `height` があるか。**alt が実画像の内容と一致するか**
      (TICKET-SITE-34 で「設定パネルが開いている」と書きながら開いていない alt が見つかった)

#### security-reviewer 観点
- [ ] 外部 JS / iframe を読み込む場合 SRI / CSP を考慮しているか
- [ ] `target="_blank"` リンクに `rel="noopener noreferrer"` があるか
- [ ] 機密情報 (API キー / メールアドレス生情報) が公開ページに混ざっていないか
- [ ] `_config.yml` の `url` / `baseurl` がリーク前提の正しい値か

### 層間通信ルール

許可された呼び出し経路:

```
[_config.yml] サイト全体設定
        ↓
[_layouts/default.html] 共通テンプレート
        ↓ {% include %}
[_includes/*.html] ヘッダ / フッタ / 部品
        ↓
[index.html / 404.html / docs/* / company/* / price/*] 各ページ
        ↓
[assets/css/*] [assets/js/*] [assets/img/*]
```

直接通信禁止:

- 各ページから `_layouts/` / `_includes/` をスキップして独自 HTML を書かない (テンプレート遵守)
- インライン CSS / JS は最小限。基本は `assets/` 配下のファイルから読む
- ページ間で重複する HTML 断片は `_includes/` に抽出

### 複雑度別スキップルール

| 複雑度 | 例 | 実行範囲 |
|---|---|---|
| 小規模 | テキスト修正、画像差し替え、リンク修正 | content-engineer 単独 → code-reviewer |
| 中規模 | 新ページ追加、layout 拡張、新言語追加 | 全 5 フェーズ |
| 大規模 | サイト構造刷新、デザインシステム刷新、Jekyll → 他 SSG 移行 | 全 5 フェーズ + architect 必須 |
