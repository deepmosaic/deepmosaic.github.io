// T-2215 (i18n1112 I18N-804, 2026-11-13) 公式サイトの英中のページのはみ出し・日本語の残り (漏れ) の判定。
//
// - 使う側: `e2e/i18n-layout.spec.ts` (実ブラウザで採取して、ここの純関数で判定する)。
// - 仕様テスト: `src/lib/i18n-overflow.test.js` (`npm test` に乗る)。
// - はみ出しの kind の定義は desktop の I18N-801 と同じ (clipped / ellipsis / clipped-y / spill / offscreen / no-name)。
//   サイトは ja と英中が別の HTML なので、`path` が ja に無い項目は kind によってエラーか警告 `no-counterpart` に分ける
//   (英中のヘッダーとフッターは `_includes/header-intl.html`・`footer-intl.html` で、ja と DOM が違うため)。

/** 判定する言語。サイトの英中のページの接頭辞と同じ。 */
export const LEAK_LANGS = Object.freeze(['en', 'zh-tw'])
/** 幅の名前 (allow の `width`)。 */
export const WIDTHS = Object.freeze(['desktop', 'mobile'])

/** はみ出しの kind のうち、判定の対象 (エラーになりうる) もの。 */
const JUDGED_KINDS = Object.freeze(['clipped', 'clipped-y', 'spill', 'offscreen', 'no-name'])
/** ja に同じ `path` が無いときにエラーにする kind (画面の外へ出る・名前が無い)。残りは警告 `no-counterpart`。 */
const ERROR_WITHOUT_COUNTERPART = Object.freeze(['offscreen', 'spill', 'no-name'])

/** 横スクロールの許容 (px)。小数の丸めで 1px ずれることがある。 */
const SCROLL_TOLERANCE_PX = 1

// 仮名: ひらがな・カタカナ・長音 (ー)。中黒 (・ U+30FB) は記号として英中でも使いうるので数えない。
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u
const HAN = /\p{Script=Han}/u

/**
 * 文に日本語が残っている (漏れ) か。
 * - en: 仮名か漢字を含めば漏れ。
 * - zh-tw: 仮名を含めば漏れ (漢字は繁体字中国語の文字でもあるので見ない)。
 * @param {string} text
 * @param {'en' | 'zh-tw'} lang
 * @returns {boolean}
 */
export function judgeLeak(text, lang) {
	if (!LEAK_LANGS.includes(lang)) throw new Error(`judgeLeak: lang は en / zh-tw のどれか (受け取った値: ${lang})`)
	const s = String(text ?? '')
	if (KANA.test(s)) return true
	return lang === 'en' && HAN.test(s)
}

/**
 * ページが横にスクロールするか (1px までは許す)。
 * @param {{ scrollWidth: number, innerWidth: number }} m
 */
export function pageHasHorizontalScroll({ scrollWidth, innerWidth }) {
	return scrollWidth - innerWidth > SCROLL_TOLERANCE_PX
}

/**
 * 英中の URL のパスから ja の対応ページのパスを求める。`/en/price/` → `/price/`、`/zh-tw/` → `/`、`/en` → `/`。
 * 接頭辞の無いパスは Error (`/enterprise/inquiry/` のように `en` で始まる ja のディレクトリを英語のページと取り違えない)。
 * @param {string} urlPath
 */
export function jaCounterpart(urlPath) {
	const m = /^\/(?:en|zh-tw)(\/.*)?$/.exec(String(urlPath ?? ''))
	if (!m) throw new Error(`jaCounterpart: 英中の接頭辞 (/en/・/zh-tw/) の無いパス: ${JSON.stringify(urlPath)}`)
	return m[1] || '/'
}

/**
 * 訳の台帳 `_data/i18n_pages.yml` から、ja のパスと訳のある言語を取り出す。
 * 書き方は `scripts/i18n/checks/head.mjs` の parseLedger と同じ制約 (1 行 1 鍵、二重引用符の鍵 + フロー形式の配列)。
 * コメント・空行以外でこの形に当たらない行があれば Error (黙って検査の対象から外さない)。
 * @param {string} ymlText
 * @returns {{ jaPath: string, langs: string[] }[]}
 */
