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
| `PRICE_CHECK_API_KEY` | **秘匿** | 任意 | `npm test` 末尾の料金カタログのライブ照合テスト 1 件と、CI の `scripts/check-plan-catalog.mjs` を有効化する（`PRICE_CHECK_URL` と両方そろわなければ設計どおり skip） | 料金カタログの読み取り用の鍵。GitHub Actions の secret と同じ値（管理者から受け取る） |
| `PRICE_CHECK_URL` | **秘匿** | 任意 | 料金カタログの取得先（`livemode=true` は自動で付く）。ローカルでは自分で立てたスタブの URL を渡し、「値をずらしたら落ちる」ことを確認できる | 管理者から受け取る（GitHub Actions の secret と同じ値。公開のログに出さないため secret にしている） |

設定例（PowerShell、現在のシェルのみ有効。実際の値は書き残さないこと）:

```powershell
$env:PRICE_CHECK_API_KEY = "<your-api-key>"
$env:PRICE_CHECK_URL = "<catalog-url>"
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

期待結果: 失敗 0。skip のうち 1 件は `PRICE_CHECK_API_KEY` / `PRICE_CHECK_URL` 未設定時に設計どおり飛ばされる料金カタログのライブ照合（→「環境変数」参照）。

## ブラウザ E2E（問い合わせフォーム）

`/enterprise/inquiry/`（Enterprise 導入相談）と `/contact/`（一般のお問い合わせ）の送信フローを実ブラウザ（Chromium）で検証する。`npm test` が見るのは `src/lib/inquiry-validate.js` の**純ロジックだけ**で、**Jekyll の `data-endpoint` / `data-kind` → Svelte アイランドの props → `fetch`** という配線はここでしか固定できない。

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
| 未入力のまま送信 | 項目ごとのエラー文 + `aria-invalid` / `aria-describedby`、最初の誤りへフォーカス、送信しない |
| 全角で打った電話番号 | `（０３）１２３４－５６７８` → `(03)1234-5678` に直してから送る |
| 利用アカウント予定数 < 1 | Enterprise の下限（1 アカウント）を示して止まる |
| 200 `{ok:true, mail:true}` | 完了カード + 受付確認メールの案内、カードへフォーカス移動、「閉じる」で空のフォームに戻る |
| 200 `{ok:true}` | 完了カードは出すが受付確認メールの案内は出さない |
| 429 | レート制限の案内。入力は消さず再送できる |
| 502 | `support_email` を添えた案内 |
| `website` 欄 | 埋まっていても送信し、その値を payload に載せる |
| payload の形 | `company` / `name` / `email` / `phone` / `seats`（整数） / `message` / `website`。`turnstileToken` はサイトキーが空の間は載せない |

> ⚠️ **本物の送信先は絶対に叩かない。** spec は `beforeEach` で配信サーバ以外への通信を abort し、`data-endpoint`（`_data/inquiry.yml`）だけを `page.route` で差し替える。endpoint はテストに直書きせず**ビルド出力の `data-endpoint` から読む**ので、`_data/inquiry.yml` の受け渡しが切れたら気付ける。

CI（`.github/workflows/jekyll.yml`）は `Verify build output` の後に `E2E_SKIP_BUILD=1` で同じ spec を走らせ、失敗すればデプロイごと止める。**この env を外さないこと** — `_site/` を作り直すと `JEKYLL_ENV=production` も `--baseurl` も無い出力を Pages に上げてしまう。

E2E のコードはこのリポジトリ唯一の TypeScript / Playwright 資産で、Prettier の設定は置いていない。整形は Prettier を明示オプションで使う:

```powershell
npx prettier --no-config --single-quote --print-width 100 --check e2e playwright.config.ts
```

## 問い合わせフォームの送信先

本番のビルド (`JEKYLL_ENV=production`) は `_data/inquiry.yml` の `endpoint` に送る。ほかのビルド (`bundle exec jekyll serve` など) は、
リポジトリに置かない設定ファイル `_config.local.yml` (`.gitignore` 済み) に `inquiry_endpoint_dev` があればそこへ、無ければ `endpoint` へ送る:

```powershell
# _config.local.yml に 1 行: inquiry_endpoint_dev: "<開発用の受け口の URL>"
bundle exec jekyll serve --port 4000 --config _config.yml,_config.local.yml
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
| `en/docs/` `zh-tw/docs/` | 英中のドキュメント (`/en/docs/`・`/en/docs/web/`・`/zh-tw/…`)。骨組みだけを持ち、本文は `_includes/docs/<en\|zh-tw>/*.html`、目次は `_data/l10n/<lang>/docs_toc.yml` |
| `scripts/i18n/docs-diff.mjs` | docs の訳の include (`_includes/docs/<en\|zh-tw>/`) のうち、日本語の節が変わって訳の直しが要る節と日本語の今のソースを出す (`node scripts/i18n/docs-diff.mjs [en\|zh-tw]`)。直したら `node scripts/i18n/accept-site.mjs <訳の include> --section <節の id>` |
| `scripts/optimize-images.mjs` | PNG → WebP 変換 (ffmpeg)。既定の対象は `assets/img/screenshots/` 直下だけ、`<dir>` で明示も可。引数なしは一覧表示のみ、`--apply` で変換して元 PNG を削除。原稿から参照中の PNG は `[KEEP]` で残す (判定は `src/lib/image-optimize.js`) |
| `playwright.config.ts` `e2e/` | 問い合わせフォームのブラウザ E2E（`npm run e2e`）。配信サーバは `e2e/lib/serve.mjs`。公開物ではないので `_config.yml` の `exclude` に入れてある |
| `assets/dist/` | Vite 出力（**gitignore** ・CI 再生成） |
| `assets/` | 画像 / フォント / 動画 / `fonts.css`（自己ホスト Roboto） |

