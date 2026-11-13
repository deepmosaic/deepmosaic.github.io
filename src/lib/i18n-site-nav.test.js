// T-2204 (i18n1112 I18N-706, 2026-11-12) サイトのヘッダー・フッター・言語の切り替え・対象外のリンクの印の仕様テスト。
//
//   node --test src/lib/i18n-site-nav.test.js
//
//   - header.html と英中の写し header-intl.html の構造の一致 (data-dl の値・ナビのリンクの行き先・data-links の項目と dl)
//   - footer.html と footer-intl.html の構造の一致 (/company/ のリンク 6 本の順・data-dl= の数・行き先の集合)
//   - 言語の切り替え (lang-switch.html) の include の数 (header 2 / footer 1、写しも同じ)、/join/ を載せない
//   - lang-switch.html の 3 つの variant の出力の一番外の要素が data-i18n-switch を持ち、リンクに lang / hreflang がある
//   - 英中の写しから対象外 (docs・法務 5 本) へのリンクが ja の URL で、印 (ja_only_badge) を持つ
//   - nav.yml (en / zh-tw) のキーの集合が同じ、値が lintValue を通り、属性・JSON を壊す字を含まない
//   - site-lang.js の pageLang / pick
//   - MobileNav.svelte の ja の文を残したまま 3 言語の表を持つ
//   - app.css の @source 2 行と :root:lang(zh) のフォント、言語で分ける規則は :root:lang(zh) と :root:not(:lang(ja)) の下だけ
//     言語の規則と英中の @source を除いた本文が基点 (10678af) の app.css と同じ (ja の CSS を変えていない)
//   - check-site のモジュール scripts/i18n/checks/nav.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import checkNav from '../../scripts/i18n/checks/nav.mjs'
import { pageLang, pick } from './site-lang.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')

/** 英中の接頭辞を落とし、言語のデータの参照を同じ形に揃える (ja の `site.data.lang.ja.X` と英中の `L.X`)。 */
const normalizeRefs = (s) =>
	s
		.replace(/\{\{\s*L\.url_prefix\s*\}\}/g, '')
		.replace(/\{\{\s*(?:site\.data\.lang\.ja|L)\.([\w]+)\s*\}\}/g, '{{$1}}')

const hrefsOf = (src) => [...normalizeRefs(stripComments(src)).matchAll(/\shref="([^"]*)"/g)].map((m) => m[1])
const dataDlOf = (src) => [...stripComments(src).matchAll(/\sdata-dl="([^"]*)"/g)].map((m) => m[1])

/** data-links の JSON を読む (Liquid の式は接頭辞を落としてから `x` に置き換える)。 */
function dataLinksOf(src) {
	const raw = stripComments(src).match(/data-links='([^']*)'/)?.[1]
	assert.ok(raw, 'data-links が見つからない')
	return JSON.parse(normalizeRefs(raw).replace(/\{\{[^}]*\}\}/g, 'x'))
}

const HEADER = read('_includes/header.html')
const HEADER_INTL = read('_includes/header-intl.html')
const FOOTER = read('_includes/footer.html')
const FOOTER_INTL = read('_includes/footer-intl.html')
const SWITCH = read('_includes/lang-switch.html')
const JA_LINK = read('_includes/ja-link.html')

// ---- 小さな yml の読み取り (nav.yml の形 = 平らな `key: "value"` とコメント・空行だけ) ----

function parseFlatYaml(text, where) {
	const out = {}
	text.split(/\r?\n/).forEach((raw, i) => {
		if (/^\s*(#.*)?$/.test(raw)) return
		const m = raw.match(/^([a-z][a-z0-9_]*):\s*"((?:[^"\\]|\\.)*)"\s*(#.*)?$/)
		if (!m) throw new Error(`${where} の ${i + 1} 行目が読めない (平らな key: "value" だけ): ${raw}`)
		if (m[1] in out) throw new Error(`${where}: キーが重複: ${m[1]}`)
		out[m[1]] = JSON.parse(`"${m[2]}"`)
	})
	return out
}

const NAV = {
	en: parseFlatYaml(read('_data/l10n/en/nav.yml'), 'en/nav.yml'),
	'zh-tw': parseFlatYaml(read('_data/l10n/zh-tw/nav.yml'), 'zh-tw/nav.yml'),
}

// ---- header ----

