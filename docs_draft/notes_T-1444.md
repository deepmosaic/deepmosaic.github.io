# T-1444: site — 「ブラウザでお試し (10 分まで)」、GA4 web_app_open の分離、docs/web.html、privacy §9

## 変更点
- `_data/site.yml`: `web_app.trial_minutes: 10` を追加 (文言用の写し。SSOT は web BFF の var `WEB_TRIAL_MAX_SECONDS` 既定 600 秒。ずれたら両方直す旨をコメント)。
- `index.html` hero: 「ブラウザで試す（インストール不要）」→「ブラウザでお試し（{{ trial_minutes }} 分までの動画・インストール不要）」。
- `_includes/cta-download.html`: Web 版の説明行に「お試し用（1 本 {{ trial_minutes }} 分まで）です。」(トップ末尾 / price / spec の 3 面)。
- `src/lib/attribution.js`: 純関数 `ga4EventNameFor(id)` を追加 (`-webapp` で終わる id → `web_app_open`、それ以外・非文字列 → `file_download`)。
- `src/main.js`: `window.gtag('event', ga4EventNameFor(a.dataset.dl), ga4FileDownloadParams(...))`。パラメータは従来と同じ。
- `_includes/docs/web.html`: #about のリードに「Web 版はお試し用です…」、#requirements に「動画の長さ」行 (「動画のサイズ」の次)、#diff の末尾に「動画の長さ」行、#start のボタン名を「ブラウザでお試し」に。有料 (Light / Pro) と組織は制限なしの旨も明記 (契約のユーザー決定 1)。
- `llms.txt` / `llms-full.txt`: Web 版の行に「お試し用 (無料プランは 1 本 N 分まで)」。
- `company/privacy.html` §9: 「ブラウザで本サービスにログインした状態でインストーラーをダウンロードした場合、そのアカウントの識別子をダウンロードの記録にあわせて保存し、アプリケーションの初回起動時の記録と突き合わせます。」を追加。最終更新日 2026-10-24。legal.yml / EULA / 利用規約の版は不変。
  - 法務文書は配布形態 (デスクトップ版 / Web 版) を書き分けない規約 (`site-copy-t1061.test.js`) のため、契約 F の文言を「ブラウザで本サービスに…インストーラーを…」に言い換えた。
- テスト: 新規 `src/lib/site-copy-t1444.test.js`、`attribution.test.js` に `ga4EventNameFor` の 3 ケース。
  `site-copy-t1038.test.js` (6 ページ同日の縛りを外し MIN_DATE 以降だけに)、`site-copy-t1036.test.js` (privacy の日付を 2026-10-12 以降に) を緩めた。

## 追加・変更したコマンド
なし (`npm test` / `npm run build && bundle exec jekyll build --strict_front_matter` / `node scripts/check-docs.mjs` は従来どおり)。

## 注意点・既知の制約
- GA4 側で `web_app_open` をキーイベントにする等の設定は管理画面の作業 (本チケット外)。これまで `file_download` に混ざっていた Web 版クリックが抜けるので、`file_download` の件数は公開日から減る (Desktop の DL だけになる)。
- BFF の 10 分制限は `WEB_TRIAL_ENFORCE=false` で出し、web アプリは未リリース。サイトを先に公開すると「10 分まで」の案内が実際の挙動より先行する。公開順は web のリリースに合わせること。
- 分数を変えるときは BFF の `WEB_TRIAL_MAX_SECONDS` と `_data/site.yml` の `trial_minutes`、`site-copy-t1444.test.js` の期待値を同時に直す。

## ロールバック
コミットを revert する (データ・外部設定の変更なし)。
