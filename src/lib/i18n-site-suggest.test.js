// T-2211 (i18n1112 I18N-713, 2026-11-12) サイトの言語の自動の案内 (帯) と選んだ言語の記憶の仕様テスト。
//
//   node --test src/lib/i18n-site-suggest.test.js
//
//   - resolveSiteLang: desktop の fromSystem (設計書 §1.2) と同じ規則。ただし情報が無い (空) ときは ja (spec の決定)
//   - decideSuggestion: 帯を出すか・どの言語へ案内するか (英中のページ・保存値 ja・alternate が無いときは出さない)
//   - hreflangToSiteLang / toSitePath: <link rel="alternate" hreflang> の値と href の読み方
//   - TEXT: en と zh-tw のキーの集合が ja と同じで、lintValue (I18N-702) を通る
//   - mountLangSuggest: 小さな偽の document / storage / navigator で、帯の描画・保存・例外への耐性・リダイレクトしないこと
//   - main.js: import と呼び出しの 2 行が「i18n の初期化」の区切りの下にある
//   - jsdom・linkedom は使わない (devDependencies に無いので足さない)。DOM の実際の見え方はウェーブ末尾の Playwright で見る

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
	STORAGE_KEY,
	TEXT,
	resolveSiteLang,
	decideSuggestion,
	hreflangToSiteLang,
	toSitePath,
	normalizeStored,
} from './lang-suggest.js'
import { lintValue } from '../../scripts/i18n/site-lint.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

// lang-suggest-mount.js は `import './lang-suggest.css'` を持つ (vite が app.css に束ねる)。
// node は .css を import できないので、このテストの中だけ空のモジュールに差し替えてから動的に import する。
let mountLangSuggest
before(async () => {
	const hooks = [
		'export async function resolve(specifier, context, next) {',
		"  if (specifier.endsWith('.css')) return { url: 'data:text/javascript,', shortCircuit: true }",
		'  return next(specifier, context)',
		'}',
	].join('\n')
	register(`data:text/javascript,${encodeURIComponent(hooks)}`)
	;({ mountLangSuggest } = await import('./lang-suggest-mount.js'))
})

// ---- 1. resolveSiteLang ----

test('resolveSiteLang: 先頭から見て最初に当たる言語 (ja / zh* → zh-tw / en)、どれにも当たらなければ en', () => {
	const cases = [
		[['ja-JP'], 'ja'],
		[['ja'], 'ja'],
		[['en-US'], 'en'],
		[['en-GB'], 'en'],
		[['zh-TW'], 'zh-tw'],
		[['zh-HK'], 'zh-tw'],
		[['zh-CN'], 'zh-tw'],
		[['zh-SG'], 'zh-tw'],
		[['zh-Hans-CN'], 'zh-tw'],
		[['zh-Hant'], 'zh-tw'],
		[['zh'], 'zh-tw'],
		[['ZH_tw'], 'zh-tw'],
		[['fr-FR'], 'en'],
		[['ko-KR'], 'en'],
		[['fr-FR', 'ja'], 'ja'],
		[['ko-KR', 'ja-JP'], 'ja'],
		[['fr-FR', 'zh-TW'], 'zh-tw'],
		[['en-US', 'ja-JP'], 'en'],
		[['ja-JP', 'en-US'], 'ja'],
		[['x'], 'en'],
		// 「jv」「enx」のような別の言語を取り違えない (主タグで比べる)
		[['jv-ID'], 'en'],
		[['jav'], 'en'],
		[['enx'], 'en'],
	]
	for (const [langs, want] of cases) {
		assert.equal(resolveSiteLang(langs), want, JSON.stringify(langs))
	}
})

test('resolveSiteLang: 言語の情報が無い (空・空文字だけ・配列でない) ときは ja = 帯を出さない', () => {
	assert.equal(resolveSiteLang([]), 'ja')
	assert.equal(resolveSiteLang(['']), 'ja')
	assert.equal(resolveSiteLang(['  ']), 'ja')
	assert.equal(resolveSiteLang(undefined), 'ja')
	assert.equal(resolveSiteLang(null), 'ja')
	assert.equal(resolveSiteLang('en-US'), 'ja')
	assert.equal(resolveSiteLang([null, 42, 'en-US']), 'en')
})

// ---- 2. decideSuggestion ----

const ALT = { en: '/en/price/', 'zh-tw': '/zh-tw/price/' }

