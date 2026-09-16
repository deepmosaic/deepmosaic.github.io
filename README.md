# deepmosaic.github.io

Deepmosaic 公式サイト（ランディングページ）。**Jekyll (Ruby)** 製の静的サイトで GitHub Pages に配信。スタイルは **Tailwind CSS v4**、対話部品（モバイルメニュー / FAQ / スクロールスパイ / 動画ライトボックス）は **Svelte 5 アイランド**。フロントエンドは **Vite** でビルドする。

## 構成（2 段ビルド）

```
src/ (Tailwind + Svelte)  ──[Vite]──▶  assets/dist/app.{css,js}  ──[Jekyll]──▶  _site/
```

Vite が Tailwind CSS と Svelte アイランドを `assets/dist/app.css` / `app.js` に出力し、その後 Jekyll がそれらを取り込んでサイトを生成する。**必ず `npm run build` を先に実行してから** Jekyll を動かすこと（先に実行しないとスタイル / JS が反映されず、素の HTML になる）。

> **重要**: サイトを配信するのは **Jekyll 側だけ**。Vite の dev server は構成していないため、npm 側単独ではサイトを閲覧できない（`npm run dev` = `vite build --watch` は HTTP エンドポイントを持たないアセット watcher）。閲覧は必ず `bundle exec jekyll serve` 経由。

## 前提条件

Windows 11 のクリーン環境からの再現手順。Docker / yarn / pnpm は不要。

| ツール | バージョン | 備考 |
|---|---|---|
| Node.js + npm | **20.19+ もしくは 22+**（動作確認: Node v24 / npm 11） | https://nodejs.org/ |
| Ruby + DevKit | **3.4**（Jekyll 用） | 下記 winget コマンドでインストール |
| Bundler | Ruby 3.4 に同梱 | 個別インストール不要 |
| Git | 任意の近年版 | クローンに使用 |

Ruby + DevKit のインストール（PowerShell、動作確認済み）:

```powershell
winget install RubyInstallerTeam.RubyWithDevKit.3.4 --accept-package-agreements --accept-source-agreements --silent
```

- `C:\Ruby34-x64` にインストールされ、ユーザー PATH に追加される。
- **PATH 反映のため、インストール後は必ず新しいシェルを開き直す**こと（開き直さないと `ruby` / `bundle` が見つからない）。

## セットアップ手順

リポジトリのルートで以下を順に実行する（初回のみ）:

```powershell
# 1) Ruby gem のインストール（Jekyll 4.4 ほか 41 gem。
#    native 拡張は同梱の MSYS2 devkit で自動ビルドされる）
bundle install

# 2) Node 依存のインストール（package-lock.json 通りに再現）
npm ci
```

- `npm ci` は `package-lock.json` を使う。**`package-lock.json` はコミット対象**（CI の `npm ci` にも必要）。
- `assets/dist/` と `node_modules/` は **gitignore**（CI で再生成されるためコミット不要）。

## 環境変数

このリポジトリに `.env` / `.env.example` は**存在しない**。**基本の起動に必須の環境変数も無い**（何も設定せずにビルド・起動できる）。任意で使うものは以下の 2 つのみ:

| 変数 | 秘匿 | 必須 | 用途 | 入手先 |
|---|---|---|---|---|
| `SUPABASE_PROXY_API_KEY` | **秘匿** | 任意 | `npm test` 末尾の Supabase `plan_catalog` ライブ照合テスト 1 件を有効化する（未設定なら設計どおり skip）。CI では `scripts/check-plan-catalog.mjs` も使用 | Supabase proxy Worker の X-API-Key。GitHub Actions の secret `SUPABASE_PROXY_API_KEY` と同じ値（リポジトリ管理者から受領） |
| `PLAN_CATALOG_URL` | 非秘匿 | 任意（**ローカル検証専用**） | `scripts/check-plan-catalog.mjs` の取得先を上書きし、スタブサーバで「値をずらしたら落ちる」ことを確認するために使う。**CI では設定しない** | 自分で立てたスタブの URL |

設定例（PowerShell、現在のシェルのみ有効。実際の値は書き残さないこと）:

```powershell
$env:SUPABASE_PROXY_API_KEY = "<your-api-key>"
```

## 起動

```powershell
# 1) フロントエンドアセットを生成（assets/dist/app.css, app.js。省略不可）
npm run build

# 2) Jekyll dev server 起動（port 4000）
bundle exec jekyll serve --port 4000
```

