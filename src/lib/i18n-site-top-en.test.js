// T-2207 (i18n1112 I18N-709, 2026-11-12) サイトのトップページ (en) `en/index.html` の仕様テスト。
//
//   node --test src/lib/i18n-site-top-en.test.js
//
//   - ja の index.html と en/index.html の構造の一致 (scripts/i18n/parity.mjs の compareStructure が空)
//   - front matter: lang / permalink / ja_url / source / source_hash / seo_title / description / schemas (ja と同じ)
//   - ソースの文に仮名・漢字が無い (コメントを除く)。文のデータは l10n から引く (site.data.mosaic. などの直参照が無い)
//   - サイト内リンクは /en/ の接頭辞、docs は ja-link.html、DL の href は言語のデータ
//   - check-site のモジュール scripts/i18n/checks/pages-top-en.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { compareStructure } from '../../scripts/i18n/parity.mjs'
import { sourceHash } from '../../scripts/i18n/source-hash.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EN_REL = 'en/index.html'
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')

/** front matter の生の文 (`---` の間) と本文 */
function splitFrontMatter(src) {
	const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
	assert.ok(m, 'front matter が無い')
	return { fm: m[1], body: m[2] }
}

/** front matter のトップレベルの scalar (`key: value`) */
function fmScalar(fm, key) {
	const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm'))
	if (!m) return undefined
	return m[1].replace(/^(["'])(.*)\1$/, '$2')
}

/** front matter の配列 (`key:` の次の `  - x` の行) */
function fmList(fm, key) {
	const lines = fm.split('\n')
	const i = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l))
	if (i === -1) return undefined
	const out = []
	for (const l of lines.slice(i + 1)) {
		const m = l.match(/^\s+-\s+(.+?)\s*$/)
		if (m) out.push(m[1])
		else if (/^\s*#/.test(l)) continue
		else break
	}
	return out
}

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const HAN = /\p{Script=Han}/u
const FULLWIDTH = /[　-〿＀-￯]/u

const enExists = existsSync(join(ROOT, EN_REL))
const JA = read('index.html')
const EN = enExists ? read(EN_REL) : ''

// ---------------------------------------------------------------- 1. ソース

test('en/index.html がある', () => {
	assert.ok(enExists, `${EN_REL} が無い`)
})

test('構造: compareStructure(index.html, en/index.html) が空 (ja-link.html の追加だけ許す)', () => {
	assert.ok(enExists)
	assert.deepEqual(compareStructure(JA, EN), [])
})

test('front matter: lang / permalink / ja_url / source / source_hash / layout', () => {
	assert.ok(enExists)
	const { fm } = splitFrontMatter(EN)
	assert.equal(fmScalar(fm, 'layout'), 'default')
	assert.equal(fmScalar(fm, 'lang'), 'en')
	assert.equal(fmScalar(fm, 'permalink'), '/en/')
	assert.equal(fmScalar(fm, 'ja_url'), '/')
	assert.equal(fmScalar(fm, 'source'), 'index.html')
	assert.equal(fmScalar(fm, 'source_hash'), sourceHash(join(ROOT, 'index.html')), 'source_hash が古い (accept-site.mjs で書き直す)')
})

test('front matter: title・seo_title・description が英語で、seo_title は製品の方向 (adds mosaic) を含み 70 字以内', () => {
	assert.ok(enExists)
	const { fm } = splitFrontMatter(EN)
	for (const key of ['title', 'seo_title', 'description']) {
		const v = fmScalar(fm, key)
		assert.ok(v && v.length > 0, `${key} が無い`)
		assert.ok(!KANA.test(v) && !HAN.test(v) && !FULLWIDTH.test(v), `${key} に日本語の字: ${v}`)
	}
	const seo = fmScalar(fm, 'seo_title')
	assert.ok(/adds mosaic|apply mosaic/i.test(seo), `seo_title に製品の方向が無い: ${seo}`)
	assert.ok(seo.length <= 70, `seo_title が長い (${seo.length} 字): ${seo}`)
	assert.ok(seo.includes('Deepmosaic'), 'seo_title に製品名が無い')
	const desc = fmScalar(fm, 'description')
	assert.ok(/adds mosaic|apply mosaic|applies mosaic/i.test(desc), `description に製品の方向が無い: ${desc}`)
	assert.ok(/cannot|no feature/i.test(desc), `description に誤認の訂正 (否定) が無い: ${desc}`)
	assert.ok(!/remove[sd]?\s+mosaic|decensor|uncensor|unblur/i.test(desc), `description に除去の連語: ${desc}`)
})

test('front matter: schemas が ja と同じ、ja に無い noindex / sitemap / faq_data を持たない', () => {
	assert.ok(enExists)
	const ja = splitFrontMatter(JA).fm
	const en = splitFrontMatter(EN).fm
	assert.deepEqual(fmList(en, 'schemas'), fmList(ja, 'schemas'))
	for (const key of ['noindex', 'sitemap', 'faq_data', 'no_tracking', 'needs_video']) {
		assert.equal(fmScalar(en, key), fmScalar(ja, key), `${key} が ja と違う`)
	}
})

test('本文: コメントの外に仮名・漢字・全角の記号が無い', () => {
	assert.ok(enExists)
	const body = stripComments(splitFrontMatter(EN).body)
	body.split('\n').forEach((line, i) => {
		assert.ok(!KANA.test(line) && !HAN.test(line) && !FULLWIDTH.test(line), `本文 ${i + 1} 行目に日本語の字: ${line.trim()}`)
	})
})

test('本文: 文のデータは l10n から (site.data.mosaic. / disclosure. / entity.not_removal_note / faq の直参照が無い)', () => {
	assert.ok(enExists)
	const body = stripComments(splitFrontMatter(EN).body)
	for (const ref of ['site.data.mosaic.', 'site.data.disclosure.', 'site.data.entity.not_removal_note', 'site.data.faq', 'site.data.plans.tax_note']) {
		assert.ok(!body.includes(ref), `${ref} を直に引いている`)
	}
	for (const ref of [
		'site.data.l10n.en.mosaic.scopes',
		'site.data.l10n.en.mosaic.controls',
		'site.data.l10n.en.mosaic.priority_note',
		'site.data.l10n.en.mosaic.note',
		'site.data.l10n.en.disclosure.responsibility',
		'site.data.l10n.en.disclosure.weaknesses',
		'site.data.l10n.en.disclosure.accuracy_note',
		'site.data.l10n.en.disclosure.offline_steps',
		'site.data.l10n.en.entity.not_removal_note',
		'site.data.l10n.en.plans.tax_note',
	]) {
		assert.ok(body.includes(ref), `${ref} を引いていない`)
	}
	assert.match(body, /\{%\s*include faq\.html items=site\.data\.l10n\.en\.faq\.items\s*%\}/)
})

test('本文: 否定の注記 (not_removal_note) の要素に data-i18n-allow="mosaic_removal"', () => {
	assert.ok(enExists)
	const body = stripComments(splitFrontMatter(EN).body)
	assert.match(body, /<p [^>]*data-i18n-allow="mosaic_removal"[^>]*>\{\{\s*site\.data\.l10n\.en\.entity\.not_removal_note\s*\}\}<\/p>/)
	// 除去の語は否定の注記の外に書かない
	const outside = body.replace(/<p [^>]*data-i18n-allow="mosaic_removal"[^>]*>[\s\S]*?<\/p>/g, '')
	assert.ok(!/remove[sd]?\s+mosaic|decensor|uncensor|unblur|mosaic removal/i.test(outside), '否定の注記の外に除去の語')
})

test('本文: 製品の方向の語 (adds mosaic / apply mosaic) がある、成人向けの語・禁止語が無い', () => {
	assert.ok(enExists)
	const body = stripComments(splitFrontMatter(EN).body)
	assert.ok(/adds mosaic|apply mosaic/i.test(body))
	for (const w of ['private', 'genital', 'intimate', 'nude', 'NSFW', 'sensitive area', 'explicit', 'censor', 'pixelat', 'log in', 'login', 'Please', 'mosaics']) {
		assert.ok(!new RegExp(`(?<![\\w])${w}`, 'i').test(body.replace(/<[^>]*>/g, ' ')), `禁止語: ${w}`)
	}
})

test('リンク: サイト内は /en/ の接頭辞、docs は ja-link.html、DL の href は言語のデータ', () => {
	assert.ok(enExists)
	const body = stripComments(splitFrontMatter(EN).body)
	// Liquid のタグ ({% include ja-link.html href=… %}) の引数は除いて、HTML の href だけを見る
	const hrefs = [...body.replace(/\{%[\s\S]*?%\}/g, '').matchAll(/\shref="([^"]*)"/g)].map((m) => m[1])
	for (const h of hrefs) {
		if (h.startsWith('#') || h.startsWith('{{')) continue
		assert.ok(!/^\/(price|spec|enterprise|subscribe|contact|company\/about)/.test(h), `接頭辞の無いサイト内リンク: ${h}`)
		assert.ok(!/^\/docs/.test(h), `docs への生のリンク (ja-link.html を使う): ${h}`)
	}
	for (const want of ['/en/spec/', '/en/price/', '/en/enterprise/inquiry/']) {
		assert.ok(hrefs.includes(want), `${want} へのリンクが無い`)
	}
	const jaLinks = [...body.matchAll(/\{%-?\s*include ja-link\.html href="([^"]*)"/g)].map((m) => m[1])
	assert.deepEqual(jaLinks.sort(), ['/docs', '/docs/#detect-mosaic', '/docs/#detect-options', '/docs/#team'])
	assert.match(body, /<a href="\{\{ site\.data\.lang\[page\.lang\]\.app_download_link \}\}" download data-dl="hero"/) // T-2303: インストーラの DL (ja と同じ属性)
	assert.match(body, /secondary_href="\/en\/price\/"/)
})

test('画像: アプリの画面・日本語の文字が写った画像の alt に (Japanese UI)', () => {
	assert.ok(enExists)
	const body = stripComments(splitFrontMatter(EN).body)
	const imgs = [...body.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
	assert.ok(imgs.length > 0)
	for (const tag of imgs) {
		const src = tag.match(/\ssrc="([^"]*)"/)[1]
		const alt = tag.match(/\salt="([^"]*)"/)?.[1] ?? ''
		assert.ok(alt.length > 0, `${src} の alt が空`)
		const jaUi = /screenshots\/|detectable-objects\.webp|samples\/mosaic-detect-|pr_image\.webp/.test(src)
		if (jaUi) assert.ok(alt.endsWith(' (Japanese UI)'), `${src} の alt に (Japanese UI) が無い: ${alt}`)
		else assert.ok(!alt.includes('(Japanese UI)'), `${src} は日本語の画面ではない: ${alt}`)
	}
})

test('本文: stats の値とラベルの数が ja (_data/site.yml の stats) の件数と同じで、数字の部分が ja と同じ', () => {
	// en は値とラベルを split の配列で書き、ja の S.stats を forloop.index0 で引く。ja の件数・並び・値が変わっても
	// source_hash (index.html だけが対象) では気づけないので、ここで _data/site.yml と突き合わせる。
	const yml = read('_data/site.yml')
	const block = yml.match(/^stats:\n([\s\S]*?)(?=^\S|(?![\s\S]))/m) // 次の最上位のキーかファイルの終わりまで
	assert.ok(block, '_data/site.yml に stats が無い')
	const jaValues = [...block[1].matchAll(/^ {2}- value: "([^"]*)"/gm)].map((m) => m[1])
	assert.ok(jaValues.length > 0, 'stats の value を読めない')
	const body = read(EN_REL)
	const values = body.match(/assign stats_values = "([^"]*)" \| split: "\|"/)
	const labels = body.match(/assign stats_labels = "([^"]*)" \| split: "\|"/)
	assert.ok(values && labels, 'en/index.html に stats_values / stats_labels の split が無い')
	const enValues = values[1].split('|')
	assert.equal(enValues.length, jaValues.length, 'stats の値の数が ja と違う')
	assert.equal(labels[1].split('|').length, jaValues.length, 'stats のラベルの数が ja と違う')
	const digits = (v) => (v.match(/[\d,]+\+?/) ?? [''])[0]
	assert.deepEqual(enValues.map(digits), jaValues.map(digits), 'stats の数字の部分が ja と違う')
})