## Microsoft Store のバッジ

ダウンロードの導線は Microsoft Store の公式のバッジだけ。画像は Microsoft の配布元 (https://github.com/microsoft/app-store-badge の HTML 版のバッジと同じ置き場所) から取り、**形・色・文字・縦横比を変えずに**そのまま `assets/img/store-badge/` に置いている (サイトの地が暗いので dark 版 = 黒地に白い文字)。外部のバッジのスクリプトは読み込まない。

| ファイル | 取った元 (2026-11-23 に取得) | sha256 |
|---|---|---|
| `assets/img/store-badge/ja.svg` | https://get.microsoft.com/images/ja%20dark.svg | `35132ffb47c99587958570939f2fcef0c242fdae763a153ae8ac5bfd7ce98781` |
| `assets/img/store-badge/en.svg` | https://get.microsoft.com/images/en-us%20dark.svg | `0e0cd666d0b351bc2680658faf8485a5d2d78d2ab14086d37fca7f0e8c12fa69` |
| `assets/img/store-badge/zh-tw.svg` | https://get.microsoft.com/images/zh-tw%20dark.svg | `a2949f62dd83d980140e42817b6f701d57d95e18009526017198a22c9beae06e` |

- 使い方: `<img>` の `width="161" height="44"` (元の寸法) を保ち、CSS では高さだけを決めて幅は `w-auto` にする (普通のボタンの所は 38px、トップの冒頭とページ末尾の案内は 60px / sm 以上 72px)。周りの余白を詰めない。
- 縁: dark 版の地 (#202020) と縁 (黒 10%) はサイトの地 (#1f1f1f) に溶けて形が見えないので、画像は変えずに包むリンクの外側へ明るい 1px の縁を描く (`src/app.css` の `.store-badge-link`、box-shadow なので寸法は変わらない)。`store-button.html` とヘッダーのリンクに付ける。
- alt はバッジに書かれた文 (ja「Microsoft Store からダウンロード」、en「Download from the Microsoft Store」、zh-tw「從 Microsoft Store 下載」)。
- 行き先は Microsoft Store のインストーラを直接ダウンロードする URL `https://get.microsoft.com/installer/download/<ID>?referrer=appbadge&source=www.deepmosaic.co.jp` (`_includes/store-install-url.html` が組む。3 言語で同じ)。押すと小さなインストーラ (`Deepmosaic Installer.exe`) がダウンロードされ、開くと Microsoft Store を通して入る。応答は常にファイルの保存なので、リンクに `target` を付けない (同じタブ)。
- 料金のカードのダウンロードのカード (HOBBY) は、バッジではなく青い主ボタン「アプリをダウンロード」(行き先は同じ)。Free の帯はバッジ。
- 差し替えるときは同じ URL から取り直し、表の sha256 を書き直す (`src/lib/site-store-button.test.js` が照合する)。配布元のバイトのまま置くため、`.gitattributes` で改行を変換しない。

## トラブルシューティング

- **ページが素の HTML（スタイル / JS 無し）で表示される** → `npm run build` を実行してから Jekyll を起動していない。`assets/dist/app.css` / `app.js` が生成済みか確認。
- **`npm run dev` を起動したのにブラウザで見られない** → `npm run dev` は HTTP サーバではない（アセット watcher）。閲覧は `bundle exec jekyll serve` で行う。
- **`ruby` / `bundle` が見つからない** → winget での Ruby インストール後にシェルを開き直していない。新しい PowerShell を開く。
- **`jekyll serve --detach` が `fork() function is unimplemented` で落ちる** → Windows では `--detach` 不可。付けずに実行。
- **`jekyll build --strict_variables` が `invalid option` で落ちる** → そのフラグは Jekyll 4.4 CLI に存在しない。`--strict_front_matter` を使う。
- **ビルド中に Svelte の警告が出る** → `VideoLightbox.svelte` の a11y 警告と `RoiCalculator.svelte` の `state_referenced_locally` 警告はビルド時に毎回出るが、**既知かつ無害**（ビルドは成功する）。
- **`bundle exec jekyll serve` で `webrick (LoadError)`** → `bundle add webrick`、改善しなければ `gem update` を試す。
- **ページが `_site/` に出力されない** → ファイル先頭に front matter（`--- ... ---`。中身が空でも `---` 2 行）が必要。無いと Jekyll のビルド対象にならない。
- **`npm test` で 1 件 skip される** → 正常（`PRICE_CHECK_API_KEY` / `PRICE_CHECK_URL` 未設定時の設計どおりの挙動。「環境変数」参照）。

## 任意 / オプション（基本の起動には不要）

- **`PRICE_CHECK_API_KEY` と `PRICE_CHECK_URL` の設定** — `npm test` の料金カタログのライブ照合 1 件が有効になる。未設定でも開発・起動に支障なし。
- **`node scripts/check-plan-catalog.mjs`** — `_data/plans.yml` と料金カタログの乖離検査（CI が実行。鍵か取得先が無ければスキップして exit 0）。
- **`bundle exec jekyll serve --livereload`** — Jekyll 側のみの編集時にブラウザ自動リロード。
- **画像追加時の運用**（WebP 必須・`node scripts/optimize-images.mjs --apply` 等）は `CLAUDE.md` の Conventions を参照。既定の対象は `assets/img/screenshots/` だけで、`assets/img/` 直下のロゴ (JSON-LD が参照する `logo-font.png` など) は巻き込まない。