- ブラウザで **http://127.0.0.1:4000/**（= `http://localhost:4000/`）を開く。HTTP 200 でトップページが表示されれば成功（動作確認済み）。
- 停止は `Ctrl+C`。
- > **Windows 注意**: `jekyll serve --detach` は `fork()` 未実装のため使えない。`--detach` を付けずに実行すること。

### 反復開発（2 ターミナル構成）

`src/`（Tailwind / Svelte）を編集しながら開発する場合:

```powershell
# ターミナル 1: サイト配信
bundle exec jekyll serve --port 4000

# ターミナル 2: Vite watch（保存時に assets/dist/ を自動再生成）
npm run dev
```

- `_layouts` / `_includes` / 各ページ HTML など **Jekyll 側だけ**の編集なら、`bundle exec jekyll serve --livereload` の再生成で足りる（`npm run dev` は不要）。
- `src/` の **CSS / Svelte を変えたとき**だけ `npm run build`（または `npm run dev` の watch）が必要。

## 動作確認（スモークチェック）

サーバ起動中に別ターミナルで:

```powershell
(Invoke-WebRequest http://127.0.0.1:4000/ -UseBasicParsing).StatusCode   # => 200
```

ユニットテスト（ネットワーク不要。`src/lib/*.test.js` を `node --test` で実行）:

```powershell
npm test
```

期待結果: **129 件中 128 pass / 1 skip** (2026-09-17 時点)。skip の 1 件は `SUPABASE_PROXY_API_KEY` 未設定時に設計どおり飛ばされる plan_catalog ライブ照合（→「環境変数」参照）。失敗 0 が正常。

## ブラウザ E2E（Enterprise 問い合わせフォーム）

`/enterprise/inquiry/` の送信フローを実ブラウザ（Chromium）で検証する（T-286）。`npm test` が見るのは `src/lib/inquiry-validate.js` の**純ロジックだけ**で、**Jekyll の `data-endpoint` → Svelte アイランドの props → `fetch`** という配線はここでしか固定できない。

```powershell
npm run e2e:install   # 初回のみ: Chromium を取得（既にあれば何もしない）
npm run e2e           # npm run build → jekyll build → _site/ を配信 → Playwright
```

ビルドから配信までは `playwright.config.ts` の `webServer` が面倒を見る（`e2e/lib/serve.mjs` が `_site/` を <http://127.0.0.1:4173> で配る。node:http だけで書いてあり依存は増えない）。**ビルド済みの `_site/` をそのまま**使いたいときは:

```powershell
$env:E2E_SKIP_BUILD = "1"; npm run e2e
```

固定している振る舞い（`e2e/inquiry.spec.ts`・9 件）:

| 検証 | 期待 |
|---|---|
| 未入力のまま送信 | 項目ごとのエラー文 + `aria-invalid` / `aria-describedby`、最初の誤りへフォーカス、Worker は叩かない |
| 全角で打った電話番号 | `（０３）１２３４－５６７８` → `(03)1234-5678` に直してから送る |
| 利用アカウント予定数 < 3 | Enterprise の下限（3 アカウント）を示して止まる |
| 200 `{ok:true, mail:true}` | 完了カード + 受付確認メールの案内、カードへフォーカス移動、「閉じる」で空のフォームに戻る |
| 200 `{ok:true}` | 完了カードは出すが受付確認メールの案内は出さない |
| 429 | レート制限の案内。入力は消さず再送できる |
| 502 | `support_email` を添えた案内 |
| ハニーポット `website` | 埋まっていても送信し、その値を payload に載せる（bot 判定は Worker 側の責務） |
| payload の形 | `company` / `name` / `email` / `phone` / `seats`（整数） / `message` / `website`。`turnstileToken` はサイトキーが空の間は載せない |

> ⚠️ **本物の Worker は絶対に叩かない。** spec は `beforeEach` で配信サーバ以外への通信を abort し、`data-endpoint`（`_data/inquiry.yml`）だけを `page.route` で差し替える。endpoint はテストに直書きせず**ビルド出力の `data-endpoint` から読む**ので、`_data/inquiry.yml` の受け渡しが切れたら気付ける。

CI（`.github/workflows/jekyll.yml`）は `Verify build output` の後に `E2E_SKIP_BUILD=1` で同じ spec を走らせ、失敗すればデプロイごと止める。**この env を外さないこと** — `_site/` を作り直すと `JEKYLL_ENV=production` も `--baseurl` も無い出力を Pages に上げてしまう。

E2E のコードはこのリポジトリ唯一の TypeScript / Playwright 資産で、Prettier の設定は置いていない。整形はモノレポの `web` のバイナリを明示オプションで使う:

