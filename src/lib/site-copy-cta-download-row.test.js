// ページ末尾の案内 (`_includes/cta-download.html`。トップ・/price/・/spec/ の 3 言語) のダウンロードの並びは、
// トップの冒頭 (ヒーロー) と同じ形: 中央に大きな Microsoft Store のバッジ、その下に Web 版への文字のリンク。
//
//   node --test src/lib/site-copy-cta-download-row.test.js
//
//   - 並びの <div> の class はヒーローの並びと同じ。中身はバッジ (size="hero") → Web 版への文字のリンクの 2 つだけで、枠つきのボタンを置かない。
//   - Web 版へのリンクの class・属性・矢印 (読み上げない) はヒーローのリンクと同じ。文は 3 言語ともヒーローと同じ「ブラウザでお試し →」。
//     計測の目印は cta-webapp (ヒーローの hero-webapp と区別する)。
//   - Web 版の説明の行 (対応ブラウザ・お試しの上限) はリンクを持たない文として残す。
//   - 呼び出し側 (9 ページ) は副ボタンの引数を渡さない。英中の parts.yml の cta_ のキーは全部 include が使う。
//   - バッジの描いた大きさ (幅ごと) は e2e/store-badge.spec.ts が見る。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')

/** `data-dl="<id>"` を持つ `<a …>…</a>` を 1 つ取り出す (無ければ null)。 */
function linkOf(html, id) {
	return html.match(new RegExp(`<a\\b[^>]*data-dl="${id}"[^>]*>[\\s\\S]*?</a>`))?.[0] ?? null
}

/** `dl="<id>"` の store-button を含む <div …> から対応する </div> まで。無ければ null。 */
function rowOf(html, id) {
	const at = html.search(new RegExp(`\\{%-?\\s*include store-button\\.html[^%]*dl="${id}"`))
	if (at < 0) return null
	const open = html.lastIndexOf('<div ', at)
	const close = html.indexOf('</div>', at)
	return open < 0 || close < 0 ? null : html.slice(open, close + '</div>'.length)
}

const classOf = (tag) => tag?.match(/\sclass="([^"]*)"/)?.[1] ?? null
const openTagOf = (html) => html?.match(/^<[^>]*>/)?.[0] ?? null
/** Liquid のタグと出力・HTML のタグを落とし、空白を 1 つに潰した文。 */
const textOf = (html) =>
	html
		.replace(/\{%[\s\S]*?%\}/g, '')
		.replace(/\{\{[\s\S]*?\}\}/g, '')
		.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

function parseFlatYaml(text) {
	const out = {}
	for (const raw of text.split('\n')) {
		const m = raw.match(/^([a-z][a-z0-9_]*):\s*"((?:[^"\\]|\\.)*)"/)
		if (m) out[m[1]] = JSON.parse(`"${m[2]}"`)
	}
	return out
}

const CTA = stripComments(read('_includes/cta-download.html'))
const HERO = stripComments(read('index.html'))

test('並び: class はヒーローの並びと同じで、大きいバッジ → Web 版への文字のリンクの 2 つだけ', () => {
	// Act
	const row = rowOf(CTA, 'cta-store')
	const heroRow = rowOf(HERO, 'hero-store')

	// Assert
	assert.ok(row, 'ページ末尾の案内のダウンロードの並びが無い')
	assert.ok(heroRow, 'ヒーローのダウンロードの並びが無い')
	assert.equal(classOf(openTagOf(row)), classOf(openTagOf(heroRow)), '並びの class がヒーローと違う')
	assert.ok(['flex', 'flex-col', 'items-center'].every((c) => classOf(openTagOf(row)).split(' ').includes(c)), '中央寄せの縦並びでない')
	assert.match(row, /\{%-?\s*include store-button\.html dl="cta-store" size="hero" lazy=true %\}/)
	assert.equal((row.match(/<a\b/g) ?? []).length, 1, 'バッジの部品のほかに置くリンクは Web 版への 1 つだけ')
	assert.ok(row.indexOf('dl="cta-store"') < row.indexOf('data-dl="cta-webapp"'), 'バッジが Web 版へのリンクより前に無い')
	assert.doesNotMatch(row, /\bbtn-|secondary_/, '枠つきのボタンが残っている')
	assert.doesNotMatch(CTA, /include\.secondary_/, '副ボタンの引数を読んでいる')
})

