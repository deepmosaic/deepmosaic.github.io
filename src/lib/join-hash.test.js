// T-2090 (login1111): `/join/` のフラグメントの解釈 (`src/lib/join-hash.js`)。
//
//   node --test src/lib/join-hash.test.js

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	APP_LOGIN_URL,
	MAX_HASH_LENGTH,
	ORG_CODE_PATTERN,
	joinAppUrl,
	parseJoinHash,
} from './join-hash.js'

const INVALID = { kind: 'invalid' }

/** [説明, 入力, 期待値] */
const CASES = [
	// 正しいコード
	['正しいコード', '#code=ABCD-EFGH-2345', { kind: 'code', code: 'ABCD-EFGH-2345' }],
	['先頭の # なし', 'code=ABCD-EFGH-2345', { kind: 'code', code: 'ABCD-EFGH-2345' }],
	['数字だけ', '#code=1234-5678-9012', { kind: 'code', code: '1234-5678-9012' }],
	['小文字は大文字にする', '#code=abcd-efgh-2345', { kind: 'code', code: 'ABCD-EFGH-2345' }],
	['キー名の大文字', '#CODE=ABCD-EFGH-2345', { kind: 'code', code: 'ABCD-EFGH-2345' }],
	['前後の空白 (エンコード済み) を除く', '#code=%20ABCD-EFGH-2345%20', { kind: 'code', code: 'ABCD-EFGH-2345' }],
	['前後の空白 (生) を除く', '#code= ABCD-EFGH-2345 ', { kind: 'code', code: 'ABCD-EFGH-2345' }],
	// 管理者
	['管理者', '#admin', { kind: 'admin' }],
	['管理者 (大文字)', '#ADMIN', { kind: 'admin' }],
	['管理者 (# なし)', 'admin', { kind: 'admin' }],
	// 空
	['空文字', '', INVALID],
	['# だけ', '#', INVALID],
	['空白だけ', '#   ', INVALID],
	['code= だけ', '#code=', INVALID],
	// 不正な形
	['区切りなし', '#code=ABCDEFGH2345', INVALID],
	['区切りが違う', '#code=ABCD_EFGH_2345', INVALID],
	['1 文字足りない', '#code=ABCD-EFGH-234', INVALID],
	['1 文字多い', '#code=ABCD-EFGH-23456', INVALID],
	['4 区切り', '#code=ABCD-EFGH-2345-6789', INVALID],
	['記号を含む', '#code=AB!D-EFGH-2345', INVALID],
	['全角英数', '#code=ＡＢＣＤ-ＥＦＧＨ-２３４５', INVALID],
	['途中の空白', '#code=ABCD -EFGH-2345', INVALID],
	['改行を含む', '#code=ABCD-EFGH-2345%0AX', INVALID],
	['壊れたパーセントエンコード', '#code=%E0%A4%A', INVALID],
	['余計な値が続く', '#code=ABCD-EFGH-2345&x=1', INVALID],
	['キーが違う', '#org=ABCD-EFGH-2345', INVALID],
	['admin に余計な値', '#admin=1', INVALID],
	['admin とコードの混在', '#admin&code=ABCD-EFGH-2345', INVALID],
	['クエリ形式 (?code=)', '?code=ABCD-EFGH-2345', INVALID],
	// 長すぎ
	['長すぎ', `#code=ABCD-EFGH-2345${' '.repeat(MAX_HASH_LENGTH)}`, INVALID],
	['長すぎ (英数)', `#${'A'.repeat(MAX_HASH_LENGTH + 1)}`, INVALID],
	// HTML を含む値
	['HTML (生)', '#code=<img src=x onerror=alert(1)>', INVALID],
	['HTML (エンコード済み)', '#code=%3Cscript%3Ealert(1)%3C%2Fscript%3E', INVALID],
	['コードの後ろに HTML', '#code=ABCD-EFGH-2345%3Cb%3E', INVALID],
	['引用符で属性を抜ける', '#code=ABCD-EFGH-2345%22%20onclick=%22x', INVALID],
	// 文字列でない
	['undefined', undefined, INVALID],
	['null', null, INVALID],
	['数値', 1234, INVALID],
]

for (const [name, input, expected] of CASES) {
	test(`parseJoinHash: ${name}`, () => {
		assert.deepEqual(parseJoinHash(input), expected)
	})
}

test('parseJoinHash: 長さの上限ちょうどは読む (上限の境界)', () => {
	// `code=` (5) + 前後の空白 + 14 文字 = MAX_HASH_LENGTH ちょうど
	const room = MAX_HASH_LENGTH - 'code='.length - 'ABCD-EFGH-2345'.length
	const left = ' '.repeat(Math.floor(room / 2))
	const right = ' '.repeat(room - left.length)
	const body = `code=${left}ABCD-EFGH-2345${right}`
	assert.equal(body.length, MAX_HASH_LENGTH)
	assert.deepEqual(parseJoinHash(`#${body}`), { kind: 'code', code: 'ABCD-EFGH-2345' })
	assert.deepEqual(parseJoinHash(`#${body} `), INVALID)
})

test('parseJoinHash: 返すコードは必ず形の検証に通っている', () => {
	for (const [, input] of CASES) {
		const result = parseJoinHash(input)
		if (result.kind === 'code') assert.match(result.code, ORG_CODE_PATTERN)
		else assert.equal('code' in result, false, '検証に通らない値を返さない')
	}
})

test('joinAppUrl: アプリが受ける URL (deepmosaic://join?code=…)', () => {
	assert.equal(joinAppUrl('ABCD-EFGH-2345'), 'deepmosaic://join?code=ABCD-EFGH-2345')
})

test('joinAppUrl: 形の検証に通らない値は null (href に入れない)', () => {
	for (const bad of ['', 'abcd-efgh-2345', 'ABCD-EFGH-2345&x=1', '"><script>', null, undefined]) {
		assert.equal(joinAppUrl(bad), null, String(bad))
	}
})

test('管理者のリンクは deepmosaic://login', () => {
	assert.equal(APP_LOGIN_URL, 'deepmosaic://login')
})
