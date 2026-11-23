// docs 第 4 章「編集」の追跡とキーの節と、製品版の画面に無い操作の記述の回帰テスト。
//
//   node --test src/lib/site-copy-docs-edit-range.test.js
//
//   - 3 言語の編集の章と Web 版の章に、製品版の画面に無い「前後に反映」(Shift+F) の記述が無い
//     (本文・ツールバーの表・ショートカットの表・設定の説明)。製品版の画面に無い右クリックの項目の説明 (開発用の設定) も無い。
//   - 画面に無い「区間の大きさ・形を変更」のパネルの記述 (メニューの項目・パネルの語・画像・節の id="edit-range") が、
//     3 言語の docs・Web 版の章・llms.txt のどこにも無い。
//   - #edit-track に「つなぐ」(Y)・「トラッキングキュー」・「区間をまとめて直す」の小見出しがこの順で 3 言語ともにある。
//     区間を一律に変える手段はモザイク設定の「時間別」タブ。
//   - 3 言語の追跡とキーの節に中間地点 (Shift+Y・「中間地点にする」) とトラッキングキューの操作の語、
//     右クリックメニューの説明にアプリの並びどおりの項目 (回避マスクへの変更を含む)、#shortcuts に Shift+Y の行、
//     #edit-mosaic にぼかしの強さと時間別、#premiere にぼかしの強さが渡らないことがある。llms.txt の行にも同じ機能がある。
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
	{
		dir: '',
		words: ['前後に反映', '開発用の設定'],
		connect: 'つなぐ',
		queue: 'トラッキングキュー',
		range: '区間をまとめて直す',
		menu: ['ここからつなぐ', 'ここへつなぐ'],
		mid: '中間地点にする',
		avoid: ['回避マスクにする', 'モザイクに戻す'],
		queueWords: ['一時停止', '再開', '中止', '優先する', 'キューから削除', '確認', '再試行', '完了を消去'],
		removedMenu: '区間の大きさ・形を変更',
		removedPanel: ['範囲内のすべての枠', '縦横比を固定', '位置 横 (%)', '最小モザイクの注記'],
		timeTab: '時間別',
		blur: 'ぼかしの強さ',
	},
	{
		dir: 'en/',
		words: ['Spread to adjacent frames', 'spread to adjacent frames', 'development setting'],
		connect: 'Connecting',
		queue: 'Tracking queue',
		range: 'Fixing a range of frames at once',
		menu: ['Connect from here', 'Connect to here'],
		mid: 'Add as waypoint',
		avoid: ['Make exclusion mask', 'Change back to mosaic'],
		queueWords: ['Pause', 'Resume', 'Cancel', 'Move up', 'Remove from queue', 'Review', 'Retry', 'Clear finished'],
		removedMenu: 'Change size and shape over a range',
		removedPanel: ['All boxes in the range', 'Lock aspect ratio', 'Horizontal shift (%)', 'Minimum mosaic note'],
		timeTab: 'By time',
		blur: 'Blur strength',
	},
	{
		dir: 'zh-tw/',
		words: ['前後套用', '開發用的設定'],
		connect: '連接',
		queue: '追蹤佇列',
		range: '一次修正一段區間',
		menu: ['從這裡連接', '連接到這裡'],
		mid: '設為中間點',
		avoid: ['設為排除遮罩', '改回馬賽克'],
		queueWords: ['暫停', '繼續', '取消', '優先處理', '從佇列移除', '查看', '重試', '清除已完成'],
		removedMenu: '變更區間的大小與形狀',
		removedPanel: ['範圍內的所有框', '鎖定長寬比', '水平位移（%）', '最小馬賽克的註記'],
		timeTab: '依時間',
		blur: '模糊強度',
	},
]

/** 製品版の画面に出ないショートカット (表にも本文にも書かない) */
const HIDDEN_SHORTCUT = 'motion_fusion_toggle'

/** docs の章 (訳の include は言語のフォルダ) */
const DOC_FILES = ['01-intro', '02-account', '03-detect', '04-edit', '05-export', '06-ops', '07-team', 'web']

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

/** 並びがアプリと同じか (どれも見つかり、出てくる位置が昇順) */
function inOrder(text, words) {
	const at = words.map((w) => text.indexOf(w))
	return at.every((i) => i >= 0) && at.every((i, k) => k === 0 || at[k - 1] < i)
}

