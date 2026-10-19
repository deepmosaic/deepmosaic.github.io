// T-1362 [exp:f16]: 検出オプションの「既存のモザイク」とラベル「既存モザイク」の docs を固定する
// (desktop T-1346 / T-1354 / T-1370、web T-1347 / T-1373)。
//
//   node --test src/lib/site-copy-t1362-f16.test.js
//
// このファイルは [exp:f16] のコミットに入れる (機能を外すときは revert で一緒に消える)。
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
/** 語彙ポリシー: 既存のモザイクの説明に置かない語。 */
const REMOVAL_WORDS = ['除去', '解除', '取り除', '復元']

const detectOptions = () => {
	const sec = sectionOf(stripComments(read('_includes/docs/03-detect.html')), 'detect-options')
	assert.ok(sec, '#detect-options 節が見つからない')
	return sec
}
const editSection = (id) => {
	const sec = sectionOf(stripComments(read('_includes/docs/04-edit.html')), id)
	assert.ok(sec, `#${id} 節が見つからない`)
	return sec
}
const webDiff = () => {
	const sec = sectionOf(stripComments(read('_includes/docs/web.html')), 'diff')
	assert.ok(sec, 'web.html の #diff 節が見つからない')
	return sec
}

/** #edit-player の検出クラスの色の段落。 */
const colorParagraph = () =>
	[...editSection('edit-player').matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1])).find((t) => t.startsWith('検出クラスは色分け')) ?? null

/** このコミットで足した文の一覧 (検査の対象)。 */
function addedTexts() {
	const rows = kvRowsWith(detectOptions(), '既存のモザイク')
	return [
		kvRow(detectOptions(), '検出対象'),
		rows?.at(-1)?.val ?? '',
		colorParagraph() ?? '',
		kvRow(editSection('edit-toolbar'), 'ラベル（C）') ?? '',
		kvRow(webDiff(), '検出') ?? '',
	]
}

test('陽性対照: GUARD の検査は固有名詞を拾い、境界の外は拾わない', () => {
	assert.deepEqual(guardHits('CUDA で動きます'), ['CUDA'])
	assert.deepEqual(guardHits('LoRAT'), ['LoRAT'])
	assert.deepEqual(guardHits('GPU で動きます'), [])
	assert.deepEqual(guardHits('HiTech'), [])
})

test('検出対象の行に「既存のモザイク」があり、初期値は OFF', () => {
	const val = kvRow(detectOptions(), '検出対象')
	assert.ok(val, '検出対象の行が無い')
	assert.ok(val.includes('「既存のモザイク」'), val)
	assert.ok(val.includes('「既存のモザイク」以外の3つがON'), val)
	assert.ok(val.includes('「既存のモザイク」はOFF'), val)
})

test('検出オプションの kv の最後の行が「既存のモザイク」で、kv-alt が交互', () => {
	const rows = kvRowsWith(detectOptions(), '既存のモザイク')
	assert.ok(rows && rows.length >= 2, '検出オプションの kv が見つからない')
	const last = rows.at(-1)
	const prev = rows.at(-2)
	assert.equal(last.key, '既存のモザイク')
	for (const w of ['既存モザイク', '多角形', 'ID 別', '上から']) {
		assert.ok(last.val.includes(w), `「${w}」が無い: ${last.val}`)
	}
	assert.notEqual(last.cls, prev.cls, 'kv-alt が直前の行と交互になっていない')
})

test('既存のモザイクの行に語彙ポリシーの語と固有名詞が無い', () => {
	const last = kvRowsWith(detectOptions(), '既存のモザイク').at(-1)
	for (const w of REMOVAL_WORDS) assert.ok(!last.val.includes(w), `「${w}」がある: ${last.val}`)
	assert.deepEqual(guardHits(last.val), [])
})

test('編集ページの色の段落とラベル（C）の行に「既存モザイク」がある', () => {
	const color = colorParagraph()
	assert.ok(color, '色の段落が見つからない')
	assert.ok(color.includes('既存モザイク（紫'), color)
	const label = kvRow(editSection('edit-toolbar'), 'ラベル（C）')
	assert.ok(label, 'ラベル（C）の行が無い')
	assert.ok(label.includes('「既存モザイク」'), label)
})

test('Web 版の差分表の検出の行に「既存のモザイク」があり、「同じ」で始まる', () => {
	const val = kvRow(webDiff(), '検出')
	assert.ok(val, '検出の行が無い')
	assert.ok(val.startsWith('同じ'), val)
	assert.ok(val.includes('既存のモザイク'), val)
})

test('足した文に内部の語・固有名詞が無い', () => {
	const texts = addedTexts()
	// 既存の文 (web の差分表の行の WebGPU) は触らないので、足した語の周りだけを見る
	const ownTexts = [texts[0], texts[1], texts[2], texts[3]]
	for (const t of texts) {
		for (const w of INTERNAL_WORDS) assert.ok(!t.includes(w), `「${w}」がある: ${t}`)
	}
	for (const t of ownTexts) assert.deepEqual(guardHits(t), [], t)
})
