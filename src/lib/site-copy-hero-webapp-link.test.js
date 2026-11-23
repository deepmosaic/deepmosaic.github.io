// トップのヒーローのダウンロードの並び: 中央に大きな Microsoft Store のバッジ、その下に Web 版への文字のリンク。
//
//   node --test src/lib/site-copy-hero-webapp-link.test.js
//
//   - ja / en / zh-tw のトップのヒーローは、縦に中央寄せの並び (flex-col items-center) に
//     Store のバッジ (size="hero") → Web 版への文字のリンク「ブラウザでお試し →」の 2 つだけを置く。
//   - Web 版へのリンクは枠つきのボタンの class を持たず、サイトの文字のリンクの class (text-accent-soft hover:underline)。
//     文は短い名前 + 矢印 (読み上げでは矢印を読まない) で、お試しの分数などの補足を付けない。
//   - ヒーローにドキュメントへのボタンは置かない。
//   - バッジの描いた大きさ (幅ごと) は e2e/store-badge.spec.ts が見る。

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

/** ヒーローのダウンロードの並び (Store のバッジを含む <div …> から対応する </div> まで)。無ければ null。 */
function heroRowOf(html) {
	const at = html.search(/\{%-?\s*include store-button\.html[^%]*dl="hero-store"/)
	if (at < 0) return null
	const open = html.lastIndexOf('<div ', at)
	const close = html.indexOf('</div>', at)
	return open < 0 || close < 0 ? null : html.slice(open, close + '</div>'.length)
}

const textOf = (html) =>
	html
		.replace(/\{%[\s\S]*?%\}/g, '')
		.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

const PAGES = [
	{ file: 'index.html', label: 'ブラウザでお試し', docs: '/docs/' },
	{ file: 'en/index.html', label: 'Try it in your browser', docs: '/en/docs/' },
	{ file: 'zh-tw/index.html', label: '在瀏覽器中試用', docs: '/zh-tw/docs/' },
]

for (const { file, label, docs } of PAGES) {
	test(`${file}: ヒーローの並びは中央寄せの縦並びで、大きいバッジ → Web 版への文字のリンクの 2 つだけ`, () => {
		// Act
		const row = heroRowOf(read(file))

		// Assert
		assert.ok(row, 'ヒーローのダウンロードの並びが無い')
		const div = row.match(/^<div class="([^"]*)">/)?.[1] ?? ''
		assert.ok(['flex', 'flex-col', 'items-center'].every((c) => div.split(' ').includes(c)), `中央寄せの縦並びでない: ${div}`)
		assert.match(row, /\{%-?\s*include store-button\.html dl="hero-store" size="hero" %\}/)
		const anchors = row.match(/<a\b/g) ?? []
		assert.equal(anchors.length, 1, 'バッジの部品のほかに置くリンクは Web 版への 1 つだけ')
		assert.ok(row.indexOf('dl="hero-store"') < row.indexOf('data-dl="hero-webapp"'), 'バッジが Web 版へのリンクより前に無い')
		assert.ok(!row.includes(`href="${docs}"`), 'ヒーローにドキュメントへのボタンがある')
		assert.doesNotMatch(row, /BookOpen/)
	})

	test(`${file}: Web 版へのリンクは文字のリンクで、文は「${label} →」だけ`, () => {
		// Act
		const link = linkOf(read(file), 'hero-webapp')

		// Assert
		assert.ok(link, 'hero-webapp のリンクが無い')
		const cls = link.match(/\sclass="([^"]*)"/)?.[1] ?? ''
		assert.doesNotMatch(cls, /\bbtn-/, '枠つきのボタンの class が残っている')
		assert.ok(cls.split(' ').includes('text-accent-soft') && cls.split(' ').includes('hover:underline'), `文字のリンクの class でない: ${cls}`)
		assert.match(link, /target="_blank" rel="noopener noreferrer"/)
		assert.match(link, /<span aria-hidden="true">→<\/span><\/a>$/, '矢印は読み上げない')
		assert.equal(textOf(link), `${label} →`)
		assert.doesNotMatch(link, /trial_minutes|\stitle=|icon\.html/, '補足の文・title・アイコンを付けない')
	})
}

test('ヘルパー: 該当が無ければ null', () => {
	assert.equal(linkOf('<a href="/" data-dl="hero">x</a>', 'hero-webapp'), null)
	assert.equal(heroRowOf('<div class="x"><a data-dl="cta-store"></a></div>'), null)
	assert.equal(heroRowOf('<div class="a">{% include store-button.html dl="hero-store" size="hero" %}</div>'), '<div class="a">{% include store-button.html dl="hero-store" size="hero" %}</div>')
})
