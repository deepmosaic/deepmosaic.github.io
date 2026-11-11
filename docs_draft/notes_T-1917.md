# T-1917: ダウンロード導線を Microsoft Store に、インストール / 更新 / 第三者ソフトの節を MSIX に合わせる

ユーザー決定 (2026-11-11): サイト配布版 (NSIS) をやめて Microsoft Store だけにする。2.11.1 が最後のサイト版。
公開 (master への push) は Store 公開の後にリーダーが行う (統合ブランチ `store1109-integrate` に保留、T-1901 の 4585f25 と一緒に)。

## 変更点
- DL の単一管理点 `_data/lang/ja.json`: `app_download_link` = `https://apps.microsoft.com/detail/9PDKMKWHN9RW`、
  `app_store_protocol_link` = `ms-windows-store://pdp/?productid=9PDKMKWHN9RW`、`app_store_product_id` を追加。
  ヘッダー / ヒーロー / フッター / モバイルのドロワー / `download-button.html` (料金カード・CTA・docs) / JSON-LD の `downloadUrl` がこれを参照する。
- DL ボタンはファイル DL ではなくなったので `download` 属性を外した (`data-dl` の計測は残す)。文言: ヘッダー「Microsoft Store で入手」、
  ヒーローと既定のボタン「Microsoft Store で無料入手」、フッター「ダウンロード（Microsoft Store）」。料金カードの文言 (plans.yml) は変えていない。
- `src/lib/attribution.js` の `decorateDownloadUrl`: `apps.microsoft.com` と http(s) 以外の URL には流入経路 (utm / ref / lp / dm) を載せない
  (第三者に着地ページや参照元を送らないため)。GA4 の `file_download` 送信はそのまま (link_id で導線を区別できる)。
- docs `#install`: Store で入手する手順、Store の 2 つのリンク、インストール先 / アップグレード (Store が配信) / 使用許諾 (初回起動時)。
  「インストーラ版（Deepmosaic Setup）をお使いの方へ」: 2.11.1 で終了、データはそのまま (移行作業不要)、無料枠・ライセンスはアカウント、
  Premiere 連携はプラグイン 0.1.21 以降、インストーラ版を消すときの注意 (`%LOCALAPPDATA%\deepmosaic` が消える / 削除のチェックを入れない)。
- docs `#setup`: 検出エンジンと軽量モデルはアプリに同梱、GPU 高速化は「このアプリについて」のスイッチで取得 (自動取得しない、約 1.7 GB / 展開後 約 2.4 GB)。
- docs `#update`: Store の自動更新・手動更新、エンジンはアプリと一緒、モデルは起動時に自動。インストーラ版の更新ダイアログと「アップデートを確認」は過去の説明として残す (スクリーンショットも残す、T-974 の検査)。
- docs `#data`: `%LOCALAPPDATA%\deepmosaic` の中身 (モデル・GPU ランタイム)、Store 版も同じ場所を使う (新規 PC では Windows が振り替えることがある)。
- docs `#uninstall`: Store 版で残るもの (`.deepmosaic`・プロジェクトフォルダ、インストーラ版から引き継いだ `%LOCALAPPDATA%\deepmosaic`)、インストーラ版の削除の注意。
- docs `#licenses`: FFmpeg 8.1.3 (BtbN/FFmpeg-Builds autobuild-2026-10-31-12-59、win64-gpl-8.1)、対応ソース (GPL v3 §6) の R2 の README.txt、
  Store 版で差し替えできない旨。正本は desktop `src/lib/legal/third-party.ts` と `static/licenses/ffmpeg-NOTICE.txt` (main 68a059ed)。
- テスト: `src/lib/site-copy-t1917.test.js` (新規)、`attribution.test.js` (Store 非装飾 3 件)、`site-copy-t1900.test.js` (BtbN / R2 へ)、
  `site-copy-t924.test.js` (01-intro は Store の更新)、`e2e/mobile-nav.spec.ts` (DL 項目は Store・download 属性なし)、CI の焼き込み検査に Store URL を追加。

## Store バッジ
Microsoft 公式バッジ (`https://get.microsoft.com/images/ja%20dark.svg` 等。SVG にスクリプト・外部参照なしを確認) は取得できたが、
利用条件 (Microsoft Store Badge Guidelines。learn.microsoft.com の App marketing guidelines は 2026-11-11 時点で 404) を確認できなかったため使っていない。
テキストのボタン / リンクにした。使う場合は条件 (改変禁止・最小サイズ・余白・掲載ページへのリンク) を確認してから。

## コマンド
```bash
npm test                                   # 596 件 pass
npm run build && bundle exec jekyll build --strict_front_matter
node scripts/check-docs.mjs                # OK
E2E_SKIP_BUILD=1 npx playwright test       # 19 pass / 1 skip
```

## 注意点・未対応 (リーダー判断)
- 料金カードの「ダウンロードして申し込む」(Light / Pro): Store 版はアプリ内で購入できず「Web サイトでプランを管理」→ `/price/` に戻る。
  サイト上の申し込み導線が無いと循環する。導線の決定が要る (本チケットでは文言を変えていない)。docs `#plan` (アプリのプロフィールメニューから申し込む) も同様。
- プライバシーポリシー §9 (インストーラのファイル名のトークンで DL 経路を記録) は Store 配布では成り立たない。法務文書なので未変更。
- `_data/spec.yml` の通信「実行ファイル等のダウンロード」は、Store 版では初回に取るのはデータだけ (GPU 高速化を除く)。未変更。
- 新規 PC での MSIX の `%LOCALAPPDATA%` 振り替えとアンインストール時の削除は未実測 (W2 は NSIS 版の残る PC で実測)。docs はぼかして書いた。
- 「インストーラ版のアンインストールで `%LOCALAPPDATA%\deepmosaic` が消える」は従来の docs の記述に基づく。Store 版と併存した PC で実測していない。

## ロールバック
このコミットを revert する (統合ブランチ上なので公開前なら影響なし)。公開後に戻す場合は revert して master に push。
