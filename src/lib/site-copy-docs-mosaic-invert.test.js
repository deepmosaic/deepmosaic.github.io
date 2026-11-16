// モザイク設定の「反転 (外側にかける)」と Premiere Pro 連携の制限の docs を固定する。
//
//   node --test src/lib/site-copy-docs-mosaic-invert.test.js
//
// 読み取りはこのファイル内で完結させる (出さない名前の一覧だけは name-guard.js を使う)。

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

/** `kv` の行の一覧 ({ cls, key, val }、素の文字列)。 */
const rowsOf = (html) => [...html.matchAll(ROW_RE)].map((m) => ({ cls: m[1], key: textOf(m[2]), val: textOf(m[3]) }))

/** `kv-key` の文字列が `key` の行の `kv-val` の文字列。無ければ null。 */
const kvRow = (html, key) => rowsOf(html).find((r) => r.key === key)?.val ?? null

/** `key` の行を含む `kv` の行の一覧 (節の中の `kv` ごとに分けて探す)。 */
function kvRowsWith(sectionHtml, key) {
	const chunks = sectionHtml.split('<div class="kv ').slice(1)
	return chunks.map(rowsOf).find((rows) => rows.some((r) => r.key === key)) ?? null
}

/** 技術名・部品名・他社の製品名 (一覧は name-guard.js)。英数字に挟まれていないときだけ当たる。 */
const guardHits = (text) => findNames(text, TECH_NAMES)

/** docs に書かない語。 */
const INTERNAL_WORDS = ['実験', 'フラグ', '開発ビルド']
/** アプリのトグルの名前 (半角括弧、アプリの画面の表記と同じ)。 */
const LABEL = '反転 (外側にかける)'

const section = (file, id) => {
	const sec = sectionOf(stripComments(read(file)), id)
	assert.ok(sec, `${file} の #${id} 節が見つからない`)
	return sec
}

/** #edit-mosaic の kv の最後の 2 行。 */
function lastMosaicRows() {
	const rows = kvRowsWith(section('_includes/docs/04-edit.html', 'edit-mosaic'), LABEL)
	assert.ok(rows && rows.length >= 2, `#edit-mosaic の kv に「${LABEL}」の行が無い`)
	return { last: rows.at(-1), prev: rows.at(-2) }
}

/** #premiere の反転の段落。 */
const premiereParagraph = () =>
	[...section('_includes/docs/05-export.html', 'premiere').matchAll(/<p>([\s\S]*?)<\/p>/g)]
		.map((m) => textOf(m[1]))
		.find((t) => t.includes(LABEL)) ?? null

test('陽性対照: GUARD の検査は固有名詞を拾い、境界の外は拾わない', () => {
	assert.deepEqual(guardHits('CUDA で動きます'), ['CUDA'])
	assert.deepEqual(guardHits('FFmpeg を同梱'), ['FFmpeg'])
	assert.deepEqual(guardHits('GPU で動きます'), [])
	assert.deepEqual(guardHits('CUDAs'), [])
})

test('#edit-mosaic の kv の最後の行が「反転 (外側にかける)」で、ID 別・内側と外側・既定 OFF を書き、kv-alt が交互', () => {
	const { last, prev } = lastMosaicRows()
	assert.equal(last.key, LABEL)
	for (const w of ['ID 別', '外側', '内側', '回避マスク', '既定 OFF']) {
		assert.ok(last.val.includes(w), `「${w}」が無い: ${last.val}`)
	}
	assert.notEqual(last.cls, prev.cls, 'kv-alt が直前の行と交互になっていない')
})

test('#premiere に反転のあるプロジェクトは送信しない旨と代わりの手段がある', () => {
	const para = premiereParagraph()
	assert.ok(para, `#premiere に「${LABEL}」の段落が無い`)
	assert.ok(para.includes('送信'), para)
	assert.ok(para.includes('このアプリで書き出'), para)
	assert.ok(para.includes('N 件'), para)
})

test('Web 版の差分表の編集ページの行に「反転」があり、「タイムライン編集」も残る', () => {
	const val = kvRow(section('_includes/docs/web.html', 'diff'), '編集ページ')
	assert.ok(val, '編集ページの行が無い')
	assert.ok(val.startsWith('同じ'), val)
	assert.ok(val.includes('反転'), val)
	assert.ok(val.includes('タイムライン編集'), val)
})

test('反転についての文に docs に書かない語・固有名詞が無い', () => {
	const texts = [
		lastMosaicRows().last.val,
		premiereParagraph() ?? '',
		kvRow(section('_includes/docs/web.html', 'diff'), '編集ページ') ?? '',
	]
	for (const t of texts) {
		for (const w of INTERNAL_WORDS) assert.ok(!t.includes(w), `「${w}」がある: ${t}`)
		assert.deepEqual(guardHits(t), [], t)
	}
})