test('ヘルパーの陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p></p>', 'x'), null)
	assert.deepEqual(h3Titles('<h3 class="a">A</h3><p>b</p><h3 id="c">C <kbd>X</kbd></h3>'), ['A', 'C X'])
	assert.equal(textOf('{% comment %}前後に反映{% endcomment %}<b>x</b>'), 'x')
	assert.equal(inOrder('a b c', ['a', 'c']), true)
	assert.equal(inOrder('a b c', ['c', 'a']), false)
	assert.equal(inOrder('a b c', ['a', 'z']), false)
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

for (const { dir, removedMenu, removedPanel } of LANGS) {
	test(`${dir || 'ja/'}: 画面に無い「区間の大きさ・形を変更」のパネルと最小モザイクの注記の記述・画像・節の id が docs に無い`, () => {
		const edit = read(`_includes/docs/${dir}04-edit.html`)
		assert.ok(textOf(edit).includes('Ctrl+K'), '陽性対照: 編集の章が読めていない')
		for (const name of DOC_FILES) {
			const src = read(`_includes/docs/${dir}${name}.html`)
			const text = textOf(src)
			assert.ok(!text.includes(removedMenu), `${name} に「${removedMenu}」が残っている`)
			for (const w of removedPanel) assert.ok(!text.includes(w), `${name} に「${w}」が残っている`)
			assert.ok(!src.includes('edit-range'), `${name} に edit-range (節の id・リンク・画像) が残っている`)
		}
	})
}

for (const { dir, connect, queue, range, menu, avoid } of LANGS) {
	test(`${dir || 'ja/'}: 追跡とキーの節に「つなぐ」「トラッキングキュー」「区間をまとめて直す」の小見出しがこの順にあり、右クリックメニューの説明につなぐと回避マスクの項目がある`, () => {
		const edit = read(`_includes/docs/${dir}04-edit.html`)
		const track = sectionOf(edit, 'edit-track')
		assert.ok(track, '陽性対照: #edit-track が無い')
		const titles = h3Titles(track)
		const at = [connect, queue, range].map((t) => titles.indexOf(t))
		assert.ok(at.every((i) => i >= 0), `小見出しが欠けている: ${titles.join(' / ')}`)
		assert.deepEqual([...at].sort((a, b) => a - b), at, `小見出しの並びが違う: ${titles.join(' / ')}`)
		assert.equal(titles.at(-1), range, '「区間をまとめて直す」が節の最後の小見出しでない')
		assert.ok(track.includes('<kbd>Y</kbd>'), 'つなぐのキー (Y) が無い')
		const player = textOf(sectionOf(edit, 'edit-player') ?? '')
		for (const m of [...menu, ...avoid]) assert.ok(player.includes(m), `#edit-player の右クリックメニューに「${m}」が無い`)
	})
}

for (const { dir, menu, mid, avoid, queue, queueWords, timeTab, blur } of LANGS) {
	test(`${dir || 'ja/'}: 中間地点 (Shift+Y)・トラッキングキューの操作・時間別・ぼかしの強さが、追跡とキー・右クリック・ショートカット・モザイク設定・Premiere の説明にある`, () => {
		const edit = read(`_includes/docs/${dir}04-edit.html`)
		const track = sectionOf(edit, 'edit-track') ?? ''
		const trackText = textOf(track)
		assert.ok(track, '陽性対照: #edit-track が無い')
		assert.ok(track.includes('<kbd>Shift+Y</kbd>'), '#edit-track に Shift+Y が無い')
		assert.ok(trackText.includes(mid), `#edit-track に「${mid}」が無い`)
		const queueText = trackText.slice(trackText.indexOf(queue))
		for (const w of queueWords) assert.ok(queueText.includes(w), `トラッキングキューの説明に「${w}」が無い`)
		const player = textOf(sectionOf(edit, 'edit-player') ?? '')
		assert.ok(inOrder(player, [avoid[0], menu[0], mid, menu[1]]), '#edit-player の右クリックメニューの並びがアプリと違う')
		assert.ok(sectionOf(edit, 'shortcuts')?.includes('<tr data-shortcut="bbox_bridge_mid">'), '#shortcuts に Shift+Y の行が無い')
		const mosaic = textOf(sectionOf(edit, 'edit-mosaic') ?? '')
		assert.ok(mosaic.includes(blur), `#edit-mosaic に「${blur}」が無い`)
		assert.ok(h3Titles(sectionOf(edit, 'edit-mosaic') ?? '').includes(timeTab), `#edit-mosaic に「${timeTab}」の小見出しが無い`)
		const premiere = textOf(sectionOf(read(`_includes/docs/${dir}05-export.html`), 'premiere') ?? '')
		assert.ok(premiere.length > 0, '陽性対照: #premiere が無い')
		assert.ok(premiere.toLowerCase().includes(blur.toLowerCase()), `#premiere に「${blur}」(渡らないこと) が無い`)
		assert.ok(premiere.includes(timeTab), `#premiere に「${timeTab}」(渡らないこと) が無い`)
	})
}