test('decideSuggestion: ja のページ + 英中のブラウザ (保存値なし) → その言語の alternate の href がそのまま返る', () => {
	assert.deepEqual(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: null, alternates: ALT }), {
		lang: 'en',
		href: '/en/price/',
	})
	assert.deepEqual(decideSuggestion({ pageLang: 'ja', languages: ['zh-CN'], stored: null, alternates: ALT }), {
		lang: 'zh-tw',
		href: '/zh-tw/price/',
	})
})

test('decideSuggestion: 英中のページでは出さない', () => {
	assert.equal(decideSuggestion({ pageLang: 'en', languages: ['en-US'], stored: null, alternates: ALT }), null)
	assert.equal(decideSuggestion({ pageLang: 'zh-tw', languages: ['zh-TW'], stored: 'en', alternates: ALT }), null)
})

test('decideSuggestion: 保存値 ja (帯を閉じた・日本語を選んだ) なら英中のブラウザでも出さない', () => {
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: 'ja', alternates: ALT }), null)
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['zh-TW'], stored: 'ja', alternates: ALT }), null)
})

test('decideSuggestion: 保存値 en / zh-tw は ja のブラウザでも勝つ (選んだ言語)', () => {
	assert.deepEqual(decideSuggestion({ pageLang: 'ja', languages: ['ja-JP'], stored: 'en', alternates: ALT }), {
		lang: 'en',
		href: '/en/price/',
	})
	assert.deepEqual(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: 'zh-tw', alternates: ALT }), {
		lang: 'zh-tw',
		href: '/zh-tw/price/',
	})
})

test('decideSuggestion: ja のブラウザ・情報の無いブラウザ (保存値なし) には出さない', () => {
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['ja-JP', 'en-US'], stored: null, alternates: ALT }), null)
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: [], stored: null, alternates: ALT }), null)
})

test('decideSuggestion: 候補の alternate が無い (docs・法務・404) なら出さない', () => {
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: null, alternates: {} }), null)
	assert.equal(
		decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: null, alternates: { 'zh-tw': '/zh-tw/' } }),
		null,
	)
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: 'en', alternates: undefined }), null)
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: null, alternates: { en: '' } }), null)
})

test('decideSuggestion: 未知の保存値は保存値なしと同じ (ブラウザの言語で決める)', () => {
	assert.deepEqual(decideSuggestion({ pageLang: 'ja', languages: ['en-US'], stored: 'ko', alternates: ALT }), {
		lang: 'en',
		href: '/en/price/',
	})
	assert.equal(decideSuggestion({ pageLang: 'ja', languages: ['ja-JP'], stored: 'zh-TW?', alternates: ALT }), null)
})

test('normalizeStored: ja / en / zh-tw だけを受ける (zh-TW は zh-tw にそろえる)', () => {
	assert.equal(normalizeStored('ja'), 'ja')
	assert.equal(normalizeStored('en'), 'en')
	assert.equal(normalizeStored('zh-tw'), 'zh-tw')
	assert.equal(normalizeStored('zh-TW'), 'zh-tw')
	assert.equal(normalizeStored('fr'), null)
	assert.equal(normalizeStored(''), null)
	assert.equal(normalizeStored(null), null)
	assert.equal(normalizeStored(undefined), null)
})

// ---- 3. hreflang と href ----

test('hreflangToSiteLang: ja / en / zh-Hant-TW / zh-tw を受け、x-default と他は null', () => {
	assert.equal(hreflangToSiteLang('ja'), 'ja')
	assert.equal(hreflangToSiteLang('en'), 'en')
	assert.equal(hreflangToSiteLang('zh-Hant-TW'), 'zh-tw')
	assert.equal(hreflangToSiteLang('zh-tw'), 'zh-tw')
	assert.equal(hreflangToSiteLang('ZH-HANT-TW'), 'zh-tw')
	assert.equal(hreflangToSiteLang('x-default'), null)
	assert.equal(hreflangToSiteLang('fr'), null)
	assert.equal(hreflangToSiteLang(null), null)
})

test('toSitePath: 本番の絶対 URL をサイト内のパスにする (配信元が違っても同じサイトの中で移る)', () => {
	assert.equal(toSitePath('https://www.deepmosaic.co.jp/en/price/'), '/en/price/')
	assert.equal(toSitePath('https://www.deepmosaic.co.jp/zh-tw/'), '/zh-tw/')
	assert.equal(toSitePath('https://www.deepmosaic.co.jp/en/company/about'), '/en/company/about')
	assert.equal(toSitePath('/en/'), '/en/')
	// http(s) とパスだけ。javascript: などは捨てる
	assert.equal(toSitePath('javascript:alert(1)'), null)
	assert.equal(toSitePath('data:text/html,x'), null)
	assert.equal(toSitePath(''), null)
	assert.equal(toSitePath(null), null)
})

