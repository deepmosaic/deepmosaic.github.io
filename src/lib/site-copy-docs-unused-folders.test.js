// 未使用フォルダの一括チェックと ProRes 422 の説明の docs を固定する。
//
//   node --test src/lib/site-copy-docs-unused-folders.test.js
//
//   - 03-detect の #import「ホーム画面のお知らせ」の未使用フォルダの <li> に、一括選択の 2 ボタン
//     「すべてにチェックを入れる」「すべてのチェックを外す」と、開いたときの既定の選択 (検出結果の無い
//     フォルダだけ) がある。旧表記「すべて選択」「選択解除」は無い。選択モードの「すべて選択」は別機能なので残る。
//   - 05-export の #edit-encode に ProRes 422 と 422 HQ の違いの段落がある (版の数字は書かない)。
//   - この 2 つの文に固有名詞 (GUARD) が無い。
//
// ほかの docs の節の文を前提にしない。
// 読み取りはこのファイル内で完結させる (`docs-desktop-refresh.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findNames, TECH_NAMES } from './name-guard.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** `<section id="…">` から対応する `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const ROW_RE =
	/<div class="(kv-row(?: kv-alt)?)">\s*<div class="kv-key">([\s\S]*?)<\/div>\s*<div class="kv-val">([\s\S]*?)<\/div>\s*<\/div>/g

/** `kv-key` の文字列が `key` の行の `kv-val` の文字列。無ければ null。 */
function kvRow(html, key) {
	for (const m of html.matchAll(ROW_RE)) {
		if (textOf(m[2]) === key) return textOf(m[3])
	}
	return null
}

/** 技術名・部品名・他社の製品名 (一覧は name-guard.js)。英数字に挟まれていないときだけ当たる。 */
const guardHits = (text) => findNames(text, TECH_NAMES)

/** #import の未使用フォルダの <li> の素の文字列。 */
function orphanItem() {
	const sec = sectionOf(stripComments(read('_includes/docs/03-detect.html')), 'import')
	assert.ok(sec, '#import 節が見つからない')
	for (const m of sec.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
		const t = textOf(m[1])
		if (t.startsWith('「使われていないプロジェクトフォルダ')) return { sec, item: t }
	}
	assert.fail('未使用フォルダの <li> が見つからない')
}

/** #edit-encode の ProRes の段落の素の文字列。 */
function proresParagraph() {
	const sec = sectionOf(stripComments(read('_includes/docs/05-export.html')), 'edit-encode')
	assert.ok(sec, '#edit-encode 節が見つからない')
	for (const m of sec.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
		const t = textOf(m[1])
		if (t.includes('「MOV (ProRes 422)」') && t.includes('「MOV (ProRes 422 HQ)」')) return { sec, para: t }
	}
	assert.fail('ProRes 422 と 422 HQ の段落が見つからない')
}

test('陽性対照: GUARD の検査は固有名詞を拾い、境界の外は拾わない', () => {
	assert.deepEqual(guardHits('CUDA で動きます'), ['CUDA'])
	assert.deepEqual(guardHits('FFmpeg を同梱'), ['FFmpeg'])
	assert.deepEqual(guardHits('GPU で動きます'), [])
	assert.deepEqual(guardHits('CUDAs'), [])
})

test('未使用フォルダの <li> に一括選択の 2 ボタンと既定の選択がある', () => {
	const { item } = orphanItem()
	for (const w of ['すべてにチェックを入れる', 'すべてのチェックを外す', '検出結果の無いフォルダ', '「一覧を見る」', '「削除」']) {
		assert.ok(item.includes(w), `「${w}」が無い: ${item}`)
	}
})

test('未使用フォルダの <li> に旧表記が無く、選択モードの「すべて選択」は残る', () => {
	const { sec, item } = orphanItem()
	assert.ok(!item.includes('すべて選択'), item)
	assert.ok(!item.includes('選択解除'), item)
	const selectMode = [...sec.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1])).find((t) => t.includes('選択モード'))
	assert.ok(selectMode, '選択モードの段落が見つからない')
	assert.ok(selectMode.includes('すべて選択'), selectMode)
})

test('#edit-encode に ProRes 422 と 422 HQ の違いの段落があり、版の数字が無い', () => {
	const { para } = proresParagraph()
	assert.ok(para.includes('422 HQ'), para)
	assert.ok(para.includes('画質'), para)
	assert.ok(para.includes('これまでと同じ画質'), para)
	assert.doesNotMatch(para, /\d+\.\d+\.\d+/)
})

test('フォーマットの行に ProRes 422 と 422 HQ がある', () => {
	const { sec } = proresParagraph()
	const fmt = kvRow(sec, 'フォーマット')
	assert.ok(fmt, 'フォーマットの行が無い')
	assert.ok(fmt.includes('MOV (ProRes 422)'), fmt)
	assert.ok(fmt.includes('MOV (ProRes 422 HQ)'), fmt)
})

test('未使用フォルダと ProRes の文に固有名詞が無い', () => {
	assert.deepEqual(guardHits(orphanItem().item), [])
	assert.deepEqual(guardHits(proresParagraph().para), [])
})
