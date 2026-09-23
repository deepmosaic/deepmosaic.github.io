// docs「組織（Enterprise）」の**導入の流れ**を実装 (アプリ / Worker / DB / 見積書) に固定する回帰テスト
// (T-338 → T-510)。
//
//   node --test src/lib/docs-team-quote.test.js
//
// 組織は**見積を出した時点**で `status='quoted'` として作られ、組織コードもそのときに決まる
// (T-334〜T-337)。入金・請求書の発行で**同じ組織が `active` になり**、組織コードは変わらない。
//
// T-398 (2026-09-21) で**見積書から組織コードの欄を外した** (コードの配布は案内メール側)。
// 組織コードがお客様に渡るのは、ご契約が有効になったときの「組織のご利用を開始できます」の
// 案内メール (Worker `email-copy.ts` の `org-activated`) だけになった:
//
//   - 案内メールが届いたアドレス (= 見積の宛先 `quote.email`) でログインすると、owner 招待が
//     消化されて**自動で管理者として参加**する (`enterprise-provision.ts` の `ownerEmail`)
//   - 他のメンバーはログインダイアログの「組織コード」欄から参加する
//
// そのため T-338 で書いた「お見積書のコードを配れば、ご契約の前でも参加できる」
// 「(組織コードは) お見積書に記載したものから変わりません」は**事実と食い違う**ようになった
// (T-510 で削除)。サイトは公開文書なので、実装より広い約束も、無くなった紙面への言及も残さない。
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

/**
 * Liquid の `{% comment %}` を落とす。章冒頭のコメントは消した文言の経緯を引用するので、
 * 表示される本文だけを検査する。
 */
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

test('お見積書の手順に組織コードを書いていない (T-398 で見積書から外した)', () => {
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

test('組織コードはお支払いのリンクより後に出てくる (契約前には渡らない)', () => {
	// Arrange / Act
	const payment = sectionText.indexOf('お支払いのリンク')
	const code = sectionText.indexOf('組織コード')

	// Assert
	assert.ok(payment >= 0, 'お支払いのリンクの説明が無い')
	assert.ok(code >= 0, '組織コードの説明が無い')
	assert.ok(payment < code, '組織コードがお支払いのリンクより前に出てくる (見積時に渡るように読める)')
})

test('契約が有効になる条件は「カードのお支払い」または「請求書の発行」', () => {
	// Arrange
	const activation = steps.find((li) => li.includes('ご契約が有効'))
	assert.ok(activation, '契約が有効になる手順が無い')

	// Act / Assert
	assert.match(activation, /お支払い/, `カードのお支払いに触れていない: ${activation}`)
	assert.match(activation, /請求書の発行/, `請求書の発行に触れていない: ${activation}`)
})

test('案内メールのアドレスでログインすると管理者になり、他のメンバーは組織コード欄から参加する', () => {
	// Arrange
	const login = steps.find((li) => li.includes('案内メール') && li.includes('ログイン') && li.includes('管理者'))
	assert.ok(login, '案内メールのアドレスでログインして管理者になる手順が無い')

	// Act / Assert
	assert.match(login, /ログインダイアログ/, `他のメンバーの参加経路が書かれていない: ${login}`)
	assert.match(login, /「組織コード」欄/, `参加の入口 (組織コード欄) が書かれていない: ${login}`)
})

test('見積書に組織コードがある / 契約前から配れる、という旧説明が章のどこにも残っていない (T-398)', () => {
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
