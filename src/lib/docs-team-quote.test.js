// docs「チーム（Enterprise）」の**導入の流れ**を実装 (アプリ / Worker / DB) に固定する回帰テスト (T-338)。
//
//   node --test src/lib/docs-team-quote.test.js
//
// T-334〜T-337 で「組織がいつできるか」が変わった:
//
//   旧: 支払リンクの発行・入金で初めて組織ができ、そのあと組織コードをメールで配る
//   新: **見積を出した時点で `status='quoted'` の組織と組織コードができる** (組織コードは見積書に印字)。
//       入金・請求書の発行で**同じ組織が `active` になる** (attach。組織コードは変わらない)
//
// 契約前にできることは**ログインと参加だけ**。これは新しい分岐ではなく既存の判定の帰結:
//
//   - `org_join_by_code` … `canceled` 以外は参加できる          → 組織コードでの参加は通る
//   - `get_license_v2`  … プランの合成は `active|past_due` だけ → 共有枠 (込み時間) は使えない
//   - `org_update_subscription` … `quoted` は 409 `org_not_activated` → アカウント数は変更できない
//
// サイトは公開文書なので、**実装より広い約束を書くと問い合わせになる**。
// 「見積書にコードがある」「契約が有効になるまで共有枠とアカウント数の変更は使えない」の
// 2 点を、節 (導入の流れ) の構造ごと固定する。
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

/** 節の中の `<p>` の中身。 */
const paragraphs = (section) => [...section.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1])

/** タグを落とした素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '')

const html = readFileSync(TEAM_DOC, 'utf8')
const section = sectionOf(html, FLOW_HEADING)
const sectionText = textOf(section ?? '')

test('sectionOf は無い見出しなら null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange / Act
	const found = sectionOf(html, '存在しない見出し')

	// Assert
	assert.equal(found, null)
})

test(`「${FLOW_HEADING}」の節がある`, () => {
	// Arrange / Act / Assert
	assert.ok(section, `${FLOW_HEADING} の節が見つからない`)
	assert.ok(listItems(section).length >= 4, '手順が 4 つ未満になっている')
})

test('組織コードはお見積書で渡す (見積書を説明する手順に書いてある)', () => {
	// Arrange
	const quoteStep = listItems(section).find((li) => textOf(li).includes('お見積書'))
	assert.ok(quoteStep, 'お見積書を説明する手順が無い')

	// Act
	const text = textOf(quoteStep)

	// Assert
	assert.match(text, /組織コード/, `お見積書の手順に組織コードが無い: ${text}`)
})

test('組織コードはお支払いより前に渡る (手順の順序)', () => {
	// Arrange / Act
	const code = sectionText.indexOf('組織コード')
	const payment = sectionText.indexOf('お支払いのリンク')

	// Assert
	assert.ok(code >= 0, '組織コードの説明が無い')
	assert.ok(payment >= 0, 'お支払いのリンクの説明が無い')
	assert.ok(code < payment, '組織コードがお支払いのリンクより後に出てくる')
})

test('契約が有効になる条件は「カードのお支払い」または「請求書の発行」', () => {
	// Arrange
	const activation = listItems(section).find((li) => textOf(li).includes('ご契約が有効'))
	assert.ok(activation, '契約が有効になる手順が無い')

	// Act
	const text = textOf(activation)

	// Assert
	assert.match(text, /お支払い/, `カードのお支払いに触れていない: ${text}`)
	assert.match(text, /請求書の発行/, `請求書の発行に触れていない: ${text}`)
})

test('契約が有効になるまで共有枠 (込み時間) とアカウント数の変更は使えないと書いてある', () => {
	// Arrange
	const limit = paragraphs(section).find((p) => textOf(p).includes('ご契約が有効になるまで'))
	assert.ok(limit, '「ご契約が有効になるまで」の説明が無い')

	// Act
	const text = textOf(limit)

	// Assert
	assert.match(text, /共有枠/, `共有枠 (込み時間) に触れていない: ${text}`)
	assert.match(text, /込み時間/, `込み時間の言い換えが無い: ${text}`)
	assert.match(text, /アカウント数の変更/, `アカウント数の変更に触れていない: ${text}`)
})

test('契約前でもログインと参加はできると書いてある (できることを狭めない)', () => {
	// Arrange / Act / Assert
	assert.match(sectionText, /ご契約の前でも/, '契約前にできることの説明が無い')
	assert.match(sectionText, /参加/, '参加できる旨が書かれていない')
})

test('組織コードでの参加は対応版アプリからだと断ってある (見積書と同じ断り書き)', () => {
	// Arrange: 見積書 (dashboard の印刷ページ) に入っているのと同じ一文。
	// 出荷版アプリのログインダイアログには「組織コード」欄がまだ無いため、
	// サイトだけ先に公開すると見積書と説明が食い違う。
	const notice = '組織コードでのご参加は、対応版アプリの公開後にご利用いただけます'

	// Act
	const joinClaim = sectionText.indexOf('チームに参加できます')
	const caveat = sectionText.indexOf(notice)

	// Assert
	assert.ok(joinClaim >= 0, '参加できる旨の説明が無い')
	assert.ok(caveat >= 0, `見積書と同じ断り書きが無い: ${notice}`)
	assert.ok(joinClaim < caveat, '断り書きが参加の説明より前に出てくる')
	assert.match(sectionText, /「組織コード」欄/, '対応版で何が増えるのか (入力欄) が書かれていない')
})

test('「支払い確認後に初めて組織コードが届く」旧説明が残っていない (T-334 で変わった)', () => {
	// Arrange / Act
	const text = textOf(html)

	// Assert
	assert.ok(
		!text.includes('組織コードが記載されたメールをお送りします'),
		'組織コードが支払い後に初めて届く、という旧説明が残っている',
	)
})
