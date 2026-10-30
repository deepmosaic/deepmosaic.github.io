// T-1362 [exp:f16]: 検出オプションの「モザイク」(素材にすでにかかっているモザイク) とラベル「モザイク」の docs を固定する
// (T-1547 / T-1558: アプリの表示名を「既存のモザイク」「既存モザイク」から「モザイク」に変えたのに合わせた)
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
	const rows = kvRowsWith(detectOptions(), 'モザイク')
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

test('検出対象の行に「モザイク」があり、初期値は OFF', () => {
	const val = kvRow(detectOptions(), '検出対象')
	assert.ok(val, '検出対象の行が無い')
	assert.ok(val.includes('「モザイク」'), val)
	assert.ok(val.includes('「モザイク」以外の3つがON'), val)
	assert.ok(val.includes('「モザイク」はOFF'), val)
	assert.ok(!val.includes('既存'), `旧名が残っている: ${val}`)
})

test('検出オプションの kv の最後の行が「モザイク」で、kv-alt が交互', () => {
	const rows = kvRowsWith(detectOptions(), 'モザイク')
	assert.ok(rows && rows.length >= 2, '検出オプションの kv が見つからない')
	const last = rows.at(-1)
	const prev = rows.at(-2)
	assert.equal(last.key, 'モザイク')
	for (const w of ['すでにかかっている', 'ラベル「モザイク」', '多角形', 'ID 別', '上から']) {
		assert.ok(last.val.includes(w), `「${w}」が無い: ${last.val}`)
	}
	assert.notEqual(last.cls, prev.cls, 'kv-alt が直前の行と交互になっていない')
})

test('モザイクの行に語彙ポリシーの語と固有名詞が無い', () => {
	const last = kvRowsWith(detectOptions(), 'モザイク').at(-1)
	for (const w of REMOVAL_WORDS) assert.ok(!last.val.includes(w), `「${w}」がある: ${last.val}`)
	assert.deepEqual(guardHits(last.val), [])
})

test('編集ページの色の段落とラベル（C）の行に「モザイク」がある', () => {
	const color = colorParagraph()
	assert.ok(color, '色の段落が見つからない')
	assert.ok(color.includes('モザイク（紫'), color)
	assert.ok(!color.includes('既存モザイク'), `旧名が残っている: ${color}`)
	const label = kvRow(editSection('edit-toolbar'), 'ラベル（C）')
	assert.ok(label, 'ラベル（C）の行が無い')
	assert.ok(label.includes('「モザイク」'), label)
	assert.ok(!label.includes('既存モザイク'), `旧名が残っている: ${label}`)
})

// T-1625: Desktop 版は「モザイク」を ON にすると局部・顔と排他、Web 版は併用できる。差があるので「同じ」ではなく「ほぼ同じ」で始め、差を書く
test('Web 版の差分表の検出の行は「ほぼ同じ」で始まり、「モザイク」の併用 / 排他の差を書く', () => {
	const val = kvRow(webDiff(), '検出')
	assert.ok(val, '検出の行が無い')
	assert.ok(val.startsWith('ほぼ同じ'), val)
	assert.ok(val.includes('「モザイク」'), val)
	assert.ok(val.includes('Web 版は「モザイク」を局部・顔と併用できます'), val)
	assert.ok(val.includes('Desktop 版は排他'), val)
})

// ── T-1625: 「モザイク」(すでにかかっているモザイク) の小節 #detect-mosaic ─────────────────

const detectMosaic = () => {
	const sec = sectionOf(stripComments(read('_includes/docs/03-detect.html')), 'detect-mosaic')
	assert.ok(sec, '#detect-mosaic 節が見つからない')
	return sec
}
/** 「取り除く機能ではありません」の否定文。語彙ポリシーの例外はこの 1 文だけ。 */
const NOT_REMOVAL = '取り除く機能ではありません'
/** 画面に出る進捗の段名の引用 (engine の段名と揃えて変えない)。旧名の検査の例外はこの引用だけ。 */
const STEP_NAME_QUOTE = '「既存のモザイクを検出」'

test('#detect-mosaic の節が本文にあり、目次にも同じ ID がある', () => {
	const html = stripComments(read('_includes/docs/03-detect.html'))
	assert.ok(html.includes('<section id="detect-mosaic"'), '本文に節が無い')
	assert.ok(html.indexOf('<section id="detect-options"') < html.indexOf('<section id="detect-mosaic"'), '#detect-options の後に無い')
	assert.match(read('_data/docs_toc.yml'), /\{ id: detect-mosaic, label: [^}]+\}/)
})

test('#detect-mosaic は手順・結果の見方・制約・所要の 4 つの小見出しを持ち、上からかけ直すことを書く', () => {
	const text = textOf(detectMosaic())
	for (const h of ['手順', '結果の見方', '制約', '所要の目安']) {
		assert.ok(detectMosaic().includes(`<h3 class="mt-6 text-[16px] font-bold text-ink">${h}</h3>`), `小見出し「${h}」が無い`)
	}
	for (const w of ['上から', 'すでにかかっている', 'ラベル「モザイク」', '多角形', 'ID 別', '「[モザイク除外]」', '元の映像に戻すことはできません']) {
		assert.ok(text.includes(w), `「${w}」が無い`)
	}
	for (const w of ['ぼかし', '黒塗り', '4K', '半透明', '1〜2 フレーム', 'GPU の無い PC', '約 9 分', '約 31 分', '1.1〜1.2 倍', '1.5〜1.6 倍']) {
		assert.ok(text.includes(w), `制約・所要の「${w}」が無い`)
	}
	assert.ok(text.includes('#edit-overview') || detectMosaic().includes('href="#edit-overview"'), '#edit-overview への案内が無い')
	assert.ok(detectMosaic().includes('href="#edit-toolbar"'), '#edit-toolbar への案内が無い')
})

test('#detect-mosaic は「取り除く」を否定文でだけ使い、語彙ポリシーの語・旧名・固有名詞・内部の語が無い', () => {
	const text = textOf(detectMosaic())
	assert.ok(text.includes(NOT_REMOVAL), `否定文「${NOT_REMOVAL}」が無い`)
	const rest = text.split(NOT_REMOVAL).join('')
	for (const w of REMOVAL_WORDS) assert.ok(!rest.includes(w), `「${w}」がある`)
	const own = text.split(STEP_NAME_QUOTE).join('')
	for (const w of ['既存モザイク', '既存のモザイク', ...INTERNAL_WORDS]) assert.ok(!own.includes(w), `「${w}」がある`)
	assert.deepEqual(guardHits(text), [])
})

test('検出オプションの「モザイク」の行から #detect-mosaic へ送り、検出対象の行に Desktop 版の排他を書く', () => {
	const last = kvRowsWith(detectOptions(), 'モザイク').at(-1)
	assert.ok(detectOptions().includes('href="#detect-mosaic"'), '#detect-mosaic へのリンクが無い')
	assert.ok(last.val.includes('詳しくは'), last.val)
	const target = kvRow(detectOptions(), '検出対象')
	assert.ok(target.includes('モザイクの枠だけを検出します。局部・顔の検出とモザイクの初期設定は使いません'), target)
	assert.ok(kvRow(detectOptions(), '所要時間の目安').includes('(モザイクの走査 / 目安 N fps)'))
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
