// T-2208 (i18n1112 I18N-710, 2026-11-12) サイトのトップページ (繁体字中国語・台湾) `zh-tw/index.html` の仕様テスト。
//
//   node --test src/lib/i18n-site-top-zh.test.js
//
//   - ja の index.html と zh-tw/index.html の構造の一致 (scripts/i18n/parity.mjs の compareStructure が空)。en/index.html とも一致
//   - front matter: lang / permalink / ja_url / source / source_hash / seo_title / description / schemas (ja と同じ)
//   - ソースの文に仮名・簡体字・日本の新字体・禁止語・和製漢語が無い (コメントを除く。scripts/i18n/site-lint.mjs の lintText)
//   - 文のデータは l10n から引く (site.data.mosaic. などの直参照が無い、site.data.l10n['zh-tw'] を入れた変数 ZH の参照がある)
//   - サイト内リンクは /zh-tw/ の接頭辞、docs は ja-link.html、DL の href は言語のデータ、金額は「日圓」(¥ を使わない)
//   - check-site のモジュール scripts/i18n/checks/pages-top-zh.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { compareStructure } from '../../scripts/i18n/parity.mjs'
import { sourceHash } from '../../scripts/i18n/source-hash.mjs'
import { lintText } from '../../scripts/i18n/site-lint.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ZH_REL = 'zh-tw/index.html'
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
/** 製品の方向 (モザイクを「かける」) の語 */
const DIRECTION = /加上馬賽克|套用馬賽克/
/** 除去の語 (否定の注記の要素の中だけで使える) */
const REMOVAL = /去馬賽克|去碼|移除馬賽克/

const zhExists = existsSync(join(ROOT, ZH_REL))
const JA = read('index.html')
const ZH = zhExists ? read(ZH_REL) : ''

// ---------------------------------------------------------------- 1. ソース

test('zh-tw/index.html がある', () => {
	assert.ok(zhExists, `${ZH_REL} が無い`)
})

test('構造: compareStructure(index.html, zh-tw/index.html) が空 (ja-link.html の追加だけ許す)', () => {
	assert.ok(zhExists)
	assert.deepEqual(compareStructure(JA, ZH), [])
})

test('構造: en/index.html と zh-tw/index.html の構造が一致 (include の並びは ja-link.html も含めて同じ)', () => {
	assert.ok(zhExists)
	assert.deepEqual(compareStructure(read('en/index.html'), ZH, { allowExtraIncludes: [] }), [])
})

test('front matter: lang / permalink / ja_url / source / source_hash / layout', () => {
	assert.ok(zhExists)
	const { fm } = splitFrontMatter(ZH)
	assert.equal(fmScalar(fm, 'layout'), 'default')
	assert.equal(fmScalar(fm, 'lang'), 'zh-tw')
	assert.equal(fmScalar(fm, 'permalink'), '/zh-tw/')
	assert.equal(fmScalar(fm, 'ja_url'), '/')
	assert.equal(fmScalar(fm, 'source'), 'index.html')
	assert.equal(fmScalar(fm, 'source_hash'), sourceHash(join(ROOT, 'index.html')), 'source_hash が古い (accept-site.mjs で書き直す)')
})

test('front matter: title・seo_title・description が繁体字で、seo_title は製品の方向 (為影片加上馬賽克) と製品名を含む', () => {
	assert.ok(zhExists)
	const { fm } = splitFrontMatter(ZH)
	for (const key of ['title', 'seo_title', 'description']) {
		const v = fmScalar(fm, key)
		assert.ok(v && v.length > 0, `${key} が無い`)
		assert.ok(HAN.test(v), `${key} が中国語でない: ${v}`)
		assert.deepEqual(lintText('zh-tw', v), [], `${key} に仮名・簡体字・新字体・禁止語: ${v}`)
	}
	const seo = fmScalar(fm, 'seo_title')
	assert.ok(seo.includes('為影片加上馬賽克'), `seo_title に製品の方向 (為影片加上馬賽克) が無い: ${seo}`)
	assert.ok(seo.includes('Deepmosaic'), 'seo_title に製品名が無い')
	assert.ok(seo.length <= 40, `seo_title が長い (${seo.length} 字): ${seo}`)
	const desc = fmScalar(fm, 'description')
	assert.ok(DIRECTION.test(desc), `description に製品の方向が無い: ${desc}`)
	assert.ok(/無法|不具備/.test(desc), `description に誤認の訂正 (否定) が無い: ${desc}`)
	assert.ok(!REMOVAL.test(desc), `description に除去の語: ${desc}`)
	assert.ok(!REMOVAL.test(fmScalar(fm, 'title')) && !REMOVAL.test(seo), 'title / seo_title に除去の語')
})

