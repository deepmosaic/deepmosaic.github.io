// docs「チーム（Enterprise）」の**お支払い方法**を実装 (Worker の支払リンク発行) に固定する
// 回帰テスト (T-419)。
//
//   node --test src/lib/docs-team-payment.test.js
//
// T-419 で請求書経路の subscription に `payment_settings[payment_method_types]=[customer_balance, card]`
// を入れたので、**Stripe のオンライン請求書ページで銀行振込とクレジットカードのどちらでも払える**。
// 「請求書払い（銀行振込）」とだけ書くと、実際にできることより**狭い**説明になり、
// 「カードで払えないのか」という問い合わせを生む。
//
// 逆に決済ポータル (支払い方法の変更・解約) は請求書経路では開けないままなので、
// ここを「カードなら誰でもポータルが使える」と広げてはいけない (`collection_method=send_invoice`
// の subscription は Stripe Billing Portal の対象外)。**広げすぎ / 狭めすぎの両方**を固定する。
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

/** `<div class="kv-key">ラベル</div>` に続く `kv-val` の中身。見つからなければ null。 */
function kvValue(html, label) {
	const re = new RegExp(
		`<div class="kv-key">${label}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`,
	)
	const m = html.match(re)
	return m === null ? null : textOf(m[1])
}

const html = readFileSync(TEAM_DOC, 'utf8')
const docText = textOf(html)

test('kvValue は無いラベルなら null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange / Act
	const found = kvValue(html, '存在しないラベル')

	// Assert
	assert.equal(found, null)
})

test('お支払い方法の行に銀行振込とクレジットカードの両方がある', () => {
	// Arrange
	const value = kvValue(html, 'お支払い方法')
	assert.ok(value, 'お支払い方法の行が無い')

	// Act / Assert
	assert.match(value, /クレジットカード/, `クレジットカードに触れていない: ${value}`)
	assert.match(value, /銀行振込/, `銀行振込に触れていない: ${value}`)
	assert.match(
		value,
		/どちらでも/,
		`請求書ではカード・振込のどちらでも払えることが書かれていない: ${value}`,
	)
})

test('導入の流れの請求書払いに「銀行振込またはクレジットカード」と書いてある', () => {
	// Arrange: 手順 3 (お支払いのリンク) の一文。
	const step = docText
		.split('\n')
		.find((line) => line.includes('お支払いのリンクをメールでお送りします'))
	assert.ok(step, 'お支払いのリンクを説明する手順が無い')

	// Act / Assert
	assert.match(
		step,
		/請求書払い（銀行振込またはクレジットカード。/,
		`請求書払いの括弧書きが T-419 の表記になっていない: ${step}`,
	)
	assert.match(step, /請求書の発行から 30 日以内/, `支払期日が書かれていない: ${step}`)
})

test('ご請求のサイクルの行でも請求書はカード・振込のどちらでも払えると書いてある', () => {
	// Arrange
	const value = kvValue(html, 'ご請求のサイクル')
	assert.ok(value, 'ご請求のサイクルの行が無い')

	// Act / Assert
	assert.match(
		value,
		/請求書は銀行振込またはクレジットカード/,
		`請求書の支払手段に触れていない: ${value}`,
	)
})

test('「請求書払い（銀行振込。」の旧表記が残っていない (T-419 で広がった)', () => {
	// Arrange / Act / Assert — 「銀行振込しかできない」と読める括弧書き。
	assert.ok(
		!docText.includes('請求書払い（銀行振込。'),
		'請求書払いが銀行振込だけに見える旧表記が残っている',
	)
})

test('決済ポータルはカード契約だけという説明を広げていない (send_invoice は Portal 不可)', () => {
	// Arrange
	const value = kvValue(html, '決済ポータル')
	assert.ok(value, '決済ポータルの行が無い')

	// Act / Assert — 請求書ページでカードを使えても、Portal が開くわけではない。
	assert.match(
		value,
		/クレジットカードでお支払いの場合のみ/,
		`ポータルの条件が緩められている: ${value}`,
	)
	assert.match(value, /請求書払いの場合は/, `請求書払いの案内先が消えている: ${value}`)
})