test('header: 写しの data-dl の値が ja と同じ (header・mobile)', () => {
	assert.deepEqual(dataDlOf(HEADER).sort(), ['header'])
	assert.deepEqual(dataDlOf(HEADER_INTL).sort(), dataDlOf(HEADER).sort())
	// data-links の dl も同じ
	assert.deepEqual(
		dataLinksOf(HEADER_INTL).map((l) => l.dl ?? null),
		dataLinksOf(HEADER).map((l) => l.dl ?? null),
	)
})

test('header: ナビのリンクの行き先 (接頭辞を除いた形) の集合が ja と同じ', () => {
	const ja = new Set(hrefsOf(HEADER))
	const intl = new Set(hrefsOf(HEADER_INTL))
	assert.ok(ja.has('/price') && ja.has('/enterprise/inquiry/'), '陽性対照: ja のナビに料金と法人がある')
	assert.deepEqual([...intl].sort(), [...ja].sort())
	// 英中のサイト内のリンク (docs 以外) は接頭辞付き
	const live = stripComments(HEADER_INTL)
	for (const path of ['/price', '/spec', '/enterprise/inquiry/']) {
		assert.match(live, new RegExp(`href="\\{\\{ L\\.url_prefix \\}\\}${path.replace(/\//g, '\\/')}"`), `${path} に接頭辞が無い`)
	}
	assert.doesNotMatch(live, /href="\/(price|spec|enterprise)/, '英中のヘッダーに接頭辞の無い訳のあるページのリンクがある')
})

test('header: data-links の項目の数・行き先・dl が ja と同じ、ラベルは nav.yml から引く', () => {
	const ja = dataLinksOf(HEADER)
	const intl = dataLinksOf(HEADER_INTL)
	assert.equal(intl.length, ja.length)
	assert.deepEqual(
		intl.map((l) => l.href),
		ja.map((l) => l.href),
	)
	// T-2303: DL 項目 (インストーラ) だけ download: true (ja と同じ)。真偽は download-attr.js が '' に写す (T-231)
	assert.deepEqual(
		intl.map((l) => l.download),
		ja.map((l) => l.download),
	)
	assert.equal(intl.find((l) => l.dl === 'mobile')?.download, true)
	const raw = stripComments(HEADER_INTL).match(/data-links='([^']*)'/)[1]
	assert.doesNotMatch(raw, /[぀-ヿ]/, '英中の data-links に仮名を直書きしない')
	// docs の項目は印を持つ
	const docs = intl.find((l) => l.href === '/docs')
	assert.ok(docs, 'data-links に /docs が無い')
	assert.equal(docs.badge, 'x', 'docs の項目に印 (badge = L.ja_only_badge) が無い')
})

test('header: 英中の DL の <a> は app_download_link・data-dl・download 属性 (値なし) を持つ (T-2303)', () => {
	const tags = stripComments(HEADER_INTL).match(/<a\s[^>]*app_download_link[^>]*>/g) ?? []
	assert.equal(tags.length, 1)
	assert.match(tags[0], /data-dl="header"/)
	assert.match(tags[0], /\sdownload\s/)
})

