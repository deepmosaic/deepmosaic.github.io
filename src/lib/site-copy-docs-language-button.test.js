// docs 第 1 章の表示言語の切り替えの説明 (プロフィールメニューの言語の行) の回帰テスト。
//
//   node --test src/lib/site-copy-docs-language-button.test.js
//
//   - アプリの表示言語は、プロフィールメニューの「テーマ」の行のすぐ下の言語の行で切り替える。
//     押すと開く一覧の言語名はそれぞれの言語での呼び名 (日本語・English・繁體中文)。
//   - #install の「インストーラの言語」の行はプロフィールメニューの言語の行で切り替えると書き、画面の構成 (#layout) へ案内する。
//   - #layout の「表示言語」の見出しはプロフィールメニューの説明の前に置く。
//     プロフィールメニューの項目の並びは許可の一覧のとおり (最後が表示言語の切り替え)。
//   - 英中の訳にも、画面右上の独立した言語のボタンの説明が無い。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** 一覧に出る言語名 (アプリの ja の文と同じ) */
const SELF_NAMES = ['日本語', 'English', '繁體中文']

/** プロフィールメニューの項目の並び (アプリの ja の文と同じ。括弧の中の補足は除く) */
const PROFILE_MENU_ITEMS = ['サインインの状態とプラン', 'サインイン', '組織', 'プランの契約と管理', 'お問い合わせ', 'サインアウト', 'テーマの切り替え', '表示言語の切り替え']

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

/** h3 の見出しから次の h3 (または終わり) までの本文。無ければ null。 */
function h3BlockOf(html, title) {
	const re = new RegExp(`<h3[^>]*>${title}</h3>([\\s\\S]*?)(?=<h3|$)`)
	const m = re.exec(html)
	return m ? m[1] : null
}

/** 「…が並びます」の前の項目を、全角の括弧の中の補足を除いて「、」で分ける。無ければ null。 */
function menuItemsOf(text) {
	const m = text.match(/開きます。(.*?)が並びます/)
	if (!m) return null
	return m[1].replace(/（[^（）]*）/g, '').split('、').map((s) => s.trim()).filter(Boolean)
}

const intro = read('_includes/docs/01-intro.html')

test('ヘルパーの陽性対照と陰性対照', () => {
	assert.equal(h3BlockOf('<h3 class="a">X</h3><p>b</p><h3>Y</h3>', 'X'), '<p>b</p>')
	assert.equal(h3BlockOf('<p>b</p>', 'X'), null)
	assert.equal(sectionOf('<p></p>', 'x'), null)
	assert.deepEqual(menuItemsOf('押すと開きます。A、B（補足）、C が並びます。'), ['A', 'B', 'C'])
	assert.equal(menuItemsOf('並びの説明が無い'), null)
})

test('「インストーラの言語」の行: 切り替えはプロフィールメニューの言語の行で、画面の構成へ案内する', () => {
	const install = sectionOf(intro, 'install')
	assert.ok(install, '陽性対照: #install が無い')
	const text = textOf(install)
	assert.match(text, /プロフィールメニュー（右上）の言語の行で切り替えられます（画面の構成）/)
	assert.doesNotMatch(text, /表示言語のボタン/)
	assert.ok(install.includes('href="#layout"'), '画面の構成 (#layout) へのリンクが無い')
})

test('画面の構成: 表示言語はプロフィールメニューの「テーマ」の行の下の言語の行で、押すと開く一覧の言語名はそれぞれの言語での呼び名', () => {
	const layout = sectionOf(intro, 'layout')
	assert.ok(layout, '陽性対照: #layout が無い')
	const block = h3BlockOf(layout, '表示言語')
	assert.ok(block, '「表示言語」の見出しが無い')
	const text = textOf(block)
	assert.match(text, /プロフィールメニュー（右上）の「テーマ」の行のすぐ下に/)
	for (const name of SELF_NAMES) assert.ok(text.includes(name), `一覧の言語名「${name}」が無い`)
	assert.match(text, /今の言語の名前の行があります。押すと .+ の一覧が開き/)
	assert.match(text, /次に起動したときも選んだ言語で表示されます/)
	assert.doesNotMatch(text, /アイコンだけ/)
	assert.doesNotMatch(layout, /表示言語のボタン/)
	assert.ok(layout.indexOf('>表示言語</h3>') < layout.indexOf('プロフィールメニュー（右上）</h3>'), '表示言語の説明がプロフィールメニューの後にある')
})

test('英中の訳: 画面右上の独立した言語のボタンの説明が無く、言語の切り替えはプロフィールメニューの「テーマ」の行の下', () => {
	const cases = [
		{ file: '_includes/docs/en/01-intro.html', old: /Display language button|to the left of the profile menu|only the icon/, row: /Just below the "Theme" row in the profile menu/ },
		{ file: '_includes/docs/zh-tw/01-intro.html', old: /顯示語言按鈕|個人資料選單左側|只顯示圖示/, row: /個人資料選單（右上）的「主題」列正下方/ },
	]
	for (const { file, old, row } of cases) {
		const text = textOf(read(file))
		assert.doesNotMatch(text, old, `${file} に右上の言語のボタンの説明が残っている`)
		assert.match(text, row, `${file} にプロフィールメニューの言語の行の説明が無い`)
	}
})

test('画面の構成: プロフィールメニューの項目の並びは許可の一覧のとおり', () => {
	const layout = sectionOf(intro, 'layout')
	const block = h3BlockOf(layout, 'プロフィールメニュー（右上）')
	assert.ok(block, '陽性対照: プロフィールメニューの見出しが無い')
	const firstPara = /<p>([\s\S]*?)<\/p>/.exec(block)?.[1] ?? ''
	assert.deepEqual(menuItemsOf(textOf(firstPara)), PROFILE_MENU_ITEMS)
})