// ---- 4. TEXT ----

test('TEXT: 3 言語のキーの集合が同じで、空の値が無い', () => {
	assert.deepEqual(Object.keys(TEXT).sort(), ['en', 'ja', 'zh-tw'])
	const keys = Object.keys(TEXT.ja).sort()
	assert.deepEqual(keys, ['action', 'close', 'message', 'region'])
	for (const lang of ['en', 'zh-tw']) {
		assert.deepEqual(Object.keys(TEXT[lang]).sort(), keys, lang)
		for (const k of keys) assert.ok(String(TEXT[lang][k]).trim().length > 0, `${lang}.${k}`)
	}
})

test('TEXT: spec が決めた文と用語集の「閉じる」(close / 關閉)', () => {
	assert.equal(TEXT.en.message, 'This page is also available in English.')
	assert.equal(TEXT['zh-tw'].message, '本頁面也提供繁體中文版。')
	assert.equal(TEXT.en.action, 'View in English')
	assert.equal(TEXT['zh-tw'].action, '以繁體中文檢視')
	assert.equal(TEXT.en.close, 'Close')
	assert.equal(TEXT['zh-tw'].close, '關閉')
})

test('TEXT: en と zh-tw の値が lintValue を通る (仮名・漢字・全角・禁止字・禁止語・和製漢語)', () => {
	for (const lang of ['en', 'zh-tw']) {
		for (const [k, v] of Object.entries(TEXT[lang])) {
			assert.deepEqual(lintValue(lang, v), [], `${lang}.${k}: ${v}`)
		}
	}
})

test('STORAGE_KEY は dm-site-lang', () => {
	assert.equal(STORAGE_KEY, 'dm-site-lang')
})

// ---- 5. mountLangSuggest (偽の DOM) ----

/** `tag[attr]` / `[attr]` / `[attr="v"]` の並びだけを読む最小の matcher */
function matches(el, selector) {
	const m = selector.match(/^([a-z]*)((?:\[[^\]]+\])*)$/)
	if (!m) throw new Error(`fake dom: 読めないセレクタ ${selector}`)
	if (m[1] && el.tagName !== m[1]) return false
	for (const [, name, val] of m[2].matchAll(/\[([a-z0-9-]+)(?:="([^"]*)")?\]/g)) {
		if (!el.hasAttribute(name)) return false
		if (val !== undefined && el.getAttribute(name) !== val) return false
	}
	return true
}

class FakeElement {
	constructor(tagName) {
		this.tagName = tagName.toLowerCase()
		this.attrs = new Map()
		this.children = []
		this.parentNode = null
		this.listeners = {}
		this._text = ''
		this.className = ''
	}
	setAttribute(k, v) {
		this.attrs.set(k, String(v))
	}
	getAttribute(k) {
		return this.attrs.has(k) ? this.attrs.get(k) : null
	}
	hasAttribute(k) {
		return this.attrs.has(k)
	}
	get textContent() {
		return this._text + this.children.map((c) => c.textContent).join('')
	}
	set textContent(v) {
		this._text = String(v)
		this.children = []
	}
	get firstChild() {
		return this.children[0] ?? null
	}
	append(...nodes) {
		for (const n of nodes) {
			n.parentNode = this
			this.children.push(n)
		}
	}
	insertBefore(node, ref) {
		node.parentNode = this
		const i = ref ? this.children.indexOf(ref) : -1
		if (i < 0) this.children.push(node)
		else this.children.splice(i, 0, node)
		return node
	}
	remove() {
		if (!this.parentNode) return
		this.parentNode.children = this.parentNode.children.filter((c) => c !== this)
		this.parentNode = null
	}
	addEventListener(type, fn) {
		;(this.listeners[type] ??= []).push(fn)
	}
	click() {
		const ev = {
			type: 'click',
			target: this,
			defaultPrevented: false,
			preventDefault() {
				this.defaultPrevented = true
			},
		}
		for (const fn of this.listeners.click ?? []) fn(ev)
		return ev
	}
	closest(selector) {
		for (let el = this; el; el = el.parentNode) if (el instanceof FakeElement && matches(el, selector)) return el
		return null
	}
	/** 子孫を深さ優先で */
	*walk() {
		for (const c of this.children) {
			yield c
			yield* c.walk()
		}
	}
	find(selector) {
		for (const el of this.walk()) if (matches(el, selector)) return el
		return null
	}
}