test('front matter: schemas が ja と同じ、noindex / sitemap / faq_data などが ja と同じ', () => {
	assert.ok(zhExists)
	const ja = splitFrontMatter(JA).fm
	const zh = splitFrontMatter(ZH).fm
	assert.deepEqual(fmList(zh, 'schemas'), fmList(ja, 'schemas'))
	for (const key of ['noindex', 'sitemap', 'faq_data', 'no_tracking', 'needs_video']) {
		assert.equal(fmScalar(zh, key), fmScalar(ja, key), `${key} が ja と違う`)
	}
})

test('本文: コメントの外に仮名・簡体字・日本の新字体・禁止語・和製漢語が無い (lintText)', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	body.split('\n').forEach((line, i) => {
		assert.ok(!KANA.test(line), `本文 ${i + 1} 行目に仮名: ${line.trim()}`)
		assert.deepEqual(lintText('zh-tw', line), [], `本文 ${i + 1} 行目: ${line.trim()}`)
	})
})

test('本文: en/index.html の英文が残っていない (写して訳し忘れた行が無い)', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	for (const en of [
		'Turn mosaic work into',
		'Download for free',
		'Frequently asked questions',
		'See pricing',
		'Japanese UI',
		'View the documentation',
		'Flexible editing',
		'learn more',
	]) {
		assert.ok(!body.includes(en), `英語の文が残っている: ${en}`)
	}
	assert.ok(HAN.test(body))
})

test('本文: 文のデータは l10n から (site.data.mosaic. / disclosure. / entity.not_removal_note / faq / plans.tax_note の直参照が無い)', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	for (const ref of ['site.data.mosaic.', 'site.data.disclosure.', 'site.data.entity.not_removal_note', 'site.data.faq', 'site.data.plans.tax_note', 'site.data.l10n.en.']) {
		assert.ok(!body.includes(ref), `${ref} を直に引いている`)
	}
	for (const ref of [
		'ZH.mosaic.scopes',
		'ZH.mosaic.controls',
		'ZH.mosaic.priority_note',
		'ZH.mosaic.note',
		'ZH.disclosure.responsibility',
		'ZH.disclosure.weaknesses',
		'ZH.disclosure.accuracy_note',
		'ZH.disclosure.offline_steps',
		'ZH.entity.not_removal_note',
		'ZH.plans.tax_note',
	]) {
		assert.ok(body.includes(ref), `${ref} を引いていない`)
	}
	// Jekyll の include の引数には添字 (['zh-tw']) を書けないので、l10n を変数 ZH に入れてから引く
	assert.match(body, /\{%-?\s*assign ZH = site\.data\.l10n\['zh-tw'\]\s*-?%\}/, 'l10n を変数 ZH に入れていない')
	assert.match(body, /\{%\s*include faq\.html items=ZH\.faq\.items\s*%\}/)
	// 引用符の無い引数の値 (変数) に添字があるもの。class="h-[18px]" のような引用符つきの値は対象外
	assert.ok(!/\{%-?\s*include\s[^%]*\s[\w-]+=[\w.]+\[/.test(body), 'include の引数に添字がある (Jekyll がビルドで落ちる)')
})

test('本文: 否定の注記 (not_removal_note) の要素に data-i18n-allow="mosaic_removal"、その外に除去の語が無い', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	assert.match(body, /<p [^>]*data-i18n-allow="mosaic_removal"[^>]*>\{\{\s*ZH\.entity\.not_removal_note\s*\}\}<\/p>/)
	const outside = body.replace(/<p [^>]*data-i18n-allow="mosaic_removal"[^>]*>[\s\S]*?<\/p>/g, '')
	assert.ok(!REMOVAL.test(outside), '否定の注記の外に除去の語')
})

