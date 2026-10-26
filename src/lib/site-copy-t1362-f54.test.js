// T-1362 [exp:f54]: 業務用の書き出し形式 (DV / DNxHR / CineForm) とタイムコードの記録の docs を固定する
// (desktop T-1327 / T-1355。web は PRO_EXPORT_FORMATS_ENABLED が常に false なので Desktop 版のみ)。
//
//   node --test src/lib/site-copy-t1362-f54.test.js
//
// このファイルは [exp:f54] のコミットに入れる (機能を外すときは revert で一緒に消える)。
// 読み取りはこのファイル内で完結させる (共有のモジュールを作ると revert が絡むので作らない)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

/** 固有名詞 (LOG-TERMS 付録 A の guard_tokens + モデル名 + 社名)。英数字に挟まれていないときだけ当たる。 */
const GUARD_WORDS = [
	'Rust', 'Sentry', 'Tauri', 'onnxruntime', 'ONNX', 'ORT', 'EP', 'CUDA', 'cuDNN', 'TensorRT', 'CoreML',
	'DirectML', 'WebGPU', 'WASM', 'wasm', 'NVENC', 'nvenc', 'VideoToolbox', 'ffmpeg', 'FFmpeg', 'ffprobe',
	'OpenCV', 'LoRAT', 'CSRT', 'KLT', 'MOSSE', 'KCF', 'HiT', 'AsymTrack', 'LightFC', 'SiamABC', 'SGLATrack',
	'VitTrack', 'SUTrack', 'MixFormer', 'NanoTrack', 'UETrack',
	'SAM', 'YOLO', 'Segment Anything',
	'Apple', 'Avid', 'GoPro', 'Canopus', 'Grass Valley',
]
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const GUARD = GUARD_WORDS.map((w) => new RegExp(`(?<![A-Za-z0-9])${escapeRe(w)}(?![A-Za-z0-9])`))
const guardHits = (text) => GUARD_WORDS.filter((_, i) => GUARD[i].test(text))

/** 公開しない内部の語 (実験機能の docs に書かない)。 */
const INTERNAL_WORDS = ['実験', 'フラグ', '開発ビルド']
/** UI の並び (`formats.ts` の PRO_EXPORT_FORMATS)。 */
const PRO_LABELS = ['MOV (DV)', 'MOV (DNxHR SQ)', 'MOV (DNxHR HQ)', 'MOV (DNxHR HQX 10bit)', 'MOV (CineForm)']

const encodeSection = () => {
	const sec = sectionOf(stripComments(read('_includes/docs/05-export.html')), 'edit-encode')
	assert.ok(sec, '#edit-encode 節が見つからない')
	return sec
}
const webDiff = () => {
	const sec = sectionOf(stripComments(read('_includes/docs/web.html')), 'diff')
	assert.ok(sec, 'web.html の #diff 節が見つからない')
	return sec
}

/** #edit-encode の業務用の形式の制約の段落。 */
const constraintParagraph = () =>
	[...encodeSection().matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1])).find((t) => t.includes('「MOV (DV)」')) ?? null

/** #edit-encode の kv の最後の 2 行。 */
function lastEncodeRows() {
	const rows = kvRowsWith(encodeSection(), 'フォーマット')
	assert.ok(rows && rows.length >= 2, '#edit-encode の kv が見つからない')
	return { last: rows.at(-1), prev: rows.at(-2) }
}

/** `_data/spec.yml` の formats の「書き出し」の値。 */
function specExportValue() {
	const m = read('_data/spec.yml').match(/- key: "書き出し"\s*\n\s*val: "([^"]*)"/)
	assert.ok(m, 'spec.yml の書き出しの行が見つからない')
	return m[1]
}

