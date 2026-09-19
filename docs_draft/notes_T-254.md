# notes_T-254: Enterprise 導入相談ページ `/enterprise/inquiry/` — Google フォーム導線の全置換

公式サイトに自前の問い合わせページを作り、Google フォームへの導線 (site 7 箇所) と desktop / web の
PlanSelectDialog「導入について相談する」を差し替えた。送信先は T-253 の `POST /inquiry`
(desktop リポジトリ `worker-auth0-updater/src/inquiry.ts`)。**コミット・push・デプロイはしていない。**
web / desktop 側のメモは `web/docs_draft/notes_T-254.md` / `desktop/docs_draft/notes_T-254.md`。

## 変更点 (要約)

| ファイル | 内容 |
|---|---|
| `enterprise/inquiry/index.html` (新) | ページ本体。front matter (`title: Enterprise 導入相談` / `seo_title: Enterprise 導入相談｜Deepmosaic` (共通サフィックス付きだと約 33 全角) / `description` / `permalink: /enterprise/inquiry/` / `schemas: breadcrumb`)。h1「Enterprise 導入について相談する」、リード (先頭は `_data/entity.yml` の `one_liner`、金額は書かない)、アイランド root `<div data-island="inquiry-form" data-endpoint data-turnstile-site-key data-support-email>` の中に `<noscript>` (mailto:support@ と記入項目の一覧)、フォーム下に「Enterprise 以外のお問い合わせはアプリ内の『お問い合わせ』(`/docs#support`) / ログインできなければ support@ へ」の注記 |
| `_data/inquiry.yml` (新) | `endpoint` (本番 Worker) / `endpoint_dev` (dev Worker) / `turnstile_site_key` (**空**) / `support_email`。ページは `jekyll.environment == "production"` (CI) のとき `endpoint`、それ以外 (ローカル `jekyll serve` / `jekyll build`) は `endpoint_dev` を埋める |
| `src/islands/InquiryForm.svelte` (新) | Svelte 5 (runes) アイランド。項目 = 会社名 / 氏名 / メールアドレス / 電話番号 / 利用アカウント予定数 (`type=number` min 3 step 1 既定 3、補助文「Enterprise は 3 アカウント以上」) / ご相談内容 (任意、≤4000) + ハニーポット `website` (画面外・`aria-hidden`・`tabindex=-1`・`autocomplete=off`) + Turnstile (サイトキーがあるときだけ `challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` を動的に読み `turnstile.render` で明示レンダー、theme auto / language ja、トークンは送信のたび reset)。状態 idle → submitting → done \| error。**done は「閉じる」を押すまで消えず**、閉じると空のフォームに戻る (フォーム要素は done の間 `hidden` で残し、widget を作り直さない)。`fetch(endpoint, { mode: 'cors', credentials: 'omit' })`。a11y: `label for` / `aria-invalid` + `aria-describedby` / `role=alert` のエラー / `sr-only` の `role=status` / 完了パネルと最初のエラー項目へフォーカス移動 / `novalidate` で独自検証。見た目は Tailwind ユーティリティ + `src/app.css` のトークン (`bg-surface` / `border-edge` / `text-danger` 等、生ヘックス無し) |
| `src/lib/inquiry-validate.js` (新) | 純関数 (DOM に触らない)。Worker の `validateInquiry` の写し (上限・メール regex・電話 regex・制御文字)。`normalizePhone` (全角数字 / ＋ / （） / 全角空白 / 各種ダッシュ・長音 → ASCII)、`normalizeSeats` (数値 / 数字文字列 / 全角数字 → 整数、それ以外 null)、`normalizeMessage` (CRLF→LF + trim)、`validateInquiry` (**全項目の誤りを一括**で返す)、`buildPayload` (token は空なら載せない)、`describeFailure` (429 →「送信回数の上限に達しました。しばらく時間をおいて再度お試しください。」/ `turnstile_failed` →「認証に失敗しました。ページを再読み込みしてください。」/ `invalid_input` → Worker の項目別文面を該当項目に / 502 `delivery_failed` → support 宛の案内 / ネットワーク・未知 → generic) |
| `src/lib/inquiry-validate.test.js` (新) | `node --test` 23 件 (正規化 / 境界値ちょうど / 上限超過 / メール形式 / 電話 regex / 予定数 <3・>10000・非整数 / 制御文字 / ハニーポットは検査しない / 非オブジェクト入力 / payload / 失敗文面 6 種)。`npm test` が `src/lib/*.test.js` を拾うので自動で対象 |
| `src/main.js` | `InquiryForm` を `[data-island="inquiry-form"]` にマウント (他のアイランドと同じ `mountIslands`) |
| `src/app.css` | `@source "../enterprise/**/*.html";` (新ディレクトリの HTML を Tailwind が走査する) |
| `_data/plans.yml` | enterprise `cta.href` → `/enterprise/inquiry/`、`external: false` (料金カードの外部リンクアイコンと `target=_blank` が消える) |
| `_includes/header.html` | `contact_url` → `/enterprise/inquiry/`。ドロワーの「問い合わせ」から `"target":"_blank"` を外した (同一タブ) |
| `_includes/footer.html` | 「問い合わせ」を内部リンクに (target / rel / ExternalLink アイコン除去。ラベルは `site.data.lang.ja.contact` のまま) |
| `price/index.html` / `company/cookie.html` / `_includes/docs/02-account.html` / `_includes/docs/06-ops.html` | Google フォーム URL → `/enterprise/inquiry/` (target / rel 除去、文言は据え置き。cookie は「お問い合わせ」のまま) |
| `.github/workflows/jekyll.yml` (`Verify build output`) | 回帰ガード 3 つ追加 (T-231 と同じ書き方): `_site` の **HTML** に `docs.google.com/forms` が残っていたら落とす (`--include='*.html'`。`docs_draft/*.md` が `_site` に複製されるので md は見ない) / `/enterprise/inquiry/` に `data-island="inquiry-form"` が無ければ落とす / 同ページに `<noscript>` が無ければ落とす |

