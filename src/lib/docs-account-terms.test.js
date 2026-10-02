// docs の「契約の数」の呼び方を「契約アカウント数」に固定する回帰テスト (T-881)。
//
//   node --test src/lib/docs-account-terms.test.js
//
// アプリ (desktop / web) のプラン選択は「契約本数」「N 本」を「契約アカウント数」
// 「N アカウント」に改めた (T-878 / T-879)。サイトの説明が古い呼び方のままだと、
// 画面と docs で同じ欄の名前が食い違う。
//
// 検査するのは**利用者に見える部分**だけ。Liquid の `{% comment %}` と HTML コメントの
// 中は内部メモなので除く (TICKET-SITE-CONTRACT-SSOT の注記は内部語のまま残す)。
// 動画の本数 (「動画を 1 本選んで」など) は意味が違うので対象外。
//
// 読み取りはこのファイル内で完結させる (他に読み手がいないため lib 化しない)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = join(HERE, '..', '..', '_includes', 'docs')
const ACCOUNT_DOC = join(DOCS_DIR, '02-account.html')

/** 利用者に見えない部分 (Liquid / HTML のコメント) を取り除く。 */
function visibleSource(html) {
	return html
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** プラン選択のスクリーンショット (`plan-select.webp`) の alt を返す (無ければ null)。 */
function planSelectAlt(html) {
	const m = html.match(/<img[^>]*src="\/assets\/img\/screenshots\/plan-select\.webp"[^>]*>/)
	if (!m) return null
	const alt = m[0].match(/\balt="([^"]*)"/)
	return alt ? alt[1] : null
}

test('docs の見える部分に「契約本数」が残っていない', () => {
	const offenders = readdirSync(DOCS_DIR)
		.filter((name) => name.endsWith('.html'))
		.filter((name) => visibleSource(readFileSync(join(DOCS_DIR, name), 'utf8')).includes('契約本数'))
	assert.deepEqual(offenders, [])
})

test('「プランを選ぶ」の説明が「契約アカウント数」を選べると書く', () => {
	const html = visibleSource(readFileSync(ACCOUNT_DOC, 'utf8'))
	assert.match(html, /「契約アカウント数」を選べます/)
})

test('プラン選択のスクリーンショットの alt が「契約アカウント数」を表示すると書く', () => {
	const alt = planSelectAlt(readFileSync(ACCOUNT_DOC, 'utf8'))
	assert.ok(alt, 'plan-select.webp の img と alt がある')
	assert.match(alt, /契約アカウント数/)
	assert.doesNotMatch(alt, /契約本数/)
})

test('コメントの中の内部メモは検査の対象外 (除去の陽性対照)', () => {
	const src = '{%- comment -%}契約本数{%- endcomment -%}<!-- 契約本数 --><p>見える</p>'
	assert.equal(visibleSource(src), '<p>見える</p>')
})