test('本文: 製品の方向の語 (加上馬賽克 / 套用馬賽克) がある、身体の部位は用語集の語、成人向けの語が無い', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	assert.ok(DIRECTION.test(body))
	for (const w of ['敏感部位', '私密部位', '隱私部位', '生殖器', '性器', '裸', '色情', '成人']) {
		assert.ok(!body.includes(w), `禁止語: ${w}`)
	}
	assert.ok(body.includes('男性身體部位') && body.includes('女性身體部位'), '用語集の 男性身體部位 / 女性身體部位 が無い')
})

test('本文: 金額は「日圓」で、¥ を使わない', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	assert.ok(!body.includes('¥') && !body.includes('&yen;'), '¥ を使っている')
	assert.ok(body.includes('8,940 日圓'), 'noscript の金額が「8,940 日圓」の形でない')
})

test('リンク: サイト内は /zh-tw/ の接頭辞、docs は ja-link.html、DL の href は言語のデータ', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	const hrefs = [...body.replace(/\{%[\s\S]*?%\}/g, '').matchAll(/\shref="([^"]*)"/g)].map((m) => m[1])
	for (const h of hrefs) {
		if (h.startsWith('#') || h.startsWith('{{')) continue
		assert.ok(!/^\/(price|spec|enterprise|subscribe|contact|company\/about)/.test(h), `接頭辞の無いサイト内リンク: ${h}`)
		assert.ok(!/^\/en\//.test(h), `英語のページへのリンク: ${h}`)
		assert.ok(!/^\/docs/.test(h), `docs への生のリンク (ja-link.html を使う): ${h}`)
	}
	for (const want of ['/zh-tw/spec/', '/zh-tw/price/', '/zh-tw/enterprise/inquiry/']) {
		assert.ok(hrefs.includes(want), `${want} へのリンクが無い`)
	}
	const jaLinks = [...body.matchAll(/\{%-?\s*include ja-link\.html href="([^"]*)"/g)].map((m) => m[1])
	assert.deepEqual(jaLinks.sort(), ['/docs', '/docs/#detect-mosaic', '/docs/#detect-options', '/docs/#team'])
	assert.match(body, /<a href="\{\{ site\.data\.lang\[page\.lang\]\.app_download_link \}\}" download data-dl="hero"/) // T-2303: インストーラの DL (ja と同じ属性)
	assert.match(body, /secondary_href="\/zh-tw\/price\/"/)
})

test('画像: alt が繁体字で、アプリの画面・日本語の文字が写った画像の alt に（日文介面）', () => {
	assert.ok(zhExists)
	const body = stripComments(splitFrontMatter(ZH).body)
	const imgs = [...body.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
	assert.ok(imgs.length > 0)
	for (const tag of imgs) {
		const src = tag.match(/\ssrc="([^"]*)"/)[1]
		const alt = tag.match(/\salt="([^"]*)"/)?.[1] ?? ''
		assert.ok(alt.length > 0 && HAN.test(alt), `${src} の alt が繁体字でない: ${alt}`)
		const jaUi = /screenshots\/|detectable-objects\.webp|samples\/mosaic-detect-|pr_image\.webp/.test(src)
		if (jaUi) assert.ok(alt.endsWith('（日文介面）'), `${src} の alt に（日文介面）が無い: ${alt}`)
		else assert.ok(!alt.includes('日文介面'), `${src} は日本語の画面ではない: ${alt}`)
	}
})

