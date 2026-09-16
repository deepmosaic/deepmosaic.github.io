# T-263 — site: ENTERPRISE の CTA をダウンロード申込に / docs にチーム管理節 / ローンチ切替手順

実装日: 2026-09-17 / Role: Implementer → Reviewer → Tester (単独セッション)

**コミット・push・デプロイなし。** ゲート (`npm run build` / `bundle exec jekyll build --strict_front_matter` /
`check-docs.mjs` / `check-plan-catalog.mjs` / `npm test` / CI の `Verify build output` をローカル抽出) は通過済み。

---

## 変更点 (要約)

| ファイル | 役割 | 内容 |
|---|---|---|
| `_data/plans.yml` | 変更 | enterprise の `cta` を `kind: download` / 「ダウンロードして申し込む」/ `variant: secondary` に。`secondary_cta` (「導入について相談する」→ `/enterprise/inquiry/`) を追加 |
| `_includes/pricing-cards.html` | 変更 | 任意の `secondary_cta` を主ボタンの下にテキストリンクで描画 (7 行)。既存の `cta` の分岐は不変 |
| `_includes/docs/07-team.html` | **新規** | docs 第 7 章「チーム」= 節 `#team`「チームの管理（Enterprise）」 |
| `_data/docs_toc.yml` | 変更 | desktop の目次末尾に「チーム」グループ (`team` 1 件) を追加 |
| `docs/index.html` | 変更 | `{% include docs/07-team.html %}` を 06-ops の後に追加 |

`_config.yml` / `src/` / `assets/` は触っていない。**既存 20 個の契約 ID (about … trouble) は無変更**
(`src/lib/docs-check.js` の `LEGACY_DOCS_IDS`)。追加のみ。

### 判断のメモ

- **`secondary_cta` はボタンではなくテキストリンク。** カードにボタンを 2 つ並べると主導線
  (ダウンロード申込) が分からなくなる。見た目は本文中のリンクと同じ `text-accent-soft hover:underline`
- **数値はカードにも docs にも直書きしない。** 込み時間 / 最低アカウント数は `_data/plans.yml` の
  enterprise 行を Liquid で引く (`ent.included_hours` / `ent.min_seats`)。
  **アカウント数の上限 (`plan_catalog.max_seats`) は plans.yml に写しが無いので、数値を書かず
  「上限を超える場合は導入相談へ」と書いた** — 書くと検査対象外の数値がサイトにだけ残る
- **章は末尾に足した。** 既存 6 章の順序と番号を動かすと差分が大きく、目次 ID の契約に触れる事故が増える。
  目次のグループ順 = ページの節順 (Scrollspy) も保てる
- **スクリーンショットは入れていない。** T-260 (desktop のチーム管理モーダル) が未実装のため、
  差し込み位置を HTML コメントで残した (`{%- comment -%} スクリーンショット (T-260 実装後): … {%- endcomment -%}`)。
  画像を入れるときは `screenshots.mjs` → `assets/img/screenshots/` → `optimize-images.mjs --apply` →
  `check-docs.mjs --fix-dims` の順 (CI が実在・alt・寸法を検査する)
- docs の記述は T-255 / T-257 / T-258 の実装に合わせた: 招待も 1 席を占める / 再送は 60 秒クールダウン /
  組織コードは owner にだけ表示・再発行で旧コード無効 / シート下限は `max(min_seats, メンバー + 未消化招待)` /
  シート変更は `proration_behavior=create_prorations` (日割りで次回請求) かつ当期のプールも
  `open_usage_period` の upsert で即再計算 / 繰越なし

---

## ローンチ切替手順 (Enterprise 自己申込を開く)

**このサイトの変更を公開してよいのは、`plan_catalog.self_serve` を true にした後だけ。**
順序を逆にすると、カードから申し込んだユーザーが Worker の 400
(`seat-based plan requires contact`) に当たる = **存在しない導線の広告**になる。

### 前提 (別チケット。揃っていなければ切り替えない)

- T-255 の migration (`desktop/docs/supabase/migrations/2026-09-16_t255_organizations.sql`) が
  sandbox / live とも適用済み (未適用だと `/org/*` は 503 `org_unavailable`)
- `worker-auth0-updater` が T-257 + T-258 込みでデプロイ済み (`ACTION_SHARED_SECRET` 投入済み)
- Auth0 Post-Login Action が投入済み (`ext-org_code` での参加)
- desktop / web の「チームの管理」UI (T-259〜T-262) が出荷済み

### 手順

