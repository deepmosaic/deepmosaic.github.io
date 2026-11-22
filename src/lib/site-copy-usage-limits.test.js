// 上限時間の記述・バッジ・税込併記の回帰テスト。
//
//   node --test src/lib/site-copy-usage-limits.test.js
//
//   - FAQ / docs 第 2 章 / 第 6 章に「上限時間の適用は順次開始」を載せない (上限はアプリが適用している)。
//     超過料金なし・追加契約の説明は載せる。
//   - Pro に「最も選ばれています」バッジを出さない。
//   - 料金カードの価格は税別に税込を併記する。税込額は `_data/plans.yml` の
//     `price_incl_display` が写しで、規則 (`taxIncluded`) と一致することをここで強制する。
//
// 読み取りはこのファイル内で完結させる (`site-copy-enterprise-min-seats.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadTiers } from './plans-yml.js'
import { formatYen, taxIncluded } from './pricing.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid の `{% comment %}`、HTML コメント、YAML の行コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^\s*#.*$/gm, '')
}

/** plans.yml の最上位 `tax_rate_percent`。無ければ null。 */
function taxRatePercentOf(yml) {
	const m = yml.match(/^tax_rate_percent:\s*(\d+)\s*$/m)
	return m ? Number(m[1]) : null
}

const ROLLOUT_PAGES = ['_data/faq.yml', '_includes/docs/02-account.html', '_includes/docs/06-ops.html']

test('「上限時間の適用は順次開始」と適用前提の文が公開面に無い', () => {
	for (const rel of ROLLOUT_PAGES) {
		const text = stripComments(read(rel))
		assert.doesNotMatch(text, /順次開始/, `${rel} に「順次開始」が残っている`)
		assert.doesNotMatch(text, /適用が始まるまで/, `${rel} に「適用が始まるまで」が残っている`)
		assert.doesNotMatch(text, /開始日は事前にお知らせ/, `${rel} に「開始日は事前にお知らせ」が残っている`)
	}
})

test('超過料金なしと、利用枠を使い切ったときの案内 (次の更新日・法人向けプランの相談) は残っている (開示を消していない)', () => {
	for (const rel of ROLLOUT_PAGES) {
		const text = stripComments(read(rel))
		assert.match(text, /超過料金は発生しません/, `${rel} から「超過料金は発生しません」が消えた`)
		assert.match(text, /次の更新日に利用枠が戻ります/, `${rel} から更新日の案内が消えた`)
		assert.match(text, /法人向けプランの Enterprise/, `${rel} から法人向けプランの案内が消えた`)
		assert.doesNotMatch(text, /追加でご契約/, `${rel} に追加の契約の案内が残っている`)
	}
})

test('どのプランにも「最も選ばれています」バッジが無い', () => {
	for (const tier of loadTiers()) {
		assert.ok(!tier.badge, `${tier.code} に badge (${tier.badge}) が残っている`)
	}
	assert.doesNotMatch(stripComments(read('_data/plans.yml')), /最も選ばれています/)
})

test('taxIncluded は 10% を 1 円未満切り捨てで足す (境界値)', () => {
	assert.equal(taxIncluded(0, 10), 0)
	assert.equal(taxIncluded(1, 10), 1)
	assert.equal(taxIncluded(9, 10), 9)
	assert.equal(taxIncluded(10, 10), 11)
	assert.equal(taxIncluded(2980, 10), 3278)
	assert.equal(taxIncluded(12345, 10), 13579)
})

test('taxIncluded は不正な入力を受け付けない (失敗系)', () => {
	assert.throws(() => taxIncluded(-1, 10), RangeError)
	assert.throws(() => taxIncluded(Number.NaN, 10), RangeError)
	assert.throws(() => taxIncluded(100, -5), RangeError)
	assert.throws(() => taxIncluded(100, Number.NaN), RangeError)
})

test('plans.yml の税込額は規則 (税率 × 切り捨て) と一致する', () => {
	// Arrange
	const rate = taxRatePercentOf(read('_data/plans.yml'))
	assert.equal(rate, 10, 'plans.yml の tax_rate_percent が 10 でない')
	// 税込額の写しを持つのは金額を出す有料プラン (今は Light)。お見積りのプランと public が false のプランは金額の欄を持たない
	const tiers = loadTiers()
	const paid = tiers.filter((t) => t.price > 0)
	assert.ok(paid.some((t) => t.code === 'light'), '有料プランが読めていない')
	for (const t of tiers) {
		if ('price_incl_display' in t) assert.equal(typeof t.price, 'number', `${t.code}: 税込額だけがある`)
	}

	// Assert
	for (const tier of paid) {
		const expected = formatYen(taxIncluded(tier.price, rate)).slice(1)
		assert.equal(tier.price_incl_display, expected, `${tier.code} の price_incl_display が規則と食い違う`)
	}
})

test('料金カードは税別の後ろに税込を併記する', () => {
	const cards = stripComments(read('_includes/pricing-cards.html'))
	assert.match(cards, /plan\.price_incl_display/, 'pricing-cards.html が税込額を出していない')
	assert.match(cards, /税込/, 'pricing-cards.html に「税込」の表記が無い')
})
