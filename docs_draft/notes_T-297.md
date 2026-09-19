# T-297 — Pro / Enterprise を月 20 時間に (公式サイト側)

実装日: 2026-09-19 / Role: Implementer / `master` (in place、**push なし**)

正本は Supabase `plan_catalog`。`_data/plans.yml` はその写しで、
乖離は CI (`scripts/check-plan-catalog.mjs`) が検知する。

---

## 変更点 (site)

| ファイル | 内容 |
|---|---|
| `_data/plans.yml` | pro `included_hours: 40 → 20` / specs 「月 20 時間」、enterprise `included_hours: 40 → 20` / specs 「アカウント数 × 20 時間をプール共有」。どちらも SSOT が Supabase である旨のコメントを添えた |
| `src/lib/pricing.test.js` | 確定値 20 / `monthlyCost(pro,20)=9800`・`(pro,21)=19600`・`(pro,41)=INF` / `contractsNeeded(pro,40)=2`・`(pro,40.1)=null` / `bestSeatPlan(ent,60)={3,24000}`・`(ent,61)={4,32000}`・`(ent,80)={4,32000}`・`(ent,81)={5,40000}` / 切替 `40h=Pro`・`41h=Enterprise` / 境界 `(pro,20)`・`(pro,20.000001)` / `suggestEnterpriseOver=20` / `planBreakdown` の再設計 |
| `src/lib/plan-catalog.test.js` | 「合計時間は `included_hours × max_contracts`」の Pro を 40 に (20 × 2) |

### `planBreakdown` の再設計 (ここだけ構造が変わる)

旧: `planBreakdown(pro, 41) === '2 契約（月 80 時間込み）'`。
20 時間化すると 41h は **Pro の上限 (2 本 = 40h) を超えて候補から外れる**ため、
`contractsNeeded` が null → `?? 1` で「月 20 時間込み」という*賄えないプランの内訳文*になる。
これを仕様として固定するのは誤りなので:

- 複数契約の内訳は `(pro, 21) === '2 契約（月 40 時間込み）'` で固定
- 41h は「**どのプランが選ばれるか**」= `cheapestPlan(paid, 41).tier.code === 'enterprise'` で固定
- Enterprise は `(ent, 12) = 3 アカウント（60 時間をプール共有）` / `(ent, 73) = 4 アカウント（80 時間をプール共有）`

「月 12 時間 → Light×3 ¥8,940 / 年間削減 1,620,720 円」(トップの ROI 計算機の既定値) は不変。
`index.html` の noscript も不変。

## コマンド

```bash
cd C:/Users/core/scripts/deepmosaic/deepmosaic.github.io
npm test        # node --test src/lib/*.test.js → 128 passed / 1 skipped (ライブ検査は鍵なしで skip)
```

## 注意点 (リリース順)

- ⚠️ **Supabase に `2026-09-19_t297_plan_minutes_20h.sql` を適用してからサイトを公開する。**
  `scripts/check-plan-catalog.mjs` は本番 `plan_catalog` と `plans.yml` を突き合わせ、
  食い違うと **exit 1 (CI 落ち)** になる。先にサイトを push すると
  「pro: 込み時間が食い違っている — サイト 1200 分 / Supabase 2400 分」で Pages が止まる。
- サイトは **push = 即公開**。本チケットでは commit も push もしていない
  (T-289 の部分公開方針に従い、公開判断はユーザー)。
- 料金 (¥9,800 / ¥8,000・最低 3 アカウント) と `max_contracts` は変更なし。

## 残課題

- Pro 既契約者への告知 (サイト掲示 / メール) はユーザー判断。既契約者の枠は
  **次の課金期間から** 20 時間になる (バックフィルしない)。
- Enterprise カードの文言整理 (`price_note` など) は T-298 の担当。
