# T-404 — 問い合わせ前検査にも U+FFFD (文字化け) 拒否を入れる

対象: `src/lib/inquiry-validate.js` / `src/lib/inquiry-validate.test.js`

Worker 側 (`desktop/worker-auth0-updater/src/inquiry-validate.ts`) と**同時に変える契約**の写し。
本体の変更（本文の fatal UTF-8 デコード、`/org/*` と `/admin/enterprise/*` の入力検証、
Node スモークスクリプト）は desktop リポの `docs_draft/notes_T-404.md` に書いてある。

## 変更点

- 制御文字ヘルパを改名し、**U+FFFD (REPLACEMENT CHARACTER) も拒否対象**に追加
  - `hasAnyControlChar` → `hasForbiddenChar`（1 行項目: 制御文字 + U+FFFD）
  - `hasInvalidMessageChar` → `hasForbiddenMessageChar`（本文: `\t` `\n` 以外の制御文字 + U+FFFD）
  - 判定は `REPLACEMENT_CHAR_CODE = 0xfffd` の 1 定数にまとめた。どちらも非 export の内部関数なので
    外部契約（`validateInquiry` / `buildPayload` / `describeFailure` …）は変わらない
- モジュール冒頭の「Worker と同時に変える規則」の一覧に **U+FFFD 拒否**を追記
- テスト追加: `validateInquiry は U+FFFD (文字化け) を弾く`
  （enterprise の会社名・ご相談内容、general の件名。正常な日本語は通ることも同時に固定）

## なぜ

Worker は本文を fatal UTF-8 でデコードするようになった（CP932 のまま送られた本文は 400 `invalid_json`）が、
**送信元が既に化けていれば**正しい UTF-8 として U+FFFD が届く。Worker 側はそれを `invalid_input` で弾くので、
サイトの前検査が緩いままだと「フォームでは通るのに Worker が 400」という往復が生まれる。

## 追加・変更したコマンド

無し。既存のまま:

```bash
npm test          # node --test src/lib/*.test.js
```

## 注意点・既知の制約

- サイト側は**サーバの写し**。ここを Worker より厳しくすると正当な入力を送れなくなるので、
  規則を変えるときは必ず両方を同時に変える（この変更も対で入れてある）
- U+FFFD を意図して打った入力も弾く。置換文字を本文に入れる正当な用途が無いと判断した
- ビルド成果物（`assets/dist/`）は CI 再生成。このコミットには含めない
- デプロイはリーダーが行う（このチケットでは公開しない）

## ロールバック

- コミット単位で戻せる。部分的に緩めるなら `REPLACEMENT_CHAR_CODE` の判定 2 行
  （`hasForbiddenChar` / `hasForbiddenMessageChar`）を削る。
  **その場合は Worker 側 (`inquiry-validate.ts`) も同時に戻す**