Google フォーム URL の出現箇所はリポジトリ全体を grep して **CHANGELOG / docs_draft 以外はゼロ** (ビルド出力 `_site` もゼロ)。

## Turnstile のサイトキーを貼る場所

`_data/inquiry.yml` の `turnstile_site_key: ""` に、Cloudflare ダッシュボード → Turnstile → ウィジェット追加
(ホスト名 = `www.deepmosaic.co.jp` / `deepmosaic.co.jp` / `deepmosaic.github.io`、モード Managed) の
**Site Key (公開値)** を貼る。空の間は widget を描画せず token も送らず、Worker 側も
`TURNSTILE_SECRET_KEY` 未投入なら検証をスキップする (縮退運用 = ハニーポット + KV レート制限だけ)。
Secret Key は Worker 側 (`npx wrangler secret put TURNSTILE_SECRET_KEY`) で、**サイトを公開した後**に入れる (下記の順序)。

## ローカルでの確認手順

```bash
cd deepmosaic.github.io
npm test                                              # inquiry-validate 23 件を含む
npm run build && bundle exec jekyll serve             # :4000。development なので endpoint_dev が埋まる
# → http://localhost:4000/enterprise/inquiry/
```

- `jekyll serve` は `JEKYLL_ENV` 未指定 = development なので、ページの `data-endpoint` は
  `_data/inquiry.yml` の `endpoint_dev` (`https://deepmosaic-auth0-updater-dev.deepmosaic.workers.dev/inquiry`) になる。
  **dev Worker の `[env.dev.vars] INQUIRY_ALLOWED_ORIGINS` が `http://localhost:4000,http://127.0.0.1:4000` を
  許可している**ので、ローカルの Jekyll から実送信できる (本番 Worker は localhost を 403 にする)。
  ポートを変えるなら Worker 側の許可リストも合わせる。
- dev Worker が未デプロイなら先に (desktop リポ) `cd worker-auth0-updater && npx wrangler kv namespace create INQUIRY_RATELIMIT --env dev`
  → `wrangler.toml` の `REPLACE_WITH_INQUIRY_RATELIMIT_DEV_KV_ID` を置換 → `npx wrangler deploy --env dev` (notes_T-253 参照)。
  dev は Slack 無しなので、200 を得るには `ADMIN_NOTIFY_EMAIL` (設定済み) + `RESEND_API_KEY --env dev` が要る。
  無いと 502 `delivery_failed` になるが、それ自体はフォームのエラー表示 (support 宛の案内) の確認に使える。
- Turnstile をローカルで見るときは `turnstile_site_key` に Cloudflare の**テスト用サイトキー** (常に成功
  `1x00000000000000000000AA` / 常に失敗 `2x00000000000000000000AB` / 対話強制 `3x00000000000000000000FF`) を一時的に入れる。
  dev Worker 側の secret はテスト用 `1x0000000000000000000000000000000AA` (常に成功)。**コミットしないこと。**
