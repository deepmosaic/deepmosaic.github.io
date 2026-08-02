#!/usr/bin/env node
// `_data/plans.yml` が Supabase `plan_catalog` とずれていないか検査する
// (TICKET-SITE-CONTRACT-SSOT / 案B)。
//
//   node scripts/check-plan-catalog.mjs
//
// ## なぜ要るか
//
// 契約本数の上限 (`max_contracts`) / 込み時間 / 月額の **真の SSOT は Supabase の
// `plan_catalog`**。静的サイトは Supabase を読めないため `_data/plans.yml` に写しを
// 置いている。写しである以上いつか必ず乖離し、乖離したまま公開すると
// **実在しない契約条件を広告する**ことになる。人手のレビューではなく機械で気付く。
//
// サイト内の重複そのものは案C で `_data/plans.yml` の 1 箇所に潰した。ここが守るのは
// **その 1 箇所と本番 DB の距離**。
//
// ## 終了コードの方針 (重要)
//
//   0  一致した / 検査できなかった (鍵が無い・ネットワーク断・5xx・鍵が無効)
//   1  **取得に成功して値が食い違った**
//
// サイトのデプロイを Supabase や Worker の可用性に人質に取らせない。落ちている間
// サイトを更新できない、という状態を作らないため、**取得できなければ黙って素通しする**
// (`::warning::` は出すので Actions の画面には残る)。
//
// ## 環境変数
//
//   SUPABASE_PROXY_API_KEY  Worker の X-API-Key。**未設定なら検査をスキップ**する。
//                           値はログにも例外にも出さない
//   PLAN_CATALOG_URL        取得先の上書き。**ローカル検証専用** — 「値をずらしたら
//                           落ちる」ことをスタブサーバで確認するために使う。CI では設定しない
import { loadTiers } from '../src/lib/plans-yml.js'
import { CATALOG_URL, diffPlanCatalog, fetchPlanCatalog } from '../src/lib/plan-catalog.js'

// GitHub Actions のアノテーション。ローカルで実行しても素の 1 行として読める
const warn = (m) => console.log(`::warning::${m}`)
const fail = (m) => console.log(`::error::${m}`)

const tiers = loadTiers()

const result = await fetchPlanCatalog({
	apiKey: process.env.SUPABASE_PROXY_API_KEY || '',
	url: process.env.PLAN_CATALOG_URL || CATALOG_URL,
})

if (result.status !== 'ok') {
	warn(`plan_catalog との突き合わせをスキップ: ${result.message}`)
	process.exit(0)
}

const { errors, warnings, compared } = diffPlanCatalog(tiers, result.plans)

for (const w of warnings) warn(w)

if (errors.length > 0) {
	for (const e of errors) fail(e)
	fail(
		`_data/plans.yml が Supabase plan_catalog と ${errors.length} 件食い違っている —` +
			' 広告している条件が実在しない。plan_catalog の値に合わせて plans.yml を直すこと',
	)
	process.exit(1)
}

// 「一致している」は **比較できた範囲での話**。列が無い等で飛ばした項目があれば
// 件数を添える (緑だが監視が一部効いていない、を隠さない)
const skipped = warnings.length > 0 ? ` / 飛ばした項目 ${warnings.length} 件` : ''
console.log(`plan_catalog と _data/plans.yml は一致している (${compared} プランを突き合わせ${skipped})`)
