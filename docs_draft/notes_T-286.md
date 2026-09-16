# T-286 — site: Enterprise 問い合わせフォームのブラウザ E2E (Playwright)

実装日: 2026-09-17 / Role: Implementer → Reviewer → Tester (単独セッション)

**コミット・push・デプロイなし。** ゲート (`npm test` / `npm run build` /
`bundle exec jekyll build` / CI の `Verify build output` をローカル抽出 / `npm run e2e`) は通過済み。

---

## なぜ要るのか

`npm test` (`node --test src/lib/*.test.js`) が見ているのは `src/lib/inquiry-validate.js` の
**純ロジックだけ**。T-254 のフォームは

```
_data/inquiry.yml  →  Liquid (enterprise/inquiry/index.html) の data-*
                   →  src/main.js の mountIslands が props として渡す
                   →  InquiryForm.svelte の fetch(endpoint)
```

という 3 段の配線を持ち、**この配線が切れても `npm test` も `jekyll build` も緑のまま**通る。
CI の `Verify build output` も「アイランド root と `<noscript>` が出力に居ること」しか見ていない。
送信先の Worker (T-253) は別リポジトリなので、契約のずれは本番で初めて分かる。そこを塞ぐ。

## 変更点 (要約)

| ファイル | 役割 | 内容 |
|---|---|---|
| `playwright.config.ts` | **新規** | `testDir: e2e`、chromium 1 プロジェクト、`webServer` が `npm run build && bundle exec jekyll build && node e2e/lib/serve.mjs` を 4173 で起動。`E2E_SKIP_BUILD=1` で配信のみ |
| `e2e/lib/serve.mjs` | **新規** | `_site/` を配る node:http だけの静的サーバ (依存追加なし)。末尾スラッシュ → `index.html`、404 は `_site/404.html` を 404 のまま、`Cache-Control: no-store`、ルート外は 403 |
| `e2e/inquiry.spec.ts` | **新規** | 仕様 9 件 (下表) |
| `package.json` | 変更 | devDependency `@playwright/test` 1.62.1 (exact)、`e2e` / `e2e:install` スクリプト |
| `package-lock.json` | 変更 | 上記の反映 (`npm ci` 用) |
| `_config.yml` | 変更 | `exclude` に `e2e` / `playwright.config.ts` |
| `.gitignore` | 変更 | `e2e/.artifacts/` |
| `.github/workflows/jekyll.yml` | 変更 | `Verify build output` に「E2E が `_site/` に漏れていないこと」を追加 + その後に Chromium 取得 / `npx playwright test` / 失敗時のレポート回収 |
| `README.md` `CLAUDE.md` | 変更 | 実行手順と注意点の節 |

`src/` `_data/` `enterprise/` は**一切触っていない** (E2E 用のフックを製品コードに足さない方針)。

## 固定した仕様 (`e2e/inquiry.spec.ts`)

| # | 仕様 | 主な assert |
|---|---|---|
| 1 | 未入力のまま送信 | 4 項目のエラー文、`aria-invalid="true"`、`aria-describedby`(help がある項目は `help error` の 2 つ)、既定値 3 の seats は赤くしない、`role=alert`、先頭の誤りへフォーカス、**Worker を叩かない** |
| 2 | 全角の電話番号 | `（０３）１２３４－５６７８␣` → payload は `(03)1234-5678` |
| 3 | seats < 3 | 「3 以上で入力してください (Enterprise は 3 アカウントから)」、seats へフォーカス、送信しない |
| 4 | 200 `{ok:true, mail:true}` | 完了カード + メール案内、フォームは `hidden`、カードへフォーカス、`role=status`、「閉じる」で空のフォーム + company へフォーカス |
| 5 | 200 `{ok:true}` | 完了カードは出すが**メール案内は出さない** |
| 6 | 429 | レート制限の文面、完了カードなし、送信ボタンは再度押せる、入力は残る |
| 7 | 502 | 「お問い合わせを受け付けられませんでした」+ `data-support-email` の値 |
| 8 | honeypot | `#inq-website` に値 → 送信は通り、payload の `website` にその値が載る |
| 9 | payload の形 | `POST` / `application/json` / キーは company・name・email・phone・seats・message・website の 7 個ちょうど、`seats` は整数、`company` は trim 済み、`turnstileToken` は無い |