function makeLink(hreflang, href) {
	const l = new FakeElement('link')
	l.setAttribute('rel', 'alternate')
	l.setAttribute('hreflang', hreflang)
	l.setAttribute('href', href)
	return l
}

const PRICE_ALTERNATES = [
	makeLink('ja', 'https://www.deepmosaic.co.jp/price/'),
	makeLink('en', 'https://www.deepmosaic.co.jp/en/price/'),
	makeLink('zh-Hant-TW', 'https://www.deepmosaic.co.jp/zh-tw/price/'),
	makeLink('x-default', 'https://www.deepmosaic.co.jp/en/price/'),
]

function makeDoc({ lang = 'ja', links = PRICE_ALTERNATES, scrollY = 0 } = {}) {
	const body = new FakeElement('body')
	body.append(new FakeElement('header'))
	const listeners = {}
	return {
		documentElement: { lang },
		body,
		defaultView: {
			scrollY,
			scrollTo() {
				throw new Error('スクロールを動かさない')
			},
		},
		createElement: (t) => new FakeElement(t),
		querySelectorAll: (sel) => (sel.startsWith('link') ? links.filter((l) => matches(l, sel)) : []),
		addEventListener(type, fn) {
			;(listeners[type] ??= []).push(fn)
		},
		dispatch(type, target) {
			const ev = { type, target, preventDefault() {} }
			for (const fn of listeners[type] ?? []) fn(ev)
		},
	}
}

function makeStorage(initial = null) {
	const map = new Map()
	if (initial !== null) map.set(STORAGE_KEY, initial)
	return {
		map,
		getItem: (k) => (map.has(k) ? map.get(k) : null),
		setItem: (k, v) => map.set(k, String(v)),
	}
}

const throwingStorage = {
	getItem() {
		throw new Error('SecurityError')
	},
	setItem() {
		throw new Error('QuotaExceededError')
	},
}

const navOf = (...languages) => ({ languages, language: languages[0] })
const tags = (doc) => doc.body.children.map((c) => c.tagName)

test('mount: ja のページ + en のブラウザ → body の先頭に英語の帯 (region・lang・data-nosnippet・サイト内のパス)', () => {
	const doc = makeDoc()
	const banner = mountLangSuggest(doc, makeStorage(), navOf('en-US'))
	assert.ok(banner)
	assert.equal(doc.body.firstChild, banner, 'body の先頭 (ヘッダーより前の通常の流れ)')
	assert.equal(banner.getAttribute('role'), 'region')
	assert.equal(banner.getAttribute('aria-label'), TEXT.en.region)
	assert.equal(banner.getAttribute('lang'), 'en')
	assert.ok(banner.hasAttribute('data-nosnippet'))
	assert.match(banner.className, /\blang-suggest\b/)
	const link = banner.find('a')
	assert.equal(link.getAttribute('href'), '/en/price/')
	assert.equal(link.getAttribute('hreflang'), 'en')
	assert.equal(link.textContent, TEXT.en.action)
	assert.ok(banner.textContent.includes(TEXT.en.message))
	const close = banner.find('button')
	assert.equal(close.getAttribute('type'), 'button')
	assert.equal(close.textContent, TEXT.en.close)
})

test('mount: zh-CN のブラウザ → 繁体字の帯 (lang="zh-Hant-TW") で /zh-tw/price/', () => {
	const banner = mountLangSuggest(makeDoc(), makeStorage(), navOf('zh-CN'))
	assert.equal(banner.getAttribute('lang'), 'zh-Hant-TW')
	assert.equal(banner.getAttribute('aria-label'), TEXT['zh-tw'].region)
	assert.equal(banner.find('a').getAttribute('href'), '/zh-tw/price/')
	assert.equal(banner.find('a').getAttribute('hreflang'), 'zh-Hant-TW')
	assert.equal(banner.find('a').textContent, TEXT['zh-tw'].action)
})

