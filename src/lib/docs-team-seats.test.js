// docs「チーム（Enterprise）」の**アカウント数の下限**の文言を実装に固定する回帰テスト (T-330)。
//
//   node --test src/lib/docs-team-seats.test.js
//
// 下限の正は Worker (`org-manage.ts` の `max(ENTERPRISE_MIN_SEATS, min_seats, used)`)。
// T-328 で「お見積り時のアカウント数 (`seats_floor`)」が下限から外れたため、
// サイトの説明も **3 アカウント / 使用中の数** に揃える必要がある。
//
// 数値は手書きせず `_data/plans.yml` の `min_seats` から取る — 手書きすると
// 「plans.yml だけ直して docs が古い」という乖離が起き、実在しない条件を広告することになる
// (`plan-catalog.js` が plans.yml ↔ Supabase で守っている距離の、docs 側の一区間)。
//
// 読み取りはこのファイル内で完結させる (他に読み手がいないため lib 化しない)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadTiers } from './plans-yml.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEAM_DOC = join(HERE, '..', '..', '_includes', 'docs', '07-team.html')

/** 下限を説明している定義表の行のキー。文言を動かすならこのキーごと動かすこと。 */
const SEAT_FLOOR_KEY = '減らせる下限'

/**
 * 変更操作そのものを説明している行のキー。
 * 「下限」を説明する行の 2 行上にあり、ここが「増やせます」に戻ると
 * 同じ表の中で「減らせる下限」と矛盾する (T-330 の実装で揃えた)。
 */
const SEAT_CHANGE_KEY = 'アカウント数の変更'

/** `.kv-key` が `key` の行の `.kv-val` を全部返す (0 件なら空配列)。 */
function kvValues(html, key) {
	const re = new RegExp(`<div class="kv-key">${key}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`, 'g')
	return [...html.matchAll(re)].map((m) => m[1])
}

/** タグを落とした素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '')

const html = readFileSync(TEAM_DOC, 'utf8')

const enterprise = loadTiers().find((t) => t.code === 'enterprise')
assert.ok(enterprise, 'plans.yml に enterprise が無い')
const minSeats = enterprise.min_seats

test('kvValues はキーが無ければ空を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange / Act
	const found = kvValues(html, '存在しないキー')

	// Assert
	assert.deepEqual(found, [])
})

test(`定義表に「${SEAT_FLOOR_KEY}」の行がちょうど 1 つある`, () => {
	// Arrange / Act
	const rows = kvValues(html, SEAT_FLOOR_KEY)

	// Assert
	assert.equal(rows.length, 1, `${SEAT_FLOOR_KEY} の行が ${rows.length} 個ある`)
})

test('下限の説明の数値は plans.yml の min_seats だけ (手書きの数を持たない)', () => {
	// Arrange
	const [row] = kvValues(html, SEAT_FLOOR_KEY)

	// Act
	const numbers = [...new Set(textOf(row).match(/\d+/g) ?? [])]

	// Assert
	assert.deepEqual(numbers, [String(minSeats)])
	assert.ok(
		textOf(row).includes(`${minSeats} アカウント`),
		`下限 (${minSeats} アカウント) が書かれていない: ${textOf(row)}`,
	)
})

test('下限には使用中のアカウント数も併記する', () => {
	// Arrange
	const [row] = kvValues(html, SEAT_FLOOR_KEY)

	// Act / Assert
	assert.match(textOf(row), /使用中/)
})

test(`「${SEAT_CHANGE_KEY}」は増やす側だけを書かない (下限の行と矛盾させない)`, () => {
	// Arrange
	const rows = kvValues(html, SEAT_CHANGE_KEY)
	assert.equal(rows.length, 1, `${SEAT_CHANGE_KEY} の行が ${rows.length} 個ある`)

	// Act
	const text = textOf(rows[0])

	// Assert
	assert.match(text, /増減/, `減らせる旨が書かれていない: ${text}`)
})

test('お見積り時のアカウント数を下限とする旧文言が残っていない (T-328 で撤去)', () => {
	// Arrange / Act
	const text = textOf(html)

	// Assert
	assert.ok(
		!text.includes('お見積り時のアカウント数より減らす'),
		'seats_floor 由来の下限の説明が残っている',
	)
})
