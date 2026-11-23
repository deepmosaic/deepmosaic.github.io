// docs の検査 (scripts/check-docs.mjs・src/lib/docs-check.js) の 3 言語の仕様テスト。
//
//   node --test src/lib/docs-check-langs.test.js
//
//   - 対象は /docs/・/docs/web/ と、生成されていれば /en/docs/・/en/docs/web/・/zh-tw/docs/・/zh-tw/docs/web/
//   - 深いリンクは言語つきのページの id で判定する (/en/docs/#x は英語のページの id)
//   - 契約の id と目次の検査は 3 言語とも。英中の目次 (_data/l10n/<lang>/docs_toc.yml) は id の並びが日本語と同じ
//   - 言語別の画像の置き場 (assets/img/screenshots/<lang>/) があっても無くても通る
//   - --fix-dims は _includes/docs/ の下の言語のフォルダにも効く
//   - fixture の `_site` は一時ディレクトリに作る (リポの `_site` は読まない)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
	DOCS_LANGS,
	LEGACY_DOCS_IDS,
	compareTocIds,
	docsPagePath,
	docsPages,
	extractDocsDeepLinks,
} from './docs-check.js'
import { checkDocsSite, fixDocsDims } from '../../scripts/check-docs.mjs'

function makeTree(files) {
	const dir = mkdtempSync(join(tmpdir(), 'docs-check-langs-'))
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(dir, rel)
		mkdirSync(dirname(abs), { recursive: true })
		writeFileSync(abs, body)
	}
	return dir
}

/** 幅と高さを持つ最小の WebP (VP8X) のヘッダ。 */
function webp(width, height) {
	const b = Buffer.alloc(30)
	b.write('RIFF', 0, 'ascii')
	b.write('WEBP', 8, 'ascii')
	b.write('VP8X', 12, 'ascii')
	const w = width - 1
	const h = height - 1
	b[24] = w & 0xff
	b[25] = (w >> 8) & 0xff
	b[26] = (w >> 16) & 0xff
	b[27] = h & 0xff
	b[28] = (h >> 8) & 0xff
	b[29] = (h >> 16) & 0xff
	return b
}

const TOC = `desktop:
  - title: 導入
    items:
      - { id: about, label: はじめに }
      - { id: layout, label: 画面の構成 }
web:
  - title: Web 版
    items:
      - { id: about, label: はじめに }
      - { id: start, label: 始め方 }
`

const DESKTOP_IDS = [...LEGACY_DOCS_IDS, 'layout']
const WEB_IDS = ['about', 'start']

/** docs のビルド出力の最小の形 (ヘッダー・目次の島・節・フッター)。 */
function docsHtml(ids, extra = '') {
	const sections = ids.map((id) => `<section id="${id}"><h2>${id}</h2></section>`).join('\n')
	return `<!doctype html><header><img src="/logo.png"></header><div data-island="scrollspy">\n${sections}\n${extra}</div><footer><img src="/icon.png"></footer>\n`
}

/** ja の 2 ページと目次だけの最小のリポ。 */
function baseFiles(extra = {}) {
	return {
		'_data/docs_toc.yml': TOC,
		'_site/docs/index.html': docsHtml(DESKTOP_IDS, '<a href="#plan">plan</a>'),
		'_site/docs/web/index.html': docsHtml(WEB_IDS),
		'_site/index.html': '<a href="/docs/#plan">docs</a>',
		...extra,
	}
}

// ---------------------------------------------------------------- 純ロジック

test('docsPagePath / docsPages: 3 言語 × Desktop 版・Web 版の 6 ページ、ja は接頭辞なし', () => {
	assert.deepEqual(DOCS_LANGS, ['ja', 'en', 'zh-tw'])
	assert.equal(docsPagePath('ja', 'desktop'), '/docs/')
	assert.equal(docsPagePath('ja', 'web'), '/docs/web/')
	assert.equal(docsPagePath('en', 'desktop'), '/en/docs/')
	assert.equal(docsPagePath('zh-tw', 'web'), '/zh-tw/docs/web/')
	const pages = docsPages()
	assert.equal(pages.length, 6)
	assert.deepEqual(pages[0], { lang: 'ja', kind: 'desktop', page: '/docs/', file: 'docs/index.html' })
	assert.deepEqual(pages.find((p) => p.page === '/en/docs/web/'), { lang: 'en', kind: 'web', page: '/en/docs/web/', file: 'en/docs/web/index.html' })
})

