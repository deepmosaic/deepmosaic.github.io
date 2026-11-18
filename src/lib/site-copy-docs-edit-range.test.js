// docs 第 4 章「編集」の追跡とキーの節と、製品版の画面に無い操作の記述の回帰テスト。
//
//   node --test src/lib/site-copy-docs-edit-range.test.js
//
//   - 編集の章と Web 版の章に、製品版の画面に無い「前後に反映」(Shift+F) の記述が無い
//     (本文・ツールバーの表・ショートカットの表・設定の説明)。製品版の画面に無い右クリックの項目の説明 (開発用の設定) も無い。
//   - llms.txt の追跡とキーの行に「前後に反映」が無く、リンクの名前が節の見出しと同じ。
//   - #edit-track に「つなぐ」(Y) の小見出しと、「区間をまとめて直す」の小見出し (id="edit-range") がある。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const LANGS = [
	{ dir: '', words: ['前後に反映', '開発用の設定'], connect: 'つなぐ', range: '区間をまとめて直す', menu: ['ここからつなぐ', 'ここへつなぐ'] },
]

/** 製品版の画面に出ないショートカット (表にも本文にも書かない) */
const HIDDEN_SHORTCUT = 'motion_fusion_toggle'

function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}
const textOf = (src) => stripComments(src).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<section id="…">` の中身 (次の section の手前まで)。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** h3 の見出しの文 (タグを除く) の一覧 */
const h3Titles = (html) => [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => textOf(m[1]).trim())

test('ヘルパーの陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p></p>', 'x'), null)
	assert.deepEqual(h3Titles('<h3 class="a">A</h3><p>b</p><h3 id="c">C <kbd>X</kbd></h3>'), ['A', 'C X'])
	assert.equal(textOf('{% comment %}前後に反映{% endcomment %}<b>x</b>'), 'x')
})

for (const { dir, words } of LANGS) {
	test(`${dir || 'ja/'}: 編集の章と Web 版の章に「前後に反映」(Shift+F) の記述が無い`, () => {
		const edit = read(`_includes/docs/${dir}04-edit.html`)
		const web = read(`_includes/docs/${dir}web.html`)
		assert.ok(sectionOf(edit, 'shortcuts'), '陽性対照: #shortcuts が無い')
		assert.ok(edit.includes('data-shortcut="motion_key_here"'), '陽性対照: F の行が無い')
		for (const [name, src] of [['04-edit', edit], ['web', web]]) {
			const text = textOf(src)
			for (const w of words) assert.ok(!text.includes(w), `${name} に「${w}」が残っている`)
			assert.ok(!text.includes('Shift+F'), `${name} に Shift+F が残っている`)
			assert.ok(!src.includes(`data-shortcut="${HIDDEN_SHORTCUT}"`), `${name} に ${HIDDEN_SHORTCUT} の行が残っている`)
		}
	})
}

for (const { dir, connect, range, menu } of LANGS) {
	test(`${dir || 'ja/'}: 追跡とキーの節に「つなぐ」と「区間をまとめて直す」の小見出しがあり、右クリックメニューの説明につなぐ項目がある`, () => {
		const edit = read(`_includes/docs/${dir}04-edit.html`)
		const track = sectionOf(edit, 'edit-track')
		assert.ok(track, '陽性対照: #edit-track が無い')
		const titles = h3Titles(track)
		assert.ok(titles.includes(connect), `「${connect}」の小見出しが無い: ${titles.join(' / ')}`)
		assert.ok(titles.includes(range), `「${range}」の小見出しが無い: ${titles.join(' / ')}`)
		assert.equal(titles.at(-1), range, '「区間をまとめて直す」が節の最後の小見出しでない')
		assert.match(track, /<h3 id="edit-range"/, '小見出しに id="edit-range" が無い')
		assert.equal((edit.match(/id="edit-range"/g) ?? []).length, 1, 'id="edit-range" が 1 つでない')
		assert.ok(track.includes('<kbd>Y</kbd>'), 'つなぐのキー (Y) が無い')
		const player = textOf(sectionOf(edit, 'edit-player') ?? '')
		for (const m of menu) assert.ok(player.includes(m), `#edit-player の右クリックメニューに「${m}」が無い`)
	})
}

test('llms.txt: 「前後に反映」と Shift+F が無く、#edit-track の行の名前が「追跡とキー」', () => {
	const llms = read('llms.txt')
	const line = llms.split(/\r?\n/).find((l) => l.includes('/docs/#edit-track)'))
	assert.ok(line, '陽性対照: #edit-track の行が無い')
	assert.ok(line.startsWith('- [追跡とキー / Tracking and keyframes]'), `行の名前が違う: ${line.slice(0, 60)}`)
	assert.ok(!llms.includes('前後に反映'), '「前後に反映」が残っている')
	assert.ok(!llms.includes('Shift+F'), 'Shift+F が残っている')
})