```sql
-- 1. sandbox で開く (livemode = false)
update public.plan_catalog
   set self_serve = true
 where plan_code = 'enterprise' and livemode = false;

-- 確認
select plan_code, livemode, seat_based, self_serve, min_seats, max_seats
  from public.plan_catalog where plan_code = 'enterprise';
```

0. **先に Stripe の Customer Portal 設定**で Enterprise の `adjustable_quantity` を
   `minimum: min_seats` / `maximum: max_seats` にする (sandbox / live 両方)。
   現状は `max_contracts` 基準で `maximum: 1` の可能性があり、そのままだと
   ポータルから増席できない (notes_T-258 の申し送り)
1. **sandbox**: 上の SQL → dev Worker + sandbox 課金で「申込 → 組織発行 → 招待 → 組織コードで参加 →
   アカウント数の増減 → 請求書表示」を一通り確認する
2. **live**: 同じ SQL を `livemode = true` で実行する。
   併せて `desktop/docs/supabase/plan_catalog_seed.sql` の enterprise 行も `self_serve = true` に直す
   (**seed が値の SSOT**。直さないと次に seed を流した人が false に戻す)
3. **Workers を先にデプロイ** (既にデプロイ済みなら何もしない)。サイトより必ず先
4. **サイトをデプロイ** — この変更を `master` に push (GitHub Pages が自動ビルド)。
   これで `/price/` と `/` の ENTERPRISE カードが「ダウンロードして申し込む」になり、
   `/docs/#team` が公開される
5. 事後確認: `/price/` のカード / `data-dl="enterprise"` が GA4 の `file_download` に出ること /
   `/docs/#team` が開くこと / アプリから Enterprise を実際に 1 件申し込めること

**サイトを切り替えるまでの中間状態は安全側**: `self_serve` が true でもカードは
「導入について相談する」のまま = 問い合わせフォームに落ちるだけ。逆順 (サイトだけ先に公開) は
400 になるので不可。

### ロールバック

1. `_data/plans.yml` の enterprise を `cta: { label: "導入について相談する", kind: "link",
   href: "/enterprise/inquiry/", external: false }` に戻し、`secondary_cta` を削除してサイトを再デプロイ
   (同じ導線が 2 つ並ぶのを避けるため、必ず両方)
2. `update public.plan_catalog set self_serve = false where plan_code = 'enterprise';`
   (+ seed も戻す)。**既に発行された組織は残る** — 組織側の機能 (`/org/*`) は self_serve とは独立で、
   停止したいなら Worker のロールバックが要る

### ⚠️ CI はこの乖離を検知しない

`scripts/check-plan-catalog.mjs` が突き合わせるのは `min_seats` / 込み時間 / 月額 / `max_contracts` だけで、
**`self_serve` は見ていない**。「カードは申込導線なのに DB は false」は機械では落ちないので、
上の順序を人が守ること (検知を増やすなら `diffPlanCatalog` に `self_serve` ↔ `cta.kind` の突き合わせを足す —
今回は plans.yml 側に対応する列が無いため見送り)。

---

## 検証 (実施済み)

```bash
cd C:/Users/core/scripts/deepmosaic/deepmosaic.github.io
npm run build                                      # vite OK (app.css 38.86 kB / app.js 72.17 kB)
bundle exec jekyll build --strict_front_matter     # OK
node scripts/check-docs.mjs                        # docs check: OK (2 ページ, 14 ファイルの深いリンク)
node scripts/check-plan-catalog.mjs                # skip (SUPABASE_PROXY_API_KEY 未設定) = exit 0
npm test                                           # tests 129 / pass 128 / skip 1 / fail 0
bash <CI の Verify build output を抽出したもの>      # exit 0 (data-dl / Google フォーム / プレースホルダ等)
```

ブラウザ目視 (`bundle exec jekyll serve --port 4010`):

- `/price/` 1280px — ENTERPRISE カードが「ダウンロードして申し込む」(副ボタン配色) +
  その下にテキストリンク「導入について相談する」。Pro が主ボタンのままで視線の優先度は不変
- `/price/` 390px — カードが縦積みになってもリンクが折り返さない
- `/docs/#team` 1280px / 390px — 目次「チーム」→ 本文へ遷移、`.kv` 表が幅で崩れない

`data-dl="enterprise"` が出力に載ることを確認 (`_site/price/index.html`)。DL 計測の CI チェック
(ページごとに `data-dl` が 1 つ以上) も通過。

---

## 既知の限界 / やっていないこと

- **スクリーンショットなし** (T-260 の UI 待ち)。差し込み位置は HTML コメント
- **`llms.txt` に `/docs/#team` を足していない。** 足すなら日英 1 行
  (`- [チームの管理 / Team management]({{ U }}/docs/#team): …`)。今回は範囲外と判断
