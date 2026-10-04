# T-972 docs にチュートリアル動画 2 本を埋め込む

## 変更点
- `_includes/docs/01-intro.html`: `#about` の説明 2 段落の直後・「作業の流れ」の前に h3「動画で見る基本の使い方」と
  `<figure>` 2 つ (Desktop 版 / Web 版) を追加。`<video controls preload="none" playsinline poster="…png" width="960" height="540">`
  + `<source type="video/mp4">` + 文字のフォールバックリンク + `figcaption` 1 文。autoplay / muted / loop は付けない。
  新しい section は足していない (節 ID の契約)。
- `llms.txt`: ドキュメントの節の docs の行の直後に動画 2 本の URL の 1 行。
- `llms-full.txt`: 「8. リンク」の Documentation の直後に同じ内容の 1 行。
- `src/lib/site-copy-t972.test.js`: 見出し・2 本の URL (mp4 / poster)・属性・`<img>` フォールバック無し・figcaption・llms の 1 行・固有名なしを固定。

## 追加・変更したコマンド
- なし (`npm test` に自動で含まれる)。`scripts/check-docs.mjs` は変更なし (`<video>` は検査対象外、中に `<img>` を書いていない)。

## 注意点・既知の制約
- URL は `https://deepmosaic-r2-proxy.deepmosaic.workers.dev/media/tutorial/tutorial-{desktop,web}-basic.{mp4,png}` 固定。
  R2 に実体が置かれ、T-971 (r2-proxy の media/ 許可) がデプロイされるまで poster も動画も表示されない
  → master への merge は 2.7.1 のリリース時 (T-968) に、実体の到達を確かめてから。
- サイトに CSP は無いので外部オリジンの media は追加設定不要。
- 寸法 960×540 は表示枠の比率 (16:9) のための属性。実体は 1920×1080。

## リーダーが確かめる手順
- `curl -I https://deepmosaic-r2-proxy.deepmosaic.workers.dev/media/tutorial/tutorial-desktop-basic.mp4` (web / png も) が 200 / video/mp4 / image/png。
- `/docs/#about` で poster が出て、再生・シークできること。

## ロールバック
- 本ブランチの T-972 コミットを revert (01-intro の追加ブロック、llms 2 行、テスト 1 本だけ)。