- JS 無効の代替: DevTools で JavaScript を無効にして再読み込み → `<noscript>` の mailto と項目一覧が出る。
- 手で通した確認項目 (ブラウザ): 必須未入力 → 項目ごとの赤字 + 先頭項目へフォーカス + role=alert /
  `０３－１２３４－５６７８` → 送信 payload は `03-1234-5678` / 予定数 2 → 「3 以上」/ 送信中はボタン無効 + 「送信しています…」/
  200 → 完了パネル (フォーカス移動) が「閉じる」まで残る → 閉じると空フォーム (予定数 3) / 429・502 の文面。
- CI と同じ検査をローカルで:
  ```bash
  npm run build && JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter
  node scripts/check-docs.mjs && node scripts/check-plan-catalog.mjs && npm test
  # .github/workflows/jekyll.yml の Verify build output の run ブロックを取り出して bash で実行 (T-231 と同じ)
  grep -rl --include='*.html' 'docs.google.com/forms' _site | wc -l   # 0 が正 (docs_draft の md は対象外)
  grep -c 'data-island="inquiry-form"' _site/enterprise/inquiry/index.html   # 1
  ```

## リリース時の順序 (ユーザーが行う)

1. **Worker (T-253) を先に本番へ**: desktop リポ `worker-auth0-updater` で KV namespace を作って id を貼り
   `npx wrangler deploy`。`TURNSTILE_SECRET_KEY` は**まだ入れない**。curl で `Origin: https://www.deepmosaic.co.jp` 付きの
   POST が 200 になることを確認 (notes_T-253 の手順)。
2. **サイトを公開** (この差分を `master` に push → Actions「Deploy Jekyll site to Pages」が緑)。この時点で
   `turnstile_site_key` は空 = 縮退運用 (ハニーポット + レート制限)。公開後に本番ページから 1 件テスト送信し、
   Slack `#申し込み` / 管理者メール / お礼メールを確認。
3. **Turnstile を有効化**: Cloudflare で widget を作成 → Site Key を `_data/inquiry.yml` に貼って push → 本番ページに
   widget が出ることを確認 → **その後で** `npx wrangler secret put TURNSTILE_SECRET_KEY` (prod) → もう 1 件テスト送信。
   逆順 (secret が先) にすると、サイトキー無しのページからの送信が全件 400 `turnstile_failed` になる。
4. 親リポジトリでサブモジュール参照を更新し、`CHANGELOG.md` の T-254 にチェックを入れる。
   web は `node scripts/sync-check.mjs --accept` で台帳を更新する (desktop の PlanSelectDialog.svelte が変わったため。web 側は移植済み)。

## スマホ実機の確認項目 (iOS Safari / Android Chrome)

- ハンバーガー → 「問い合わせ」が**同一タブ**で `/enterprise/inquiry/` に遷移する (旧: Google フォームが新規タブ)
- 375px 幅で横スクロールが出ない。フォームは 1 カラムに落ちる (`sm:` 未満)、Turnstile の widget (約 300px) がカード内に収まる
- 入力のキーボード: メール = `inputmode=email`、電話 = `type=tel`、予定数 = `inputmode=numeric`
- 電話を全角で打っても送信できる (送信前に半角へ正規化。補助文にその旨)
- 必須未入力で送信 → 先頭のエラー項目にフォーカスが移り、画面内に赤字が見える
- 送信 → 完了パネルが表示され、他の操作をしても消えない → 「閉じる」で空フォームに戻る
- 料金ページの Enterprise カード「導入について相談する」が同一タブで遷移し、外部リンクアイコンが無い
- フッターの「問い合わせ」も同様

## 検証結果 (2026-09-16、ローカル / Windows Git Bash)

