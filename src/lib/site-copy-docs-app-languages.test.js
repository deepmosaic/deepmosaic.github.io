// docs のアプリの表示言語 (ja・en・zh-TW の 3 言語) の記述の回帰テスト。
//
//   node --test src/lib/site-copy-docs-app-languages.test.js
//
//   - アプリの画面は日本語・英語・繁体字中国語の 3 言語。
//   - docs の #install の「インストーラの言語」の行は 3 言語の事実を書く (「アプリも日本語 UI です」と書かない)。
//     インストーラ (NSIS) は日本語。初回は Windows の表示言語で決まり (zh-* は繁体字、それ以外は英語)、
//     プロフィールメニュー (右上) の言語の行で切り替えられる (アプリの画面と同じ)。
//   - このテストは日本語の docs だけを見る (英中の docs は訳の include の検査で見る)。
//
// 読み取りはこのファイル内で完結させる (site-copy-docs-install-update.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

const intro = read('_includes/docs/01-intro.html')

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'install'), null)
	assert.equal(sectionOf('<section id="install"><p>a</p></section>', 'install'), '<section id="install"><p>a</p>')
	assert.equal(textOf('{% comment %}x{% endcomment %}<!-- y --><b>z</b>'), 'z')
})

test('#install: アプリの画面は 3 言語に対応し、プロフィールメニューの言語の行で切り替えられる (アプリも日本語 UI です、と書かない)', () => {
	const install = sectionOf(intro, 'install')
	assert.ok(install, '01-intro に #install が無い')
	const text = textOf(install)
	assert.match(text, /アプリの画面は日本語・英語・繁体字中国語に対応しています/)
	assert.match(text, /初めて起動したときは Windows の表示言語に合わせて選ばれ（日本語・英語・中国語以外は英語）/)
	assert.match(text, /プロフィールメニュー（右上）の言語の行で切り替えられます/)
	assert.doesNotMatch(text, /アプリも日本語 UI です/, '「アプリも日本語 UI です」の文を載せない')
	assert.doesNotMatch(text, /ログイン/, '語は「サインイン」')
})

test('#install: 「画面の言語」の行でアプリの画面の言語を書き、インストーラの言語の行は置かない (Microsoft Store から入れる)', () => {
	const text = textOf(sectionOf(intro, 'install') ?? '')
	assert.match(text, /画面の言語 アプリの画面は日本語・英語・繁体字中国語に対応しています。/)
	assert.doesNotMatch(text, /インストーラの言語/)
})

test('docs の 01-intro のほかの所に「日本語 UI」の記述が無い', () => {
	assert.doesNotMatch(textOf(intro), /日本語 ?UI/)
})
