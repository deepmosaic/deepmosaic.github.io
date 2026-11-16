// ビルド出力の SEO の検査 scripts/i18n/checks/seo.mjs の仕様テスト。
//
//   node --test src/lib/i18n-site-seo.test.js
//
//   - 内部リンクの形: 末尾 / はディレクトリの index.html、拡張子なしは <パス>.html (= /company/*)。
//     ディレクトリのページを末尾 / なしで指す (301 を経由する)・行き先が無い・.html を指す、はエラー
//   - sitemap.xml: 全 <url> に ISO 8601 の <lastmod>、3 件以上なら値が 2 種類以上、<loc> もリンクと同じ規則
//   - Organization の JSON-LD の sameAs: 配列・https://・GitHub と twitter:site の X を含む
//   - ?checkout= / &checkout= のリンクは rel に nofollow
//   - `_site` は読まない (一時フォルダに小さな _site の模型を作る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { makeContext } from '../../scripts/i18n/check-site.mjs'
import checkSeo from '../../scripts/i18n/checks/seo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ORIGIN = 'https://www.deepmosaic.co.jp'

const ORG = (sameAs) =>
	`<script type="application/ld+json">\n${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${ORIGIN}/#organization`,
		sameAs,
	})}\n</script>`
const GOOD_SAME_AS = ['https://github.com/deepmosaic', 'https://x.com/deepmosaic']

function page({ body = '', head = '', twitter = '@deepmosaic', org = ORG(GOOD_SAME_AS) } = {}) {
	const tw = twitter ? `<meta name="twitter:site" content="${twitter}">` : ''
	return `<html><head>${tw}${head}${org}</head><body>${body}</body></html>`
}

function sitemap(entries) {
	const urls = entries
		.map(([loc, lastmod]) => `<url><loc>${loc}</loc>${lastmod === undefined ? '' : `<lastmod>${lastmod}</lastmod>`}</url>`)
		.join('\n')
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const GOOD_SITEMAP = sitemap([
	[`${ORIGIN}/`, '2026-11-14T10:00:00+09:00'],
	[`${ORIGIN}/price/`, '2026-11-15T01:02:03Z'],
	[`${ORIGIN}/company/about`, '2026-11-01T00:00:00+09:00'],
])

/** 行き先として必ずある最小のファイル群 (陽性対照の土台)。 */
function baseFiles() {
	return {
		'index.html': page({ body: '<a href="/">home</a>' }),
		'price/index.html': page(),
		'docs/index.html': page(),
		'spec/index.html': page(),
		'en/price/index.html': page(),
		'en/spec/index.html': page(),
		'company/about.html': page(),
		'assets/img/a.webp': 'x',
		'sitemap.xml': GOOD_SITEMAP,
	}
}

function run(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-seo-'))
	try {
		for (const [rel, text] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), text)
		}
		return checkSeo(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

/** baseFiles に、body を持つページ 1 枚 (probe.html) と上書きを足して回す。 */
function runWith({ body = '', files = {}, probe = {} } = {}) {
	return run({ ...baseFiles(), 'probe.html': page({ body, ...probe }), ...files })
}

// ---- 1. 陽性対照 ----

test('seo: 正しい模型ではエラー 0', () => {
	const body = [
		'<a href="/price/">p</a>',
		'<a href="/docs/#plan">d</a>',
		'<a href="/company/about">c</a>',
		'<a href="/en/price/">e</a>',
		`<a href="${ORIGIN}/price/">abs</a>`,
		'<a href="//cdn.example/x.js">cdn</a>',
		'<a href="https://app.deepmosaic.co.jp/?checkout=light" data-dl="subscribe-light-webapp" rel="nofollow">buy</a>',
		'<a href="/assets/img/a.webp">img</a>',
		'<a href="#top">top</a>',
		'<a href="mailto:a@example.com">mail</a>',
		`<div data-links='[{"label":"x","href":"/price/"},{"label":"y","href":"${ORIGIN}/spec/"}]'></div>`,
		'<script type="application/json" data-i18n-switch data-lang-links>[{"href":"/en/spec/"}]</script>',
	].join('\n')
	assert.deepEqual(runWith({ body }), [])
})

// ---- 2. 失敗系 (リンクの形) ----

function oneError(body, pattern) {
	const errors = runWith({ body })
	assert.equal(errors.length, 1, `エラーが 1 件でない: ${JSON.stringify(errors)}`)
	assert.match(errors[0], pattern)
	return errors[0]
}

test('seo: ディレクトリのページを末尾 / なしで指すと 301 のエラー (ページのパスと href を含む)', () => {
	const e = oneError('<a href="/price">p</a>', /301/)
	assert.ok(e.includes('probe.html'), e)
	assert.ok(e.includes('/price'), e)
})

test('seo: # とクエリを外して判定する (/docs#usage・/en/spec?x=1)', () => {
	assert.ok(oneError('<a href="/docs#usage">d</a>', /301/).includes('/docs#usage'))
	assert.ok(oneError('<a href="/en/spec?x=1">s</a>', /301/).includes('/en/spec?x=1'))
})

test('seo: 自分のドメインの絶対 URL も見る', () => {
	oneError(`<a href="${ORIGIN}/spec">s</a>`, /301/)
})

test('seo: 行き先が無い (/company/about/・/nothing/・存在しない画像)', () => {
	oneError('<a href="/company/about/">c</a>', /行き先が無い/)
	oneError('<a href="/nothing/">n</a>', /行き先が無い/)
	oneError('<a href="/assets/img/missing.webp">m</a>', /行き先が無い/)
})

test('seo: .html を指すリンクはエラー', () => {
	oneError('<a href="/index.html">i</a>', /\.html/)
	oneError('<a href="/company/about.html">c</a>', /\.html/)
})

test('seo: data-links の JSON と data-lang-links の JSON の href も見る', () => {
	oneError(`<div data-links='[{"label":"x","href":"/price"}]'></div>`, /301/)
	oneError('<script type="application/json" data-lang-links>[{"href":"/spec"}]</script>', /301/)
})

// ---- 3. 失敗系 (sitemap) ----

test('seo: sitemap.xml が無いとエラー 1 件', () => {
	const files = baseFiles()
	delete files['sitemap.xml']
	const errors = run(files)
	assert.equal(errors.length, 1, JSON.stringify(errors))
	assert.match(errors[0], /sitemap/)
})

test('seo: lastmod の無い url はエラー (loc を含む)', () => {
	const sm = sitemap([
		[`${ORIGIN}/`, '2026-11-14T10:00:00+09:00'],
		[`${ORIGIN}/price/`, undefined],
	])
	const errors = runWith({ files: { 'sitemap.xml': sm } })
	assert.equal(errors.length, 1, JSON.stringify(errors))
	assert.ok(errors[0].includes(`${ORIGIN}/price/`), errors[0])
	assert.match(errors[0], /lastmod/)
})

test('seo: lastmod が日付だけ・/ 区切りはエラー', () => {
	for (const bad of ['2026-11-15', '2026/11/15']) {
		const sm = sitemap([
			[`${ORIGIN}/`, '2026-11-14T10:00:00+09:00'],
			[`${ORIGIN}/price/`, bad],
		])
		const errors = runWith({ files: { 'sitemap.xml': sm } })
		assert.equal(errors.length, 1, `${bad}: ${JSON.stringify(errors)}`)
		assert.ok(errors[0].includes(bad), errors[0])
	}
})

test('seo: url が 3 件で lastmod が全部同じならエラー 1 件、2 件で同じならエラーなし (境界)', () => {
	const t = '2026-11-14T10:00:00+09:00'
	const three = sitemap([
		[`${ORIGIN}/`, t],
		[`${ORIGIN}/price/`, t],
		[`${ORIGIN}/company/about`, t],
	])
	const e3 = runWith({ files: { 'sitemap.xml': three } })
	assert.equal(e3.length, 1, JSON.stringify(e3))
	assert.match(e3[0], /lastmod/)
	const two = sitemap([
		[`${ORIGIN}/`, t],
		[`${ORIGIN}/price/`, t],
	])
	assert.deepEqual(runWith({ files: { 'sitemap.xml': two } }), [])
})

test('seo: sitemap の loc もリンクと同じ規則で見る', () => {
	const sm = sitemap([
		[`${ORIGIN}/`, '2026-11-14T10:00:00+09:00'],
		[`${ORIGIN}/price`, '2026-11-15T10:00:00+09:00'],
	])
	const errors = runWith({ files: { 'sitemap.xml': sm } })
	assert.equal(errors.length, 1, JSON.stringify(errors))
	assert.match(errors[0], /301/)
	assert.ok(errors[0].includes('sitemap.xml'), errors[0])
})

// ---- 4. 失敗系 (sameAs) ----

test('seo: sameAs に X が無い (twitter:site は @deepmosaic) とエラー', () => {
	const errors = runWith({ probe: { org: ORG(['https://github.com/deepmosaic']) } })
	assert.equal(errors.length, 1, JSON.stringify(errors))
	assert.ok(errors[0].includes('https://x.com/deepmosaic'), errors[0])
	assert.ok(errors[0].includes('probe.html'), errors[0])
})

test('seo: twitter:site と sameAs の X が一致しないとエラー', () => {
	const errors = runWith({ probe: { twitter: '@other' } })
	assert.equal(errors.length, 1, JSON.stringify(errors))
	assert.ok(errors[0].includes('https://x.com/other'), errors[0])
})

test('seo: sameAs が配列でない・http:// の要素・JSON-LD が壊れている、はそれぞれエラー', () => {
	for (const org of [
		ORG('https://github.com/deepmosaic'),
		ORG([...GOOD_SAME_AS, 'http://example.com/deepmosaic']),
		'<script type="application/ld+json">{"@type": "Organization", "sameAs": [</script>',
	]) {
		const errors = runWith({ probe: { org } })
		assert.ok(errors.length >= 1, `エラーにならない: ${org}`)
		assert.ok(errors.every((e) => e.includes('probe.html')), JSON.stringify(errors))
	}
})

test('seo: Organization の JSON-LD が無いページはエラーなし (他の JSON-LD だけでも)', () => {
	const other = '<script type="application/ld+json">{"@type":"FAQPage"}</script>'
	assert.deepEqual(runWith({ probe: { org: other } }), [])
	assert.deepEqual(runWith({ probe: { org: '' } }), [])
})

// ---- 5. 失敗系 (nofollow) ----

test('seo: ?checkout= / &checkout= のリンクは rel に nofollow が要る', () => {
	oneError('<a href="https://app.deepmosaic.co.jp/?checkout=pro">x</a>', /nofollow/)
	oneError('<a href="https://app.deepmosaic.co.jp/?checkout=pro" rel="noopener">x</a>', /nofollow/)
	oneError('<a href="https://app.deepmosaic.co.jp/?foo=1&checkout=light">x</a>', /nofollow/)
	oneError('<a href="https://app.deepmosaic.co.jp/?foo=1&amp;checkout=light">x</a>', /nofollow/)
	assert.deepEqual(runWith({ body: '<a rel="noopener nofollow" href="https://app.deepmosaic.co.jp/?checkout=pro">x</a>' }), [])
	assert.deepEqual(runWith({ body: '<a href="https://app.deepmosaic.co.jp/?checkoutx=1">x</a>' }), [])
})

// ---- 6. 例外を投げない ----

test('seo: 空の _site でも配列を返す (sitemap が無いエラーだけ)', () => {
	const errors = run({})
	assert.ok(Array.isArray(errors))
	assert.equal(errors.length, 1, JSON.stringify(errors))
})
