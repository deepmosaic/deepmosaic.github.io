# T-508 — 公式サイトの連絡先を contact@ から support@deepmosaic.co.jp に

請求書 (Stripe のサポートメール) と公式サイトの連絡先を support@ に一本化する。サイト側は 3 箇所。
Stripe ダッシュボード (設定 → ビジネス → 公開ビジネス情報 → サポートメール、test と live) の変更と
検証モードの請求書での確認は**リーダーがブラウザで行う** (このチケットのコードには含まない)。

## 変更点

- `company/asct.html` (L36) — 特定商取引法に基づく表記の「メールアドレス」行
- `company/privacy.html` (L160) — プライバシーポリシーの「お問い合わせ窓口」の E-mail
- `_includes/schema/organization.html` (L30) — JSON-LD `Organization.contactPoint.email`
  (全ページの `<head>` に出る)
- **`src/lib/contact-email.test.js` (新規)** — 回帰テスト 8 件。宛先の正は `_data/inquiry.yml` の
  `support_email` (問い合わせフォームの mailto と 502 の案内文が使う) で、上の 3 面がそれと同じ
  宛先を載せていること / 旧宛先 `contact@deepmosaic.co.jp` が残っていないことを固定する。
  `supportEmailOf` が行の無い YAML で null を返すこと (検査のすり抜け防止) も見る。

`git grep "contact@"` のヒットは上の 3 箇所だけだった (他に触ったファイルは無い)。ビルド後の `_site/`
にも `contact@deepmosaic` は残っていない。docs_draft / CHANGELOG の過去記録には手を付けていない。

## 追加・変更したコマンド

新規コマンドは無し。`npm test` に `contact-email.test.js` が加わる (`node --test src/lib/*.test.js`)。

## 注意点・既知の制約

- 3 ファイルは作業ツリーが CRLF (`core.autocrlf=true`、index は LF)。差分は各 1 行。
- 「最終更新日」(privacy: 2026-08-02 / asct: 2020-7-1) は据え置いた。連絡先の変更を改定として
  日付を上げるかは事業判断なので、必要ならリーダーが決める。
- Worker (`MAIL_REPLY_TO` 等) とコードに contact@ は無い (起票時の調査どおり)。

## ロールバック

このコミットを revert するだけ (データ・設定の移行は無い)。