## 追加したコマンド

```bash
npm run e2e:install            # 初回のみ (chromium)。既存の ms-playwright があれば何もしない
npm run e2e                    # build → jekyll build → 4173 で配信 → playwright test
E2E_SKIP_BUILD=1 npm run e2e   # ビルド済みの _site/ を使う (CI と同じ経路)
npx playwright show-report e2e/.artifacts/html

# 整形 (このリポジトリに prettier 設定は置いていない)
../web/node_modules/.bin/prettier --no-config --single-quote --print-width 100 --check e2e playwright.config.ts
```

## 注意点・既知の制約

- **`E2E_SKIP_BUILD=1` を CI から外さないこと。** 外すと E2E が `_site/` を作り直し、
  `JEKYLL_ENV=production` も `--baseurl` も無い出力を直後の `Upload artifact` が Pages に上げる。
  設定ファイルのコメントとワークフローの両方に警告を書いた。
- **本物の Worker を叩かせない仕掛け。** `beforeEach` で `page.route('**/*')` を張り、
  配信サーバ (`baseURL`) 以外への通信を `abort` する。その後に endpoint 用の route を登録する
  (Playwright は**後から登録したハンドラを先に評価する**ので、差し替えが見張りに優先する)。
  順番を入れ替えると全部 abort されて「送信できませんでした」に倒れる。
- **route.fulfill にも CORS が効く。** endpoint は別オリジン (workers.dev) なので、
  プリフライト (`OPTIONS`) と `Access-Control-Allow-Origin` を spec 側で返している。
  ここを削るとネットワークエラーの文面が出て、原因が分かりにくい失敗になる。
- **endpoint はテストに直書きしない。** ビルド出力の `data-endpoint` を読む。ローカルビルドは
  development なので `endpoint_dev`、CI は production なので `endpoint` が入るが、
  どちらでもそのまま動く (差し替え対象を markup から取るため)。
- **`_config.yml` の `exclude`。** 入れ忘れると `e2e/inquiry.spec.ts` と `playwright.config.ts` が
  `_site/` に複製されて配信される (実際に最初の 1 回踏んだ)。`Verify build output` に検知を足した。
- Chromium は `~/AppData/Local/ms-playwright` の既存 (1234) を使う。CI は
  `npx playwright install --with-deps chromium` で毎回取得する (ubuntu の共有ライブラリごと)。
- 検出力の確認: `normalizePhone` の全角ハイフン写像を 1 行削ると #2 が、
  `InquiryForm.svelte` の `doneEl?.focus()` を削ると #4 が落ちることを実測した
  (後者は `node --test` では検出できない = E2E を足した意味そのもの)。両方とも元に戻してある。

## 未対応 / 引き継ぎ

- **Turnstile が有効になったら spec を足す。** 今は `turnstile_site_key` が空なので widget が
  描画されず、`turnstileToken` も payload に載らない。キーを入れたら
  「widget 未完了で送信を止める」「`turnstile_failed` の文面」「送信後に reset する」を追加する。
  challenges.cloudflare.com は `beforeEach` の abort 対象なので、そのときは例外を開ける必要がある。
- `README.md` の「期待結果: **92 件中 91 pass / 1 skip**」は現状 (129 件中 128 pass / 1 skip) と
  ずれているが、T-286 の範囲外なので触っていない。
- `_site/scripts/` (ビルド用 `.mjs`) が以前から配信されている。害は無いが `exclude` 候補。
- ロールバック観点: 追加のみなので `playwright.config.ts` / `e2e/` の削除 +
  `package.json` / `_config.yml` / `.gitignore` / `jekyll.yml` の該当行を戻せば元に戻る。
  サイトの出力 (`_site/`) は E2E 導入前後で同一 (`exclude` を入れた状態が従来と同じ)。
