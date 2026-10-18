# T-1296: 動作環境の GPU 要件を「RTX 3000 シリーズ以上、未満は動作未確認」に

## 変更点
- `_data/spec.yml` (正本) の GPU 行: 「NVIDIA GeForce RTX 3000 シリーズ以上 (CUDA 対応) + 最新ドライバ<br>RTX 3000 シリーズ未満の GPU は動作未確認です。GPU が無い場合も CPU モードで動作しますが、処理速度は大幅に低下します」。`/spec/` と `llms-full.txt` はここから生成されるので自動で変わる。
- 手書きの写しを同じ内容に:
  - `_includes/docs/06-ops.html` 動作環境の GPU 行 (精緻化・NVENC ドライバ 570 の文は据え置き)。
  - `_data/entity.yml` の `software_requirements` (JSON-LD): 「NVIDIA GeForce RTX 3000 シリーズ以上を推奨」。T-333 で表から外した「Microsoft Edge WebView2」を削った。
  - `_data/faq.yml`「GPU は必須ですか？」: 「NVIDIA GeForce RTX 3000 シリーズ以上を推奨します。それ未満の GPU は動作未確認です」。
- `src/lib/spec-requirements.test.js` に 4 箇所の文言一致と entity.yml に WebView2 が無いことの回帰テストを追加。

## 追加・変更したコマンド
なし (`npm test` に含まれる)。

## 注意点・既知の制約
- 「CUDA 対応 GPU 機では標準で有効」(index.html / docs 03-detect の精緻化の説明) は spec の禁止事項どおり変えていない。
- docs 第 1 章「インストール」の WebView2 の説明は残している (インストーラの挙動の説明で、動作環境の要件ではない)。
- 公開は master への push (T-1298 のリーダー作業)。

## ロールバック
この commit を revert する。