test('extractDocsDeepLinks: 言語の接頭辞つきの深いリンクはその言語のページとして返し、ほかの接頭辞は docs と数えない', () => {
	const text = [
		'<a href="/docs/#usage">',
		'<a href="/en/docs/#plan">',
		'<a href="/en/docs#trouble">',
		'<a href="/zh-tw/docs/web/#requirements">',
		'[x](https://www.deepmosaic.co.jp/en/docs/#team)',
		'[y](https://www.deepmosaic.co.jp/docs/web/#start)',
		'<a href="/fr/docs/#about">',
		'<a href="/company/docs/#about">',
		'<a href="/en/docs/">',
	].join('\n')
	assert.deepEqual(extractDocsDeepLinks(text), [
		{ page: '/docs/', id: 'usage' },
		{ page: '/en/docs/', id: 'plan' },
		{ page: '/en/docs/', id: 'trouble' },
		{ page: '/zh-tw/docs/web/', id: 'requirements' },
		{ page: '/en/docs/', id: 'team' },
		{ page: '/docs/web/', id: 'start' },
	])
})

test('compareTocIds: 英中の目次の id の並びが日本語と同じなら []、違えば言語のページの名前つきで返す', () => {
	assert.deepEqual(compareTocIds('/en/docs/', ['a', 'b'], ['a', 'b']), [])
	const swapped = compareTocIds('/en/docs/', ['a', 'b'], ['b', 'a'])
	assert.equal(swapped.length, 1)
	assert.match(swapped[0], /^\/en\/docs\/: 目次/)
	assert.equal(compareTocIds('/zh-tw/docs/web/', ['a', 'b'], ['a']).length, 1)
})

// ---------------------------------------------------------------- checkDocsSite