test('本文: stats の値とラベルの数が ja (_data/site.yml の stats) の件数と同じで、数字の部分が ja と同じ', () => {
	// zh-tw は en と同じく値とラベルを split の配列で書き、ja の S.stats を forloop.index0 で引く。
	// ja の件数・並び・値が変わっても source_hash (index.html だけが対象) では気づけないので、ここで _data/site.yml と突き合わせる。
	const yml = read('_data/site.yml')
	const block = yml.match(/^stats:\n([\s\S]*?)(?=^\S|(?![\s\S]))/m)
	assert.ok(block, '_data/site.yml に stats が無い')
	const jaValues = [...block[1].matchAll(/^ {2}- value: "([^"]*)"/gm)].map((m) => m[1])
	assert.ok(jaValues.length > 0, 'stats の value を読めない')
	assert.ok(zhExists)
	const body = read(ZH_REL)
	const values = body.match(/assign stats_values = "([^"]*)" \| split: "\|"/)
	const labels = body.match(/assign stats_labels = "([^"]*)" \| split: "\|"/)
	assert.ok(values && labels, 'zh-tw/index.html に stats_values / stats_labels の split が無い')
	const zhValues = values[1].split('|')
	const zhLabels = labels[1].split('|')
	assert.equal(zhValues.length, jaValues.length, 'stats の値の数が ja と違う')
	assert.equal(zhLabels.length, jaValues.length, 'stats のラベルの数が ja と違う')
	const digits = (v) => (v.match(/[\d,]+\+?/) ?? [''])[0]
	assert.deepEqual(zhValues.map(digits), jaValues.map(digits), 'stats の数字の部分が ja と違う')
	for (const v of [...zhValues, ...zhLabels]) assert.deepEqual(lintText('zh-tw', v), [], `stats: ${v}`)
})

// ---------------------------------------------------------------- 2. checks/pages-top-zh.mjs

const GOOD_JA =
	'<html lang="ja"><head>\n' +
	'<link rel="canonical" href="https://www.deepmosaic.co.jp/" />\n' +
	'<script type="application/ld+json">{"@type": "SoftwareApplication", "disambiguatingDescription": "x"}</script>\n' +
	'<script type="application/ld+json">{"@type": "FAQPage", "mainEntity": [{"@type": "Question"}, {"@type": "Question"}]}</script>\n' +
	'</head><body>\n' +
	'<a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW" data-dl="hero">x</a><a href="https://app" data-dl="hero-webapp">y</a>\n' +
	'<details>a</details><details>b</details>\n' +
	'</body></html>\n'

const GOOD_ZH =
	'<html lang="zh-Hant-TW"><head>\n' +
	'<link rel="canonical" href="https://www.deepmosaic.co.jp/zh-tw/" />\n' +
	'<link rel="alternate" hreflang="ja" href="https://www.deepmosaic.co.jp/" />\n' +
	'<link rel="alternate" hreflang="en" href="https://www.deepmosaic.co.jp/en/" />\n' +
	'<link rel="alternate" hreflang="zh-Hant-TW" href="https://www.deepmosaic.co.jp/zh-tw/" />\n' +
	'<link rel="alternate" hreflang="x-default" href="https://www.deepmosaic.co.jp/en/" />\n' +
	'<script type="application/ld+json">{"@type": "SoftwareApplication", "disambiguatingDescription": "x"}</script>\n' +
	'<script type="application/ld+json">{"@type": "FAQPage", "mainEntity": [{"@type": "Question"}, {"@type": "Question"}]}</script>\n' +
	'</head><body>\n' +
	'<div class="kicker">為影片加上馬賽克的 AI 軟體</div>\n' +
	'<p data-i18n-allow="mosaic_removal">不具備去掉既有馬賽克的功能。</p>\n' +
	'<p class="cta" data-i18n-allow="mosaic_removal">這是用來套用（加上）馬賽克的軟體。不具備去掉既有馬賽克的功能。</p>\n' +
	'<span>2,980 日圓</span>\n' +
	'<a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW" data-dl="hero">x</a><a href="https://app" data-dl="hero-webapp">y</a>\n' +
	'<details>a</details><details>b</details>\n' +
	'</body></html>\n'