| ゲート | 結果 |
|---|---|
| `npm run build` (Vite) | OK。Svelte コンパイラ警告なし (`state_referenced_locally` を 1 件出していたので初期値をプロップから取らない形に直した) |
| `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter` | OK |
| `node scripts/check-docs.mjs` | OK (2 ページ、深いリンク 14 ファイル — 新ページの `/docs#support` も検査対象) |
| `node scripts/check-plan-catalog.mjs` | 鍵なしで skip (従来どおり) |
| `npm test` | 128 pass / 1 skip (新規 23 件を含む) |
| `Verify build output` を丸ごとローカル実行 | exit 0。負のテスト: `_site` に旧 URL 入りファイルを置き、アイランド root を書き換えると exit 1 (追加ガード 2 つとも検出) |
| `_site` の HTML 内の `docs.google.com/forms` | 0 件 (このメモ自身が `_site/docs_draft/` に複製されるため md は除外) |
| `/enterprise/inquiry/` の出力 | `<title>Enterprise 導入相談｜Deepmosaic</title>`、robots は既定 (noarchive 無し)、canonical、BreadcrumbList、`data-endpoint` = 本番 Worker (development ビルドでは dev Worker)、`data-turnstile-site-key=""`、`<noscript>` + mailto、sitemap.xml に掲載 |
| web `npm run check` / `lint` / `test` | 0 errors / 0 / 201 files 2837 pass |
| desktop `npm run check` / `lint` / `test` | 0 errors / 0 / 123 files 1626 pass |

## 注意点・既知の制約

- **問い合わせページに Enterprise 以外の用件も来る**: docs (「ログインできない場合は問い合わせフォーム」) / cookie /
  price の導線もこのページに向くが、フォームは予定アカウント数 ≥3 が必須。ページ下部に「Enterprise 以外はアプリ内の
  『お問い合わせ』(/docs#support)、ログインできなければ support@」の注記を置いて逃がしている。
  一般問い合わせ用のフォームが要るなら別チケット (Worker 側の `seats` 必須を外す判断を含む)。
- **外部 JS**: Turnstile の `api.js` はサイトキーがあるときだけ `challenges.cloudflare.com` から読む。Cloudflare 側で
  更新されるため SRI は付けられない (公式も非推奨)。サイトキーが空の間は外部 JS を一切増やさない。
- **support@deepmosaic.co.jp が公開面に出る** (noscript の mailto と注記)。ページの性質上の意図的な露出 (Worker の
  502 文面も同じ宛先を案内する)。`_data/inquiry.yml` の `support_email` 1 箇所で変えられる。
- `describeFailure` は `invalid_input` のときだけ Worker の `message` を画面に出す (自前 Worker の日本語文面。Svelte が
  テキストとしてエスケープする)。他の code は文面をこちらで決める。
- **文言は他ページと同じくページ直書き** (`_data/lang/*.json` はナビ用の語彙だけで、`en` 版ページは存在しない)。
  製品説明は `entity.one_liner` 参照で、金額は書いていない。
- **`_data/inquiry.yml` の `endpoint` 切替は `jekyll.environment` 依存**。本番は CI が `JEKYLL_ENV=production` で
  ビルドするので本番 Worker になる。手元で `jekyll build` した `_site` をそのまま公開すると dev Worker を向く
  (デプロイは Actions 経由なので通常は起きない)。
- **ローカルの working copy は CRLF** (`core.autocrlf=true`、site に `.gitattributes` 無し)。編集した既存ファイルは
  CRLF に揃えた。新規ファイルは LF で作った (コミット時に git が正規化するので差分には影響しない)。
- **`docs_draft/*.md` が `_site` に複製されて公開される** (既存の挙動: `_config.yml` の `exclude` に `docs_draft` が無い。
  notes_T-231 / T-252 も公開済みのはず)。内部メモを公開したくなければ `_config.yml` の `exclude` に `docs_draft` を足す
  (全ページに関わる設定なのでリーダー判断・別チケット)。追加したガードは HTML だけを見るので、このメモの URL 表記では落ちない。
- 別セッションが `_includes/docs/03-detect.html` を編集中 (このチケットでは触っていない)。
- `bundle install` / `npm install` は不要 (依存の追加なし)。

## ロールバック観点

- サイトの差分はページ追加 + リンク差し替えだけで、データやブラウザのストレージには影響しない。コミット単位で
  `git revert` すれば Google フォーム導線に戻る (`.github/workflows/jekyll.yml` のガードも同じコミットで戻すこと —
  ガードだけ残すと旧 URL の復活を CI が落とす。それが狙いでもある)。
- Worker 側を止めたいときは T-253 の手順 (`INQUIRY_ALLOWED_ORIGINS` を無効値にして deploy) で全件 403 にできる。
  その間フォームは generic エラー + support 宛の案内を出す。
- `turnstile_site_key` を空に戻して push すれば widget は消える (Worker の secret も消すこと。残すと全件 400)。
