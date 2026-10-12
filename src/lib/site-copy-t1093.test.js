// T-1093 (2026-10-12) プライバシーポリシー 13 項「エラー診断レポートについて」の改定を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1093.test.js
//
//   Web 版もエラー診断を送るようになったため、送る内容に
//   「エラーの直前の操作の記録（開いていた画面及び処理の進み具合）」と「ブラウザの情報」を足した。
//   書き方の方針は T-1061 と同じ (企業名を出さない / 配布形態で区別しない / 所在国は「米国」だけ)。
//   15 項 (保存先・委託先) は T-1061 で形態の区別が消えているため変更しない。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t1061.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

/** 見出し「<n>.」の h2 の直前にある HTML コメント (間に空白だけを許す)。無ければ null。 */
function commentBefore(html, n) {
	const m = html.match(new RegExp(`<!--((?:(?!-->)[\\s\\S])*)-->\\s*<h2[^>]*>${n}\\.`))
	return m ? m[1] : null
}

test('13 項: 送る内容にエラーの直前の操作の記録とブラウザの情報がある', () => {
	const body = textOf(sectionOf(PRIVACY, 13))
	assert.match(body, /エラーの直前の操作の記録（開いていた画面及び処理の進み具合）/)
	assert.match(body, /OS及びブラウザの情報/)
})

test('13 項: 送信先は「外部のエラー診断サービス（米国）」で、ファイル名とパスを伏せる記述が残っている', () => {
	const body = textOf(sectionOf(PRIVACY, 13))
	assert.match(body, /外部のエラー診断サービス（米国）/)
	assert.match(body, /ファイル名及びファイルのパスは伏せます/)
})

test('13 項: 本文に企業名・製品名と配布形態の区別を書かない', () => {
	const body = textOf(sectionOf(PRIVACY, 13))
	assert.deepEqual(body.match(/Sentry|Web版|Web 版|デスクトップ版|インストール/g), null)
})

test('13 項: 直前の HTML コメントに T-1093 の改定記録がある', () => {
	const comment = commentBefore(PRIVACY, 13)
	assert.ok(comment, '13 項の直前に HTML コメントが無い')
	assert.match(comment, /T-1093/)
})

test('15 項: 見出しと最初の 1 文は T-1093 で変えていない', () => {
	const body = textOf(sectionOf(PRIVACY, 15))
	assert.ok(
		body.startsWith(
			'保存先・委託先及び外国にある第三者への提供について 当社は、利用者情報の保存・処理を次の外部のサービスに委託しており、その一部は外国にあるサーバーで取り扱われます。',
		),
		`15 項の冒頭が変わっている: ${body.slice(0, 120)}`,
	)
})

test('sectionOf は存在しない項で例外を投げる (検査のすり抜け防止)', () => {
	assert.throws(() => sectionOf(PRIVACY, 99), /99 項の見出し/)
})
