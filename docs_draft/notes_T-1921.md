# T-1921: プライバシーポリシー §9 を配信ストアからの入手に合わせて改訂 (案、公開前にユーザー確認)

ユーザー決定 (2026-11-11): 配布は Microsoft Store だけ、インストーラー版 (NSIS) は 2.11.1 で終了。「案を作って確認後に公開」。
公開 (master への push) は Store 公開と一緒 (T-1917 と同じ統合ブランチ `store1109-integrate`)。

## 事実の出典 (desktop main d7342ab5)
- `src-tauri/src/telemetry/install_source.rs` `pending_report_for`: Store 版はトークン・probe を読まず `source = "store"` 固定で
  `app_first_launched` を 1 回だけ送る (auth_sub = アカウントまたは `device:<uuid>`、session_id、app_version)。
- `src-tauri/src/commands/web_origin.rs`: Store 版は `GET /install-origin` を呼ばない (T-1898)。
- `build_variant::distribution` (`store` / `site`) は Sentry のタグ (`docs/sentry-tags.md` の `distribution`) と実行ログの `spawn` 行
  (`subprocess/runner_log.rs`、`run_log_uploader` で送信) に入る → §9-1 のなお書き (動作記録・エラー診断にも含める)。
- サイト: `src/lib/attribution.js` は `apps.microsoft.com` に流入元を付けない (T-1917)。GA4 の `file_download` はそのまま → §9-2。

## 変更点
- `company/privacy.html` §9 「ダウンロード経路の記録」→「入手経路の記録」(9-1〜9-5)。インストーラー版の記述は 9-3 に残した
  (既に配った版と、インストーラー版のダウンロードの記録が続く間のため)。オプトアウトは「識別子を含まないインストーラーを案内」→
  「配信ストアから入手した本ソフトウェアを利用」。最終更新日 2026-10-31 → 2026-11-11 (版 legal.yml 2026-11-08 は据え置き、再同意なし)。
- 法務文書の書き方: 企業名・サービス名は書かない (「外部のアプリケーション配信サービス（配信ストア）」)。
- `_data/spec.yml` 通信「初回セットアップ」: 「実行ファイル等のダウンロード」→「AI モデル等のデータ … GPU 高速化を有効にした場合は NVIDIA 製のコンポーネントも」。
- テスト: `src/lib/site-copy-t1921.test.js` (新規)、`site-copy-t1444.test.js` (§9 の見出し)、`site-copy-t1656.test.js` (日付の固定を外す)、
  `spec-requirements.test.js` (通信の文言)。

## 注意点・残り (リーダー判断)
- 公開日が 11-11 でなければ最終更新日と `site-copy-t1921.test.js` の日付を公開日に合わせる。
- web (main ef994764) の「Desktop 版をダウンロード」は今も r2-proxy のインストーラー (2.11.1) と dl トークンを使う → 9-3 の記録は続く。
  web の導線を Store に変えるなら別チケット。
- `company/cookie.html` のローカルストレージの説明 (「後日ダウンロードされた際にどの経路からのご利用かを把握するために使用します」) は
  Store のリンクに流入元を付けなくなったので実態とずれる (Web 版への導線には付く)。
- `_data/disclosure.yml` の送信内容の一覧に「配布の種類」は無い (動作記録の一部とみなした)。

## ロールバック
このコミットを revert (統合ブランチ上なので公開前は影響なし)。
