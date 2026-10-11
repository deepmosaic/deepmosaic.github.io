# T-1035 クッキーポリシーの実態化

## 変更点
- `company/cookie.html`
  - 最終更新日 `2019-6-1` → `2026-10-12` (ISO、見た目は terms にそろえて `text-sm text-ink-3 mb-8`)。
  - プライバシーポリシーへのリンクを `/company/privacy.html` → `/company/privacy`。
  - 前文・使用目的から、ソーシャルメディアでの共有・広告の個人化・「他の個人情報とリンクさせる場合」の記述を削除。
  - 「ブラウザのローカルストレージ」節を、流入元の記録 2 件 (最初 = 最大 180 日 / 直近 = 最大 30 日) に書き換え、Web 版の段落 (設定・テーマ・表示の設定・同意の記録、動画はブラウザ内の保存領域で当社サーバーへ送らない) を追加。
  - 表を 2 行に: エッセンシャル = Web 版のログイン Cookie 3 種 (HttpOnly、Auth0 ドメインの Cookie は同サービスのポリシー)、分析 = GA4 (`_ga` / `_ga_*`)。広告クッキー・ソーシャルネットワーキング・クッキーの行を削除。
  - 「興味・関心に基づく広告ツール」(Appchoices) と「ソーシャルクッキー」(Twitter / LinkedIn) の節を削除。
  - 「Google™クッキー」節を見出し `Google Analytics` にし、GA4 と測定 ID を明記。オプトアウトは `tools.google.com/dlpage/gaoptout` のみ (広告設定 `settings/ads` は削除)。h2 と同名になる小見出し `<p class="italic">Google Analytics</p>` は削除。
- `src/lib/site-copy-t1035.test.js` (新規): 表 2 行 / 不在語 / 存在語 / リンク / 日付 / 実装 (attribution.js・default.html) との一致。

## 確認した事実と出典
- GA4 測定 ID `G-6EKGBQ8QWS`: `_layouts/default.html` L84-91 (gtag)。
- localStorage の保存期間: `src/lib/attribution.js` L153 `ATTR_TTL_MS = 30 * 86_400_000`、L242 `FIRST_TTL_MS = 180 * 86_400_000` (テストで import して照合)。
- ダウンロードボタンのクリックの送信: `src/lib/attribution.js` `ga4FileDownloadParams`。
- Web 版 Cookie: `web` origin/main `worker/src/cookies.ts` L1-24 (名前・Path・寿命)、`serializeCookie` が全 Cookie に `HttpOnly` / `Secure` を付ける。
- GA4 とアカウントの紐づけ: `git grep -n "user_id" _layouts/ src/` は 0 件 → 「他の個人情報とリンク」は削除。

## 確認できず書かなかったこと
- Cookie の寿命 (8 時間 / 30 日 / 10 分) と SameSite の値は本文に書いていない (spec の文面どおり)。
- Auth0 ドメインの Cookie の名前・期間 (当社の実装外)。
- 外部送信の一覧表 (電気通信事業法 27 条の 12) は計画 W0-6 で対象外。

## 注意点・既知の制約
- Web 版の同意キー `dm_legal_consent` は T-1043 で実装予定。本ページはキー名を書かず一般表現なので、名前が変わっても影響しない。

## 追加・変更したコマンド
- なし (`npm test` に新しいテストファイルが自動で含まれる)。

## ロールバック
- `company/cookie.html` を戻し、`src/lib/site-copy-t1035.test.js` を削除する。
