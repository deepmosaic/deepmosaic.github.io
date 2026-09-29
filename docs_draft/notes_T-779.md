# T-779 公開サイトの文とスクリーンショットの修正

## 変更点
- `_includes/docs/03-detect.html`
  - 「処理中は待ち時間用のミニゲームが表示されます…」(T-765 / T-766 でアプリから撤去) を
    「処理中はステップごとの進み具合と所要時間の目安が表示されます。」に置き換えた。
  - `detect.webp` の alt / figcaption に「ステップごとの所要時間」を追記。
- `_includes/docs/04-edit.html`
  - 枠の編集の自動保存: 「エンコードと Premiere Pro 連携の両方に反映」は誤り。Premiere Pro 連携に渡るのは
    検出結果とエッジのぼかしの値だけで、編集画面での枠の編集 (移動・形の変更・削除など) は渡らない、と書き換えた。
  - エッジぼかし: 「Premiere Pro のフェザーに相当」を、Premiere Pro のマスクの「マスクの境界のぼかし」と同じ意味
    (輪郭を中心に内側と外側へ半分ずつ、値は内外を合わせた幅) に書き換えた。
- `assets/img/screenshots/detect.webp` / `detect-cancel.webp` を desktop の撮影ハーネスで撮り直し
  (旧画像にはブロック崩しが写っていた。新画像はステップ表示 + ステップごとの所要時間のパネル)。
- サイト全体で「ミニゲーム / ブロック崩し / mini game / breakout / 復号鍵」を検索し、上記以外の該当なし。

## 追加・変更したコマンド
なし。撮影は `desktop` で `node scripts/e2e/screenshots.mjs --kill-existing --only=detect,detect-cancel`。

## 注意点・既知の制約
- 撮影ハーネスは毎回 vite を起動し直すため、vite の依存最適化が確定していないと
  「optimized dependencies changed. reloading」で撮影前にページが再読み込みされ
  `Execution context was destroyed` で落ちる (2 回再現)。`npm run dev` を一度起動して
  アプリのモジュールを一通り要求し (`node_modules/.vite/deps/_metadata.json` に lucide-svelte / polygon-clipping 等が載る)、
  止めてから撮影すると通った。ハーネス側の恒久対策は未実施 (desktop の担当)。
- 撮影は通ったが、その後の検出が SEGMENT 段でエラーダイアログになりハーネスは exit 1 で終わった
  (両ショットは撮影済み。sidecar 2.6.1 + 手元の SAM 重みの組み合わせと思われる、本チケット外)。
- 画像のステータスバーには撮影用フォルダ `C:\Users\core\deepmosaic\demo` が写る (旧画像と同じ扱い)。

## ロールバック
このブランチのコミットを revert すれば旧文言と旧画像に戻る (公開はリリース T-807 で実施)。