test('陽性対照: GUARD の検査は固有名詞を拾い、境界の外は拾わない', () => {
	assert.deepEqual(guardHits('CUDA で動きます'), ['CUDA'])
	assert.deepEqual(guardHits('LoRAT'), ['LoRAT'])
	assert.deepEqual(guardHits('GPU で動きます'), [])
	assert.deepEqual(guardHits('HiTech'), [])
})

test('フォーマットの行に業務用の 5 形式が UI の順で並ぶ', () => {
	const fmt = kvRow(encodeSection(), 'フォーマット')
	assert.ok(fmt, 'フォーマットの行が無い')
	const idx = PRO_LABELS.map((l) => fmt.indexOf(l))
	for (const [i, l] of PRO_LABELS.entries()) assert.ok(idx[i] >= 0, `「${l}」が無い: ${fmt}`)
	for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1], `並びが UI と違う: ${fmt}`)
})

test('解像度の行に DV 用の 2 つがある', () => {
	const res = kvRow(encodeSection(), '解像度')
	assert.ok(res, '解像度の行が無い')
	assert.ok(res.includes('SD NTSC (720x480)'), res)
	assert.ok(res.includes('SD PAL (720x576)'), res)
})

test('kv の最後の行が「タイムコードの記録」で、3 つのモードと形と制約を書き、kv-alt が交互', () => {
	const { last, prev } = lastEncodeRows()
	assert.equal(last.key, 'タイムコードの記録')
	for (const w of ['付けない', '元動画のタイムコードを引き継ぐ', '指定値', 'HH:MM:SS:FF', 'HH:MM:SS;FF', '29.97', '59.94', 'タイムコードを埋め込む']) {
		assert.ok(last.val.includes(w), `「${w}」が無い: ${last.val}`)
	}
	assert.notEqual(last.cls, prev.cls, 'kv-alt が直前の行と交互になっていない')
})

test('業務用の形式の制約の段落に DV の規格と寸法の条件がある', () => {
	const para = constraintParagraph()
	assert.ok(para, '制約の段落が見つからない')
	for (const w of ['720×480', '29.97', '720×576', '25', '偶数', '16 の倍数', '32 以上']) {
		assert.ok(para.includes(w), `「${w}」が無い: ${para}`)
	}
})

test('Web 版の差分表で業務用の形式とタイムコードの記録は Desktop 版のみ', () => {
	const fmt = kvRow(webDiff(), '書き出し形式')
	assert.ok(fmt, '書き出し形式の行が無い')
	for (const w of ['DNxHR', 'CineForm', 'Desktop 版のみ']) assert.ok(fmt.includes(w), `「${w}」が無い: ${fmt}`)
	const tc = kvRow(webDiff(), 'タイムコード')
	assert.ok(tc, 'タイムコードの行が無い')
	assert.ok(tc.startsWith('同じ'), tc)
	assert.ok(tc.includes('記録は Desktop 版のみ'), tc)
})

test('spec.yml の書き出しに DV / DNxHR / CineForm がある', () => {
	const val = specExportValue()
	for (const w of ['DV', 'DNxHR', 'CineForm']) assert.ok(val.includes(w), `「${w}」が無い: ${val}`)
})

test('足した文に固有名詞・社名・内部の語が無い', () => {
	const texts = [lastEncodeRows().last.val, constraintParagraph() ?? '', kvRow(webDiff(), 'タイムコード') ?? '', specExportValue()]
	for (const t of texts) {
		for (const w of INTERNAL_WORDS) assert.ok(!t.includes(w), `「${w}」がある: ${t}`)
		assert.deepEqual(guardHits(t), [], t)
	}
	// フォーマット / 解像度 / ビットレートの行は既存の文に足しただけ。行全体に固有名詞が無いことを見る
	for (const key of ['フォーマット', '解像度', 'ビットレート']) {
		assert.deepEqual(guardHits(kvRow(encodeSection(), key) ?? ''), [], key)
	}
	assert.deepEqual(guardHits(kvRow(webDiff(), '書き出し形式') ?? ''), [])
})