test('mount: ja のブラウザ・保存値 ja・alternate の無いページ・英中のページでは何も描かない', () => {
	for (const [name, doc, storage, nav] of [
		['ja のブラウザ', makeDoc(), makeStorage(), navOf('ja-JP')],
		['保存値 ja', makeDoc(), makeStorage('ja'), navOf('en-US')],
		['alternate なし (docs)', makeDoc({ links: [] }), makeStorage(), navOf('en-US')],
		['en のページ', makeDoc({ lang: 'en' }), makeStorage(), navOf('en-US')],
		['zh-tw のページ', makeDoc({ lang: 'zh-Hant-TW' }), makeStorage('en'), navOf('zh-TW')],
	]) {
		assert.equal(mountLangSuggest(doc, storage, nav), null, name)
		assert.deepEqual(tags(doc), ['header'], `${name}: body に何も足さない`)
	}
})

test('mount: 帯のリンクを押すとその言語を保存し、遷移は止めない (リダイレクトもしない)', () => {
	const storage = makeStorage()
	const banner = mountLangSuggest(makeDoc(), storage, navOf('en-US'))
	const ev = banner.find('a').click()
	assert.equal(storage.map.get(STORAGE_KEY), 'en')
	assert.equal(ev.defaultPrevented, false)
})

test('mount: 閉じるで帯を外し ja を保存する → 次の読み込みでは出ない', () => {
	const doc = makeDoc()
	const storage = makeStorage()
	const banner = mountLangSuggest(doc, storage, navOf('en-US'))
	banner.find('button').click()
	assert.equal(storage.map.get(STORAGE_KEY), 'ja')
	assert.equal(banner.parentNode, null)
	assert.deepEqual(tags(doc), ['header'])
	assert.equal(mountLangSuggest(makeDoc(), storage, navOf('en-US')), null)
})

test('mount: 保存値 en なら ja のブラウザでも ja のページで帯を出す', () => {
	const banner = mountLangSuggest(makeDoc(), makeStorage('en'), navOf('ja-JP'))
	assert.ok(banner)
	assert.equal(banner.find('a').getAttribute('href'), '/en/price/')
})

/** 言語の切り替え (I18N-706 の lang-switch.html の形) を body に足す */
function addSwitch(doc) {
	const wrap = new FakeElement('div')
	wrap.setAttribute('data-i18n-switch', '')
	const links = {}
	for (const [hl, href] of [
		['ja', '/price/'],
		['en', '/en/price/'],
		['zh-Hant-TW', '/zh-tw/price/'],
	]) {
		const a = new FakeElement('a')
		a.setAttribute('href', href)
		a.setAttribute('hreflang', hl)
		const label = new FakeElement('span') // リンクの中の子要素を押した場合も拾う
		a.append(label)
		wrap.append(a)
		links[hl] = { a, label }
	}
	doc.body.append(wrap)
	return links
}

test('mount: 言語の切り替えのリンクを押すとその言語を保存する (中の要素を押しても)', () => {
	const doc = makeDoc()
	const storage = makeStorage()
	mountLangSuggest(doc, storage, navOf('en-US'))
	const sw = addSwitch(doc)
	doc.dispatch('click', sw['zh-Hant-TW'].label)
	assert.equal(storage.map.get(STORAGE_KEY), 'zh-tw')
	doc.dispatch('click', sw.ja.a)
	assert.equal(storage.map.get(STORAGE_KEY), 'ja')
	doc.dispatch('click', sw.en.a)
	assert.equal(storage.map.get(STORAGE_KEY), 'en')
})

test('mount: 英中のページでも言語の切り替えの選択は保存する (帯は描かない)', () => {
	const doc = makeDoc({ lang: 'en' })
	const storage = makeStorage()
	assert.equal(mountLangSuggest(doc, storage, navOf('en-US')), null)
	const sw = addSwitch(doc)
	doc.dispatch('click', sw.ja.a)
	assert.equal(storage.map.get(STORAGE_KEY), 'ja')
})

test('mount: 切り替えの外のリンク・hreflang の無いリンク・テキストのノードを押しても保存しない', () => {
	const doc = makeDoc()
	const storage = makeStorage()
	mountLangSuggest(doc, storage, navOf('ja-JP'))
	const outside = new FakeElement('a')
	outside.setAttribute('hreflang', 'en')
	doc.body.append(outside)
	doc.dispatch('click', outside)
	const sw = addSwitch(doc)
	sw.en.a.attrs.delete('hreflang')
	doc.dispatch('click', sw.en.a)
	doc.dispatch('click', { nodeType: 3 }) // テキストのノード (closest を持たない)
	doc.dispatch('click', null)
	assert.equal(storage.map.has(STORAGE_KEY), false)
})

