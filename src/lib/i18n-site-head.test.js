// T-2203 (i18n1112 I18N-705, 2026-11-12) サイトの head の多言語化 (html lang・og:locale・hreflang・canonical・JSON-LD・訳の台帳) の仕様テスト。
//
//   node --test src/lib/i18n-site-head.test.js
//
//   - 訳の台帳 `_data/i18n_pages.yml`: 鍵は ja のパス 9 本、値は全部 [en, zh-tw]。隣に desktop があれば SITE_TRANSLATED_PATHS と照合
//   - 台帳の鍵の ja のページがソースに実在する (front matter の permalink か置き場所から求めた URL)
//   - layout / schema のソース: x-default の hreflang が en を向く、ja 固定 (`site.data.lang.ja.`) の参照が残っていない
//   - 既存のテストがソースを照合している式 (faq の 2 行・gtag・no_tracking) を残している
//   - check-site のモジュール `scripts/i18n/checks/head.mjs` の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

import check, { parseLedger } from '../../scripts/i18n/checks/head.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import { readFrontMatter } from '../../scripts/i18n/source-hash.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const ORIGIN = 'https://www.deepmosaic.co.jp'

/** 台帳の鍵 (W7-site.md §1。ja のパス 9 本 = アプリの SITE_TRANSLATED_PATHS 8 本 + /company/about) */
const LEDGER_KEYS = [
	'/',
	'/price/',
	'/spec/',
	'/subscribe/',
	'/join/',
	'/contact/',
	'/enterprise/inquiry/',
	'/mosaic-removal/',
	'/company/about',
]

const ledger = parseLedger(read('_data/i18n_pages.yml'))

// ---- 1. 台帳 ----

test('台帳: 鍵が ja のパス 9 本と一致する', () => {
	assert.deepEqual([...ledger.keys()].sort(), [...LEDGER_KEYS].sort())
})

test('台帳: 値が全部 [en, zh-tw]', () => {
	for (const [key, langs] of ledger) assert.deepEqual(langs, ['en', 'zh-tw'], `${key} の値`)
})

test('台帳: 先頭のコメントにアプリの SITE_TRANSLATED_PATHS と /company/about の関係を書いてある', () => {
	const text = read('_data/i18n_pages.yml')
	assert.match(text, /SITE_TRANSLATED_PATHS/)
	assert.match(text, /\/company\/about/)
})

const DESKTOP_SITE_URL = join(ROOT, '..', 'desktop', 'src', 'lib', 'i18n', 'site-url.ts')
test(
	'台帳: 隣の desktop の SITE_TRANSLATED_PATHS (8 本) が 台帳の鍵 − /company/about と一致する',
	{ skip: existsSync(DESKTOP_SITE_URL) ? false : 'desktop の site-url.ts が隣に無い' },
	() => {
		const src = readFileSync(DESKTOP_SITE_URL, 'utf8')
		const block = src.match(/SITE_TRANSLATED_PATHS\s*=\s*\[([\s\S]*?)\]/)
		assert.ok(block, 'SITE_TRANSLATED_PATHS が読めない')
		const paths = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
		assert.deepEqual(paths, LEDGER_KEYS.filter((k) => k !== '/company/about').sort())
	},
)

test('parseLedger: 引用符付きの鍵・フロー形式の配列・コメントを読む', () => {
	const m = parseLedger('# c\n"/": [en, zh-tw]\n"/a/": [ "en" ]  # x\n\n')
	assert.deepEqual([...m.entries()], [
		['/', ['en', 'zh-tw']],
		['/a/', ['en']],
	])
	assert.throws(() => parseLedger('/x/: en\n'), /読めない/)
})

// ---- 2. 台帳の鍵の ja のページが実在する ----

const SKIP_DIRS = new Set(['_site', 'node_modules', '_includes', '_layouts', '_data', 'en', 'zh-tw', 'e2e', 'src', 'scripts', 'assets', 'vendor', '.git', 'docs_draft', 'test-results', 'playwright-report', '.jekyll-cache'])

