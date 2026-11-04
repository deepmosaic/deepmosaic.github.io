# T-1743: ピクセルサイズの説明を「画面の幅に並ぶ粒の数」に (req1104b)

## 変更点

- `_data/mosaic.yml`、`_includes/docs/03-detect.html`、`_includes/docs/04-edit.html`、`index.html` のピクセルサイズの説明を
  「画面の幅に並ぶ粒の数」(既定 幅に 53 粒、解像度に依らない) に書き直した。px と解像度の例 (36 px / 12 px、√(幅×高さ) ÷ 40) を削除し、
  「最大セル」を「最も粗い粒 (幅に N 粒以上)」に、グラフの軸を「画面幅に対する割合 / 粒の数」に。
- 自主規制の最小モザイクの説明 (長辺 400px 以上は長辺÷100、最小 4px) は残した (下限の処理は残るため)。

## 追加・変更したコマンド

なし。ゲート: `npm run build && node scripts/check-docs.mjs`。

## 注意点・既知の制約

- branch `req1104-integrate` (b1c8a23 = T-1735) の上に積んでいる。master へ push しない (次回のアプリ公開と一緒に出す)。
- スクリーンショットは差し替えていない (T-1735 と同じ。index.html の `mosaic-detect-2-reapplied.webp` の alt は旧 UI の画面の説明のまま)。
- 不透明度の説明 (`_data/mosaic.yml` / `04-edit.html`「既定 100%」) は変えていない。新規プロジェクトの seed は 85 % になったので、
  掲載するかはリーダー判断 (隠蔽の強さの訴求に関わるため)。

## ロールバック

このチケットのコミットを revert する。
