// 料金カードの grid の分岐の回帰テスト。
//
//   node --test src/lib/site-copy-pricing-grid.test.js
//
//   - カードが 2 枚のときは、lg 以上で 3 列のときの 1 列ぶんの幅のトラック 2 本を中央に寄せる
//     (md 〜 lg 未満は 2 列でコンテナいっぱい)。
//   - 3 枚のときは md:grid-cols-3、それ以外は md:grid-cols-2 lg:grid-cols-4 (カードの枚数ごとの列の作り)。
//   - 幅の式 (100% - 2.5rem) / 3 の 2.5rem は gap-5 × 2 なので、grid の div の gap-5 を外さない。
//   - `scripts/i18n/checks/parts.mjs` の regex の前提 (横帯の `card mt-5 flex`、h3 の直後の `flex flex-wrap items-baseline`)。
//
// ビルド出力の幅・中央・はみ出しは `e2e/pricing-cards-width.spec.ts`。ここは include のソースだけを読む。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(ROOT, '_includes', 'pricing-cards.html'), 'utf8')

/** 料金カードの grid の div の開始タグ (Liquid の分岐を含む 1 行)。 */
function gridTag() {
	const m = SRC.match(/<div class="grid items-stretch[^\n]*>/)
	assert.ok(m, 'pricing-cards.html に料金カードの grid の div が無い')
	return m[0]
}

/** grid の div の class から card_count の分岐ごとのクラスを取り出す。 */
function branches() {
	const tag = gridTag()
	const three = tag.match(/{% if card_count == 3 %}([^{]*){%/)
	const two = tag.match(/{% elsif card_count == 2 %}([^{]*){%/)
	const other = tag.match(/{% else %}([^{]*){% endif %}/)
	assert.ok(three && two && other, `grid の div の分岐が読めない: ${tag}`)
	return { three: three[1].trim(), two: two[1].trim(), other: other[1].trim() }
}

test('2 枚のときは lg 以上で 3 列ぶんの幅のトラック 2 本を中央寄せ、md は 2 列', () => {
	const cls = branches().two.split(/\s+/)
	assert.ok(cls.includes('md:grid-cols-2'), `md の 2 列が無い: ${cls.join(' ')}`)
	assert.ok(cls.includes('lg:grid-cols-[repeat(2,calc((100%-2.5rem)/3))]'), `lg の 3 列ぶんの幅のトラックが無い: ${cls.join(' ')}`)
	assert.ok(cls.includes('lg:justify-center'), `lg の中央寄せが無い: ${cls.join(' ')}`)
})

test('3 枚とそれ以外の分岐は変えない', () => {
	const { three, other } = branches()
	assert.equal(three, 'md:grid-cols-3')
	assert.equal(other, 'md:grid-cols-2 lg:grid-cols-4')
})

test('grid の div に items-stretch gap-5 が残る (幅の式の 2.5rem = gap-5 × 2)', () => {
	assert.match(gridTag(), /class="grid items-stretch gap-5 /)
})

test('横帯と価格の行の作り (checks/parts.mjs の前提) が残る', () => {
	assert.match(SRC, /class="card mt-5 flex/)
	// h3 と価格の div の間は Liquid の分岐とコメントだけ (出力では隣り合う)
	assert.match(SRC, /<\/h3>(?:\s|{%[\s\S]*?%})*<div class="flex flex-wrap items-baseline/)
})
