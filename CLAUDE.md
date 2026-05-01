# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeepMosaic 公式サイト。Jekyll ベースの静的サイト (GitHub Pages 配信)。製品紹介、ドキュメント、価格、企業情報、ダウンロードページを含む。

## Commands

```bash
# 依存インストール
bundle install

# ローカル dev server (port 4000)
bundle exec jekyll serve

# ビルド (出力: _site/)
bundle exec jekyll build

# Draft 含めて serve
bundle exec jekyll serve --drafts
```

## Architecture

### ディレクトリ

| パス | 役割 |
|---|---|
| `_config.yml` | Jekyll 設定 (サイト全体) |
| `_layouts/` | テンプレート (`default.html`) |
| `_includes/` | パーツ (`header.html`, `footer.html`, `download-button.html`, `spec-table.html`) |
| `_data/` | YAML データ (lang/i18n) |
| `_site/` | ビルド出力 (gitignore 対象) |
| `assets/` | css / js / img / fonts / videos |
| `docs/` | ドキュメントページ |
| `company/` | 企業情報ページ |
| `price/` | 価格ページ |
| `index.html` / `404.html` | トップページ / 404 |
| `CNAME` | カスタムドメイン |
| `BingSiteAuth.xml` / `sitemap.xml` / `robots.txt` | SEO |

### i18n

`_data/lang/` 配下の YAML で多言語対応。Liquid テンプレートで `site.data.lang.<lang>.<key>` 参照。

## Conventions

- Jekyll の Liquid テンプレート構文
- 画像は `assets/img/` に配置 (WebP 推奨)
- 動画は `assets/videos/` に配置
- CSS は `assets/css/` (素の CSS / SCSS)
- JS は `assets/js/` (素の JS)
- Front matter: 全ページに `layout` / `title` / `description` を必ず指定 (SEO)

## Dependencies (`Gemfile`)

- `jekyll`
- `github-pages`
- 関連プラグイン (`jekyll-seo-tag`, `jekyll-sitemap` 等)

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
bundle exec jekyll build --strict_front_matter --strict_variables
```

#### リンクチェック (オプション)
```bash
bundle exec jekyll build && find _site -name "*.html" | head -3
```

#### dev server スモーク
```bash
bundle exec jekyll serve --port 4000 &
sleep 3 && curl -s http://localhost:4000/ | grep -q "<html"
```

### プロジェクト固有チェックリスト

#### code-reviewer 観点
- [ ] 全ページに front matter (`layout` / `title` / `description`) があるか
- [ ] Liquid 構文エラーがないか (`{{ }}` / `{% %}`)
- [ ] i18n 文字列を `_data/lang/` 経由で参照しているか (ハードコード禁止)
- [ ] レスポンシブ (モバイル) でレイアウトが崩れていないか
- [ ] 画像に `alt` 属性があるか

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
