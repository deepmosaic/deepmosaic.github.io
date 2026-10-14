// docs「組織（Enterprise）」の**お支払い方法**を実装に固定する回帰テスト (T-419 → T-1252)。
// 章の表記は T-510 で「チーム」から「組織」に変えた。
//
//   node --test src/lib/docs-team-payment.test.js
//
// T-1215 (2026-10-14) で法人の見積はすべて Stripe を使わなくなった (dashboard の定数
// `CORPORATE_STRIPE_BILLING_ENABLED`、支払リンク / provision は 409 stripe_billing_disabled)。
// 月額はご利用月ごとの月次請求書 (`invoice_monthly`、T-1209 / T-1220) による**銀行振込**で、
// 日割り・カードの自動更新は無い (Worker `email-copy.ts` の `billing_note_transfer`)。
// T-419 の「請求書ページでカード・振込のどちらでも払える」「お支払いのリンク」は実装より**広い**約束に
// なったので、ここでは**広げすぎ (カード / リンク / 日割りが残る) と狭めすぎ (銀行振込が消える)**の
// 両方を固定する。以前にカードで契約した組織の操作 (決済ポータル) は段落 1 つに限って残す。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEAM_DOC = join(HERE, '..', '..', '_includes', 'docs', '07-team.html')

/** タグを落とした素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '')

/** Liquid の `{% comment %}` を落とす (章冒頭のコメントは消した文言の経緯を引用する)。 */
const stripComments = (source) => source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')

/** `<div class="kv-key">ラベル</div>` に続く `kv-val` の中身。見つからなければ null。 */
function kvValue(html, label) {
	const re = new RegExp(
		`<div class="kv-key">${label}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`,
	)
	const m = html.match(re)
	return m === null ? null : textOf(m[1])
}

const html = stripComments(readFileSync(TEAM_DOC, 'utf8'))
const docText = textOf(html)

test('kvValue は無いラベルなら null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange / Act
	const found = kvValue(html, '存在しないラベル')

	// Assert
	assert.equal(found, null)
})

test('お支払い方法の行は請求書による銀行振込だけを案内する (T-1215)', () => {
	// Arrange
	const value = kvValue(html, 'お支払い方法')
	assert.ok(value, 'お支払い方法の行が無い')

	// Act / Assert
	assert.match(value, /請求書/, `請求書に触れていない: ${value}`)
	assert.match(value, /銀行振込/, `銀行振込に触れていない: ${value}`)
	assert.match(value, /振込手数料はお客様のご負担/, `振込手数料の負担が書かれていない: ${value}`)
	assert.doesNotMatch(value, /クレジットカード/, `法人で使えないカード払いを案内している: ${value}`)
})

test('ご請求のサイクルはご利用月ごとの 1 か月分で、日割りが無いと書いてある', () => {
	// Arrange
	const value = kvValue(html, 'ご請求のサイクル')
	assert.ok(value, 'ご請求のサイクルの行が無い')

	// Act / Assert
	assert.match(value, /ご利用月ごとに 1 か月分/, `月次請求書の説明が無い: ${value}`)
	assert.match(value, /日割りはありません/, `日割りが無いことが書かれていない: ${value}`)
	assert.match(value, /30 日/, `標準の支払期日が書かれていない: ${value}`)
	assert.doesNotMatch(value, /自動決済|自動更新/, `カードの自動更新が残っている: ${value}`)
})

test('導入の流れにお支払いのリンク・日割り・カードの即時決済が残っていない (T-1215 で撤去)', () => {
	// Arrange
	const stale = ['お支払いのリンク', '初月はご利用開始日から月末までの日割り', '即時決済', '請求書払い（銀行振込またはクレジットカード']

	// Act
	const found = stale.filter((phrase) => docText.includes(phrase))

	// Assert
	assert.deepEqual(found, [], `Stripe 経路の旧い説明が残っている: ${found.join(' / ')}`)
})

test('決済ポータルは以前のカード契約の組織に限って案内する (新規の契約に広げない)', () => {
	// Arrange
	const lines = docText.split('\n').filter((line) => line.includes('決済ポータル'))

	// Act / Assert
	assert.equal(kvValue(html, '決済ポータル'), null, '決済ポータルの行が新規の契約向けに残っている')
	assert.ok(lines.length >= 1, 'カード契約の組織向けの案内が消えている')
	for (const line of lines) {
		assert.match(line, /以前にクレジットカードでご契約/, `ポータルの条件が緩められている: ${line}`)
	}
})

test('請求書の節に、銀行振込の請求書はメールで届きアプリには出ないと書いてある', () => {
	// Arrange
	const section = docText.slice(docText.indexOf('請求書（過去のご請求）'))
	assert.ok(section.startsWith('請求書（過去のご請求）'), '請求書の節が無い')

	// Act / Assert
	assert.match(section, /銀行振込でのご契約では、請求書は PDF をメールでお送りします/)
	assert.match(section, /「請求書はまだありません。」/)
})

// T-687: 支払後に「未払い」のまま見えるという問い合わせへの案内 (カード契約の組織の請求書タブ)。
test('請求書の節に、支払済みへの反映の遅れと「更新」の案内がある', () => {
	// Arrange
	const section = docText.slice(docText.indexOf('請求書（過去のご請求）'))

	// Act / Assert
	assert.match(section, /状態が『支払済み』に変わるまで少し時間がかかることがあります/)
	assert.match(section, /『更新』で最新の状態を取り直せます/)
})