/** ja のソースのページの URL の集合 (permalink か置き場所から求める) */
function jaPageUrls() {
	const urls = new Set()
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const abs = join(dir, name)
			const rel = relative(ROOT, abs).split(sep).join('/')
			if (statSync(abs).isDirectory()) {
				if (!SKIP_DIRS.has(name) && !name.startsWith('.')) walk(abs)
				continue
			}
			if (!/\.(html|md)$/.test(name)) continue
			const text = readFileSync(abs, 'utf8')
			if (!/^---\r?\n/.test(text)) continue
			const fm = readFrontMatter(text)
			if (fm.permalink) {
				urls.add(fm.permalink)
			} else if (/(^|\/)index\.(html|md)$/.test(rel)) {
				urls.add(`/${rel.replace(/index\.(html|md)$/, '')}`)
			} else {
				urls.add(`/${rel.replace(/\.(html|md)$/, '')}`)
			}
		}
	}
	walk(ROOT)
	return urls
}

test('台帳: 鍵の全部に ja のページがソースに実在する', () => {
	const urls = jaPageUrls()
	assert.ok(urls.has('/') && urls.has('/price/'), '陽性対照: トップと料金が見つかる')
	for (const key of ledger.keys()) assert.ok(urls.has(key), `${key} の ja のページが無い`)
	assert.ok(!urls.has('/no-such-page/'), '陰性対照: ソースに無いパスは見つからない')
})

// ---- 3. layout と schema のソース ----

const layout = read('_layouts/default.html')
const swApp = read('_includes/schema/software-application.html')
const breadcrumb = read('_includes/schema/breadcrumb.html')
const faqSchema = read('_includes/schema/faq.html')

