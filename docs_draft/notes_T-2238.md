# T-2238 (signin1113): CLAUDE.md の「ログイン」を「サインイン」に統一 — サイト

## 変更点

- `CLAUDE.md` 133 行: 撮れない画面の一覧の「他端末ログイン」→「他端末のサインイン」(1 行)。ほかの段落は触っていない。
- 用語集の写し (`scripts/i18n/glossary.json`・`glossary.source.json`) と語数のテスト (`src/lib/i18n-site-lang.test.js`) は、
  リーダーの追加 5 により**このチケットでは写さない** (desktop の用語集が確定した後に T-2249 が写し直す)。
  desktop の用語集は T-2238 で 211 語 (`sign_in` / `sign_out` の ja = サインイン / サインアウト、`corporate` = 法人 (reference) を追加、
  `cancel_subscription` の preferred を米式 `canceled` に)。

## 追加・変更したコマンド

なし。

## 注意点・既知の制約

- 写しを取り込むときは `glossary.source.json` の `desktop_commit`・sha256 と、`i18n-site-lang.test.js` の語数 (210 → 211) を同時に直す
  (詳細は desktop の `docs_draft/notes_T-2238.md`)。

## ロールバック

この 1 行を戻すだけ (ほかのファイルに依存しない)。

## 追記: 用語集の写し

- S2 の横断レビューの追い修正で、desktop e1d14f81 の用語集を写した (T-2249 と同じコミット。詳細は notes_T-2249.md の末尾)。
