// docs「組織（Enterprise）」の**導入の流れ**の仕様テスト。
//
//   node --test src/lib/docs-team-quote.test.js
//
// 組織は**見積を出した時点**で作られ、組織コードもそのときに決まる。ご入金で同じ組織が有効になり、
// 組織コードは変わらない。組織コードがお客様に渡るのは、ご契約が有効になったときの
// 「組織のご利用を開始できます」の案内メールだけ:
//
//   - 案内メールが届いたアドレス (= 見積の宛先) でサインインすると、**自動で管理者として参加**する
//   - 他のメンバーはサインイン画面の「組織コード」欄から参加する
//
// 「お見積書のコードを配れば、ご契約の前でも参加できる」「(組織コードは) お見積書に記載したものから
// 変わりません」は書かない (見積書に組織コードは載らない)。
//
// 読み取りはこのファイル内で完結させる (他に読み手がいないため lib 化しない。
// `docs-team-seats.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEAM_DOC = join(HERE, '..', '..', '_includes', 'docs', '07-team.html')

/** 導入の流れを説明している `<h3>` の見出し。節ごと動かすならこの文字列も動かすこと。 */
const FLOW_HEADING = '導入の流れ'

/** `<h3>` 見出しが `heading` で始まる節の HTML。見つからなければ null。 */
function sectionOf(html, heading) {
	const start = html.search(new RegExp(`<h3[^>]*>${heading}`))
	if (start < 0) return null
	const rest = html.slice(start)
	const next = rest.slice(1).search(/<h3[^>]*>/)
	return next < 0 ? rest : rest.slice(0, next + 1)
}

/** 節の中の `<li>` の中身。 */
const listItems = (section) => [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1])

/** タグを落とした素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '')

/** Liquid の `{% comment %}` を落とす (表示される本文だけを検査する)。 */
const stripComments = (source) => source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')

const html = stripComments(readFileSync(TEAM_DOC, 'utf8'))
const section = sectionOf(html, FLOW_HEADING)
const sectionText = textOf(section ?? '')
const steps = listItems(section ?? '').map(textOf)

test('sectionOf は無い見出しなら null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange / Act
	const found = sectionOf(html, '存在しない見出し')

	// Assert
	assert.equal(found, null)
})

test('stripComments は Liquid のコメントだけを落とす (本文を消して緑にならない)', () => {
	// Arrange
	const source = '<p>A</p>{%- comment -%}お見積書にも記載{%- endcomment -%}<p>B</p>{% comment %}x{% endcomment %}'

	// Act / Assert
	assert.equal(stripComments(source), '<p>A</p><p>B</p>')
})

test(`「${FLOW_HEADING}」の節がある`, () => {
	// Arrange / Act / Assert
	assert.ok(section, `${FLOW_HEADING} の節が見つからない`)
	assert.ok(steps.length >= 4, '手順が 4 つ未満になっている')
})

test('お見積書の手順に組織コードを書いていない (見積書に載らない)', () => {
	// Arrange
	const quoteStep = steps.find((li) => li.includes('お見積書'))
	assert.ok(quoteStep, 'お見積書を説明する手順が無い')

	// Act / Assert
	assert.doesNotMatch(quoteStep, /組織コード/, `見積書に組織コードがあるように読める: ${quoteStep}`)
})

test('組織コードはご契約が有効になったときの案内メールで届く', () => {
	// Arrange
	const activation = steps.find((li) => li.includes('ご契約が有効'))
	assert.ok(activation, '契約が有効になる手順が無い')

	// Act / Assert
	assert.match(activation, /組織コード/, `有効化の手順で組織コードに触れていない: ${activation}`)
	assert.match(activation, /案内メール/, `組織コードの届け方 (案内メール) が無い: ${activation}`)
})

// 法人の流れは 注文書 → 注文請書 → 月次請求書 (銀行振込) → 最初の入金で有効化。組織コードは入金より後にだけ出てくる。
test('組織コードはご注文とご入金より後に出てくる (契約前には渡らない)', () => {
	// Arrange / Act
	const order = sectionText.indexOf('注文書でご注文')
	const payment = sectionText.indexOf('銀行振込')
	const code = sectionText.indexOf('組織コード')

	// Assert
	assert.ok(order >= 0, '注文書でのご注文の説明が無い')
	assert.ok(payment >= 0, '銀行振込の説明が無い')
	assert.ok(code >= 0, '組織コードの説明が無い')
	assert.ok(order < code && payment < code, '組織コードがご注文・ご入金より前に出てくる (見積時に渡るように読める)')
})

test('契約が有効になる条件は「ご入金の確認」(請求書の発行やカードのお支払いではない)', () => {
	// Arrange
	const activation = steps.find((li) => li.includes('ご契約が有効'))
	assert.ok(activation, '契約が有効になる手順が無い')

	// Act / Assert
	assert.match(activation, /ご入金を確認/, `ご入金の確認に触れていない: ${activation}`)
	assert.doesNotMatch(activation, /請求書の発行|カードでのお支払い/, `カード払いの有効化条件が残っている: ${activation}`)
})

test('お見積書の手順に 1 アカウントあたりの検出時間と取引条件書・注文書がある', () => {
	// Arrange
	const quoteStep = steps.find((li) => li.includes('お見積書'))
	assert.ok(quoteStep, 'お見積書を説明する手順が無い')

	// Act / Assert
	assert.match(quoteStep, /1 アカウントあたりの検出時間/, `検出時間の記載に触れていない: ${quoteStep}`)
	assert.match(quoteStep, /取引条件書と注文書/, `同送する帳票に触れていない: ${quoteStep}`)
})

test('案内メールのアドレスでサインインすると管理者になり、他のメンバーは組織コード欄から参加する', () => {
	// Arrange
	const login = steps.find((li) => li.includes('案内メール') && li.includes('サインイン') && li.includes('管理者'))
	assert.ok(login, '案内メールのアドレスでサインインして管理者になる手順が無い')

	// Act / Assert
	assert.match(login, /サインイン画面/, `他のメンバーの参加経路が書かれていない: ${login}`)
	assert.match(login, /「組織コード」欄/, `参加の入口 (組織コード欄) が書かれていない: ${login}`)
})

test('見積書に組織コードがある / 契約前から配れる、という旧説明が章のどこにも残っていない', () => {
	// Arrange
	const text = textOf(html)
	const stale = [
		'お見積書にも記載',
		'お見積書に記載したもの',
		'お見積書のコード',
		'お見積りの段階から',
		'お見積書にも同じご案内',
	]

	// Act
	const found = stale.filter((phrase) => text.includes(phrase))

	// Assert
	assert.deepEqual(found, [], `見積書に組織コードがある前提の文言が残っている: ${found.join(' / ')}`)
})
