# CHANGELOG

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
