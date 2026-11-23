// 英中の docs のページの出力の検査 (scripts/i18n/checks/pages-docs.mjs) の仕様テスト。
//
//   node --test src/lib/i18n-site-pages-docs.test.js
//
//   - 英中の docs のページが無いあいだは何も言わない
//   - 本文の id の並び・目次・ページ内リンクの数・data-dl・画像の数・表の行 (kv-row) の数・<details> の数を日本語のページと比べる
//   - 置き換え漏れのプレースホルダ・Web 版へのリンクの表示言語・法務へのリンクの印・訳のあるページへのリンクの接頭辞を見る
//   - fixture の `_site` は一時ディレクトリに作る (リポの `_site` は読まない。台帳と言語の辞書はリポのものを読む)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import check, { bodyOf, docsStructure, tocsOf, DOCS_PAGES } from '../../scripts/i18n/checks/pages-docs.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const BADGE = { en: '(Japanese)', 'zh-tw': '（日文）' }
const HTML_LANG = { ja: 'ja', en: 'en', 'zh-tw': 'zh-Hant-TW' }

/** docs のページの出力の fixture。opts で本文の部品を変える */
function page(lang, opts = {}) {
	const o = {
		toc: ['about', 'install'],
		ids: ['about', 'install'],
		imgs: 2,
		kv: 2,
		details: 1,
		dl: ['docs-install'],
		extra: '',
		...opts,
	}
	const prefix = lang === 'ja' ? '' : `/${lang}`
	const tocList = o.toc.map((id) => `<li><a href="#${id}">${id}</a></li>`).join('')
	const legal =
		lang === 'ja'
			? '<a href="/company/privacy">privacy</a>'
			: `<a href="/company/privacy" class="x" hreflang="ja">privacy</a><span class="ml-1" title="t">${BADGE[lang]}</span>`
	const web = lang === 'ja' ? 'https://app.deepmosaic.co.jp/' : `https://app.deepmosaic.co.jp/?lang=${lang === 'en' ? 'en' : 'zh-TW'}`
	const sections = o.ids.map((id) => `<section id="${id}"><h2>${id}</h2><a href="#${o.ids[0]}">top</a></section>`).join('\n')
	return [
		`<!doctype html><html lang="${HTML_LANG[lang]}"><head><link rel="canonical" href="https://www.deepmosaic.co.jp${prefix}/docs/"></head><body>`,
		'<header><a href="#about">skip</a><img src="/logo.webp"><a data-dl="header" href="/download/">dl</a></header>',
		`<nav aria-label="toc" class="docs-toc sticky"><ul>${tocList}</ul></nav>`,
		`<details class="docs-toc mt-5"><summary>toc</summary><ul>${tocList}</ul></details>`,
		sections,
		'<div class="kv-row"><div>k</div></div>'.repeat(o.kv),
		'<img src="/assets/img/screenshots/a.webp" alt="a">'.repeat(o.imgs),
		'<details><summary>q</summary><p>a</p></details>'.repeat(o.details - 1),
		o.dl.map((d) => `<a data-dl="${d}" href="/download/">dl</a>`).join(''),
		`<p>${legal} <a href="${web}">web</a> <a href="${prefix}/price/">price</a> <a href="${prefix}/docs/web/">web docs</a></p>`,
		o.extra,
		'<footer><a href="/company/terms">terms</a><img src="/f.webp"><details><summary>x</summary></details></footer>',
		'</body></html>',
	].join('\n')
}

function siteOf(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-pages-docs-'))
	for (const [rel, body] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true })
		writeFileSync(join(dir, rel), body)
	}
	return dir
}

