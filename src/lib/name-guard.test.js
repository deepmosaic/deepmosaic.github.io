// 公開ページに出さない名前の検査の部品 (name-guard.js) の仕様テスト。
//
//   node --test src/lib/name-guard.test.js
//
//   - findNames の 3 つの当たり方 (words・starts・parts) と ignoreCase・lengths・ascii の陽性対照と陰性対照
//   - 規則の一覧の件数 (一覧を空にして検査がすり抜けないこと)
//   - 公開している名前 (docs の同梱ソフトの名前) は TECH_NAMES に当たる

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
	assetModelHits,
	findNames,
	LOG_SERVICE_NAMES,
	MODEL_ABBR,
	MODEL_NAMES,
	nameHash,
	PART_NAMES,
	SERVICE_NAMES,
	STORE_NAMES,
	TECH_NAMES,
} from './name-guard.js'

test('nameHash: sha256 の先頭 16 桁 (16 進)', () => {
	assert.equal(nameHash('abc'), 'ba7816bf8f01cfea')
	assert.match(nameHash('例'), /^[0-9a-f]{16}$/)
})

test('words: 英数字に挟まれていないときだけ当たる (空白でつないだ 2 語も)', () => {
	const rule = { words: [nameHash('Foo'), nameHash('Foo Bar')] }
	assert.deepEqual(findNames('Foo で動く', rule), ['Foo'])
	assert.deepEqual(findNames('(Foo)', rule), ['Foo'])
	assert.deepEqual(findNames('Foo Bar の部品', rule), ['Foo', 'Foo Bar'])
	assert.deepEqual(findNames('Foos と xFoo と Foo2', rule), [])
	assert.deepEqual(findNames('foo', rule), [], '大文字と小文字を区別する')
})

test('starts: 英数字の連なりの先頭から始まれば、後ろは問わない', () => {
	const rule = { starts: [nameHash('ab2')], ignoreCase: true }
	assert.deepEqual(findNames('AB2.1 と ab2x', rule), ['AB2', 'ab2'])
	assert.deepEqual(findNames('xab2', rule), [])
})

test('parts: 空白を含まない ASCII の連なりの中の部分文字列に当たる', () => {
	const rule = { parts: [nameHash('Example'), nameHash('ex.com')] }
	assert.deepEqual(findNames('提供: ExampleCorp (www.ex.com)', rule), ['Example', 'ex.com'])
	assert.deepEqual(findNames('Exam ple', rule), [])
})

test('parts + ignoreCase: 本文を小文字にそろえて比べ、本文のままの文字列を返す', () => {
	const rule = { parts: [nameHash('key_name')], ignoreCase: true }
	assert.deepEqual(findNames('列 KEY_NAME を使う', rule), ['KEY_NAME'])
})

test('parts + lengths + ascii: false: 日本語の部分文字列にも当たる', () => {
	const rule = { parts: [nameHash('部品名')], lengths: [3], ascii: false }
	assert.deepEqual(findNames('この部品名は書かない', rule), ['部品名'])
	assert.deepEqual(findNames('部品の名前', rule), [])
})

test('assetModelHits: 区切りの後に始まり数字・_・.・- が続く語だけを見る (普通の語は当たらない)', () => {
	assert.deepEqual(assetModelHits('assets/img/samples/shape-compare-1-rect.webp'), [])
	assert.deepEqual(assetModelHits('assets/img/hero/hero-shape.webm'), [])
})

test('規則の一覧の件数 (空にして検査がすり抜けないこと)', () => {
	assert.equal(TECH_NAMES.words.length, 45)
	assert.equal(SERVICE_NAMES.parts.length, 7)
	assert.equal(LOG_SERVICE_NAMES.words.length, 1)
	assert.equal(LOG_SERVICE_NAMES.parts.length, 3)
	assert.equal(STORE_NAMES.parts.length, 6)
	assert.equal(MODEL_NAMES.words.length + MODEL_NAMES.starts.length, 4)
	assert.equal(MODEL_ABBR.parts.length, 1)
	assert.equal(PART_NAMES.parts.length, 1)
	for (const rule of [TECH_NAMES, SERVICE_NAMES, LOG_SERVICE_NAMES, STORE_NAMES, MODEL_NAMES, MODEL_ABBR, PART_NAMES]) {
		for (const h of [...(rule.words ?? []), ...(rule.starts ?? []), ...(rule.parts ?? [])]) assert.match(h, /^[0-9a-f]{16}$/)
	}
})

test('TECH_NAMES: docs の同梱ソフトの名前 (公開している名前) に当たる', () => {
	assert.deepEqual(findNames('CUDA と FFmpeg と ONNX', TECH_NAMES), ['CUDA', 'FFmpeg', 'ONNX'])
	assert.deepEqual(findNames('GPU で動く', TECH_NAMES), [])
})
