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
| `_data/` | YAML データ (lang/i18n) |
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
| `CNAME` | カスタムドメイン |
| `BingSiteAuth.xml` / `sitemap.xml` / `robots.txt` | SEO |
| `llms.txt` / `llms-full.txt` | AI 向けのサイト概要 (`layout: null` 必須) |

### i18n

`_data/lang/` 配下の YAML で多言語対応。Liquid テンプレートで `site.data.lang.<lang>.<key>` 参照。

## Conventions

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
- 動画は `assets/videos/` に配置
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
    アップデート通知 / オフラインバナー / 他端末ログイン) は文章のみ
  - 未実装・無効の機能は書かない (SAM は機能フラグ OFF、`Pro（無制限）` は非公開プラン)。
    「使用時間の計測」の上限適用の方針文は事業判断なので勝手に変えない
- **スタイルは Tailwind CSS v4**。デザイントークン/移植した独自スタイルは `src/app.css` の `@theme` / `@layer components`、それ以外は markup に Tailwind ユーティリティを直書き。Materialize.css は撤去済み。
- **対話部品は Svelte 5 アイランド** (`src/islands/*.svelte`)。`src/main.js` が `[data-island="…"]` 要素にマウントする（プログレッシブ・エンハンスメント: JS 無効でも動作）。jQuery / lity は撤去済み。back-to-top と scroll-reveal は `main.js` の素の JS。
- **DL 計測の目印は `data-dl` 属性** (TICKET-SITE-37)。`src/main.js` の `initDownloadTracking()` が
  `a[data-dl]` **だけ**を見て href に `utm_*` / `ref` を載せ、GA4 の `file_download` を送る。
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
- [ ] i18n 文字列を `_data/lang/` 経由で参照しているか (ハードコード禁止)
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
