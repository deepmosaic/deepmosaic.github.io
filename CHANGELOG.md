# CHANGELOG

## 2026-03-09 - Maintenance: Ruby/Gem最新化 & リファクタリング

- [x] TICKET-001: Gemfile最新化（Jekyll 4.4+, minima削除, 依存関係整理）
- [x] TICKET-002: _config.yml整備（サイト設定の集約、exclude, defaults設定追加）
- [x] TICKET-003: 共通パーツのinclude化（spec-table.html, download-button.html）
- [x] TICKET-004: dead code除去（コメントアウト済みHTML、未使用CSS約300行削除）
- [x] TICKET-005: Gemfile.lock削除（bundle install再実行で再生成が必要）
- [x] TICKET-006: canonical URL正規化（index.html除去、_siteをgit追跡から除外）
- [x] TICKET-007: .gitignore整備（_site, .jekyll-cache, .sass-cache, vendor追加）
- [x] TICKET-008: GitHub Actions Jekyll 4.4デプロイワークフロー追加（GitHub Pages標準ビルドはJekyll 3.9固定のため）