- **`/price/` の本文と front matter の description は Enterprise の申込方法に触れていない。**
  「アプリ内のプラン管理からお手続き」という現行の説明で Enterprise も矛盾しない (チームの管理も
  プロフィールメニュー内) ため据え置いた
- **`_includes/docs/02-account.html` の「Enterprise は『導入について相談する』からお問い合わせください」は
  そのまま。** これは desktop の `PlanSelectDialog` の文言の説明で、自己申込を開くと実 UI が変わる
  (T-260 の範囲)。UI が確定したら 02-account 側も直すこと — **放置すると docs 内で説明が食い違う**
- `secondary_cta` は内部リンク前提 (外部 URL を入れるなら `target="_blank"` /
  `rel="noopener noreferrer"` を include に足す)
- 親リポの `CHANGELOG.md` の T-263 のチェックは付けていない (リーダーが最後にまとめる運用のため)

---

## 修正パス (leader 依頼、2026-09-17)

検証で残った指摘 3 件への対応。**コミット・push・デプロイなし**。ゲート
(`npm run build` / `bundle exec jekyll build --strict_front_matter` / `node scripts/check-docs.mjs` /
`npm test`) を再走して通過。

### (1) 副リンクのタップ領域を 24px 以上に — `_includes/pricing-cards.html`

`secondary_cta` (Enterprise の「導入について相談する」) は本文リンクと同じ見た目にしたぶん、
当たり判定が行高 (12.5px × 1.7 ≒ 21px) しか無く**指では外しやすい**。
`inline-block py-1.5` を足して上下 6px ずつ広げ、約 33px を確保した。
**`inline-block` が無いとインライン要素の縦 padding は当たり判定を広げない**ので両方必要
(理由は include 内のコメントにも残した)。見た目 (色・下線・中央寄せ) は不変。

### (2) CI に ENTERPRISE の申込導線ガードを追加 — `.github/workflows/jekyll.yml`

`Verify build output` の DL 計測チェックは「ページごとに `data-dl` が 1 つ以上」なので、
**ENTERPRISE だけが相談リンクに戻っても緑のまま**通る (Pro / Light の `data-dl` が残るため)。
プラン別に 1 本だけ名指しで固定する行を足した:

```bash
grep -q 'data-dl="enterprise"' _site/price/index.html \
  || { echo "::error::/price/ の ENTERPRISE カードから data-dl=enterprise が消えている — …"; fail=1; }
```

ロールバック手順 (`_data/plans.yml` の `cta` を相談リンクへ戻す) を実行するときは、
**この行も一緒に外す**こと (意図的なロールバックで CI が落ちる)。

### (3) `llms.txt` に `/docs/#team` を追加

notes の「やっていないこと」に挙げていた 1 行を、他の章と同じ日英併記の書式で
「ドキュメント / Documentation」節のトラブルシューティングの次に足した:

```
- [チームの管理 / Team management]({{ U }}/docs/#team): Enterprise のメンバー招待・権限・アカウント数 / inviting members, roles and seat count on Enterprise
```

`node scripts/check-docs.mjs` は深いリンクの実在も見ているので、アンカー
(`_includes/docs/07-team.html` の `id="team"`) との整合はここで機械的に守られる。

### 再走したゲート

```bash
cd C:/Users/core/scripts/deepmosaic/deepmosaic.github.io
npm run build                                      # vite OK (app.css 38.89 kB / app.js 72.17 kB)
bundle exec jekyll build --strict_front_matter     # OK
node scripts/check-docs.mjs                        # docs check: OK (2 ページ, 14 ファイル)
npm test                                           # tests 129 / pass 128 / skip 1 / fail 0
grep -o 'data-dl="enterprise"' _site/price/index.html   # 1 件 (新ガードが緑になる状態)
```

`_site/assets/dist/app.css` に `.inline-block` / `.py-1\.5` が生成されていることも確認済み
(Tailwind v4 のスキャン対象に `_includes/` が入っている)。

### 申し送り

- スクリーンショットは引き続き未挿入 (T-260 の UI が入ったので撮影可能になった。差し込み位置は
  `_includes/docs/07-team.html` の HTML コメント)。
- `_includes/docs/02-account.html` の「Enterprise は『導入について相談する』からお問い合わせください」も
  据え置き (desktop の `PlanSelectDialog` は自己申込ボタン + 相談リンクの併記になったので、
  `self_serve` を開くタイミングで docs も直す)。