function run(files) {
	const dir = siteOf(files)
	try {
		return check(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

/** ja・en・zh-tw の 2 ページずつの _site (overrides でファイルごとに差し替える) */
function fullSite(overrides = {}) {
	const files = {}
	for (const rel of DOCS_PAGES) {
		files[rel] = page('ja')
		for (const lang of ['en', 'zh-tw']) files[`${lang}/${rel}`] = page(lang)
	}
	return { ...files, ...overrides }
}

test('pages-docs: 英中の docs のページが無ければ何も言わない (日本語のページだけの今の出力)', () => {
	assert.deepEqual(run({ 'docs/index.html': page('ja'), 'docs/web/index.html': page('ja') }), [])
})

test('pages-docs: 日本語と同じ構造で、リンクの決まりを守っていれば合格 (陽性対照)', () => {
	assert.deepEqual(run(fullSite()), [])
})

test('pages-docs: レイアウトを通っていない (canonical の無い) ページは見ない', () => {
	const bad = page('en', { ids: ['x'] }).replace(/<link rel="canonical"[^>]*>/, '')
	assert.deepEqual(run(fullSite({ 'en/docs/index.html': bad })), [])
})

test('pages-docs: 本文の構造の違いを項目ごとに捕まえる (陰性対照)', () => {
	const cases = [
		[{ ids: ['about', 'setup'] }, 'id の並び'],
		[{ toc: ['install', 'about'] }, '目次の並び'],
		[{ imgs: 1 }, '画像の数'],
		[{ kv: 3 }, '表の行 (kv-row) の数'],
		[{ details: 2 }, '<details> の数'],
		[{ dl: ['docs-install', 'docs-install-store'] }, 'data-dl の並び'],
		[{ extra: '<a href="#about">more</a>' }, 'ページ内リンクの数'],
	]
	for (const [opts, label] of cases) {
		const errors = run(fullSite({ 'en/docs/index.html': page('en', opts) }))
		assert.ok(
			errors.some((e) => e.startsWith('en/docs/index.html: ') && e.includes(label) && e.includes('docs/index.html と違う')),
			`${label}: ${JSON.stringify(errors)}`,
		)
	}
})

test('pages-docs: ヘッダーとフッターの中の違いは数えない (本文だけを比べる)', () => {
	const en = page('en').replace('<footer>', '<footer><img src="/g.webp"><a href="#top">t</a><details></details>')
	assert.deepEqual(run(fullSite({ 'en/docs/index.html': en })), [])
})

test('pages-docs: <html lang> の違い・置き換え漏れのプレースホルダを捕まえる', () => {
	const errors = run(
		fullSite({
			'zh-tw/docs/web/index.html': page('zh-tw', { extra: '<p>%%PLAN_NAME%%</p>' }).replace('lang="zh-Hant-TW"', 'lang="zh-TW"'),
		}),
	)
	assert.ok(errors.some((e) => e.includes('zh-tw/docs/web/index.html: <html lang> が "zh-Hant-TW" でない')))
	assert.ok(errors.some((e) => e.includes('zh-tw/docs/web/index.html: 置き換え漏れのプレースホルダがある: %%PLAN_NAME%%')))
})

test('pages-docs: Web 版へのリンクの表示言語の欠け・違いを捕まえる', () => {
	const errors = run(
		fullSite({
			'en/docs/index.html': page('en').replace('?lang=en', ''),
			'zh-tw/docs/index.html': page('zh-tw').replace('?lang=zh-TW', '?lang=en'),
		}),
	)
	assert.ok(errors.some((e) => e.startsWith('en/docs/index.html: Web 版へのリンクに lang=en がちょうど 1 つでない')))
	assert.ok(errors.some((e) => e.startsWith('zh-tw/docs/index.html: Web 版へのリンクに lang=zh-TW がちょうど 1 つでない')))
})

test('pages-docs: 法務へのリンクが日本語のページ用の部品を通っていないことを捕まえる (hreflang・印・接頭辞)', () => {
	const noBadge = page('en').replace('<span class="ml-1" title="t">(Japanese)</span>', '')
	const noHreflang = page('en').replace(' hreflang="ja"', '')
	const prefixed = page('en', { extra: '<a href="/en/company/terms" hreflang="ja">terms</a>(Japanese)' })
	assert.ok(run(fullSite({ 'en/docs/index.html': noBadge })).some((e) => e.includes('/company/privacy に日本語のページの印 ((Japanese)) が無い')))
	assert.ok(run(fullSite({ 'en/docs/index.html': noHreflang })).some((e) => e.includes('/company/privacy に hreflang="ja" が無い')))
	assert.ok(run(fullSite({ 'en/docs/index.html': prefixed })).some((e) => e.includes('法務のページへのリンクが ja の URL でない') && e.includes('/en/company/terms')))
})

test('pages-docs: 印がリンクの中にあっても通る (ja-link.html の inside=true)', () => {
	const inside = page('zh-tw').replace(
		/<a href="\/company\/privacy"[^>]*>privacy<\/a><span[^>]*>（日文）<\/span>/,
		'<a href="/company/privacy" class="btn" hreflang="ja" title="t">privacy<span class="text-[11px]">（日文）</span></a>',
	)
	assert.deepEqual(run(fullSite({ 'zh-tw/docs/index.html': inside })), [])
})

test('pages-docs: 訳のあるページ (台帳の鍵と docs) へのリンクに言語の接頭辞が無いことを捕まえる', () => {
	const en = page('en', { extra: '<a href="/docs/#trouble">t</a><a href="/enterprise/inquiry/">i</a><a href="/">top</a><a href="/download/latest/windows">d</a><a href="/assets/x.pdf">x</a>' })
	const errors = run(fullSite({ 'en/docs/index.html': en })).filter((e) => e.includes('訳のあるページへのリンクに /en が無い'))
	assert.deepEqual(
		errors.map((e) => e.split(': ').pop()),
		['/docs/#trouble', '/enterprise/inquiry/', '/'],
	)
})

test('pages-docs: 日本語のページが生成されていなければ構造は比べない (リンクの検査は行う)', () => {
	const files = fullSite({ 'en/docs/index.html': page('en', { ids: ['x'], extra: '<a href="/price/">p</a>' }) })
	delete files['docs/index.html']
	const errors = run(files)
	assert.ok(!errors.some((e) => e.includes('と違う')))
	assert.ok(errors.some((e) => e.includes('訳のあるページへのリンクに /en が無い: /price/')))
})

test('bodyOf / tocsOf / docsStructure: ヘッダーの後からフッターの手前までを数え、目次は .docs-toc ごとに並べる', () => {
	const html = page('ja')
	const body = bodyOf(html)
	assert.ok(!body.includes('<header') && !body.includes('<footer'))
	assert.deepEqual(tocsOf(body), [
		['about', 'install'],
		['about', 'install'],
	])
	const s = docsStructure(body)
	assert.deepEqual(s.ids, ['about', 'install'])
	assert.equal(s.imgs, 2)
	assert.equal(s.kvRows, 2)
	assert.equal(s.details, 1)
	assert.deepEqual(s.dataDl, ['docs-install'])
	assert.equal(s.inPageLinks, 6)
})