```powershell
../web/node_modules/.bin/prettier --no-config --single-quote --print-width 100 --check e2e playwright.config.ts
```

## 本番ビルド

```powershell
npm run build
bundle exec jekyll build --strict_front_matter   # 出力: _site/
```

> ⚠️ `--strict_variables` という CLI フラグは **Jekyll 4.4 に存在しない**（付けると `invalid option` で落ちる）。ゲートは `--strict_front_matter` のみ（詳細は `CLAUDE.md` 参照）。

## デプロイ

`master` への push で GitHub Actions（`.github/workflows/jekyll.yml`）が走り、`npm ci` → `npm run build` → `jekyll build` の順でビルドして GitHub Pages に配信する。`assets/dist/` は CI で生成されるためコミット不要。

## 主なディレクトリ

| パス | 役割 |
|---|---|
| `src/app.css` | Tailwind v4 エントリ（`@theme` トークン + 移植した独自スタイル） |
| `src/main.js` | アイランドのマウント + back-to-top / scroll-reveal（素の JS） |
| `src/islands/*.svelte` | 対話部品（MobileNav / Accordion / Scrollspy / VideoLightbox） |
| `src/lib/` | 純ロジック + テスト（`npm test` の対象） |
| `_layouts/` `_includes/` | Jekyll テンプレート / 共通パーツ |
| `index.html` `docs/` `price/` `company/` `404.html` | 各ページ |
| `docs/index.html` `docs/web/index.html` | ドキュメント (Desktop 版 / Web 版)。骨組みだけを持ち、本文は `_includes/docs/*.html`、目次は `_data/docs_toc.yml` |
| `scripts/check-docs.mjs` | docs の回帰ガード (契約 ID / 目次 / リンク / 画像)。`npm run build && bundle exec jekyll build` の後に `node scripts/check-docs.mjs`。CI でも実行 |
| `playwright.config.ts` `e2e/` | 問い合わせフォームのブラウザ E2E（`npm run e2e`）。配信サーバは `e2e/lib/serve.mjs`。公開物ではないので `_config.yml` の `exclude` に入れてある |
| `assets/dist/` | Vite 出力（**gitignore** ・CI 再生成） |
| `assets/` | 画像 / フォント / 動画 / `fonts.css`（自己ホスト Roboto） |

## トラブルシューティング

- **ページが素の HTML（スタイル / JS 無し）で表示される** → `npm run build` を実行してから Jekyll を起動していない。`assets/dist/app.css` / `app.js` が生成済みか確認。
- **`npm run dev` を起動したのにブラウザで見られない** → `npm run dev` は HTTP サーバではない（アセット watcher）。閲覧は `bundle exec jekyll serve` で行う。
- **`ruby` / `bundle` が見つからない** → winget での Ruby インストール後にシェルを開き直していない。新しい PowerShell を開く。
- **`jekyll serve --detach` が `fork() function is unimplemented` で落ちる** → Windows では `--detach` 不可。付けずに実行。
- **`jekyll build --strict_variables` が `invalid option` で落ちる** → そのフラグは Jekyll 4.4 CLI に存在しない。`--strict_front_matter` を使う。
- **ビルド中に Svelte の警告が出る** → `VideoLightbox.svelte` の a11y 警告と `RoiCalculator.svelte` の `state_referenced_locally` 警告はビルド時に毎回出るが、**既知かつ無害**（ビルドは成功する）。
- **`bundle exec jekyll serve` で `webrick (LoadError)`** → `bundle add webrick`、改善しなければ `gem update` を試す。
- **ページが `_site/` に出力されない** → ファイル先頭に front matter（`--- ... ---`。中身が空でも `---` 2 行）が必要。無いと Jekyll のビルド対象にならない。
- **`npm test` で 1 件 skip される** → 正常（`SUPABASE_PROXY_API_KEY` 未設定時の設計どおりの挙動。「環境変数」参照）。

## 任意 / オプション（基本の起動には不要）

- **`SUPABASE_PROXY_API_KEY` の設定** — `npm test` の plan_catalog ライブ照合 1 件が有効になる（92 件全件実行）。未設定でも開発・起動に支障なし。
- **`node scripts/check-plan-catalog.mjs`** — `_data/plans.yml` と Supabase `plan_catalog` の乖離検査（CI が実行。鍵が無ければスキップして exit 0）。
- **`bundle exec jekyll serve --livereload`** — Jekyll 側のみの編集時にブラウザ自動リロード。
- **画像追加時の運用**（WebP 必須・`node scripts/optimize-images.mjs --apply` 等）は `CLAUDE.md` の Conventions を参照。
