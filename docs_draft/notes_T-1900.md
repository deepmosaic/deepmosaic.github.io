# T-1900 メモ (サイト): 同梱する第三者ソフトとライセンス

## 変更点

- `_includes/docs/06-ops.html` の末尾 (運用の章、`#web` の次) に `<section id="licenses">`「同梱する第三者ソフトとライセンス」を追加。
  FFmpeg 8.1.1 (GPL v3、gyan.dev の essentials ビルド、libx264 / libx265 / libxvid、ソースの入手先)、ONNX Runtime 1.26 (MIT)、
  Microsoft Visual C++ 再頒布可能パッケージ、GPU 高速化 (NVIDIA、約 2.4 GB) は任意取得、を書いた。Premiere には触れない。
- `_data/docs_toc.yml` の desktop「運用」に `{ id: licenses, label: 同梱ソフトのライセンス }` を追加 (追加のみ、既存 ID は不変)。
- 回帰テスト `src/lib/site-copy-t1900.test.js`。
- 内容の正本は desktop の `src/lib/legal/third-party.ts` (アプリの「このアプリについて」と同じ)。

## 追加・変更したコマンド

- なし (`npm test` に新しいテストファイルが加わるだけ)。

## 注意点・既知の制約

- **公開 (master への push) はしていない。** Store 版の公開と合わせて出す。
- フッターの法務リンクには足していない (`site-copy-t1038.test.js` がフッターの `/company/` リンクを 6 本に固定しているため、
  独立ページではなく docs の節にした)。
- `scripts/check-docs.mjs` (目次の ID と本文の ID の照合) は `_site/` が必要 (jekyll build) なのでこの worktree では回していない。
  目次と本文の ID の対応は `site-copy-t1900.test.js` で見ている。
- ソースの URL `https://ffmpeg.org/releases/ffmpeg-8.1.1.tar.xz` は命名規則から書いた (実在は未確認、desktop の notes を参照)。

## ロールバック

- このチケットのコミットを revert する (節・目次の 1 行・テストの 3 点)。