async function runCheck(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-top-zh-'))
	try {
		for (const [rel, text] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), text)
		}
		const { default: check } = await import('../../scripts/i18n/checks/pages-top-zh.mjs')
		return await check(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('checks/pages-top-zh: 正しい模型は 0 件', async () => {
	assert.deepEqual(await runCheck({ 'index.html': GOOD_JA, 'zh-tw/index.html': GOOD_ZH }), [])
})

test('checks/pages-top-zh: zh-tw/index.html が無ければエラー (ja の index.html がレイアウトを通っているとき)', async () => {
	const errs = await runCheck({ 'index.html': GOOD_JA })
	assert.ok(errs.some((e) => e.includes('zh-tw/index.html')), errs.join('\n'))
})

test('checks/pages-top-zh: レイアウトを通っていない模型 (canonical が無い) では何もしない', async () => {
	const noLayout = (s) => s.replace(/<link rel="canonical"[^\n]*\n/, '')
	assert.deepEqual(await runCheck({ 'index.html': noLayout(GOOD_JA) }), [])
	assert.deepEqual(
		await runCheck({ 'index.html': noLayout(GOOD_JA), 'zh-tw/index.html': '<html lang="zh-Hant-TW"><head></head></html>\n' }),
		[],
	)
})

// [名前, zh の変更, needle, ja の変更 (省略時は GOOD_JA のまま)]
const BAD_CASES = [
	['html の lang が zh-Hant-TW でない', (s) => s.replace('<html lang="zh-Hant-TW">', '<html lang="zh-TW">'), 'lang'],
	['製品の方向の語が無い', (s) => s.replace('加上馬賽克', '處理影片'), '製品の方向'],
	['否定の注記が無い', (s) => s.replace(/ data-i18n-allow="mosaic_removal"/g, ''), '否定の注記'],
	['否定の注記の中身が空 (l10n のキーが nil)', (s) => s.replace(/(data-i18n-allow="mosaic_removal">)[^<]*/g, '$1'), '否定の注記'],
	['hero の否定の注記が消えて CTA の 1 本だけ', (s) => s.replace(/<p data-i18n-allow="mosaic_removal">[^<]*<\/p>\n/, ''), '否定の注記'],
	['否定の注記の中身に否定の語が無い', (s) => s.replace(/(data-i18n-allow="mosaic_removal">)[^<]*/g, '$1這是用來套用馬賽克的軟體。'), '否定の注記'],
	['disambiguatingDescription が無い', (s) => s.replace('"disambiguatingDescription": "x"', '"description": "x"'), 'disambiguatingDescription'],
	['details と Question の数が違う', (s) => s.replace('<details>b</details>', ''), 'Question'],
	['details の数が ja と違う', (s) => s.replace('<details>b</details>', '').replace(', {"@type": "Question"}', ''), 'ja'],
	['プレースホルダが残る', (s) => s.replace('<details>a</details>', '<details>%%LIGHT_MAX%%</details>'), 'プレースホルダ'],
	// ja からも消す: 値の集合の比較 (どちらも空で一致) では捕まらず、長さの検査だけで落ちる
	['data-dl が無い (ja も無い)', (s) => s.replace(/ data-dl="[^"]*"/g, ''), '計測が止まる', (s) => s.replace(/ data-dl="[^"]*"/g, '')],
	['data-dl の値が ja と違う', (s) => s.replace('data-dl="hero-webapp"', 'data-dl="hero-web"'), 'data-dl'],
	['DL の href にクエリが焼き込まれている', (s) => s.replace('9PDKMKWHN9RW"', '9PDKMKWHN9RW?utm_source=x"'), 'クエリ'],
	['hreflang が 3 本', (s) => s.replace(/<link rel="alternate" hreflang="x-default"[^\n]*\n/, ''), 'hreflang'],
	['価格に ¥ がある', (s) => s.replace('<span>2,980 日圓</span>', '<span>2,980 日圓</span><span>¥2,980</span>'), '¥'],
	['価格に ¥ の文字参照がある', (s) => s.replace('<span>2,980 日圓</span>', '<span>2,980 日圓</span><span>&yen;2,980</span>'), '¥'],
	['価格に 日圓 が無い', (s) => s.replace('<span>2,980 日圓</span>', '<span>2,980</span>'), '日圓'],
]

for (const [name, mutate, needle, mutateJa = (s) => s] of BAD_CASES) {
	test(`checks/pages-top-zh: ${name} → エラー`, async () => {
		const errs = await runCheck({ 'index.html': mutateJa(GOOD_JA), 'zh-tw/index.html': mutate(GOOD_ZH) })
		assert.ok(errs.length > 0 && errs.some((e) => e.includes(needle)), `${name}: ${errs.join(' / ')}`)
	})
}
