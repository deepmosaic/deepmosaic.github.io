// プライバシーポリシー 13 項「エラー診断レポートについて」の回帰テスト。
//
//   node --test src/lib/site-copy-privacy-error-reports.test.js
//
//   Web 版もエラー診断を送るので、送る内容に
//   「エラーの直前の操作の記録（開いていた画面及び処理の進み具合）」と「ブラウザの情報」を書く。
//   本文に企業名を出さず、配布形態で区別しない。15 項 (保存先・委託先) は見出しと最初の 1 文を見る。
//
// 読み取りはこのファイル内で完結させる (`site-copy-legal-wording.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findNames, LOG_SERVICE_NAMES } from './name-guard.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PRIVACY = readFileSync(join(ROOT, 'company/privacy.html'), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** 見出し「<n>.」の h2 から次の h2 の手前までの HTML (コメントを含む)。無ければ例外。 */
function sectionOf(html, n) {
	const parts = html.split(new RegExp(`<h2[^>]*>${n}\\.`))
	if (parts.length !== 2) throw new Error(`${n} 項の見出しが 1 つに定まらない (${parts.length - 1} 個)`)
	return parts[1].split(/<h2/)[0]
}

test('13 項: 送る内容にエラーの直前の操作の記録とブラウザの情報がある', () => {
	const body = textOf(sectionOf(PRIVACY, 13))
	assert.match(body, /エラーの直前の操作の記録（開いていた画面及び処理の進み具合）/)
	assert.match(body, /OS及びブラウザの情報/)
})

test('13 項: 送信先は 12 項と同じ仕組みの当社のサーバーで、外部のエラー診断サービス（米国）は以前のバージョンの経過の 1 文にだけ出て、ファイル名とパスを送信しない記述がある', () => {
	const body = textOf(sectionOf(PRIVACY, 13))
	assert.match(body, /12項に定める動作記録と同じ仕組みで当社のサーバーに送信します/)
	assert.match(body, /以前のバージョンの本ソフトウェアは、[^。]*外部のエラー診断サービス（米国）[^。]*。/)
	assert.equal(body.match(/外部のエラー診断サービス/g)?.length, 1)
	assert.match(body, /ファイル名並びにフォルダ及びファイルのパスは送信しません/)
})

test('13 項: 本文に企業名・製品名と配布形態の区別を書かない', () => {
	const body = textOf(sectionOf(PRIVACY, 13))
	assert.deepEqual(body.match(/Web版|Web 版|デスクトップ版|インストール/g), null)
	assert.deepEqual(findNames(body, LOG_SERVICE_NAMES), [])
})

test('15 項: 見出しと最初の 1 文', () => {
	const body = textOf(sectionOf(PRIVACY, 15))
	assert.ok(
		body.startsWith(
			'保存先・委託先及び外国にある第三者への提供について 当社は、利用者情報の保存・処理を次の外部のサービスに委託しており、その一部は外国にあるサーバーで取り扱われます。',
		),
		`15 項の冒頭が違う: ${body.slice(0, 120)}`,
	)
})

test('sectionOf は存在しない項で例外を投げる (検査のすり抜け防止)', () => {
	assert.throws(() => sectionOf(PRIVACY, 99), /99 項の見出し/)
})
