# T-523 T-519 / T-520 の修正後に docs のスクリーンショット 7 枚を差し替える (site 側)

公開 (push) はリーダーの T-514。撮影と撮影ハーネスの検査は desktop の `docs_draft/notes_T-523.md`。

## 変更点

- `assets/img/screenshots/` の 7 枚を撮り直しで差し替え (ファイル名・寸法 1280×800 は不変):
  `edit-audio` / `edit-sidebar-media` / `edit-text` / `edit-watermark` / `edit-fade` / `edit-transition` /
  `edit-timeline-clips` (.webp)。
  - 波形: T-496 の画像は音声レーンの BGM の帯が平坦 (desktop で波形が描かれない T-519)。差し替え後は帯の中央に波形が写り、
    `04-edit.html` の alt「音声レーンの帯に波形が描かれている状態」/ figcaption「音声パネルと音声レーンの波形」と一致する
  - 操作列: ドロワーを開いた 6 枚でプレイヤーの操作列が重なっていた (T-520)。差し替え後は 2 段 (1 段目 再生ボタン + 時刻 /
    2 段目 ツールバー) で重なりなし。edit-timeline-clips (ドロワー閉) は 1 段
- `check-docs --fix-dims` の書き換えは無し (7 枚とも実寸 1280×800 = 既存の width / height と一致)。index.html はこの 7 枚を使わない

## 追加・変更したコマンド

新規コマンドは無し。実行した手順 (T-522 に従いリポのルートでは `--apply` しない):

```bash
# desktop で撮影 (desktop の notes 参照) → PNG 7 枚だけを scratchpad の作業フォルダ (リポ外) にコピー
node scripts/optimize-images.mjs <作業フォルダ>            # [DRY] 7 枚 / 保護 0 枚を確認
node scripts/optimize-images.mjs <作業フォルダ> --apply    # PNG 2406 KB → WebP 385 KB
cp <作業フォルダ>/*.webp assets/img/screenshots/
node scripts/check-docs.mjs --fix-dims                    # all <img> width/height already match
npm test && npm run build && bundle exec jekyll build --strict_front_matter && node scripts/check-docs.mjs
```

ゲート (2026-09-23): `npm test` 286 件 (pass 285 / skip 1 = plan_catalog のライブ検査で既存) / `npm run build` 成功 /
`bundle exec jekyll build --strict_front_matter` 成功 / `node scripts/check-docs.mjs` OK (2 ページ、15 ファイルの深いリンク)。

## 確認方法と結果

- 撮影ハーネス (desktop) が撮る直前と撮った PNG で検査済み: PNG の帯の中で波形の画素がある列 526/526 (ドロワー 6 枚)、
  825/825 (edit-timeline-clips)。撮り直し前の PNG は同じ検査で 5/526 (陽性対照)。操作列は 6 枚とも 2 段・重なり 0 件
- WebP は復号して目視 (edit-sidebar-media / edit-audio): 帯の波形と 2 段の操作列が見える。画素の検査は変換前の
  PNG 7 枚で行った (WebP は色のにじみで地の色がずれ、画素検査の判定が不安定なため WebP は目視で確認)
- 新しい WebP (sha256 の先頭 16 桁 / バイト数): edit-audio 698e75540bab2cfb 53370 / edit-sidebar-media bf9692fdf15ee22a 54058 /
  edit-text af52c91a346bd79c 64690 / edit-watermark 639e77914f81f2c5 54622 / edit-fade 3d18394f744a54cf 55286 /
  edit-transition 210b2b65f59a2405 57998 / edit-timeline-clips 8a0e56076ece3b79 54672

## 注意点・既知の制約

- 公開は T-514 (リーダー)。このリポの push は即公開なので、本チケットでは push していない
- 画像の中の動画 ID 表示は撮影ごとに変わる (検出のたびに採番) — 本文は ID に触れていないので影響なし
- edit-timeline-clips はドロワーを閉じた幅で操作列がコンパクト (アイコンのみ) になる (T-520 の仕様)。本文はツールバーの文言に触れていない

## ロールバック

7 枚の WebP を 1 つ前のコミット (T-522 fa66cad 時点 = T-496 の画像) に戻せばよい。寸法は不変なので HTML の変更は不要。