export function listI18nPages(ymlText) {
	const pages = []
	String(ymlText ?? '').split(/\r?\n/).forEach((raw, i) => {
		const line = raw.replace(/\s+#.*$/, '').trim()
		if (line === '' || line.startsWith('#')) return
		const m = /^"(\/[^"]*)"\s*:\s*\[([^\]]*)\]$/.exec(line)
		if (!m) throw new Error(`listI18nPages: 台帳の ${i + 1} 行目が読めない (二重引用符の鍵 + [en, zh-tw] の形だけ): ${raw}`)
		const langs = m[2].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
		const bad = langs.filter((l) => !LEAK_LANGS.includes(l))
		if (bad.length || !langs.length) {
			throw new Error(`listI18nPages: ${m[1]} の言語は en / zh-tw だけ (受け取った値: ${langs.join(', ') || '空'})`)
		}
		pages.push({ jaPath: m[1], langs })
	})
	if (!pages.length) throw new Error('listI18nPages: 台帳の鍵が 0 本')
	return pages
}

/** ja のパスからファイル名の一部を作る。`/` → `top`、`/enterprise/inquiry/` → `enterprise-inquiry`。 */
export function pageSlug(jaPath) {
	const s = String(jaPath).replace(/^\/+|\/+$/g, '')
	return s ? s.replace(/\//g, '-') : 'top'
}

/**
 * 許可の一覧 (`e2e/i18n-allow.json`) を検証して返す。不正なら Error。
 * 形: `{ version: 1, entries: [{ page, path?, text?, lang?, width?, reason }] }` (path か text のどちらかは必須)。
 */
export function parseAllow(allow) {
	if (!allow || allow.version !== 1) throw new Error('i18n-allow: version は 1')
	if (!Array.isArray(allow.entries)) throw new Error('i18n-allow: entries は配列')
	allow.entries.forEach((e, i) => {
		const at = `i18n-allow: entries[${i}]`
		if (typeof e?.page !== 'string' || !e.page) throw new Error(`${at}: page (ja のパス) が無い`)
		if (typeof e.reason !== 'string' || !e.reason.trim()) throw new Error(`${at}: reason が無い・空`)
		if (e.path === undefined && e.text === undefined) throw new Error(`${at}: path か text のどちらかが要る`)
		if (e.lang !== undefined && !LEAK_LANGS.includes(e.lang)) throw new Error(`${at}: lang は en / zh-tw`)
		if (e.width !== undefined && !WIDTHS.includes(e.width)) throw new Error(`${at}: width は desktop / mobile`)
	})
	return allow
}

/** allow の項目が当たるか。指定した条件 (page・lang・width・path の前方一致・text の完全一致) が全部合えば当たり。 */
function isAllowed(entries, ctx, it) {
	return entries.some(
		(e) =>
			e.page === ctx.page &&
			(e.lang === undefined || e.lang === ctx.lang) &&
			(e.width === undefined || e.width === ctx.width) &&
			(e.path === undefined || String(it.path).startsWith(e.path)) &&
			(e.text === undefined || it.text === e.text),
	)
}

const entriesOf = (allow) => (allow ? parseAllow(allow).entries : [])

/**
 * ja の対応ページの採取と比べて、英中のはみ出しをエラーと警告に分ける。
 * @param {{ path: string, tag?: string, text?: string, kinds: string[] }[]} jaItems
 * @param {{ path: string, tag?: string, text?: string, kinds: string[] }[]} langItems
 * @param {object | null | undefined} allow `e2e/i18n-allow.json` の中身
 * @param {{ page: string, lang: string, width: string }} ctx page は ja のパス
 */
export function diffOverflow(jaItems, langItems, allow, ctx) {
	const entries = entriesOf(allow)
	const jaKinds = new Map()
	for (const it of jaItems) jaKinds.set(it.path, new Set([...(jaKinds.get(it.path) ?? []), ...it.kinds]))
	const errors = []
	const warnings = []
	for (const it of langItems) {
		const { kinds, ...rest } = it
		for (const kind of kinds) {
			const rec = { ...rest, kind }
			if (kind === 'ellipsis') {
				warnings.push({ ...rec, reason: 'ellipsis' })
				continue
			}
			if (!JUDGED_KINDS.includes(kind)) continue
			const ja = jaKinds.get(it.path)
			let reason = null
			if (ja?.has(kind)) reason = 'preexisting'
			else if (!ja && !ERROR_WITHOUT_COUNTERPART.includes(kind)) reason = 'no-counterpart'
			else if (isAllowed(entries, ctx, it)) reason = 'allowed'
			if (reason) warnings.push({ ...rec, reason })
			else errors.push(rec)
		}
	}
	return { errors, warnings }
}

/**
 * 漏れの採取 (`LEAK_PROBE_SOURCE` の項目) を判定する。本文 (`text`) も属性 (`attr:<name>`) も同じ `judgeLeak`。
 * @param {{ path: string, kind: string, text: string }[]} items
 * @param {object | null | undefined} allow
 * @param {{ page: string, lang: string, width: string }} ctx
 */
export function diffLeaks(items, allow, ctx) {
	const entries = entriesOf(allow)
	const errors = []
	const warnings = []
	for (const it of items) {
		if (!judgeLeak(it.text, ctx.lang)) continue
		if (isAllowed(entries, ctx, it)) warnings.push({ ...it, reason: 'allowed' })
		else errors.push(it)
	}
	return { errors, warnings }
}

// ---- ブラウザの中で動かす採取 (page.evaluate に文字列で渡す) ------------------------------
// 下の 3 つの関数は Function.prototype.toString でページへ送るので、モジュールの外の名前を参照しない。

/* c8 ignore start */
function probeKit() {
	// 採取しない部分木。`[lang="ja"]` は言語の切り替えの「日本語」と正式な社名・住所、
	// `[data-i18n-switch]` は言語の切り替え (ヘッダー・フッター・ドロワー)。<html lang="ja"> 自体は見ない (下の isExcluded)。
	const EXCLUDE =
		'script, style, noscript, template, script[type="application/ld+json"], [lang="ja"], [data-ja-allowed], [data-i18n-switch], [hidden]'
	const root = document.documentElement
	const isExcluded = (el) => {
		for (let n = el; n && n !== root; n = n.parentElement) if (n.matches(EXCLUDE)) return true
		return false
	}
	const isRendered = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
	// 漏れの採取の可視。自分の箱を持たない要素の文も拾う: `display:contents` の直下の文は Range の矩形で、
	// `<option>` は持ち主の `<select>` の可視で、svg の `<title>` (ツールチップ・読み上げ) は親の可視で判定する。
	const isTextVisible = (el, textNodes) => {
		if (isRendered(el)) return true
		if (el.matches('option, optgroup')) {
			const owner = el.closest('select')
			return !!owner && isRendered(owner)
		}
		if (el.matches('svg title') && el.parentElement) return isRendered(el.parentElement)
		if (getComputedStyle(el).visibility === 'hidden') return false
		return textNodes.some((t) => {
			const range = document.createRange()
			range.selectNodeContents(t)
			return range.getClientRects().length > 0
		})
	}
	// sr-only (1px 四方に切り抜いた読み上げ用の文) は見た目のはみ出しの対象にしない
	const isVisuallyHidden = (el) => {
		const r = el.getBoundingClientRect()
		return r.width <= 1 && r.height <= 1
	}
	// 閉じたモバイルのドロワー (`aside aria-hidden="true"` を translate で画面の外へ出したもの) のように、
	// 支援技術から隠して画面の外に置いた部分は見えていない。開いた状態は spec がドロワーを開いて別に採る。
	const isParked = (el) => {
		if (!el.closest('[aria-hidden="true"]')) return false
		const r = el.getBoundingClientRect()
		return r.right <= 0 || r.left >= window.innerWidth
	}
	const pathOf = (el) => {
		const parts = []
		for (let n = el; n && n !== document.body; n = n.parentElement) {
			const tag = n.tagName.toLowerCase()
			let i = 1
			for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === n.tagName) i++
			parts.unshift(`${tag}:nth-of-type(${i})`)
		}
		return ['body', ...parts].join('>')
	}
	const directTextNodes = (el) =>
		[...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim() !== '')
	const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
	return { isExcluded, isRendered, isTextVisible, isVisuallyHidden, isParked, pathOf, directTextNodes, norm }
}

