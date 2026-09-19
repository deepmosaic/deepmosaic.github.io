// Enterprise 問い合わせフォームのブラウザ E2E 設定 (T-286)。
//
//   npm run e2e:install   # chromium を取得 (初回のみ)
//   npm run e2e           # ビルド → _site/ を配信 → Playwright
//   E2E_SKIP_BUILD=1 npm run e2e   # 既にビルド済みの _site/ をそのまま使う
//
// ## なぜビルドしてから配信するのか
//
// 検証対象は `src/islands/InquiryForm.svelte` の**振る舞い**だが、この島は
// Jekyll が出した `data-endpoint` / `data-support-email` を props で受け取り、
// Vite が束ねた `assets/dist/app.js` としてマウントされる。**2 段ビルドの
// 継ぎ目 (Liquid → data-* → props) ごと**検証したいので、公開されるのと同じ
// `_site/` を配る (`e2e/lib/serve.mjs`)。
//
// ## E2E_SKIP_BUILD
//
// CI は `Build with Jekyll` が **`JEKYLL_ENV=production` と `--baseurl` 付きで**
// 生成した `_site/` をこの後 Pages に上げる。E2E が同じ `_site/` を作り直すと
// 環境もベース URL も違う出力で**公開物を差し替えてしまう**ので、CI では
// `E2E_SKIP_BUILD=1` で配信だけ行う。ローカルでは既定でビルドから通す。
import { defineConfig, devices } from '@playwright/test';

/** 静的配信のポート。Jekyll の dev server (4000) とぶつけない。 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 4173);
export const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

/**
 * 外部の配信先 (公開後の本番など) へ向けるときの基点 (T-291)。指定すると配信サーバを立てず、
 * **読み取りだけの spec に対象を絞る** — 問い合わせフォームの spec を本番へ向けない。
 *
 *   E2E_BASE_URL=https://www.deepmosaic.co.jp npx playwright test
 */
const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL?.replace(/\/+$/, '') || undefined;
const READ_ONLY_SPECS = ['mobile-nav.spec.ts', 'inquiry-cors.spec.ts'];

const serve = `node e2e/lib/serve.mjs`;
const command = process.env.E2E_SKIP_BUILD
  ? serve
  : `npm run build && bundle exec jekyll build && ${serve}`;

export default defineConfig({
  testDir: './e2e',
  ...(EXTERNAL_BASE_URL ? { testMatch: READ_ONLY_SPECS } : {}),
  // 出力先 (trace / 使い捨ての検証スクリプト置き場) は探索しない
  testIgnore: ['**/.artifacts/**'],
  outputDir: './e2e/.artifacts/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { outputFolder: './e2e/.artifacts/html', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: EXTERNAL_BASE_URL ?? BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium' }],
  webServer: EXTERNAL_BASE_URL ? undefined : {
    command,
    // 待つのは検証対象のページそのもの。トップだけ見ていると、島を載せている
    // ページが生成されていないケースを「サーバは起きている」で見逃す。
    url: `${BASE_URL}/enterprise/inquiry/`,
    // cwd は既定 (この設定ファイルのあるディレクトリ = リポジトリルート) のまま
    env: { E2E_PORT: String(E2E_PORT) },
    // 相乗りしない (常に自分で起動する)。4173 に配信サーバが残っていると webServer の
    // コマンド (= ビルド) を一切実行せず、**古い `_site/` に対して緑になる** ため
    // (T-286 の検証で実測)。手動の配信サーバが残っていればポート衝突で即座に失敗させる。
    reuseExistingServer: false,
    // Vite + Jekyll のフルビルドを含む (CI の E2E_SKIP_BUILD=1 なら一瞬)
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
