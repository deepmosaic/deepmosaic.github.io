// T-2249: 検出対象 (label 0) の日本語の表示名を「局部」に戻したこと (T-1901 の取り消し) を固定する。
//
//   node --test src/lib/site-copy-t2249-label.test.js
//
// - 日本語のページ・docs・データには「身体のプライバシー部位」が無く、検出対象の名前は「局部」
// - 英中の訳は変えない (en は body areas、zh-TW は 身體部位)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const OLD_LABEL = '身体のプライバシー部位'

/** 日本語の利用者に見える文を持つファイル (T-1901 で変えたもの)。 */
const JA_FILES = [
	'index.html',
	'_data/entity.yml',
	'_data/lang/ja.json',
	'_data/mosaic.yml',
	'_includes/docs/01-intro.html',
	'_includes/docs/03-detect.html',
	'_includes/docs/04-edit.html',
	'_includes/docs/05-export.html',
	'_includes/docs/web.html',
]

/**
 * llms.txt / llms-full.txt は Liquid のテンプレートで、検出対象の文は _data/entity.yml から差し込まれる。
 * ソースには語が直接書かれないので、ビルドの生成物 (_site) の方を見る (_site が無い時は飛ばす)。
 */
const BUILT_LLMS = ['_site/llms.txt', '_site/llms-full.txt']

test('日本語のページ・docs・データに「身体のプライバシー部位」が無い', () => {
	for (const rel of JA_FILES) {
		assert.ok(!read(rel).includes(OLD_LABEL), `${rel} に「${OLD_LABEL}」が残っている`)
	}
})

test('ビルド後の llms.txt / llms-full.txt に「身体のプライバシー部位」が無い (_site がある時だけ)', (t) => {
	if (!existsSync(join(ROOT, '_site', 'llms.txt'))) {
		t.skip('_site が無い (npm run build / jekyll build の後に確かめる)')
		return
	}
	for (const rel of BUILT_LLMS) {
		const text = read(rel)
		assert.ok(!text.includes(OLD_LABEL), `${rel} に「${OLD_LABEL}」が残っている`)
		assert.ok(text.includes('局部'), `${rel} に「局部」が無い`)
	}
})

test('検出対象の名前は「局部」(docs の検出オプション・トップの説明・製品の定義)', () => {
	assert.ok(read('_includes/docs/03-detect.html').includes('「局部」「男性の顔」「女性の顔」「モザイク」から選びます'))
	assert.ok(read('_includes/docs/04-edit.html').includes('局部（赤）/ 男性顔（青）/ 女性顔（ピンク）'))
	const ja = JSON.parse(read('_data/lang/ja.json'))
	assert.ok(ja.find_desc.startsWith('男性と女性の局部を自動的に検出し'), ja.find_desc)
	assert.ok(ja.deep_learning_desc.startsWith('局部の自動検出には'), ja.deep_learning_desc)
	assert.ok(read('_data/entity.yml').includes('動画に映った対象（局部・顔）'))
})

test('英中の訳は変えない (en は body areas、zh-TW は 身體部位)', () => {
	const en = JSON.parse(read('_data/lang/en.json'))
	const zh = JSON.parse(read('_data/lang/zh-tw.json'))
	assert.ok(en.find_desc.includes('male and female body areas'), en.find_desc)
	assert.ok(!/private/i.test(en.find_desc), en.find_desc)
	assert.ok(zh.find_desc.includes('身體部位'), zh.find_desc)
	assert.ok(read('_data/l10n/en/entity.yml').includes('(body areas and faces)'))
	assert.ok(read('_data/l10n/zh-tw/entity.yml').includes('（身體部位、臉部）'))
})