function overflowProbe(kit) {
	const vw = window.innerWidth
	const TOL = 1
	const scrollerHolds = (el) => {
		for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
			if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
				const r = p.getBoundingClientRect()
				return r.left >= -TOL && r.right <= vw + TOL
			}
		}
		return false
	}
	const accessibleName = (el) => {
		const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
		const labelled = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
		const alts = [...el.querySelectorAll('img[alt], svg [aria-label], svg title')]
			.map((n) => n.getAttribute('alt') ?? n.getAttribute('aria-label') ?? n.textContent)
			.join(' ')
		return kit.norm([el.getAttribute('aria-label'), labelled, el.getAttribute('title'), el.textContent, alts].join(' '))
	}
	const out = []
	for (const el of document.body.querySelectorAll('*')) {
		if (kit.isExcluded(el) || !kit.isRendered(el) || kit.isVisuallyHidden(el) || kit.isParked(el)) continue
		const texts = kit.directTextNodes(el)
		if (!texts.length && !el.matches('button, a, label, [role=button], th, summary')) continue
		const cs = getComputedStyle(el)
		const rect = el.getBoundingClientRect()
		const kinds = []
		if (el.scrollWidth > el.clientWidth + TOL && cs.overflowX !== 'visible') {
			kinds.push(cs.textOverflow === 'ellipsis' ? 'ellipsis' : 'clipped')
		}
		if (el.scrollHeight > el.clientHeight + TOL && cs.overflowY !== 'visible') kinds.push('clipped-y')
		if (cs.overflowX === 'visible' && cs.overflowY === 'visible') {
			const spills = texts.some((t) => {
				const range = document.createRange()
				range.selectNodeContents(t)
				const r = range.getBoundingClientRect()
				return r.width > 0 && (r.left < rect.left - TOL || r.right > rect.right + TOL)
			})
			if (spills) kinds.push('spill')
		}
		if ((rect.left < -TOL || rect.right > vw + TOL) && !scrollerHolds(el)) kinds.push('offscreen')
		if (el.matches('button, [role=button]') && !accessibleName(el)) kinds.push('no-name')
		out.push({ path: kit.pathOf(el), tag: el.tagName.toLowerCase(), text: kit.norm(el.textContent).slice(0, 40), kinds })
	}
	return out
}

