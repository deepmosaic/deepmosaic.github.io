# T-289 / T-291 — 公式サイトの先行公開 (T-231 / T-252) とモバイルドロワーの回帰 E2E

## 変更点 (要約)

- **公開した**: `159f9c0` (T-231 モバイルナビの `download="false"` 修正) + `6fac814` (T-252 支払方法の明記) +
  `38e4479` (T-289 `docs_draft` を Jekyll の exclude に追加)。`origin/master` = `38e4479`。
  Actions「Deploy Jekyll site to Pages」run 35439205456 = success (2026-09-19)。
- **保留した** (ローカル `master` にだけある): `da6f938` (T-276) / `63f74b8` (T-254) / `9016d08` + `d8a5e5a` (T-263) /
  `1590357` (T-286) / マージ `a592e76` / T-291 のコミット。
- **T-291**: `e2e/mobile-nav.spec.ts` を追加、`playwright.config.ts` に `E2E_BASE_URL` (外部の配信先へ向ける) と
  `testIgnore: ['**/.artifacts/**']`。

## なぜ全部ではなく先頭 2 件だけか

| コミット | 公開の前提 | 2026-09-19 の本番 |
|---|---|---|
| T-254 問い合わせページ | Worker `POST /inquiry` | `deepmosaic-auth0-updater` は `/inquiry` を持たない (GET 404、preflight は旧来の汎用応答)。T-254 は Google フォームの導線 7 箇所を自前フォームへ差し替えるので、先に出すと相談導線が全滅する |
| T-263 ENTERPRISE の CTA | `plan_catalog.self_serve = true` (`notes_T-263.md`) | Supabase / Workers / desktop 2.3.8 とも未リリース |
| T-286 | T-263 の後ろに積まれた E2E | — |
| T-276 docs の 1 文 | 全長計上の backend (T-276 / T-277) | 未リリース。ただし `06-ops.html` には同趣旨の文が以前から公開済み (下の「注意点」) |

コミットが依存の無い順に並んでいたので、履歴を書き換えずに `git push origin release/T-289:master` の
fast-forward で出せた。リポジトリは public なので、保留分を別ブランチへ退避 push はしていない。

## 追加 / 変更したコマンド

```bash
# 公開後の確認 (本番のドロワーを Pixel 7 エミュレーションで tap。読み取りのみ、解析系は abort)
E2E_BASE_URL=https://www.deepmosaic.co.jp npx playwright test

# ローカル (従来どおり。mobile-nav も一緒に走る)
npm run e2e
E2E_SKIP_BUILD=1 npm run e2e
```

## 検証 (実施済み)

- 公開前: 別 worktree (`release/T-289`) で `npm ci` → `npm test` (105 pass / 1 skip = 鍵未設定の live 検査) →
  `npm run build` → `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter` →
  その時点の `Verify build output` を yml から逐語抽出して実行 = exit 0。`_site/docs_draft` 不在、
  `/enterprise/inquiry` / `id="team"` / `data-dl="enterprise"` / T-276 固有の文は 0 件。
- 公開前の本番: ドロワーの同一オリジン 4 リンクすべてに `download="false"`、tap すると `false.htm` が保存され
  遷移しない (ユーザー報告の再現)。配信バンドルに `` si(r,`download`,!!…) `` が 1 件。
- 公開後の本番: バンドル 56,970 bytes (候補と同一)、`download`,!! は 0 件。ドロワーの 4 リンクとも属性なし・
  tap で遷移・保存なし。`/price/` の支払方法 3 行、`/docs_draft/notes_T-231.md` / `notes_T-252.md` / `/enterprise/inquiry/` は 404。
- T-291 の RED: `download={Boolean(item.download)}` (CI の grep ガードは検出 0 件) に戻してビルドすると
  3 件とも失敗、戻すと 3 件 PASS。ローカル全 12 件 PASS、本番向け 3 件 PASS。

## 注意点・既知の制約

- **次の公開は `git push origin master` だけでよい。** `38e4479` は `a592e76` でローカル `master` に取り込み済み
  (`_config.yml` の衝突は master 側の 4 行を採用。除外行は両側でバイト一致)。
- **保留分の解除順**: Supabase migration (T-255 を含む Step A) → Workers → (desktop / web) → サイト。
  `worker-auth0-updater` の HEAD を migration より先に出してはいけない — T-258 が `plan_catalog` の select に
  `self_serve,max_seats` を足しており、列が無い本番では PostgREST が 400 を返して
  `/create-checkout-session` が全プランで失敗する (2026-09-19 の読み取り調査。親 CHANGELOG の T-289 を参照)。
- T-276 の保留理由は「未リリースの挙動の説明」だが、`_includes/docs/06-ops.html` (使用時間の計測) には
  「検出範囲を絞った場合も動画全体の長さで数えます」が以前から公開されている。T-276 が足すのは
  `03-detect.html` の 1 文と「同じ動画をもう一度検出しても重ねては数えません」で、後者が backend 依存。
- ENTERPRISE の「クレジットカード」表記は申込経路 (T-263) より先に出た。レビューで HIGH が付いたが、
  特商法ページ (`company/asct.html`) が以前から全プランでカード払いを明記しており、Enterprise は変更前後とも
  問い合わせ経由のため、公開を止める理由にはならないと判断した。営業がカードで案内できることは業務側の前提。
- `_site/scripts/` (`check-docs.mjs` など) が本番で配信されている。`_config.yml` の exclude に `scripts` が
  無いためで、今回の変更より前からの状態。秘密情報は含まない。

## ロールバック

`git revert 38e4479 6fac814 159f9c0` を `master` に積んで push (T-231 を戻すとスマホのナビが再び壊れるので、
戻すなら T-252 の `6fac814` だけにする)。