test('layout: hreflang="x-default" があり、その href が /en を含む', () => {
	const tag = layout.match(/<link\b[^>]*hreflang="x-default"[^>]*>/)
	assert.ok(tag, 'x-default の hreflang が無い')
	assert.match(tag[0], /href="https:\/\/www\.deepmosaic\.co\.jp\/en\{\{/)
})

test('layout: hreflang の 4 本 (ja・en・zh-Hant-TW・x-default) を 1 行に 1 本ずつ書いてある', () => {
	for (const lang of ['ja', 'en', 'zh-Hant-TW', 'x-default']) {
		assert.match(layout, new RegExp(`^<link rel="alternate" hreflang="${lang}" href="[^"]+" />$`, 'm'), `${lang} の行`)
	}
	assert.equal((layout.match(/hreflang="/g) ?? []).length, 4)
})

test('layout / software-application: ja 固定の参照 (site.data.lang.ja.) が残っていない', () => {
	assert.doesNotMatch(layout, /site\.data\.lang\.ja\./)
	assert.doesNotMatch(swApp, /site\.data\.lang\.ja\./)
})

test('layout: html lang・og:locale・og:locale:alternate・image alt をページの言語から出す', () => {
	assert.match(layout, /<html lang="\{\{ site\.data\.lang\[page\.lang\]\.my_lang \}\}"/)
	assert.match(layout, /<meta property="og:locale" content="\{\{ L\.og_lang \}\}" \/>/)
	assert.match(layout, /^<meta property="og:locale:alternate" content="[^"]+" \/>$/m)
	assert.match(layout, /\{%- assign L = site\.data\.lang\[page\.lang\] -%\}/)
	assert.match(layout, /page_desc = page\.description \| default: L\.meta_desc/)
	assert.equal((layout.match(/L\.og_image_alt \| default: site\.data\.site\.seo\.og_image_alt/g) ?? []).length, 2)
	assert.match(layout, /L\.seo_brand_suffix/)
	assert.match(layout, /\{\{ page\.title \}\}｜\{\{ site\.data\.site\.seo\.brand_suffix \}\}/, 'ja の既定のタイトルの式を残す')
})

test('layout: 既存のテストが照合している gtag と no_tracking の分岐を残している', () => {
	assert.ok(layout.includes("gtag('config', 'G-6EKGBQ8QWS')"))
	assert.match(layout, /\{% if page\.no_tracking %\}\r?\n<meta name="referrer" content="no-referrer">/)
	assert.match(layout, /data-no-tracking/)
	assert.match(layout, /app\.css\?v=\{\{ site\.time \| date: '%s' \}\}/)
})

test('software-application: inLanguage・description・downloadUrl をページの言語から出し、英中は l10n の entity を使う', () => {
	assert.match(swApp, /"inLanguage": \{\{ L\.json_ld_lang \| default: "ja" \| jsonify \}\}/)
	assert.match(swApp, /"description": \{\{ L\.meta_desc \| jsonify \}\}/)
	assert.match(swApp, /"downloadUrl": \{\{ L\.app_download_link \| jsonify \}\}/)
	assert.match(swApp, /site\.data\.l10n\[page\.lang\]\.entity/)
	assert.doesNotMatch(swApp, /"inLanguage": "ja"/)
})

test('breadcrumb: ja は「ホーム」と / のまま、英中は breadcrumb_home と言語のトップ', () => {
	assert.match(breadcrumb, /\{% if page\.lang == 'ja' %\}"ホーム"\{% else %\}\{\{ L\.breadcrumb_home \| jsonify \}\}\{% endif %\}/)
	assert.match(breadcrumb, /"https:\/\/www\.deepmosaic\.co\.jp\/"/)
	assert.match(breadcrumb, /https:\/\/www\.deepmosaic\.co\.jp\{\{ L\.url_prefix \}\}\//)
})

test('faq schema: 既存の 2 行と for を残し、英中は l10n の faq に差し替える', () => {
	assert.match(faqSchema, /\{%- assign faq_src = site\.data\.faq -%\}/)
	assert.match(faqSchema, /site\.data\[page\.faq_data\]\.faq/)
	assert.match(faqSchema, /for item in faq_src/)
	assert.match(faqSchema, /site\.data\.l10n\[page\.lang\]\.faq\.items/)
	assert.match(faqSchema, /site\.data\.l10n\[page\.lang\]\[page\.faq_data\]\.faq/)
})

test('organization: 変えていない (法人の正式名・住所は ja のまま)', () => {
	const org = read('_includes/schema/organization.html')
	assert.match(org, /"name": "Deepmosaic合同会社"/)
	assert.doesNotMatch(org, /page\.lang|site\.data\.l10n/)
})

// ---- 4. checks/head.mjs の単体 (作った _site の模型) ----

const LEDGER_YML = '"/": [en, zh-tw]\n"/price/": [en, zh-tw]\n'
const LANG = {
	ja: { prefix: '', html: 'ja', og: 'ja_JP', jsonLd: 'ja' },
	en: { prefix: '/en', html: 'en', og: 'en_US', jsonLd: 'en' },
	'zh-tw': { prefix: '/zh-tw', html: 'zh-Hant-TW', og: 'zh_TW', jsonLd: 'zh-Hant-TW' },
}
const OG = { ja: 'ja_JP', en: 'en_US', 'zh-tw': 'zh_TW' }

/** 正しい head を持つページの HTML を作る。opts で一部を壊す */
function page(lang, jaPath, opts = {}) {
	const L = LANG[lang]
	const url = `${L.prefix}${jaPath}`
	const listed = opts.listed ?? true
	const lines = [`<!DOCTYPE html>`, `<html lang="${opts.htmlLang ?? L.html}">`, '<head>']
	lines.push(`<link rel="canonical" href="${ORIGIN}${opts.canonical ?? url}" />`)
	if (listed && !opts.noHreflang) {
		const alt = opts.hreflang ?? {
			ja: jaPath,
			en: `/en${jaPath}`,
			'zh-Hant-TW': `/zh-tw${jaPath}`,
			'x-default': `/en${jaPath}`,
		}
		for (const [hl, p] of Object.entries(alt)) lines.push(`<link rel="alternate" hreflang="${hl}" href="${ORIGIN}${p}" />`)
	}
	lines.push(`<meta property="og:locale" content="${opts.og ?? L.og}" />`)
	if (listed) {
		const alts = opts.ogAlt ?? Object.keys(OG).filter((k) => k !== lang).map((k) => OG[k])
		for (const a of alts) lines.push(`<meta property="og:locale:alternate" content="${a}" />`)
	}
	if (opts.software !== false) {
		const sw = {
			'@type': 'SoftwareApplication',
			inLanguage: opts.inLanguage ?? L.jsonLd,
			description: opts.description ?? (lang === 'ja' ? 'Deepmosaic は動画にモザイクをかけるアプリです。' : 'Deepmosaic applies mosaic.'),
			disambiguatingDescription: lang === 'ja' ? 'モザイクを付加します。' : 'It applies mosaic.',
			featureList: opts.featureList ?? (lang === 'ja' ? ['検出'] : ['Detect']),
		}
		lines.push(`<script type="application/ld+json">${JSON.stringify(sw)}</script>`)
	}
	if (opts.breadcrumb) {
		const bc = {
			'@type': 'BreadcrumbList',
			itemListElement: [{ '@type': 'ListItem', position: 1, name: 'x', item: opts.breadcrumb }],
		}
		lines.push(`<script type="application/ld+json">${JSON.stringify(bc)}</script>`)
	}
	if (opts.faq !== undefined) {
		const faq = {
			'@type': 'FAQPage',
			mainEntity: Array.from({ length: opts.faq }, (_, i) => ({ '@type': 'Question', name: `q${i}` })),
		}
		lines.push(`<script type="application/ld+json">${JSON.stringify(faq)}</script>`)
	}
	if (opts.rawJsonLd) lines.push(`<script type="application/ld+json">${opts.rawJsonLd}</script>`)
	lines.push('</head><body>')
	for (let i = 0; i < (opts.details ?? 0); i += 1) lines.push('<details><summary>q</summary>a</details>')
	lines.push('</body></html>')
	return lines.join('\n')
}

/** 作った _site と root で check を回す。files = { 'price/index.html': html, … } */
function runCheck(files, ledgerYml = LEDGER_YML) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-site-head-'))
	try {
		const site = join(dir, '_site')
		mkdirSync(join(dir, '_data'), { recursive: true })
		writeFileSync(join(dir, '_data', 'i18n_pages.yml'), ledgerYml)
		for (const [rel, html] of Object.entries(files)) {
			mkdirSync(dirname(join(site, rel)), { recursive: true })
			writeFileSync(join(site, rel), html)
		}
		mkdirSync(site, { recursive: true })
		return check(makeContext(site, dir))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

/** 正しい 3 言語の模型 (台帳のトップと料金、台帳に無い docs と 404) */
function goodSite() {
	return {
		'index.html': page('ja', '/', { faq: 2, details: 2 }),
		'price/index.html': page('ja', '/price/', { breadcrumb: `${ORIGIN}/` }),
		'docs/index.html': page('ja', '/docs/', { listed: false, software: false }),
		'404.html': page('ja', '/404.html', { listed: false, software: false }),
		'company/terms.html': page('ja', '/company/terms', { listed: false, software: false }),
		'en/index.html': page('en', '/', { faq: 3, details: 3 }),
		'en/price/index.html': page('en', '/price/', { breadcrumb: `${ORIGIN}/en/` }),
		'zh-tw/index.html': page('zh-tw', '/', { description: 'Deepmosaic 是為影片套用馬賽克的應用程式。', featureList: ['偵測'] }),
		'zh-tw/price/index.html': page('zh-tw', '/price/', { breadcrumb: `${ORIGIN}/zh-tw/`, description: '套用馬賽克。', featureList: ['偵測'] }),
	}
}

test('head check: 陽性対照 (正しい模型はエラー 0 件)', () => {
	assert.deepEqual(runCheck(goodSite()), [])
})

test('head check: 英中のページが無い間は ja だけを見てエラー 0 件', () => {
	const ja = Object.fromEntries(Object.entries(goodSite()).filter(([k]) => !/^(en|zh-tw)\//.test(k)))
	assert.deepEqual(runCheck(ja), [])
})

/** 1 つだけ壊した模型で、エラーに pattern が出ることを確かめる */
function expectError(rel, html, pattern) {
	const errors = runCheck({ ...goodSite(), [rel]: html })
	assert.ok(errors.some((e) => e.startsWith(`${rel}:`) && pattern.test(e)), `${rel} で ${pattern} が出ない: ${JSON.stringify(errors)}`)
}

test('head check: 台帳のページに hreflang が無い', () => {
	expectError('price/index.html', page('ja', '/price/', { noHreflang: true, breadcrumb: `${ORIGIN}/` }), /hreflang/)
})

test('head check: hreflang が 3 本しか無い / x-default が ja を向く / href の言語が違う', () => {
	const base = { ja: '/', en: '/en/', 'zh-Hant-TW': '/zh-tw/', 'x-default': '/en/' }
	const three = Object.fromEntries(Object.entries(base).filter(([k]) => k !== 'zh-Hant-TW'))
	expectError('index.html', page('ja', '/', { faq: 2, details: 2, hreflang: three }), /hreflang/)
	expectError('index.html', page('ja', '/', { faq: 2, details: 2, hreflang: { ...base, 'x-default': '/' } }), /x-default/)
	expectError('en/index.html', page('en', '/', { faq: 3, details: 3, hreflang: { ...base, en: '/zh-tw/' } }), /hreflang="en"/)
})

test('head check: hreflang が 5 本ある (4 本の正しい組 + 余分な 1 本)', () => {
	const html = page('ja', '/price/', { breadcrumb: `${ORIGIN}/` }).replace(
		'<meta property="og:locale"',
		`<link rel="alternate" hreflang="fr" href="${ORIGIN}/fr/price/" />\n<meta property="og:locale"`,
	)
	expectError('price/index.html', html, /4 本でない/)
})

test('head check: 台帳に無いページに hreflang・og:locale:alternate がある', () => {
	const html = page('ja', '/docs/', { listed: false, software: false }).replace(
		'<meta property="og:locale"',
		`<link rel="alternate" hreflang="ja" href="${ORIGIN}/docs/" />\n<meta property="og:locale:alternate" content="en_US" />\n<meta property="og:locale"`,
	)
	expectError('docs/index.html', html, /hreflang/)
	expectError('docs/index.html', html, /og:locale:alternate/)
})

test('head check: html lang・og:locale・og:locale:alternate が言語と合わない', () => {
	expectError('en/price/index.html', page('en', '/price/', { htmlLang: 'ja', breadcrumb: `${ORIGIN}/en/` }), /<html lang>/)
	expectError('zh-tw/index.html', page('zh-tw', '/', { og: 'ja_JP', description: '套用。', featureList: ['偵測'] }), /og:locale/)
	expectError('en/price/index.html', page('en', '/price/', { ogAlt: ['ja_JP', 'en_US'], breadcrumb: `${ORIGIN}/en/` }), /og:locale:alternate/)
})

test('head check: canonical が自己参照でない (英中のページが ja の URL を指す)', () => {
	expectError('en/price/index.html', page('en', '/price/', { canonical: '/price/', breadcrumb: `${ORIGIN}/en/` }), /canonical/)
})

test('head check: SoftwareApplication の inLanguage が違う・英中の文に仮名がある', () => {
	expectError('en/index.html', page('en', '/', { faq: 3, details: 3, inLanguage: 'ja' }), /inLanguage/)
	expectError('en/index.html', page('en', '/', { faq: 3, details: 3, description: 'モザイクをかける' }), /description/)
	expectError('zh-tw/index.html', page('zh-tw', '/', { description: '套用。', featureList: ['モザイク'] }), /featureList/)
})

test('head check: パンくずの 1 つ目が言語のトップでない', () => {
	expectError('en/price/index.html', page('en', '/price/', { breadcrumb: `${ORIGIN}/` }), /パンくず/)
})

test('head check: 英中の FAQPage の Question の数が <details> の数と違う', () => {
	expectError('en/index.html', page('en', '/', { faq: 3, details: 2 }), /FAQPage/)
})

test('head check: JSON-LD が読めない', () => {
	expectError('en/index.html', page('en', '/', { faq: 3, details: 3, rawJsonLd: '{ broken' }), /JSON-LD/)
})

test('head check: canonical を持たない HTML (layout を通っていない模型・断片) は見ない', () => {
	const errors = runCheck({
		...goodSite(),
		'frag.html': '<p>断片</p>',
		'en/frag/index.html': '<!DOCTYPE html><html lang="ja"><head><meta property="og:locale:alternate" content="xx_XX" /></head></html>',
	})
	assert.deepEqual(errors, [])
})

test('head check: 台帳が無ければエラー', () => {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-site-head-noledger-'))
	try {
		mkdirSync(join(dir, '_site'), { recursive: true })
		const errors = check(makeContext(join(dir, '_site'), dir))
		assert.ok(errors.some((e) => /i18n_pages\.yml/.test(e)), JSON.stringify(errors))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
