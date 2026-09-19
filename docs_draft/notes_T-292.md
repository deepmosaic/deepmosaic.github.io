# T-292 / T-294 — 問い合わせフォームの先行リリース (Worker `/inquiry` + サイト T-254 まで)

ユーザー指示「1 (問い合わせページだけ先に出す) の対応を進めて」(2026-09-19)。

## 公開したもの

| 対象 | 内容 |
|---|---|
| Worker `deepmosaic-auth0-updater` | version `ceb2bf16-dbf3-43b8-991b-e132940cbe0f`。分離ブランチ `deploy/T-292-inquiry-only` (desktop、origin に push 済み) = 本番デプロイ済みだった `59265ec` (T-182) + T-253 (`POST /inquiry`) + T-293 (セキュリティ修正 3 コミット) + KV id。HEAD (T-243 / T-257 / T-258) は**含まない** (T-255 の migration が先) |
| KV `INQUIRY_RATELIMIT` | `06d603c88ab142b98d4f18f8d59999ed` (本番)。dev 用は未作成 (プレースホルダのまま) |
| Durable Object `InquiryMailBudget` | migration tag `t293-inquiry-mail-budget` (本番に適用済み。HEAD をデプロイするときも `[[migrations]]` を残す) |
| サイト `origin/master` | `6ecc372` = `38e4479` + T-276 (docs 1 文) + T-254 (問い合わせページ) + T-294 (案内をフォームの上へ) |

保留のまま (ローカル `master` のみ): T-263 (ENTERPRISE の CTA、`self_serve = true` が前提) / T-286 / T-291 (E2E)。

## 公開前ゲート (Workflow、すべて読み取り + ローカル実行)

- Worker: vitest 467 → 489 件、typecheck、`deploy --dry-run`、**`wrangler dev --local` の実ランタイム** (dry-run はランタイムを起動しない)。
- **本番コードとの同一性**: MCP で取得したデプロイ済みコード (5,231 行) と分離ブランチのバンドルを行単位で比較 — 本番にしか無いコード / binding は無し (完全な上位集合)。
- セキュリティ (攻撃者視点) → **ブロッキング 2 件** → T-293 で修正 → 第 2 ラウンドで (B) が塞がっていないと判明 → Durable Object 版 → 第 3 ラウンドで (B) 塞がった・ブロッキング 0。詳細は `desktop/docs_draft/notes_T-293.md`。
- サイト: CI と同じ順のビルド検証 + 逐語抽出した `Verify build output` (exit 0) + ブラウザ E2E 12 件 (問い合わせ 9 + ドロワー 3) を候補の `_site` に対して実行。
- 監査: 公開差分に秘密情報なし。個人情報の取得はフォーム脇の利用目的表示 + `/company/privacy` の 2-2 で適法。**一般の問い合わせ導線が Enterprise 専用フォームに集まる** (HIGH) → T-294。

## 本番の確認

- デプロイ前後で既存 17 ルートの応答 (認証なしで拒否されるもの) が同一 (`scratchpad/t292/prod-smoke.sh`)。
- `/inquiry`: preflight 204 + ACAO = 許可オリジン / 未許可 403 で ACAO なし / Origin なし 403 / GET 405 / seats=2 → 400 `invalid_input` field=seats (ACAO 付き) / 壊れた JSON 400 / text/plain 415。
- **テスト送信 2 件** (会社名に【テスト送信】、申込者メールは `support@`): 200 `{ok:true, slack:false, mail:true}`。
  管理者通知メールとお礼メールは送信成功。**Slack は `not_in_channel` で失敗** — Bot が `#申し込み` (C0B1W7P2F1Q) に
  参加していない。**ユーザーが Slack で Bot をチャンネルに招待する** (`/invite @<Bot 名>`)。既存の課金通知
  (`postSubscriptionStartedToSlack`) も同じチャンネル・同じ Bot なので、同様に届いていない可能性がある。
- (Actions と本番ページの確認結果は親 CHANGELOG の T-292 に記載)

## 縮退運用 (Turnstile 未設定)

`_data/inquiry.yml` の `turnstile_site_key` は空、Worker に `TURNSTILE_SECRET_KEY` は未投入。守りは Origin の完全一致 +
ハニーポット + KV の IP レート制限 (並列では効かない) + **メールの日次上限 (DO、通常 30 + 保険 5)** + お礼メールに
申込者の文字列を載せない。有効化の順序: **サイトに Site Key を載せて push → その後 Worker に secret** (逆だと全件 400)。

## 残っている申し送り

- 一般 (Enterprise 以外) の問い合わせフォームを別に持つか (現状は案内で support@ / アプリ内へ逃がす)。
- IP レート制限を DO に移す / Slack 投稿にも上限を持たせる / 502 時の内容保全 (`notes_T-293.md`)。
- `/inquiry` 専用の Resend アカウント (枠の分離)。
- 「希望支払方法」(クレジットカード即時払い / 請求書) の項目追加は請求書払い計画 (承認待ち) 側。

## ロールバック

- Worker: `cd desktop/worker-auth0-updater && npx wrangler rollback e9719a96-a0f7-4dc5-b5b5-edd161ff67fd` (OAuth 資格、
  `desktop/.env` の `CLOUDFLARE_API_TOKEN` を env に入れない)。DO / KV は残るが参照されなくなるだけ。
- サイト: `git revert 6ecc372 e770c6f` (マージコミットは `-m 1`) を `master` に積んで push。ただしサイトだけ戻すと
  問い合わせ導線が Google フォームに戻る (Worker 側はそのままで害なし)。