// ---------------------------------------------------------------- 2. checks/pages-top-en.mjs

const GOOD_JA =
	'<html lang="ja"><head>\n' +
	'<link rel="canonical" href="https://www.deepmosaic.co.jp/" />\n' +
	'<script type="application/ld+json">{"@type": "SoftwareApplication", "disambiguatingDescription": "x"}</script>\n' +
	'<script type="application/ld+json">{"@type": "FAQPage", "mainEntity": [{"@type": "Question"}, {"@type": "Question"}]}</script>\n' +
	'</head><body>\n' +
	'<a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW" data-dl="hero">x</a><a href="https://app" data-dl="hero-webapp">y</a>\n' +
	'<details>a</details><details>b</details>\n' +
	'</body></html>\n'

const GOOD_EN =
	'<html lang="en"><head>\n' +
	'<link rel="canonical" href="https://www.deepmosaic.co.jp/en/" />\n' +
	'<link rel="alternate" hreflang="ja" href="https://www.deepmosaic.co.jp/" />\n' +
	'<link rel="alternate" hreflang="en" href="https://www.deepmosaic.co.jp/en/" />\n' +
	'<link rel="alternate" hreflang="zh-Hant-TW" href="https://www.deepmosaic.co.jp/zh-tw/" />\n' +
	'<link rel="alternate" hreflang="x-default" href="https://www.deepmosaic.co.jp/en/" />\n' +
	'<script type="application/ld+json">{"@type": "SoftwareApplication", "disambiguatingDescription": "x"}</script>\n' +
	'<script type="application/ld+json">{"@type": "FAQPage", "mainEntity": [{"@type": "Question"}, {"@type": "Question"}]}</script>\n' +
	'</head><body>\n' +
	'<div class="kicker">AI software that adds mosaic to videos</div>\n' +
	'<p data-i18n-allow="mosaic_removal">It has no feature for taking off mosaic.</p>\n' +
	'<p class="cta" data-i18n-allow="mosaic_removal">This software is for applying mosaic. It has no feature for taking off mosaic.</p>\n' +
	'<a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW" data-dl="hero">x</a><a href="https://app" data-dl="hero-webapp">y</a>\n' +
	'<details>a</details><details>b</details>\n' +
	'</body></html>\n'

