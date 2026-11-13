// T-2308 (backlog1113): トップのヒーローの副ボタン「ブラウザでお試し（…）」がスマートフォンの幅で切れるのを直した回帰テスト。
//
//   node --test src/lib/site-copy-t2308.test.js
//
//   - ja / en / zh-tw のトップの hero-webapp のリンクで、括弧の部分を `<span class="hidden sm:inline">…</span>` で包む
//     (狭い幅では「ブラウザでお試し」だけを出す。T-1968 のヘッダーと同じやり方)。
//   - textContent は変わらない (計測の link_text は今のまま) ので、タグを落とした文は前と同じ。
//   - 実際に 412px に収まるかは e2e/i18n-layout.spec.ts の「mobile (Pixel 7) のボタンの幅 (T-2308)」が見る。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** `data-dl="<id>"` を持つ `<a …>…</a>` を 1 つ取り出す (無ければ null)。 */
function linkOf(html, id) {
	const re = new RegExp(`<a\\b[^>]*data-dl="${id}"[^>]*>[\\s\\S]*?</a>`)
	return html.match(re)?.[0] ?? null
}

const textOf = (html) =>
	html
		.replace(/\{%[\s\S]*?%\}/g, '')
		.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

const PAGES = [
	{ file: 'index.html', short: 'ブラウザでお試し', rest: /^（\{\{[^}]+\}\} 分までの動画・インストール不要）$/ },
	{ file: 'en/index.html', short: 'Try it in your browser', rest: /^ ?\(videos up to \{\{[^}]+\}\} minutes, no installation\)$/ },
	{ file: 'zh-tw/index.html', short: '在瀏覽器中試用', rest: /^（影片最長 \{\{[^}]+\}\} 分鐘，免安裝）$/ },
]

for (const { file, short, rest } of PAGES) {
	test(`${file}: hero-webapp の括弧の部分は狭い幅で隠す (hidden sm:inline)`, () => {
		// Act
		const link = linkOf(read(file), 'hero-webapp')

		// Assert
		assert.ok(link, 'hero-webapp のリンクが無い')
		const span = link.match(/<span class="hidden sm:inline">([\s\S]*?)<\/span>/)
		assert.ok(span, '括弧の部分が <span class="hidden sm:inline"> で包まれていない')
		assert.match(span[1], rest)
		// 包みの外 (狭い幅で見える部分) は短い名前だけ
		const visible = textOf(link.replace(span[0], ''))
		assert.equal(visible, short)
	})
}

test('linkOf: 該当が無ければ null', () => {
	assert.equal(linkOf('<a href="/" data-dl="hero">x</a>', 'hero-webapp'), null)
})
