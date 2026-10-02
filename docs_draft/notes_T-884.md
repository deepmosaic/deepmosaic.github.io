# T-884 公開サイト: Web 版への導線を新規タブ、`?login=1` 撤去、hero の説明文

## 変更点
- `_data/site.yml`: `web_app.url` を `https://app.deepmosaic.co.jp/` に (`?login=1` を撤去)。経緯コメントを更新。
- `index.html`: 「ブラウザで試す（インストール不要）」(`data-dl="hero-webapp"`) に `target="_blank" rel="noopener noreferrer"`。
  hero の説明文を「自動検出の結果（素材: Pexels）。」、動画の aria-label を「Deepmosaic で書き出した動画。自動検出の結果」に。
- `_includes/cta-download.html`: Web 版リンク (`data-dl="cta-webapp"`) に同じ target / rel。
- `_includes/docs/web.html`: 始め方 1 の文を「…から開くとログイン画面が表示されるので「ログイン」を押します」に。
- `CHANGELOG.md` (サイト、参照用): TICKET-SITE-38 の節に撤回の注記 1 行。
- テスト `src/lib/top-page-features.test.js` に 3 件 (target/rel、URL に `login=` が無い、説明文 + aria-label)。

## 追加・変更したコマンド
なし。

## 注意点・既知の制約
- `src/main.js` の `initDownloadTracking` (`onActivate`) は href を装飾するだけで `preventDefault` しないため、`target="_blank"` はそのまま効く。`data-dl` (計測の目印) は残している。
- web 側の自動ログイン撤去 (T-883) と独立。どちらが先に公開されても壊れない (旧 URL は web 側で無視される)。

## ロールバック
- 本コミットを revert。URL を戻すだけなら `_data/site.yml` の `web_app.url` に `?login=1` を付け直す。
