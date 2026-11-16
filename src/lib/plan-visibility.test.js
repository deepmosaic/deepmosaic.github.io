// プランの金額の欄の有無 (お見積りのプランと public が false のプランは持たない) の仕様テスト。
//
//   node --test src/lib/plan-visibility.test.js
//
//   - 金額を出すプラン = 公開 (`public: true`) で、お見積り (`quote_label`) でないもの。
//   - それ以外のプランは `_data/plans.yml` に金額の欄 (price・price_display・price_incl_display・price_unit) を持たない。
//   - 試算の部品に渡すプラン (`roiTiers`) と試算の結果 (`roiFit`) は、金額の欄の有無で変わらない。
//   - 出力 (_site) の data-plans の検査は scripts/i18n/checks/plan-visibility.mjs (check-site)。ここでは純ロジックを見る。
//   - `_site` は読まない。

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { loadTiers } from './plans-yml.js'
import { roiFit, roiTiers } from './pricing.js'
import check, { PRICE_KEYS, findPlanData, planDataErrors, showsPrice } from '../../scripts/i18n/checks/plan-visibility.mjs'

const TIERS = loadTiers()
const byCode = (code) => {
	const t = TIERS.find((x) => x.code === code)
	assert.ok(t, `plans.yml に ${code} が無い`)
	return t
}

/** Liquid の `jsonify` を単引用符の属性に入れた形 (ページの出力と同じ) */
const island = (tiers) => `<div data-island="roi"\n         data-plans='${JSON.stringify(tiers)}'\n         data-default-cost="24000"></div>`

// ── データ ──────────────────────────────────────────────────────────

test('showsPrice: 公開でお見積りでないプランだけが金額を出す', () => {
	assert.equal(showsPrice({ public: true }), true)
	assert.equal(showsPrice({ public: true, quote_label: '' }), true)
	assert.equal(showsPrice({ public: true, quote_label: 'お見積り' }), false)
	assert.equal(showsPrice({ public: false }), false)
	assert.equal(showsPrice({}), false, 'public が無いものは公開として扱わない')
})

test('plans.yml: 金額を出すプランは Free と Light', () => {
	assert.deepEqual(
		TIERS.filter(showsPrice).map((t) => t.code),
		['free', 'light'],
	)
	for (const t of TIERS.filter(showsPrice)) {
		assert.equal(typeof t.price, 'number', `${t.code}: price が無い`)
		assert.equal(typeof t.price_display, 'string', `${t.code}: price_display が無い`)
	}
})

test('plans.yml: お見積りのプランと public が false のプランは金額の欄を持たない', () => {
	const noPrice = TIERS.filter((t) => !showsPrice(t))
	assert.deepEqual(noPrice.map((t) => t.code), ['pro', 'enterprise'], '陽性対照: 金額の欄の無いプランが読めていない')
	for (const t of noPrice) {
		for (const k of PRICE_KEYS) assert.ok(!(k in t), `${t.code}: ${k} が残っている`)
	}
})

// ── 試算に渡すプランと結果 ──────────────────────────────────────────

const publicTiers = TIERS.filter((t) => t.public === true)

test('roiTiers: 公開のプランのうち、有料のものとお見積りのものを渡す (Free は渡さない)', () => {
	assert.deepEqual(roiTiers(publicTiers).map((t) => t.code), ['light', 'enterprise'])
	assert.deepEqual(roiTiers(TIERS).map((t) => t.code), ['light', 'enterprise'], 'public が false のプランは渡さない')
	assert.deepEqual(roiTiers([]), [])
})

test('roiFit: 試算の結果は 10 時間まで Light、超えたら Enterprise (お見積り・金額なし)', () => {
	const tiers = roiTiers(publicTiers)
	const light = byCode('light')
	for (const h of [0.5, 1, 5, 5.5, 10]) {
		const fit = roiFit(tiers, h)
		assert.equal(fit.tier.code, 'light', `${h} 時間`)
		assert.equal(fit.cost, light.price * Math.max(1, Math.ceil(h / light.included_hours)), `${h} 時間`)
		assert.equal(fit.quote, false, `${h} 時間`)
	}
	for (const h of [10.5, 20, 41, 90]) {
		const fit = roiFit(tiers, h)
		assert.equal(fit.tier.code, 'enterprise', `${h} 時間`)
		assert.equal(fit.cost, null, `${h} 時間`)
		assert.equal(fit.quote, true, `${h} 時間`)
	}
})

test('roiFit: お見積りのプランに金額の欄があっても無くても結果は同じ', () => {
	const ent = byCode('enterprise')
	const withPrice = publicTiers.map((t) => (t.code === 'enterprise' ? { ...ent, price: 1, price_display: '1' } : t))
	const summary = (fit) => fit && { code: fit.tier.code, cost: fit.cost, quote: fit.quote }
	for (let h = 0.5; h <= 60; h += 0.5) {
		assert.deepEqual(summary(roiFit(roiTiers(withPrice), h)), summary(roiFit(roiTiers(publicTiers), h)), `${h} 時間`)
	}
	assert.deepEqual(roiTiers(withPrice).map((t) => t.code), ['light', 'enterprise'])
})

// ── 出力の検査 (check-site のモジュール) ────────────────────────────

test('findPlanData: data-plans の JSON を読み、実体参照を戻す', () => {
	assert.deepEqual(findPlanData(island([{ code: 'a', name: 'x' }])), [[{ code: 'a', name: 'x' }]])
	assert.deepEqual(findPlanData(`<div data-plans='[{"name":"a&amp;b","s":"&#39;"}]'></div>`), [[{ name: 'a&b', s: "'" }]])
	assert.deepEqual(findPlanData('<div data-island="roi"></div>'), [])
	assert.throws(() => findPlanData(`<div data-plans='[{'></div>`), /data-plans/)
})

test('planDataErrors: 公開で金額を出すプランと、金額の欄の無いお見積りのプランは通す (陽性対照)', () => {
	const ok = [
		{ code: 'light', public: true, price: 100, price_display: '100', price_unit: '/ 月' },
		{ code: 'enterprise', public: true, quote_label: 'お見積り', included_hours: 20 },
	]
	assert.deepEqual(planDataErrors(island(ok)), [])
})

test('planDataErrors: お見積りのプランの金額の欄と、public が false のプランを止める (陰性対照)', () => {
	for (const k of PRICE_KEYS) {
		const bad = [{ code: 'enterprise', public: true, quote_label: 'お見積り', [k]: 1 }]
		assert.equal(planDataErrors(island(bad)).length, 1, k)
	}
	assert.equal(planDataErrors(island([{ code: 'pro', public: false }])).length, 1)
	assert.equal(planDataErrors(island([{ code: 'x' }])).length, 1, 'public の無いプラン')
	assert.equal(planDataErrors(`<div data-plans='{"code":"x"}'></div>`).length, 1, '配列でない')
})

test('check: 全ページの data-plans を見て、ページのパスを添えて返す', () => {
	const pages = {
		'index.html': island([{ code: 'light', public: true, price: 100 }]),
		'en/index.html': island([{ code: 'enterprise', public: true, quote_label: 'Quote', price: 1 }]),
		'spec/index.html': '<p>なし</p>',
	}
	const ctx = { listHtml: () => Object.keys(pages).sort(), read: (rel) => pages[rel] }
	const errors = check(ctx)
	assert.equal(errors.length, 1)
	assert.match(errors[0], /^en\/index\.html: /)
	assert.match(errors[0], /enterprise/)
})
