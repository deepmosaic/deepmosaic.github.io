# deepmosaic.github.io

Deepmosaic 公式サイト（ランディングページ）。**Jekyll (Ruby)** 製の静的サイトで GitHub Pages に配信。スタイルは **Tailwind CSS v4**、対話部品（モバイルメニュー / FAQ / スクロールスパイ / 動画ライトボックス）は **Svelte 5 アイランド**。フロントエンドは **Vite** でビルドする。

## 構成（2 段ビルド）

```
src/ (Tailwind + Svelte)  ──[Vite]──▶  assets/dist/app.{css,js}  ──[Jekyll]──▶  _site/
```

Vite が Tailwind CSS と Svelte アイランドを `assets/dist/app.css` / `app.js` に出力し、その後 Jekyll がそれらを取り込んでサイトを生成する。**必ず `npm run build` を先に実行してから** Jekyll を動かすこと（先に実行しないとスタイル / JS が反映されず、素の HTML になる）。

## 必要環境

- **Ruby + Bundler**（Jekyll 用）: https://rubyinstaller.org/downloads/
- **Node.js 20.19+ もしくは 22+**（Vite / Tailwind / Svelte 用）

## セットアップ（初回のみ）

```bash
bundle install   # Ruby gem (Jekyll ほか)
npm install      # Node (Tailwind v4 / Svelte 5 / Vite)
```

## ローカル開発

```bash
# 1) フロントエンドアセットをビルド（assets/dist/app.css, app.js を生成）
npm run build

# 2) Jekyll dev server 起動（http://localhost:4000）
bundle exec jekyll serve
```

`src/`（Tailwind / Svelte）を編集しながら反復開発する場合は、**別ターミナル**で Vite の watch を回すと保存時に `assets/dist/` が自動再生成される:

```bash
npm run dev      # = vite build --watch
```

- `_layouts` / `_includes` / 各ページ HTML など **Jekyll 側だけ**の編集なら、`bundle exec jekyll serve --livereload` の再生成で足りる。
- `src/` の **CSS / Svelte を変えたとき**だけ `npm run build`（または `npm run dev` の watch）が必要。

> **Windows 注意**: `jekyll serve --detach` は `fork()` 未実装のため使えない。`--detach` を付けずに実行すること。

## 本番ビルド

```bash
npm run build && bundle exec jekyll build   # 出力: _site/
```

## デプロイ

`master` への push で GitHub Actions（`.github/workflows/jekyll.yml`）が走り、`npm ci` → `npm run build` → `jekyll build` の順でビルドして GitHub Pages に配信する。`assets/dist/` は CI で生成されるためコミット不要。

## 主なディレクトリ

| パス | 役割 |
|---|---|
| `src/app.css` | Tailwind v4 エントリ（`@theme` トークン + 移植した独自スタイル） |
| `src/main.js` | アイランドのマウント + back-to-top / scroll-reveal（素の JS） |
| `src/islands/*.svelte` | 対話部品（MobileNav / Accordion / Scrollspy / VideoLightbox） |
| `_layouts/` `_includes/` | Jekyll テンプレート / 共通パーツ |
| `index.html` `docs/` `price/` `company/` `404.html` | 各ページ |
| `assets/dist/` | Vite 出力（**gitignore** ・CI 再生成） |
| `assets/` | 画像 / フォント / 動画 / `fonts.css`（自己ホスト Roboto） |

## メモ / トラブルシュート

- `assets/dist/` と `node_modules/` は **gitignore**（CI で再生成）。**`package-lock.json` はコミットする**（`npm ci` に必要）。
- Jekyll のビルド対象にするには、ファイル先頭に front matter（`--- ... ---`。中身が空でも `---` 2 行）が必要。無いと `_site` に出力されない。
- `bundle exec jekyll serve` で `webrick (LoadError)` が出る場合は `bundle add webrick`、改善しなければ `gem update` を試す。
