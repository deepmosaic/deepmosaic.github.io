import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
	LEGACY_DOCS_IDS,
	checkDocsPage,
	extractDocsContent,
	extractDocsDeepLinks,
	extractIds,
	extractImages,
	extractLocalAnchors,
	fixImageDims,
	parseTocIds,
	parseWebpSize,
} from './docs-check.js'

const sizes = { '/assets/img/a.webp': { width: 1280, height: 800 } }
const imageSize = (src) => sizes[src]

test('契約 ID は 20 個あり about と trouble を含む', () => {
	assert.equal(LEGACY_DOCS_IDS.length, 20)
	assert.ok(LEGACY_DOCS_IDS.includes('about'))
	assert.ok(LEGACY_DOCS_IDS.includes('trouble'))
})

test('extractDocsContent はヘッダーとフッターを除いた本文を返す', () => {
	const html = '<header><img src="/logo.png"></header><div data-island="scrollspy"><section id="about"></section></div><footer><img src="/icon.png"></footer>'
	const body = extractDocsContent(html)
	assert.ok(body.includes('id="about"'))
	assert.ok(!body.includes('logo.png'))
	assert.ok(!body.includes('icon.png'))
	assert.equal(extractDocsContent('<p>no docs</p>'), '<p>no docs</p>')
})

test('extractIds は id 属性を集める', () => {
	const ids = extractIds('<section id="about"><h2 id="x-1">t</h2></section><div data-id="no">')
	assert.deepEqual([...ids].sort(), ['about', 'x-1'])
})

test('extractLocalAnchors はページ内リンクだけを返す', () => {
	const html = '<a href="#plan">a</a><a href="/price">b</a><a href="#detect-options">c</a>'
	assert.deepEqual(extractLocalAnchors(html), ['plan', 'detect-options'])
})

test('extractDocsDeepLinks は /docs と /docs/web の深いリンクを区別する', () => {
	const text = [
		'<a href="/docs#plan">',
		'<a href="/docs/#usage">',
		'[x](https://www.deepmosaic.co.jp/docs/#trouble)',
		'<a href="/docs/web/#requirements">',
		'<a href="/docs/">',
	].join('\n')
	assert.deepEqual(extractDocsDeepLinks(text), [
		{ page: '/docs/', id: 'plan' },
		{ page: '/docs/', id: 'usage' },
		{ page: '/docs/', id: 'trouble' },
		{ page: '/docs/web/', id: 'requirements' },
	])
})

test('extractImages は属性を分解する', () => {
	const [img] = extractImages('<img src="/assets/img/a.webp" alt="説明" width="1280" height="800" loading="lazy">')
	assert.equal(img.src, '/assets/img/a.webp')
	assert.equal(img.alt, '説明')
	assert.equal(img.width, 1280)
	assert.equal(img.height, 800)
})

test('parseWebpSize は VP8 / VP8L / VP8X のヘッダを読む', () => {
	// VP8 (lossy): 幅 1280 高さ 800 を 14bit で格納
	const vp8 = Buffer.alloc(30)
	vp8.write('RIFF', 0, 'ascii')
	vp8.write('WEBP', 8, 'ascii')
	vp8.write('VP8 ', 12, 'ascii')
	vp8.writeUInt16LE(1280, 26)
	vp8.writeUInt16LE(800, 28)
	assert.deepEqual(parseWebpSize(vp8), { width: 1280, height: 800 })

	// VP8X: 24bit の canvas 幅 - 1 / 高さ - 1
	const vp8x = Buffer.alloc(30)
	vp8x.write('RIFF', 0, 'ascii')
	vp8x.write('WEBP', 8, 'ascii')
	vp8x.write('VP8X', 12, 'ascii')
	vp8x[24] = (1255 & 0xff)
	vp8x[25] = (1255 >> 8) & 0xff
	vp8x[27] = (897 & 0xff)
	vp8x[28] = (897 >> 8) & 0xff
	assert.deepEqual(parseWebpSize(vp8x), { width: 1256, height: 898 })

	// VP8L: 14bit の幅 - 1 / 高さ - 1 をビット詰め
	const vp8l = Buffer.alloc(30)
	vp8l.write('RIFF', 0, 'ascii')
	vp8l.write('WEBP', 8, 'ascii')
	vp8l.write('VP8L', 12, 'ascii')
	const w = 316 - 1
	const h = 260 - 1
	vp8l[21] = w & 0xff
	vp8l[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6)
	vp8l[23] = (h >> 2) & 0xff
	vp8l[24] = (h >> 10) & 0x0f
	assert.deepEqual(parseWebpSize(vp8l), { width: 316, height: 260 })

	assert.equal(parseWebpSize(Buffer.from('not a webp file at all, really not')), null)
})