test('checkDocsSite: 英中のページがまだ無ければ日本語の 2 ページだけを見て通る', () => {
	const dir = makeTree(baseFiles())
	try {
		const r = checkDocsSite(dir)
		assert.deepEqual(r.problems, [])
		assert.deepEqual(r.pages, ['/docs/', '/docs/web/'])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('checkDocsSite: 日本語のページが無ければ問題にする (陽性対照)', () => {
	const files = baseFiles()
	delete files['_site/docs/web/index.html']
	const dir = makeTree(files)
	try {
		assert.ok(checkDocsSite(dir).problems.some((p) => p.includes('/docs/web/')))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('checkDocsSite: 英中のページも契約の id・目次の id・ページ内リンクを見る', () => {
	const dir = makeTree(
		baseFiles({
			'_site/en/docs/index.html': docsHtml(DESKTOP_IDS.filter((id) => id !== 'trouble' && id !== 'layout'), '<a href="#nowhere">x</a>'),
			'_site/en/docs/web/index.html': docsHtml(WEB_IDS),
			'_site/zh-tw/docs/index.html': docsHtml(DESKTOP_IDS),
		}),
	)
	try {
		const r = checkDocsSite(dir)
		assert.deepEqual(r.pages, ['/docs/', '/docs/web/', '/en/docs/', '/en/docs/web/', '/zh-tw/docs/'])
		assert.ok(r.problems.some((p) => p.startsWith('/en/docs/: ') && p.includes('契約 ID "#trouble"')), r.problems.join('\n'))
		assert.ok(r.problems.some((p) => p.startsWith('/en/docs/: ') && p.includes('目次の ID "#layout"')), r.problems.join('\n'))
		assert.ok(r.problems.some((p) => p.startsWith('/en/docs/: ') && p.includes('"#nowhere"')), r.problems.join('\n'))
		assert.equal(r.problems.filter((p) => p.startsWith('/zh-tw/') || p.startsWith('/en/docs/web/')).length, 0, r.problems.join('\n'))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('checkDocsSite: /en/docs/#x は英語のページの id で判定し、日本語にだけある id や生成されていない言語のページへのリンクを捕まえる', () => {
	const dir = makeTree(
		baseFiles({
			'_site/docs/index.html': docsHtml([...DESKTOP_IDS, 'only-ja']),
			'_site/en/docs/index.html': docsHtml(DESKTOP_IDS),
			'_site/en/docs/web/index.html': docsHtml(WEB_IDS),
			'_site/en/price/index.html': '<a href="/en/docs/#plan">ok</a><a href="/en/docs/#only-ja">x</a><a href="/docs/#only-ja">ja</a>',
			'_site/llms.txt': '- https://www.deepmosaic.co.jp/zh-tw/docs/#trouble\n',
		}),
	)
	try {
		const { problems } = checkDocsSite(dir)
		const norm = problems.map((p) => p.replace(/\\/g, '/'))
		assert.ok(norm.some((p) => p.startsWith('en/price/index.html: /en/docs/#only-ja')), norm.join('\n'))
		assert.ok(!norm.some((p) => p.includes('/en/docs/#plan')), norm.join('\n'))
		assert.ok(!norm.some((p) => p.includes(': /docs/#only-ja')), norm.join('\n'))
		assert.ok(norm.some((p) => p.startsWith('llms.txt: /zh-tw/docs/#trouble')), norm.join('\n'))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('checkDocsSite: 英中の目次 (_data/l10n/<lang>/docs_toc.yml) は id の並びが日本語と同じで、その id が英中のページにある', () => {
	const l10n = (body) => `_source: "_data/docs_toc.yml"\n_source_hash: "x"\n${body}`
	const enToc = TOC.replace('はじめに', 'Introduction')
	const files = baseFiles({
		'_site/en/docs/index.html': docsHtml(DESKTOP_IDS),
		'_site/en/docs/web/index.html': docsHtml(WEB_IDS),
		'_data/l10n/en/docs_toc.yml': l10n(enToc),
	})
	const dir = makeTree(files)
	try {
		assert.deepEqual(checkDocsSite(dir).problems, [])

		writeFileSync(join(dir, '_data/l10n/en/docs_toc.yml'), l10n(enToc.replace('{ id: start, label: 始め方 }', '{ id: begin, label: Start }')))
		const ps = checkDocsSite(dir).problems
		assert.ok(ps.some((p) => p.startsWith('/en/docs/web/: 目次')), ps.join('\n'))
		assert.ok(ps.some((p) => p.includes('目次の ID "#begin"')), ps.join('\n'))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('checkDocsSite: 言語別の画像の置き場の画像も、日本語の画像のままでも、実在と寸法を見て通る', () => {
	const img = (src) => `<img src="${src}" alt="screen" width="40" height="30">`
	const dir = makeTree(
		baseFiles({
			'_site/en/docs/index.html': docsHtml(DESKTOP_IDS, img('/assets/img/screenshots/en/home.webp')),
			'_site/zh-tw/docs/index.html': docsHtml(DESKTOP_IDS, img('/assets/img/screenshots/home.webp')),
		}),
	)
	try {
		mkdirSync(join(dir, '_site/assets/img/screenshots/en'), { recursive: true })
		writeFileSync(join(dir, '_site/assets/img/screenshots/en/home.webp'), webp(40, 30))
		writeFileSync(join(dir, '_site/assets/img/screenshots/home.webp'), webp(40, 30))
		assert.deepEqual(checkDocsSite(dir).problems, [])

		writeFileSync(join(dir, '_site/assets/img/screenshots/en/home.webp'), webp(80, 60))
		assert.ok(checkDocsSite(dir).problems.some((p) => p.startsWith('/en/docs/: ') && p.includes('80x60')))
		rmSync(join(dir, '_site/assets/img/screenshots/en/home.webp'))
		assert.ok(checkDocsSite(dir).problems.some((p) => p.startsWith('/en/docs/: 画像ファイルが無い')))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- fixDocsDims

test('fixDocsDims: _includes/docs 直下と言語のフォルダの <img> の width/height を実寸に書き換える', () => {
	const tag = (src) => `<img src="${src}" alt="a" width="1" height="1">\n`
	const dir = makeTree({
		'_includes/docs/01-intro.html': tag('/assets/img/screenshots/home.webp'),
		'_includes/docs/en/01-intro.html': tag('/assets/img/screenshots/en/home.webp'),
		'_includes/docs/zh-tw/01-intro.html': tag('/assets/img/screenshots/home.webp'),
		'_includes/other.html': tag('/assets/img/screenshots/home.webp'),
	})
	try {
		mkdirSync(join(dir, 'assets/img/screenshots/en'), { recursive: true })
		writeFileSync(join(dir, 'assets/img/screenshots/home.webp'), webp(40, 30))
		writeFileSync(join(dir, 'assets/img/screenshots/en/home.webp'), webp(64, 48))
		const changed = fixDocsDims(dir)
		assert.deepEqual(
			changed.map((c) => ({ ...c, file: c.file.replace(/\\/g, '/') })),
			[
				{ file: '_includes/docs/01-intro.html', changed: 1 },
				{ file: '_includes/docs/en/01-intro.html', changed: 1 },
				{ file: '_includes/docs/zh-tw/01-intro.html', changed: 1 },
			],
		)
		assert.match(readFileSync(join(dir, '_includes/docs/en/01-intro.html'), 'utf8'), /width="64" height="48"/)
		assert.match(readFileSync(join(dir, '_includes/docs/zh-tw/01-intro.html'), 'utf8'), /width="40" height="30"/)
		assert.match(readFileSync(join(dir, '_includes/other.html'), 'utf8'), /width="1" height="1"/, 'docs の外は触らない')
		assert.deepEqual(fixDocsDims(dir), [])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
