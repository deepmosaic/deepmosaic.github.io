// T-1034 (2026-10-12) 利用規約 (`company/terms.html`) の改定を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1034.test.js
//
//   - 第3条: 登録の有無にかかわらず、利用した時点から規約が適用される (新 1 項)。旧 1〜4 項は 2〜5 項に繰り下げ、
//     第10条の「第3条第4項各号」を「第3条第5項各号」に付け替える。
//   - 第7条: リバースエンジニアリング・アセットの抽出・制限の回避・公序良俗に反する映像の制作を禁止する。
//   - 第9条の2: ソフトウェアの使用許諾と、デスクトップ版は同一アカウントで同時に 1 台 (使用許諾契約書へ相互参照)。
//   - 第13条: 軽過失の全部免除にならない形 (上限は過去 12 か月の対価、下限 1 万円)。検出の精度は保証しない。
//   - 第16条: 定型約款の変更手続 (一般の利益 / 合理性、効力発生日の周知) に差し替える。
//   - 第8条 2 項・第10条 3 項・第12条 2 項: 「当社の故意又は重過失による場合を除き」を足す。
//   - 第6条 3・4 項 (T-964) の文言は `site-copy-t964.test.js` が固定する (ここでは再掲しない)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` / `site-copy-t964.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const TERMS = 'company/terms.html'

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** 本文の「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?([^\s（(]+)/)
	return m ? m[1] : null
}

/**
 * 見出し `label` (例 `第3条（` / `第9条の2（`) の h2 から次の h2 までの生 HTML (コメントは除く)。無ければ null。
 * label は「（」まで含めて渡す (`第1条（` が `第10条（` に一致しないように)。
 */
function articleHtml(html, label) {
	const body = stripComments(html)
	const h2s = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
	const i = h2s.findIndex((m) => m[1].startsWith(label))
	if (i < 0) return null
	const end = i + 1 < h2s.length ? h2s[i + 1].index : body.length
	return body.slice(h2s[i].index, end)
}

/** `articleHtml` の素の文字列。無ければ null。 */
function articleBlock(html, label) {
	const block = articleHtml(html, label)
	return block === null ? null : textOf(block)
}

const count = (text, re) => (text.match(new RegExp(re.source, 'g')) ?? []).length

test('articleBlock は無い見出しで null、ある見出しで非 null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange
	const html = read(TERMS)

	// Act / Assert
	assert.equal(articleBlock(html, '第99条（'), null)
	assert.equal(articleBlock('<p>本文</p>', '第1条（'), null)
	assert.ok(articleBlock(html, '第1条（'))
	assert.ok(articleBlock(html, '第20条（'))
	assert.ok(!articleBlock(html, '第1条（').includes('第10条'), '第1条が第10条に一致した')
})

test('lastUpdated は日付が無ければ null を返す', () => {
	assert.equal(lastUpdated('<p>本文</p>'), null)
	assert.equal(lastUpdated('<p>最終更新日: 2026-10-12</p>'), '2026-10-12')
})

test('ひな形の括弧残り「【】」が無く、期間は「12か月」と書く', () => {
	// Act
	const text = textOf(read(TERMS))

	// Assert
	assert.doesNotMatch(text, /[【】]/)
	assert.match(text, /12か月/)
})

test('第13条: 軽過失の上限 (下限 1 万円) と故意又は重過失の除外、検出漏れの非保証を書き、全部免除の文言を残さない', () => {
	// Act
	const block = articleBlock(read(TERMS), '第13条（')

	// Assert
	assert.ok(block, '第13条が無い')
	assert.match(block, /軽過失/)
	assert.match(block, /故意又は重過失/)
	assert.match(block, /1万円/)
	assert.match(block, /検出漏れ/)
	assert.doesNotMatch(block, /一切負わない/)
})

test('第8条 2 項・第10条 3 項・第12条 2 項: 「一切の責任を負いません」に故意又は重過失の除外を付ける', () => {
	const html = read(TERMS)
	for (const label of ['第8条（', '第10条（', '第12条（']) {
		// Act
		const block = articleBlock(html, label)

		// Assert
		assert.ok(block, `${label} が無い`)
		assert.match(block, /当社の故意又は重過失による場合を除き、[^。]*一切の責任を負いません/, label)
	}
})