for (const { dir, menu, mid, avoid } of LANGS) {
	test(`${dir || 'ja/'}: ショートカットの表の右クリックの行に、回避マスクとつなぐの 3 項目 (中間地点を含む) がアプリの並びである`, () => {
		const shortcuts = sectionOf(read(`_includes/docs/${dir}04-edit.html`), 'shortcuts') ?? ''
		const at = shortcuts.indexOf('<tr data-shortcut="mouse_context_menu">')
		assert.ok(at >= 0, '陽性対照: #shortcuts に右クリックの行が無い')
		const row = textOf(shortcuts.slice(at, shortcuts.indexOf('</tr>', at)))
		assert.ok(inOrder(row, [avoid[0], menu[0], mid, menu[1]]), `右クリックの行の並びがアプリと違う: ${row}`)
		assert.ok(row.includes(avoid[1]), `右クリックの行に「${avoid[1]}」が無い`)
	})
}

const WEB_EDIT_KEY = { '': '編集ページ', 'en/': 'Edit page', 'zh-tw/': '編輯頁面' }

for (const { dir, queue, timeTab, blur, removedMenu } of LANGS) {
	test(`${dir || 'ja/'}: Web 版の違いの表の「編集ページ」の行に、追跡でつなぐ (Y / Shift+Y)・トラッキングキュー・時間別・ぼかしの強さがある`, () => {
		const diff = sectionOf(read(`_includes/docs/${dir}web.html`), 'diff') ?? ''
		const key = `<div class="kv-key">${WEB_EDIT_KEY[dir]}</div>`
		const at = diff.indexOf(key)
		assert.ok(at >= 0, `陽性対照: 「${WEB_EDIT_KEY[dir]}」の行が無い`)
		const row = diff.slice(at, diff.indexOf('</div>', diff.indexOf('<div class="kv-val">', at)))
		const text = textOf(row)
		assert.ok(row.includes('<kbd>Shift+Y</kbd>'), '編集ページの行に Shift+Y が無い')
		assert.ok(text.toLowerCase().includes(queue.toLowerCase()), `編集ページの行に「${queue}」が無い`)
		assert.ok(text.includes(timeTab), `編集ページの行に「${timeTab}」が無い`)
		assert.ok(text.toLowerCase().includes(blur.toLowerCase()), `編集ページの行に「${blur}」が無い`)
		assert.ok(!text.includes(removedMenu), `編集ページの行に「${removedMenu}」が残っている`)
	})
}

test('llms.txt: #edit-track の行に中間地点とトラッキングキュー、#edit-mosaic の行にぼかしの強さと時間別、edit-range が無い', () => {
	const llms = read('llms.txt')
	const lines = llms.split(/\r?\n/)
	const track = lines.find((l) => l.includes('/docs/#edit-track)')) ?? ''
	const mosaic = lines.find((l) => l.includes('/docs/#edit-mosaic)')) ?? ''
	assert.ok(track && mosaic, '陽性対照: 行が無い')
	assert.match(track, /中間/)
	assert.match(track, /waypoint/)
	assert.match(track, /トラッキングキュー/)
	assert.match(track, /Tracking queue/)
	assert.match(track, /まとめて/)
	assert.match(mosaic, /ぼかしの強さ/)
	assert.match(mosaic, /[Bb]lur strength/)
	assert.match(mosaic, /時間別/)
	assert.match(mosaic, /By time/)
	assert.ok(!llms.includes('edit-range'), 'edit-range が残っている')
	assert.ok(!llms.includes('区間の大きさ・形を変更'), '「区間の大きさ・形を変更」が残っている')
})

test('llms.txt: 「前後に反映」と Shift+F が無く、#edit-track の行の名前が「追跡とキー」', () => {
	const llms = read('llms.txt')
	const line = llms.split(/\r?\n/).find((l) => l.includes('/docs/#edit-track)'))
	assert.ok(line, '陽性対照: #edit-track の行が無い')
	assert.ok(line.startsWith('- [追跡とキー / Tracking and keyframes]'), `行の名前が違う: ${line.slice(0, 60)}`)
	assert.ok(!llms.includes('前後に反映'), '「前後に反映」が残っている')
	assert.ok(!llms.includes('Shift+F'), 'Shift+F が残っている')
})