test('Web 版へのリンク: class・属性・矢印はヒーローと同じで、計測の目印は cta-webapp', () => {
	// Act
	const link = linkOf(CTA, 'cta-webapp')
	const hero = linkOf(HERO, 'hero-webapp')

	// Assert
	assert.ok(link, 'cta-webapp のリンクが無い')
	assert.ok(hero, 'hero-webapp のリンクが無い')
	assert.equal(classOf(link), classOf(hero), 'リンクの class がヒーローと違う')
	assert.match(link, /target="_blank" rel="noopener noreferrer"/)
	assert.match(link, /\shref="\{\{ site\.data\.site\.web_app\.url \}\}\{\{ cd_WQ \}\}"/)
	assert.match(link, / <span aria-hidden="true">→<\/span><\/a>$/, '矢印は読み上げない')
	assert.equal(textOf(link), 'ブラウザでお試し →')
	assert.equal(textOf(hero), 'ブラウザでお試し →')
	assert.doesNotMatch(link, /trial_minutes|\stitle=|icon\.html/, '補足の文・title・アイコンを付けない')
})

test('Web 版へのリンクの英中の文はヒーローの文と同じ', () => {
	for (const lang of ['en', 'zh-tw']) {
		// Arrange
		const parts = parseFlatYaml(read(`_data/l10n/${lang}/parts.yml`))
		const hero = linkOf(stripComments(read(`${lang}/index.html`)), 'hero-webapp')

		// Assert
		assert.ok(hero, `${lang}: hero-webapp のリンクが無い`)
		assert.match(CTA, /\{\{ cd_P\.cta_webapp_try \}\}/)
		assert.equal(`${parts.cta_webapp_try} →`, textOf(hero), `${lang}: cta_webapp_try がヒーローの文と違う`)
	}
})

test('説明の行: 対応ブラウザとお試しの上限の文を残し、リンクを持たない', () => {
	// Act
	const line = CTA.match(/<p[^>]*>[^\n]*cta_webapp_line[^\n]*<\/p>/)?.[0]

	// Assert
	assert.ok(line, 'Web 版の説明の行が無い')
	assert.doesNotMatch(line, /<a\b/)
	assert.match(line, /インストール不要の Web 版（Chrome \/ Edge 対応）もご利用いただけます。/)
})

test('呼び出し側は副ボタンの引数を渡さず、英中の parts.yml の cta_ のキーは全部 include が使う', () => {
	const pages = ['', 'price/', 'spec/'].flatMap((p) => ['', 'en/', 'zh-tw/'].map((l) => `${l}${p}index.html`))
	for (const rel of pages) {
		const m = read(rel).match(/\{%\s*include cta-download\.html([^%]*)%\}/)
		assert.ok(m, `${rel}: cta-download.html が無い`)
		assert.doesNotMatch(m[1], /secondary_/, `${rel}: 副ボタンの引数が残っている`)
	}
	for (const lang of ['en', 'zh-tw']) {
		const keys = Object.keys(parseFlatYaml(read(`_data/l10n/${lang}/parts.yml`))).filter((k) => k.startsWith('cta_'))
		assert.ok(keys.length > 0)
		for (const k of keys) assert.ok(CTA.includes(`cd_P.${k}`), `${lang}: ${k} を include が使っていない`)
	}
})

test('ヘルパー: 該当が無ければ null', () => {
	assert.equal(linkOf('<a href="/" data-dl="hero">x</a>', 'cta-webapp'), null)
	assert.equal(rowOf('<div class="x"><a data-dl="hero-store"></a></div>', 'cta-store'), null)
	assert.equal(classOf(openTagOf('<div class="a b">x</div>')), 'a b')
	assert.equal(textOf('{% if x %}{{ y }}{% else %}文{% endif %} <span aria-hidden="true">→</span>'), '文 →')
})