test('T-1038: 第5条 2 項・第13条 4 項の「一切…責任を負いません」にも故意又は重過失の除外を付け、除外の無い全部免除を残さない', () => {
	const html = read(TERMS)
	for (const label of ['第5条（', '第13条（']) {
		// Act
		const block = articleBlock(html, label)

		// Assert
		assert.ok(block, `${label} が無い`)
		assert.match(block, /当社の故意又は重過失による場合を除き、一切の?責任を負いません/, label)
	}
	// 規約全体で「一切…責任を負いません」の直前には必ず除外が付く
	const text = textOf(html)
	const all = count(text, /一切の?責任を負いません/)
	const excluded = count(text, /当社の故意又は重過失による場合を除き、[^。]*一切の?責任を負いません/)
	assert.equal(excluded, all, '除外の無い全部免除が残っている')
	assert.equal(all, 5)
})

test('第16条: 定型約款の変更要件と効力発生日の周知を書き、みなし同意を残さない', () => {
	// Arrange
	const raw = read(TERMS)

	// Act
	const block = articleBlock(raw, '第16条（')

	// Assert
	assert.ok(block, '第16条が無い')
	assert.match(block, /一般の利益/)
	assert.match(block, /効力発生日/)
	assert.match(block, /ウェブサイト/)
	assert.match(block, /定型約款/)
	assert.doesNotMatch(block, /みなします/)
	const comments = (raw.match(/<!--[\s\S]*?-->/g) ?? []).join('\n')
	assert.match(comments, /548/, '根拠法令のコメントが無い')
})

test('第3条: 見出しは「適用の開始及び登録」で、登録の有無にかかわらず適用し、旧 1〜4 項を繰り下げる', () => {
	// Arrange
	const html = read(TERMS)

	// Act
	const block = articleBlock(html, '第3条（')
	const liCount = count(articleHtml(html, '第3条（'), /<li>/)

	// Assert
	assert.ok(block, '第3条が無い')
	assert.match(block, /^\s*第3条（適用の開始及び登録）/)
	assert.match(block, /登録の有無にかかわらず/)
	assert.ok(liCount >= 11, `第3条の li が 5 項 + 各号 6 に満たない: ${liCount}`)
})

test('参照: 第10条は「第3条第5項各号」を 1 回参照し、旧「第3条第4項各号」を残さない', () => {
	// Act
	const text = textOf(read(TERMS))

	// Assert
	assert.equal(count(text, /第3条第5項各号/), 1)
	assert.equal(count(text, /第3条第4項各号/), 0)
})

test('第7条: 解析・アセットの抽出・制限の回避・公序良俗に反する映像の制作を禁止する', () => {
	// Act
	const block = articleBlock(read(TERMS), '第7条（')

	// Assert
	assert.ok(block, '第7条が無い')
	for (const re of [/リバースエンジニアリング/, /逆コンパイル/, /学習済みモデル/, /無料枠/, /公序良俗に反する映像/]) {
		assert.match(block, re)
	}
})

test('第9条の2: 使用許諾契約書を参照し、デスクトップ版は同時に 1 台と書き、第9条と第10条の間に置く', () => {
	// Arrange
	const html = stripComments(read(TERMS))

	// Act
	const raw = articleHtml(html, '第9条の2（')
	const pos = (label) => html.search(new RegExp(`<h2[^>]*>${label}`))

	// Assert
	assert.ok(raw, '第9条の2が無い')
	assert.match(textOf(raw), /デスクトップ版[^。]*同時に\s?1\s?台/)
	assert.match(raw, /href="\/company\/eula"/)
	assert.ok(pos('第9条（') < pos('第9条の2（'), '第9条の2が第9条より前にある')
	assert.ok(pos('第9条の2（') < pos('第10条（'), '第9条の2が第10条より後にある')
})

test('前文と第1条は使用許諾契約書へリンクし、第2条は利用者データを定義する', () => {
	// Arrange
	const html = stripComments(read(TERMS))

	// Act
	const preamble = html.slice(html.indexOf('最終更新日'), html.search(/<h2[^>]*>第1条（/))
	const art1 = articleHtml(html, '第1条（')
	const art2 = articleBlock(html, '第2条（')

	// Assert
	assert.match(preamble, /href="\/company\/eula"/)
	assert.match(art1, /href="\/company\/eula"/)
	assert.match(art2, /「利用者データ」とは/)
})

test('旧ひな形の語 (廃止ドメイン / 提供元事業者 / 投稿データ / 30 日未利用の抹消 / 登録ユーザー) を残さない', () => {
	// Act
	const text = textOf(read(TERMS))

	// Assert
	for (const re of [/deepmosaic\.jp(?!\.auth0)/, /提供元事業者/, /投稿データ/, /30日以上本サービスの利用がない/, /登録ユーザー/]) {
		assert.doesNotMatch(text, re)
	}
})

test('最終更新日は 2026-10-12', () => {
	assert.equal(lastUpdated(read(TERMS)), '2026-10-12')
})