test('parseTocIds は desktop / web の ID 一覧を返す', () => {
	const yaml = `# comment
desktop:
  - title: 導入
    items:
      - { id: about, label: はじめに }
      - { id: install, label: インストール } # note
web:
  - title: Web 版
    items:
      - { id: about, label: はじめに }
`
	assert.deepEqual(parseTocIds(yaml), { desktop: ['about', 'install'], web: ['about'] })
})

test('checkDocsPage は契約 ID・目次・ページ内リンク・画像属性の欠落を検出する', () => {
	const html = [
		'<section id="about"></section>',
		'<a href="#missing">x</a>',
		'<img src="/assets/img/a.webp" alt="a" width="1280" height="800">',
		'<img src="/assets/img/none.webp" alt="b" width="1" height="1">',
		'<img src="/assets/img/a.webp">',
	].join('')
	const problems = checkDocsPage({
		page: '/docs/',
		html,
		requiredIds: ['about', 'install'],
		tocIds: ['about', 'setup'],
		imageSize,
	})
	assert.ok(problems.some((p) => p.includes('"#install"')), '契約 ID の欠落')
	assert.ok(problems.some((p) => p.includes('目次の ID "#setup"')), '目次の欠落')
	assert.ok(problems.some((p) => p.includes('"#missing"')), 'ページ内リンク切れ')
	assert.ok(problems.some((p) => p.includes('画像ファイルが無い')), '画像の欠落')
	assert.ok(problems.some((p) => p.includes('alt の無い')), 'alt 欠落')
	assert.ok(problems.some((p) => p.includes('width/height の無い')), '寸法欠落')
	assert.equal(problems.filter((p) => p.includes('"#about"')).length, 0)
})

test('checkDocsPage は width/height と実寸の不一致を検出し、一致すれば合格する', () => {
	const bad = checkDocsPage({
		page: '/docs/',
		html: '<img src="/assets/img/a.webp" alt="a" width="640" height="400">',
		imageSize,
	})
	assert.equal(bad.length, 1)
	assert.match(bad[0], /640x400.*1280x800/)
	const ok = checkDocsPage({
		page: '/docs/',
		html: '<img src="/assets/img/a.webp" alt="a" width="1280" height="800">',
		imageSize,
	})
	assert.deepEqual(ok, [])
})

test('fixImageDims は width/height を実寸に書き換え、無ければ足す', () => {
	const src = [
		'<img src="/assets/img/a.webp" alt="a" width="640" height="400" loading="lazy">',
		'<img src="/assets/img/a.webp" alt="b">',
		'<img src="/assets/img/unknown.webp" alt="c" width="1" height="1">',
	].join('\n')
	const { html, changed } = fixImageDims(src, imageSize)
	assert.equal(changed, 2)
	assert.match(html, /alt="a" width="1280" height="800" loading="lazy"/)
	assert.match(html, /src="\/assets\/img\/a.webp" width="1280" height="800" alt="b"/)
	assert.match(html, /unknown\.webp" alt="c" width="1" height="1"/)
})