function leakProbe(kit) {
	const ATTRS = [
		['img', 'alt'],
		['[aria-label]', 'aria-label'],
		['[title]', 'title'],
		['input, textarea', 'placeholder'],
		['input[type=submit], input[type=button]', 'value'],
	]
	const out = []
	const title = kit.norm(document.title)
	if (title) out.push({ path: 'head>title', kind: 'text', text: title })
	for (const el of document.body.querySelectorAll('*')) {
		if (kit.isExcluded(el)) continue
		const textNodes = kit.directTextNodes(el)
		if (!kit.isTextVisible(el, textNodes) || kit.isParked(el)) continue
		const text = kit.norm(textNodes.map((t) => t.nodeValue).join(' '))
		const path = kit.pathOf(el)
		if (text) out.push({ path, kind: 'text', text: text.slice(0, 200) })
		for (const [sel, name] of ATTRS) {
			const v = kit.norm(el.matches(sel) ? el.getAttribute(name) : '')
			if (v) out.push({ path, kind: `attr:${name}`, text: v.slice(0, 200) })
		}
	}
	// 言語の切り替えは部分木ごと除くが (中の「日本語」のリンクを漏れにしない)、外側の要素自身の aria-label
	// (`_includes/lang-switch.html` の ls_label。訳が欠けると既定値「表示言語」に落ちる) は採る。
	for (const el of document.body.querySelectorAll('[data-i18n-switch][aria-label]')) {
		if (el.parentElement && kit.isExcluded(el.parentElement)) continue
		if (!kit.isRendered(el) || kit.isParked(el)) continue
		const v = kit.norm(el.getAttribute('aria-label'))
		if (v) out.push({ path: kit.pathOf(el), kind: 'attr:aria-label', text: v.slice(0, 200) })
	}
	return out
}
/* c8 ignore stop */

/** `page.evaluate(OVERFLOW_PROBE_SOURCE)` で、はみ出しの項目 `{ path, tag, text, kinds }[]` を返す式。 */
export const OVERFLOW_PROBE_SOURCE = `(${overflowProbe})((${probeKit})())`
/** `page.evaluate(LEAK_PROBE_SOURCE)` で、漏れの候補 `{ path, kind: 'text' | 'attr:<name>', text }[]` を返す式。 */
export const LEAK_PROBE_SOURCE = `(${leakProbe})((${probeKit})())`
