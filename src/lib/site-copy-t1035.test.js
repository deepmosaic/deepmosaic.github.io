// T-1035 (2026-10-12) クッキーポリシー (`company/cookie.html`) を実態にそろえる回帰テスト。
//
//   node --test src/lib/site-copy-t1035.test.js
//
//   - 分析 = Google Analytics 4 (測定 ID は `_layouts/default.html` の gtag と一致させる)。
//   - 公式サイトの localStorage は流入元の記録 2 件 (直近 = 30 日 / 最初 = 180 日、`src/lib/attribution.js` が正)。
//   - Web 版はログインの状態を維持する Cookie (BFF) と、ブラウザ内の保存領域だけを使う。
//   - 実装の無い広告クッキー・ソーシャルクッキー・Appchoices・Google の広告設定の記述は載せない。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` / `site-copy-t964.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ATTR_TTL_MS, FIRST_TTL_MS } from './attribution.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const COOKIE_PAGE = 'company/cookie.html'
const GA4_ID = 'G-6EKGBQ8QWS'
const DAY_MS = 86_400_000

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

/** tbody の各 `<tr>` を `[1 列目, 2 列目]` の素の文字列の組に。tbody が無ければ null。 */
function tableRows(html) {
	const body = stripComments(html).match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
	if (!body) return null
	const rows = body[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []
	return rows.map((row) => {
		const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []
		return cells.map((cell) => textOf(cell).trim())
	})
}

/** 表の 1 列目が `kind` の行の説明 (2 列目)。無ければ null。 */
function descriptionOf(rows, kind) {
	const row = rows.find(([name]) => name === kind)
	return row ? row[1] : null
}

test('tableRows は tbody が無ければ null を返し、あれば 2 列の組を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange
	const sample = '<table><tbody><tr><td>種類A</td><td><code>説明</code> A</td></tr></tbody></table>'

	// Act / Assert
	assert.equal(tableRows('<p>x</p>'), null)
	assert.deepEqual(tableRows(sample), [['種類A', '説明 A']])
})

test('lastUpdated は日付が無ければ null を返す (検査のすり抜けを防ぐ)', () => {
	assert.equal(lastUpdated('<p>本文</p>'), null)
	assert.equal(lastUpdated('<p>最終更新日: 2026-10-12</p>'), '2026-10-12')
})

test('表: エッセンシャルと分析の 2 行で、分析の説明はエッセンシャルの複写ではない', () => {
	// Act
	const rows = tableRows(read(COOKIE_PAGE))

	// Assert
	assert.ok(rows, 'クッキーの種類の表 (tbody) があること')
	assert.equal(rows.length, 2)
	const essential = descriptionOf(rows, 'エッセンシャル・ウェブサイトクッキー')
	const analytics = descriptionOf(rows, '分析クッキー')
	assert.ok(essential, 'エッセンシャルの行があること')
	assert.ok(analytics, '分析の行があること')
	assert.notEqual(analytics, essential)
	assert.match(analytics, /Google Analytics/)
	assert.match(essential, /__Host-dm_sess/)
})

test('不在: 実装の無い広告・ソーシャルの記述と Google の広告設定へのリンクを載せない', () => {
	// Arrange
	const html = stripComments(read(COOKIE_PAGE))
	const text = textOf(html)
	const banned = ['広告クッキー', 'ソーシャル', 'Twitter', 'LinkedIn', 'Appchoices', '広告の個人化', 'settings/ads']

	// Assert
	for (const word of banned) {
		assert.ok(!text.includes(word), `本文に「${word}」が無いこと`)
		assert.ok(!html.includes(word), `HTML に「${word}」が無いこと`)
	}
})

test('存在: GA4 の測定 ID、流入元の保存期間 180 日 / 30 日、ブラウザ内の保存領域、同意の記録を書く', () => {
	// Act
	const text = textOf(read(COOKIE_PAGE))

	// Assert
	assert.ok(text.includes(GA4_ID))
	assert.match(text, /180 日/)
	assert.match(text, /30 日/)
	assert.match(text, /OPFS|ブラウザ内の保存領域/)
	assert.match(text, /同意の記録/)
})

test('リンク: プライバシーポリシーへは拡張子なしの permalink で張る', () => {
	// Act
	const html = stripComments(read(COOKIE_PAGE))

	// Assert
	assert.ok(html.includes('href="/company/privacy"'))
	assert.ok(!html.includes('/company/privacy.html'))
})

test('日付: 最終更新日は ISO 形式の 2026-10-12', () => {
	assert.equal(lastUpdated(read(COOKIE_PAGE)), '2026-10-12')
})

test('事実の一致: 保存期間は attribution.js、測定 ID は _layouts/default.html の gtag と一致する', () => {
	// Arrange
	const layout = read('_layouts/default.html')

	// Assert: 実装側 (SSOT)
	assert.equal(ATTR_TTL_MS / DAY_MS, 30)
	assert.equal(FIRST_TTL_MS / DAY_MS, 180)
	assert.ok(layout.includes(`gtag('config', '${GA4_ID}')`))
})