test('mount: localStorage が例外を投げても落ちず、ブラウザの言語だけで帯を出す', () => {
	const doc = makeDoc()
	const banner = mountLangSuggest(doc, throwingStorage, navOf('en-US'))
	assert.ok(banner)
	assert.doesNotThrow(() => banner.find('a').click())
	assert.doesNotThrow(() => banner.find('button').click())
	const sw = addSwitch(doc)
	assert.doesNotThrow(() => doc.dispatch('click', sw.ja.a))
})

test('mount: storage が無い (null) ときも帯の判定だけする', () => {
	const banner = mountLangSuggest(makeDoc(), null, navOf('zh-TW'))
	assert.ok(banner)
	assert.doesNotThrow(() => banner.find('button').click())
})

test('mount: navigator.languages が無ければ navigator.language を使う', () => {
	const banner = mountLangSuggest(makeDoc(), makeStorage(), { language: 'zh-HK' })
	assert.equal(banner.getAttribute('lang'), 'zh-Hant-TW')
	assert.equal(mountLangSuggest(makeDoc(), makeStorage(), {}), null, '言語が取れなければ出さない')
})

test('mount: 既にスクロールした位置で読み込まれたら帯を差し込まない (スクロールの位置を動かさない)', () => {
	const doc = makeDoc({ scrollY: 400 })
	assert.equal(mountLangSuggest(doc, makeStorage(), navOf('en-US')), null)
	assert.deepEqual(tags(doc), ['header'])
})

test('mount: 2 回呼んでも帯は 1 つ', () => {
	const doc = makeDoc()
	mountLangSuggest(doc, makeStorage(), navOf('en-US'))
	mountLangSuggest(doc, makeStorage(), navOf('en-US'))
	assert.equal(doc.body.children.filter((c) => /\blang-suggest\b/.test(c.className)).length, 1)
})

// ---- 6. ソースの約束 (リダイレクトしない・送信しない・main.js の 2 行) ----

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('lang-suggest*.js はリダイレクト・外部への送信・cookie・innerHTML を使わない', () => {
	for (const rel of ['src/lib/lang-suggest.js', 'src/lib/lang-suggest-mount.js']) {
		// コメント (「innerHTML を使わない」などの説明) は除いて見る
		const src = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
		for (const bad of [
			/location\.replace/,
			/location\.href\s*=/,
			/location\.assign/,
			/\bfetch\(/,
			/sendBeacon/,
			/document\.cookie/,
			/innerHTML/,
			/gtag/,
		]) {
			assert.doesNotMatch(src, bad, `${rel}: ${bad}`)
		}
	}
	assert.match(read('src/lib/lang-suggest-mount.js'), /import '\.\/lang-suggest\.css';?/)
})

test('lang-suggest.css: 規則は .lang-suggest の下だけ、上部に固定しない、reduced-motion で動きを止める', () => {
	const css = read('src/lib/lang-suggest.css').replace(/\/\*[\s\S]*?\*\//g, '')
	const selectors = [...css.matchAll(/([^{}@;]+)\{/g)]
		.map((m) => m[1].trim())
		.filter((s) => s && !/^(from|to|\d+%)$/.test(s) && !/^(media|keyframes)\b/.test(s))
	assert.ok(selectors.length > 0)
	for (const s of selectors) {
		// `.lang-suggest` か BEM の子 (`.lang-suggest__inner` など) で始まる規則だけ
		for (const part of s.split(',')) {
			assert.match(part.trim(), /^\.lang-suggest(?:__[a-z]+)?(?![\w-])/, `.lang-suggest の外の規則: ${part.trim()}`)
		}
	}
	assert.doesNotMatch(css, /position\s*:\s*(fixed|sticky)/)
	assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})

test('main.js: 「i18n の初期化」の区切りの下に import と呼び出しの 2 行だけ', () => {
	const main = read('src/main.js')
	const idx = main.search(/\/\/ -+ i18n の初期化/)
	assert.ok(idx >= 0)
	const tail = main
		.slice(idx)
		.split(/\r?\n/)
		.slice(1)
		.filter((l) => l.trim() !== '')
	assert.equal(tail.length, 2, tail.join('\n'))
	assert.match(tail[0], /^import \{ mountLangSuggest \} from '\.\/lib\/lang-suggest-mount\.js';$/)
	assert.match(tail[1], /mountLangSuggest\(\)/)
	assert.match(tail[1], /DOMContentLoaded/)
})
