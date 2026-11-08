// T-1887 (2026-11-08) 動作環境 (/spec/) の「GPU と処理速度の目安」を現行エンジンの値に固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1887.test.js
//
//   - 2026-06〜07 (旧エンジン) の実測 (RTX 3070 Ti で約 6 倍、GPU なしで約 13 倍) を出さない。
//   - 行は GPU 名と「動画長の約 N 倍（10 分の動画で約 M 分）・実測 / 推定」の形。M は N × 10 を丸めた値。
//   - RTX 50 / 40 / 30 / 20 の各シリーズと GTX、GPU なしの行がある。
//   - 推定の行は、速い GPU ほど倍率が小さい (同じシリーズ内で並びが逆転しない)。
//   - FAQ の処理時間の回答は表の実測と同じ数値を使う。
//   - T-1888: 表の説明と FAQ に「CPU の性能にも依存する」を書く。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** `_data/spec.yml` の節を `{ key, val }` の配列で読む (`  - key: "…"` / `    val: "…"` の形だけ)。 */
function loadSection(yml, section) {
	const lines = yml.split(/\r?\n/)
	const start = lines.findIndex((l) => l === `${section}:`)
	if (start < 0) return []
	const rows = []
	for (let i = start + 1; i < lines.length; i += 1) {
		const line = lines[i]
		if (line.trim() === '' || line.trim().startsWith('#')) continue
		const key = line.match(/^ {2}- key: "(.*)"$/)
		if (key) {
			rows.push({ key: key[1], val: '' })
			continue
		}
		const val = line.match(/^ {4}val: "(.*)"$/)
		if (val && rows.length > 0) {
			rows[rows.length - 1].val = val[1]
			continue
		}
		if (!/^ /.test(line)) break
	}
	return rows
}

/** トップレベルの `name: "…"` の値。無ければ null。 */
const scalar = (yml, name) => yml.match(new RegExp(`^${name}: "(.*)"$`, 'm'))?.[1] ?? null

const spec = read('_data/spec.yml')
const rows = loadSection(spec, 'performance')
const VAL_RE = /^動画長の約 (\d+(?:\.\d)?) 倍（10 分の動画で約 (\d+) 分）・(実測|推定)/

/** 行の倍率・分・種別。形が合わなければ null。 */
function parseVal(val) {
	const m = val.match(VAL_RE)
	return m ? { multiple: Number(m[1]), minutes: Number(m[2]), kind: m[3] } : null
}

const find = (name) => rows.find((r) => r.key === name)

test('旧エンジンの実測 (約 6 倍 / 約 13 倍 / fps 表記) を出さない', () => {
	const all = rows.map((r) => r.val).join('\n') + scalar(spec, 'performance_note')
	assert.doesNotMatch(all, /約 13 倍|2026-06〜07|\d+ fps/)
	assert.ok(rows.length >= 20, `行が少ない: ${rows.length}`)
})

test('GPU の行はすべて「動画長の約 N 倍（10 分の動画で約 M 分）・実測 / 推定」の形で、M は N × 10 を丸めた値', () => {
	for (const r of rows.filter((x) => x.key.startsWith('NVIDIA GeForce RTX'))) {
		const v = parseVal(r.val)
		assert.ok(v, `${r.key}: 形が違う: ${r.val}`)
		assert.equal(v.minutes, Math.round(v.multiple * 10), `${r.key}: ${r.val}`)
	}
})

test('RTX 50 / 40 / 30 / 20 の各シリーズ、GTX、GPU なしの行がある', () => {
	for (const name of [
		'NVIDIA GeForce RTX 5090',
		'NVIDIA GeForce RTX 5070 Ti',
		'NVIDIA GeForce RTX 5060',
		'NVIDIA GeForce RTX 4090',
		'NVIDIA GeForce RTX 4060',
		'NVIDIA GeForce RTX 3070 Ti',
		'NVIDIA GeForce RTX 3060',
		'NVIDIA GeForce RTX 2060',
	]) {
		assert.ok(find(name), `${name} の行が無い`)
	}
	assert.ok(rows.some((r) => r.key.includes('GTX')), 'GTX の行が無い')
	assert.ok(find('GPU なし（CPU のみ）'), 'GPU なしの行が無い')
})

test('実測の行は本番の中央値 (3070 Ti 2.1 / 4070 Ti 1.3 / 5070 Ti 1.1 / 3060 2.8 倍)', () => {
	const expected = {
		'NVIDIA GeForce RTX 3070 Ti': 2.1,
		'NVIDIA GeForce RTX 4070 Ti': 1.3,
		'NVIDIA GeForce RTX 5070 Ti': 1.1,
		'NVIDIA GeForce RTX 3060': 2.8,
	}
	for (const [name, multiple] of Object.entries(expected)) {
		const v = parseVal(find(name)?.val ?? '')
		assert.deepEqual(v && [v.multiple, v.kind], [multiple, '実測'], name)
	}
})

test('推定の行は、同じシリーズの上位ほど倍率が小さい', () => {
	const series = [
		['5090', '5080', '5070 Ti', '5070', '5060 Ti', '5060', '5050'],
		['4090', '4080', '4070 Ti', '4070', '4060 Ti', '4060'],
		['3090', '3080', '3070 Ti', '3060'],
	]
	for (const names of series) {
		const multiples = names.map((n) => parseVal(find(`NVIDIA GeForce RTX ${n}`)?.val ?? '')?.multiple)
		for (let i = 1; i < multiples.length; i += 1) {
			assert.ok(multiples[i - 1] <= multiples[i], `${names[i - 1]} (${multiples[i - 1]}) > ${names[i]} (${multiples[i]})`)
		}
	}
})

test('説明文は実測と推定の違い・条件 (1080p 30fps、形に沿ったモザイクを含む、書き出しは含まない) を書く', () => {
	const note = scalar(spec, 'performance_note')
	for (const re of [/実測/, /推定/, /1080p/, /30fps/, /書き出し/, /2026-10/, /CPU の性能にも依存/]) assert.match(note, re)
})

test('FAQ の処理時間の回答は表と同じ数値 (旧値を出さない)', () => {
	const faq = read('_data/faq.yml')
	const a = faq.split('- q: "処理にはどのくらい時間がかかりますか？"')[1]?.split('\n- q:')[0] ?? ''
	assert.ok(a, 'FAQ の該当項目が無い')
	assert.doesNotMatch(a, /約 6 倍|約 13 倍|2〜6 倍/)
	assert.match(a, /RTX 3070 Ti で約 2\.1 倍/)
	assert.match(a, /RTX 5070 Ti で約 1\.1 倍/)
	assert.match(a, /CPU の性能にも依存/) // T-1888
})