async function runCheck(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-top-en-'))
	try {
		for (const [rel, text] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), text)
		}
		const { default: check } = await import('../../scripts/i18n/checks/pages-top-en.mjs')
		return await check(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('checks/pages-top-en: 正しい模型は 0 件', async () => {
	assert.deepEqual(await runCheck({ 'index.html': GOOD_JA, 'en/index.html': GOOD_EN }), [])
})

test('checks/pages-top-en: en/index.html が無ければエラー (ja の index.html がレイアウトを通っているとき)', async () => {
	const errs = await runCheck({ 'index.html': GOOD_JA })
	assert.ok(errs.some((e) => e.includes('en/index.html')), errs.join('\n'))
})

test('checks/pages-top-en: レイアウトを通っていない模型 (canonical が無い) では何もしない', async () => {
	const noLayout = (s) => s.replace(/<link rel="canonical"[^\n]*\n/, '')
	assert.deepEqual(await runCheck({ 'index.html': noLayout(GOOD_JA) }), [])
	assert.deepEqual(await runCheck({ 'index.html': noLayout(GOOD_JA), 'en/index.html': '<html lang="en"><head></head></html>\n' }), [])
})

// [名前, en の変更, needle, ja の変更 (省略時は GOOD_JA のまま)]
const BAD_CASES = [
	['html の lang が en でない', (s) => s.replace('<html lang="en">', '<html lang="ja">'), 'lang'],
	['製品の方向の語が無い', (s) => s.replace('adds mosaic', 'handles video'), '製品の方向'],
	['否定の注記が無い', (s) => s.replace(/ data-i18n-allow="mosaic_removal"/g, ''), '否定の注記'],
	['否定の注記の中身が空 (l10n のキーが nil)', (s) => s.replace(/(data-i18n-allow="mosaic_removal">)[^<]*/g, '$1'), '否定の注記'],
	['hero の否定の注記が消えて CTA の 1 本だけ', (s) => s.replace(/<p data-i18n-allow="mosaic_removal">[^<]*<\/p>\n/, ''), '否定の注記'],
	['否定の注記の中身に否定の語が無い', (s) => s.replace(/(data-i18n-allow="mosaic_removal">)[^<]*/g, '$1This software applies mosaic.'), '否定の注記'],
	['disambiguatingDescription が無い', (s) => s.replace('"disambiguatingDescription": "x"', '"description": "x"'), 'disambiguatingDescription'],
	['details と Question の数が違う', (s) => s.replace('<details>b</details>', ''), 'Question'],
	['details の数が ja と違う', (s) => s.replace('<details>b</details>', '').replace(', {"@type": "Question"}', ''), 'ja'],
	['プレースホルダが残る', (s) => s.replace('<details>a</details>', '<details>%%LIGHT_MAX%%</details>'), 'プレースホルダ'],
	// ja からも消す: 値の集合の比較 (どちらも空で一致) では捕まらず、長さの検査だけで落ちる
	['data-dl が無い (ja も無い)', (s) => s.replace(/ data-dl="[^"]*"/g, ''), '計測が止まる', (s) => s.replace(/ data-dl="[^"]*"/g, '')],
	['data-dl の値が ja と違う', (s) => s.replace('data-dl="hero-webapp"', 'data-dl="hero-web"'), 'data-dl'],
	['DL の href にクエリが焼き込まれている', (s) => s.replace('9PDKMKWHN9RW"', '9PDKMKWHN9RW?utm_source=x"'), 'クエリ'],
	['hreflang が 3 本', (s) => s.replace(/<link rel="alternate" hreflang="x-default"[^\n]*\n/, ''), 'hreflang'],
]

for (const [name, mutate, needle, mutateJa = (s) => s] of BAD_CASES) {
	test(`checks/pages-top-en: ${name} → エラー`, async () => {
		const errs = await runCheck({ 'index.html': mutateJa(GOOD_JA), 'en/index.html': mutate(GOOD_EN) })
		assert.ok(errs.length > 0 && errs.some((e) => e.includes(needle)), `${name}: ${errs.join(' / ')}`)
	})
}