test('header: ja の分岐は既存の行を残し、英中のときだけ写しを include する', () => {
	const live = stripComments(HEADER)
	assert.match(live, /\{%- if page\.lang == 'en' or page\.lang == 'zh-tw' -%\}\{% include header-intl\.html %\}\{%- else -%\}/)
	assert.match(HEADER, /<\/header>\{% endif %\}\r?\n?$/)
	// 既存の行 (data-links・noscript・DL の <a>) が残っている (陽性対照: 既存のテストが照合する形)
	assert.match(live, /data-links='\[\{"label":"ダウンロード","href":"\{\{ site\.data\.lang\.ja\.app_download_link \}\}","download":true,"dl":"mobile"\}/)
	assert.match(live, /<noscript>/)
	assert.match(live, /data-dl="header"/)
})

// ---- footer ----

const companyHrefs = (src) => hrefsOf(src).filter((h) => h.startsWith('/company/'))

test('footer: /company/ のリンク 6 本が同じ順 (英中は about だけ接頭辞付き)', () => {
	const ja = companyHrefs(FOOTER)
	assert.deepEqual(ja, ['/company/about', '/company/terms', '/company/privacy', '/company/cookie', '/company/eula', '/company/asct'])
	assert.deepEqual(companyHrefs(FOOTER_INTL), ja)
	const live = stripComments(FOOTER_INTL)
	assert.match(live, /href="\{\{ L\.url_prefix \}\}\/company\/about"/)
	for (const legal of ['terms', 'privacy', 'cookie', 'eula', 'asct']) {
		assert.doesNotMatch(live, new RegExp(`url_prefix \\}\\}/company/${legal}`), `法務 (${legal}) は ja の URL のまま`)
	}
})

test('footer: data-dl= の数と行き先の集合が ja と同じ', () => {
	const count = (src) => (stripComments(src).match(/data-dl=/g) ?? []).length
	assert.equal(count(FOOTER_INTL), count(FOOTER))
	assert.deepEqual([...new Set(hrefsOf(FOOTER_INTL))].sort(), [...new Set(hrefsOf(FOOTER))].sort())
})

test('英中の写し: 対象外 (docs・法務 5 本) へのリンクは ja の URL で印を持つ', () => {
	const live = stripComments(FOOTER_INTL)
	for (const path of ['/docs', '/company/terms', '/company/privacy', '/company/cookie', '/company/eula', '/company/asct']) {
		const re = new RegExp(`\\{% include ja-link\\.html href="${path.replace(/\//g, '\\/')}" `)
		assert.match(live, re, `footer-intl: ${path} が ja-link.html を通っていない`)
	}
	// ヘッダーのナビの docs はラベル + 小さな印
	const docsNav = stripComments(HEADER_INTL).match(/<a href="\/docs"[^>]*>[\s\S]*?<\/a>/)?.[0]
	assert.ok(docsNav, 'header-intl のナビに /docs が無い')
	assert.match(docsNav, /hreflang="ja"/)
	assert.match(docsNav, /L\.ja_only_badge/)
	assert.match(docsNav, /L\.ja_only_title/)
})

test('ja-link.html: hreflang="ja" のリンクと、英中のときだけ出る印', () => {
	const live = stripComments(JA_LINK)
	assert.match(live, /<a href="\{\{ include\.href \}\}"[^>]*hreflang="ja"[^>]*>\{\{ include\.label \}\}<\/a>/)
	const badge = live.match(/\{%-? if page\.lang == 'en' or page\.lang == 'zh-tw' -?%\}([\s\S]*?)\{%-? endif -?%\}/)?.[1]
	assert.ok(badge, '印が英中の分岐の中に無い')
	assert.match(badge, /\bjl_L\.ja_only_badge/)
	assert.match(badge, /title="\{\{ jl_L\.ja_only_title \}\}"/)
	// 呼び出し側の L を上書きしない (include は変数を共有する)
	assert.doesNotMatch(live, /assign L\s*=/)
})

// ---- 言語の切り替え ----

const includeCount = (src) => (stripComments(src).match(/\{%-?\s*include\s+lang-switch\.html\b/g) ?? []).length

test('lang-switch.html の include: header 2 回 / footer 1 回 (写しも同じ)', () => {
	assert.equal(includeCount(HEADER), 2)
	assert.equal(includeCount(HEADER_INTL), 2)
	assert.equal(includeCount(FOOTER), 1)
	assert.equal(includeCount(FOOTER_INTL), 1)
	const variants = (src) => [...stripComments(src).matchAll(/include lang-switch\.html variant="([\w-]+)"/g)].map((m) => m[1])
	assert.deepEqual(variants(HEADER), ['header', 'drawer-data'])
	assert.deepEqual(variants(HEADER_INTL), ['header', 'drawer-data'])
	assert.deepEqual(variants(FOOTER), ['footer'])
	assert.deepEqual(variants(FOOTER_INTL), ['footer'])
})

test('/join/ をナビ・フッター・切り替え・印の部品に載せない (t2090 の規則を写しにも)', () => {
	for (const [name, src] of Object.entries({ HEADER, HEADER_INTL, FOOTER, FOOTER_INTL, SWITCH, JA_LINK })) {
		assert.equal(src.includes('/join/'), false, `${name} に /join/ がある`)
	}
})

/** lang-switch.html の `{%- when 'x' -%}` の本文を返す。 */
function variantBody(name) {
	const live = stripComments(SWITCH)
	const m = live.match(new RegExp(`\\{%-\\s*when '${name}'\\s*-%\\}([\\s\\S]*?)\\{%-\\s*(?:when|endcase)`))
	assert.ok(m, `variant ${name} が無い`)
	return m[1].trim()
}

/** 本文が 1 つの要素だけで、開始タグが data-i18n-switch を持つか。戻り値はタグ名。 */
function assertSingleSwitchElement(body, name) {
	const open = body.match(/^<([a-z]+)\b[^>]*>/)
	assert.ok(open, `${name}: 先頭が要素の開始タグでない: ${body.slice(0, 40)}`)
	assert.match(open[0], /\sdata-i18n-switch(?=[\s>])/, `${name}: 一番外の要素に data-i18n-switch が無い`)
	const tag = open[1]
	assert.ok(body.endsWith(`</${tag}>`), `${name}: 末尾が </${tag}> でない`)
	// 一番外の要素が最後まで続く (同じタグの入れ子を数え、途中で閉じない)
	let depth = 0
	const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g')
	let m
	while ((m = re.exec(body))) {
		depth += m[1] === '/' ? -1 : 1
		if (depth === 0) assert.equal(m.index + m[0].length, body.length, `${name}: 一番外の要素の後に別の出力がある`)
	}
	return tag
}

test('lang-switch.html: 3 つの variant の出力は data-i18n-switch を持つ要素 1 つだけ', () => {
	assert.equal(assertSingleSwitchElement(variantBody('header'), 'header'), 'div')
	assert.equal(assertSingleSwitchElement(variantBody('footer'), 'footer'), 'div')
	const drawer = variantBody('drawer-data')
	assert.equal(assertSingleSwitchElement(drawer, 'drawer-data'), 'script')
	assert.match(drawer, /^<script type="application\/json" data-i18n-switch data-lang-links>/)
	// case の外は出力しない (Liquid のタグとコメントだけ。空白は {%- -%} で落とす)
	const outside = stripComments(SWITCH).replace(/\{%-?\s*case[\s\S]*\{%-?\s*endcase\s*-?%\}/, '')
	assert.equal(outside.replace(/\{%-[\s\S]*?-%\}/g, '').trim(), '', 'case の外に出力がある')
	assert.doesNotMatch(outside, /\{%[^-]|[^-]%\}/, 'case の外の Liquid のタグは {%- -%} で空白を落とす')
})

test('lang-switch.html: リンクは 3 言語の自称・lang・hreflang・今の言語に aria-current', () => {
	for (const name of ['header', 'footer']) {
		const body = variantBody(name)
		const anchors = body.match(/<a\b[^>]*>/g) ?? []
		assert.equal(anchors.length, 3, `${name}: リンクが 3 つでない`)
		const langs = anchors.map((a) => a.match(/\slang="([^"]*)"/)?.[1])
		assert.deepEqual(langs, ['ja', 'en', 'zh-Hant-TW'])
		for (const a of anchors) {
			const lang = a.match(/\slang="([^"]*)"/)[1]
			assert.match(a, new RegExp(`\\shreflang="${lang}"`), `${name}: hreflang が lang と違う: ${a}`)
			assert.match(a, /aria-current/, `${name}: 今の言語の印 (aria-current) を出す式が無い: ${a}`)
		}
		for (const label of ['日本語', 'English', '繁體中文']) assert.ok(body.includes(`>${label}</a>`), `${name}: ${label} が無い`)
	}
	const drawer = variantBody('drawer-data')
	for (const [label, lang] of [
		['日本語', 'ja'],
		['English', 'en'],
		['繁體中文', 'zh-Hant-TW'],
	]) {
		assert.ok(drawer.includes(`"label":"${label}"`) && drawer.includes(`"lang":"${lang}"`), `drawer-data: ${label} / ${lang}`)
	}
	// 行き先は台帳 (_data/i18n_pages.yml) にあれば対応するページ、無ければ各言語のトップ
	const live = stripComments(SWITCH)
	assert.match(live, /site\.data\.i18n_pages\[/)
	assert.match(live, /page\.ja_url \| default: page\.url \| replace: 'index\.html', ''/)
	// 見出し / aria: ja は「表示言語」、英中は L.lang_switch_label
	assert.match(live, /表示言語/)
	assert.match(live, /lang_switch_label/)
})

test('header の切り替えは xl 以上だけに出す (md・lg の既存の幅の条件を壊さない)', () => {
	const open = variantBody('header').match(/^<div\b[^>]*>/)[0]
	const cls = open.match(/class="([^"]*)"/)[1].split(/\s+/)
	assert.ok(cls.includes('hidden') && cls.includes('xl:flex'), `class: ${cls.join(' ')}`)
	assert.equal(
		cls.some((c) => /^(md|lg):(flex|block|inline)/.test(c)),
		false,
		'md / lg で表示しない',
	)
})

// ---- nav.yml ----

test('nav.yml: en と zh-tw のキーの集合が同じ、値が空でない', () => {
	assert.deepEqual(Object.keys(NAV['zh-tw']).sort(), Object.keys(NAV.en).sort())
	assert.ok(Object.keys(NAV.en).length >= 10, '陽性対照: キーが少なすぎる')
	for (const lang of ['en', 'zh-tw']) {
		// 空を許すのは DL のボタンの組み立ての先頭と末尾 (dl_cta_lead / dl_cta_tail。T-2303: en は「Download」+「 for free」で末尾が空、
		// zh-tw は「免費」+「下載」で先頭が空) だけ
		const mayBeEmpty = new Set(['dl_cta_lead', 'dl_cta_tail'])
		for (const [k, v] of Object.entries(NAV[lang])) if (!mayBeEmpty.has(k)) assert.ok(v.length > 0, `${lang}.${k} が空`)
		// md の短い形 (lead + tail) は空にしない
		assert.ok((NAV[lang].dl_cta_lead + NAV[lang].dl_cta_tail).trim().length > 0, `${lang}: DL の短い形が空`)
	}
})

test('nav.yml: 全部の値が lintValue を通り、属性・JSON を壊す字を含まない', () => {
	for (const lang of ['en', 'zh-tw']) {
		for (const [k, v] of Object.entries(NAV[lang])) {
			assert.deepEqual(lintValue(lang, v), [], `${lang}.${k}: ${v}`)
			assert.doesNotMatch(v, /["'<>\\]/, `${lang}.${k}: 属性や data-links の JSON を壊す字`)
		}
	}
})

test('nav.yml: 短い形と長い形の組み立てが全体の文と一致する (textContent は全幅で長い文のまま)', () => {
	for (const lang of ['en', 'zh-tw']) {
		const n = NAV[lang]
		assert.equal(n.dl_cta_lead + n.dl_cta_lg + n.dl_cta_tail, n.dl_cta, `${lang}: dl_cta`)
		assert.equal(n.enterprise_short + n.enterprise_lg, n.enterprise, `${lang}: enterprise`)
	}
	// T-2303: 全体の文は ja の「無料でダウンロード」の訳 (用語集の download / free)
	assert.equal(NAV.en.dl_cta, 'Download for free')
	assert.equal(NAV['zh-tw'].dl_cta, '免費下載')
	for (const lang of ['en', 'zh-tw']) {
		for (const k of Object.keys(NAV[lang])) assert.doesNotMatch(k, /^store_|_store$/, `${lang}: Store のキーが残っている: ${k}`)
	}
	// 写しが同じ組み立てで描く
	const live = stripComments(HEADER_INTL)
	assert.match(live, /\{\{ N\.dl_cta_lead \}\}<span class="hidden lg:inline">\{\{ N\.dl_cta_lg \}\}<\/span>\{\{ N\.dl_cta_tail \}\}/)
	assert.match(live, /\{\{ N\.enterprise_short \}\}<span class="hidden lg:inline">\{\{ N\.enterprise_lg \}\}<\/span>/)
	assert.match(live, /aria-label="\{\{ N\.enterprise \}\}"/)
})

test('英中の写しが参照する nav のキーは nav.yml に全部ある', () => {
	for (const [name, src] of Object.entries({ HEADER_INTL, FOOTER_INTL })) {
		const used = [...stripComments(src).matchAll(/\bN\.([a-z0-9_]+)/g)].map((m) => m[1])
		assert.ok(used.length > 0, `${name}: N. の参照が無い`)
		for (const k of used) assert.ok(k in NAV.en, `${name}: nav.yml に ${k} が無い`)
	}
	// 写しに仮名を直書きしない (表示言語の自称は lang-switch.html の中)
	for (const [name, src] of Object.entries({ HEADER_INTL, FOOTER_INTL })) {
		assert.doesNotMatch(stripComments(src), /[぀-ヿ]/, `${name} に仮名`)
	}
})

// ---- site-lang.js ----

test('site-lang: pageLang は <html lang> から ja / en / zh-tw を返す', () => {
	const doc = (lang) => ({ documentElement: { lang } })
	assert.equal(pageLang(doc('en')), 'en')
	assert.equal(pageLang(doc('en-US')), 'en')
	assert.equal(pageLang(doc('zh-Hant-TW')), 'zh-tw')
	assert.equal(pageLang(doc('zh')), 'zh-tw')
	assert.equal(pageLang(doc('ja')), 'ja')
	assert.equal(pageLang(doc('')), 'ja')
	assert.equal(pageLang(doc(undefined)), 'ja')
	assert.equal(pageLang({}), 'ja')
	assert.equal(pageLang(null), 'ja')
	assert.equal(pageLang(undefined), 'ja', 'node には document が無い = ja')
	assert.equal(pageLang(doc('fr')), 'ja')
})

test('site-lang: pick は言語の値を返し、無ければ ja', () => {
	const byLang = { ja: 'あ', en: 'a', 'zh-tw': '甲' }
	assert.equal(pick(byLang, 'en'), 'a')
	assert.equal(pick(byLang, 'zh-tw'), '甲')
	assert.equal(pick(byLang, 'ja'), 'あ')
	assert.equal(pick({ ja: 'あ' }, 'en'), 'あ')
	assert.equal(pick(byLang, 'fr'), 'あ')
})

// ---- MobileNav ----

test('MobileNav: ja の aria-label を残し、3 言語の表から選ぶ。言語のリンクは data-lang-links から読む', () => {
	const src = read('src/islands/MobileNav.svelte')
	assert.match(src, /from '\.\.\/lib\/site-lang\.js'/)
	assert.match(src, /'メニューを開く'/)
	assert.match(src, /'メニューを閉じる'/)
	const textSrc = src.match(/const TEXT = \{([\s\S]*?)\n\s*\};/)?.[1]
	assert.ok(textSrc, 'TEXT の表が無い')
	const keysOf = (lang) => {
		const body = textSrc.match(new RegExp(`${lang}: \\{([^}]*)\\}`))?.[1]
		assert.ok(body, `TEXT に ${lang} が無い`)
		return [...body.matchAll(/(\w+):/g)].map((m) => m[1]).sort()
	}
	assert.deepEqual(keysOf("'zh-tw'"), keysOf('ja'))
	assert.deepEqual(keysOf('en'), keysOf('ja'))
	assert.match(src, /script\[data-lang-links\]/)
	assert.match(src, /hreflang=/)
	assert.match(src, /aria-current=/)
	assert.match(src, /data-i18n-switch/)
	// 既存のドロワーの処理は変えない
	assert.match(src, /download=\{downloadAttr\(item\.download\)\}/)
	assert.match(src, /decorateDownloadUrl/)
})

// ---- app.css ----

test('app.css: 英中のディレクトリの @source と :root:lang(zh) のフォント', () => {
	const css = read('src/app.css')
	assert.match(css, /@source "\.\.\/en\/\*\*\/\*\.html";/)
	assert.match(css, /@source "\.\.\/zh-tw\/\*\*\/\*\.html";/)
	const zh = css.match(/:root:lang\(zh\)\s*\{([^}]*)\}/)?.[1]
	assert.ok(zh, ':root:lang(zh) の規則が無い')
	assert.match(zh, /--font-sans:\s*"Roboto",\s*"Noto Sans TC",\s*"PingFang TC",\s*"Microsoft JhengHei"/)
})

test('app.css: 言語で分ける規則は :root:lang(zh) と :root:not(:lang(ja)) の下だけ (ja の CSS を変えない)', () => {
	const css = read('src/app.css').replace(/\/\*[\s\S]*?\*\//g, '')
	const selectors = [...css.matchAll(/([^{};]+)\{/g)].map((m) => m[1].trim()).filter((s) => /:lang\(/.test(s))
	assert.ok(selectors.includes(':root:lang(zh)'), '陽性対照')
	for (const sel of selectors) {
		for (const part of sel.split(',').map((p) => p.trim())) {
			assert.ok(
				part === ':root:lang(zh)' || part.startsWith(':root:not(:lang(ja))'),
				`言語の規則が :root:not(:lang(ja)) の下に無い: ${part}`,
			)
		}
	}
})

// app.css から「英中の @source 2 行」と「セレクタに :lang( を含む規則 (入れ子ごと)」を除き、コメントを消して空白を詰めた本文。
// @source の文字列 (en・zh-tw のディレクトリの glob) はコメントの開き・閉じの並びを含むので、コメントを消す前に除く。
function jaCssBody(css) {
	const s = css
		.replace(/\r\n/g, '\n')
		.replace(/@source "\.\.\/(?:en|zh-tw)\/\*\*\/\*\.html";/g, '')
		// ウェーブ末尾の追い修正: Tailwind の自動検出から外す 3 行 (scripts/・語 table・語 shrink。
		// 基点のビルドに無かった .table・.shrink を消すため。ja の規則は増えも減りもしない)
		.replace(/@source not (?:"\.\.\/scripts"|inline\("(?:table|shrink)"\));/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
	let out = ''
	let seg = 0
	for (let i = 0; i < s.length; i++) {
		const ch = s[i]
		if (ch === ';' || ch === '}') {
			out += s.slice(seg, i + 1)
			seg = i + 1
			continue
		}
		if (ch !== '{') continue
		if (!/:lang\(/.test(s.slice(seg, i))) {
			out += s.slice(seg, i + 1)
			seg = i + 1
			continue
		}
		let depth = 1
		let j = i + 1
		for (; j < s.length && depth > 0; j++) depth += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0
		seg = j
		i = j - 1
	}
	out += s.slice(seg)
	return out.replace(/\s+/g, ' ').trim()
}
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

// 基点 (10678af = i18n1112 の前) の src/app.css の jaCssBody の sha256。
// ja の見た目を意図して変えるとき (i18n1112 の後の通常の改修) は、この値を新しい app.css から取り直す。
const BASE_JA_CSS_SHA256 = '3c3b15abbeb4fd89bf34b50bf0058ed8825019ad025226c7469f3d55b42aa3bb'

test('app.css: 言語の規則を除いた本文は基点と同じ (ja の CSS を変えていない)', () => {
	const css = read('src/app.css')
	assert.equal(sha256(jaCssBody(css)), BASE_JA_CSS_SHA256, '言語の規則 (:root:lang(zh)・:root:not(:lang(ja))) 以外の規則が変わった')
	// 陽性対照: 英中の直しを :root:not(:lang(ja)) の下に足しても (入れ子を含む) 本文は変わらない
	const withIntl = `${css}\n:root:not(:lang(ja)) .site-header { gap: 0; }\n:root:not(:lang(ja)) { .x { .y { color: red; } } }\n`
	assert.equal(sha256(jaCssBody(withIntl)), BASE_JA_CSS_SHA256, '陽性対照')
	// 陰性対照: ja に効く普通の規則を 1 つ足す・既存の値を 1 つ変えると落ちる
	assert.notEqual(sha256(jaCssBody(`${css}\n.btn-primary { color: red; }\n`)), BASE_JA_CSS_SHA256, '陰性対照 (規則の追加)')
	assert.notEqual(sha256(jaCssBody(`${css}\nbody { font-size: 30px; }\n`)), BASE_JA_CSS_SHA256, '陰性対照 (body)')
	assert.notEqual(
		sha256(jaCssBody(css.replace('"Noto Sans JP"', '"Noto Sans TC"'))),
		BASE_JA_CSS_SHA256,
		'陰性対照 (既存の値の変更)',
	)
})

// ---- checks/nav.mjs (ビルドの出力の検査) の単体 ----

const ORIGIN = 'https://www.deepmosaic.co.jp'

function switchHtml(cur, [ja, en, zh]) {
	const a = (href, lang, label) =>
		`<a href="${href}" lang="${lang}" hreflang="${lang}"${lang === cur ? ' aria-current="true"' : ''}>${label}</a>`
	const links = a(ja, 'ja', '日本語') + a(en, 'en', 'English') + a(zh, 'zh-Hant-TW', '繁體中文')
	const json = JSON.stringify([
		{ label: '日本語', href: ja, lang: 'ja', current: cur === 'ja' },
		{ label: 'English', href: en, lang: 'en', current: cur === 'en' },
		{ label: '繁體中文', href: zh, lang: 'zh-Hant-TW', current: cur === 'zh-Hant-TW' },
	])
	return {
		header: `<div data-i18n-switch class="hidden xl:flex">${links}</div>`,
		drawer: `<script type="application/json" data-i18n-switch data-lang-links>${json}</script>`,
		footer: `<div data-i18n-switch class="flex">${links}</div>`,
	}
}

function pageHtml({ canonical, cur, dests, headerText = 'Home', footerExtra = '' }) {
	const s = switchHtml(cur, dests)
	return `<html lang="${cur}"><head><link rel="canonical" href="${ORIGIN}${canonical}" /></head><body>
<header><a href="/">${headerText}</a>
${s.header}
<div class="md:hidden">${s.drawer}</div></header>
<main>本文</main>
<footer>${footerExtra}
${s.footer}
</footer></body></html>`
}

function makeSite(pages) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-nav-'))
	for (const [rel, html] of Object.entries(pages)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true })
		writeFileSync(join(dir, rel), html)
	}
	return dir
}

function runNav(pages) {
	const dir = makeSite(pages)
	try {
		return checkNav(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

const LEGAL_EN =
	'<a href="/company/terms" class="x" hreflang="ja">Terms of Service</a><span class="b" title="This page is in Japanese.">(Japanese)</span>' +
	'<a href="/docs" class="x" hreflang="ja">Documentation</a><span class="b" title="This page is in Japanese.">(Japanese)</span>'

test('checks/nav.mjs: 正しい模型ではエラー 0 (台帳のページ・台帳に無いページ・英中のページ)', () => {
	const errors = runNav({
		'price/index.html': pageHtml({ canonical: '/price/', cur: 'ja', dests: ['/price/', '/en/price/', '/zh-tw/price/'] }),
		'company/terms.html': pageHtml({ canonical: '/company/terms', cur: 'ja', dests: ['/', '/en/', '/zh-tw/'] }),
		'company/about.html': pageHtml({
			canonical: '/company/about',
			cur: 'ja',
			dests: ['/company/about', '/en/company/about', '/zh-tw/company/about'],
		}),
		'en/price/index.html': pageHtml({
			canonical: '/en/price/',
			cur: 'en',
			dests: ['/price/', '/en/price/', '/zh-tw/price/'],
			footerExtra: LEGAL_EN,
		}),
		// ルートの 404.html: header の次の行に振り分けの印 (I18N-712、W7-site.md §0-G)。切り替えとして数えない
		'404.html': pageHtml({ canonical: '/404.html', cur: 'ja', dests: ['/', '/en/', '/zh-tw/'] }).replace(
			'</header>',
			'</header>\n<div hidden data-i18n-switch data-lang-404></div>',
		),
		'plain.html': '<html><body>no header</body></html>',
	})
	assert.deepEqual(errors, [])
})

test('checks/nav.mjs: 切り替えが足りない・行き先が台帳と違う・今の言語が違うと失敗', () => {
	const good = pageHtml({ canonical: '/price/', cur: 'ja', dests: ['/price/', '/en/price/', '/zh-tw/price/'] })
	const noFooter = good.replace(/<div data-i18n-switch class="flex">[\s\S]*?<\/div>/, '')
	assert.ok(runNav({ 'price/index.html': noFooter }).some((e) => /3 か所/.test(e)), '足りない')
	const wrongDest = pageHtml({ canonical: '/price/', cur: 'ja', dests: ['/', '/en/', '/zh-tw/'] })
	assert.ok(runNav({ 'price/index.html': wrongDest }).some((e) => /行き先/.test(e)), '台帳のページなのにトップへ')
	const notListed = pageHtml({ canonical: '/company/terms', cur: 'ja', dests: ['/company/terms', '/en/company/terms', '/zh-tw/company/terms'] })
	assert.ok(runNav({ 'company/terms.html': notListed }).some((e) => /行き先/.test(e)), '台帳に無いページは各言語のトップ')
	const wrongCur = pageHtml({ canonical: '/price/', cur: 'en', dests: ['/price/', '/en/price/', '/zh-tw/price/'] }).replace(
		'<html lang="en">',
		'<html lang="ja">',
	)
	assert.ok(runNav({ 'price/index.html': wrongCur }).some((e) => /aria-current/.test(e)), '今の言語の印')
})

test('checks/nav.mjs: 英中のヘッダー・フッターの仮名、印の無い対象外のリンクは失敗', () => {
	const kana = pageHtml({
		canonical: '/en/price/',
		cur: 'en',
		dests: ['/price/', '/en/price/', '/zh-tw/price/'],
		headerText: 'ホーム',
	})
	assert.ok(runNav({ 'en/price/index.html': kana }).some((e) => /仮名/.test(e)), 'ヘッダーの仮名')
	const noBadge = pageHtml({
		canonical: '/en/price/',
		cur: 'en',
		dests: ['/price/', '/en/price/', '/zh-tw/price/'],
		footerExtra: '<a href="/company/privacy" class="x">Privacy Policy</a>',
	})
	const errors = runNav({ 'en/price/index.html': noBadge })
	assert.ok(errors.some((e) => /\/company\/privacy/.test(e)), `印の無い法務のリンク: ${errors.join(' / ')}`)
	const prefixed = pageHtml({
		canonical: '/en/price/',
		cur: 'en',
		dests: ['/price/', '/en/price/', '/zh-tw/price/'],
		footerExtra: '<a href="/en/company/terms" hreflang="ja">Terms</a><span>(Japanese)</span>',
	})
	assert.ok(runNav({ 'en/price/index.html': prefixed }).some((e) => /ja の URL/.test(e)), '法務に接頭辞')
})
