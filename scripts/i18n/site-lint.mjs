// T-2200 (i18n1112 I18N-702): 英中のページの見える文の検査 (lang-text) の本体。純関数だけ (fs を読むのは用語集の読み込みだけ)。
//
//   - visibleTexts(html) → [{ text, where, allowRemoval? }]
//       head: <title>・meta[name=description]・og:* / twitter:* の content (URL の値は除く)
//       body: 文・alt・title・aria-label・placeholder
//       除く: <script> / <style> / <template> の中 (中身は読み飛ばす)、data-ja-allowed・data-i18n-switch を持つ要素の中、コメント
//       meta の URL の値 (空白を含まず scheme://・mailto:・ms-windows-store:・/ で始まるもの) は文として拾わない
//       li・p・dt・dd・option・tr・td・th の閉じタグの省略は暗黙に閉じる (除外が後ろの兄弟に広がらない)
//       data-i18n-allow="mosaic_removal" の要素の中の文には allowRemoval: true を付ける
//   - lintText(lang, text, { allowRemoval }) → [{ word, use, rule }]   lang は 'en' | 'zh-tw' ('zh-TW' も可)
//       en:    仮名・CJK 統合漢字・全角の記号 (U+3000–U+303F・U+FF00–U+FFEF) が無い、forbidden.en の語が単語の境界で
//              (大文字小文字を無視して) 無い。allowRemoval のとき除去の語 (remove mosaic など) だけを許す
//       zh-tw: 仮名が無い、glossary-chars.json の zh_simplified・ja_shinjitai の字が無い、forbidden["zh-TW"] と
//              zh-TW_ja_words の語が無い (allow_in の合成語の中は許す)。allowRemoval のとき 去馬賽克・去碼・移除馬賽克 だけを許す
//   - lintValue(lang, value, opts?) → lintText と同じ (JSON / yml の値を 1 つ検査する。html の除外は無い)
//
//   用語集は desktop の確定版の写し (`scripts/i18n/glossary.json`・`glossary-chars.json`、出所は glossary.source.json)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

let cache = null
/** 用語集と禁止字の表 (1 回だけ読む) */
function data() {
	if (!cache) {
		cache = {
			glossary: JSON.parse(readFileSync(join(HERE, 'glossary.json'), 'utf8')),
			chars: JSON.parse(readFileSync(join(HERE, 'glossary-chars.json'), 'utf8')),
		}
	}
	return cache
}

// ---- lintText ----

/** 仮名 (半角カナ・長音・中黒を含む) */
const KANA_RUN = /[぀-ヿㇰ-ㇿｦ-ﾟ]+/gu
const HAN_RUN = /\p{Script=Han}+/gu
const FULLWIDTH_RUN = /[　-〿＀-￯]+/gu

/** en で allowRemoval のときだけ許す除去の語 */
const EN_REMOVAL_WORDS = new Set(['remove mosaic', 'removes mosaic', 'mosaic removal tool', 'decensor', 'uncensor', 'unblur'])
/** zh-tw で allowRemoval のときだけ許す除去の語 */
const ZH_REMOVAL_WORDS = new Set(['去馬賽克', '去碼', '移除馬賽克'])

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

const enWordRe = new Map()
/** 単語の境界で (大文字小文字を無視して) 一致する正規表現。語の中の空白は 1 個以上の空白に当てる */
function enRe(word) {
	let re = enWordRe.get(word)
	if (!re) {
		const body = word.split(/\s+/u).map(escapeRe).join('\\s+')
		re = new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'iu')
		enWordRe.set(word, re)
	}
	return re
}

/** text の idx の位置の word が、allow_in の合成語の一部か (desktop の lint-core.ts と同じ判定) */
function insideAllowed(text, idx, word, allowIn) {
	return allowIn.some((comp) => {
		const at = comp.indexOf(word)
		return at >= 0 && idx - at >= 0 && text.startsWith(comp, idx - at)
	})
}

/** 許可の合成語の外に word が現れるか */
function containsForbidden(text, fw) {
	for (let i = text.indexOf(fw.word); i >= 0; i = text.indexOf(fw.word, i + 1)) {
		if (!insideAllowed(text, i, fw.word, fw.allow_in ?? [])) return true
	}
	return false
}

function runs(re, text) {
	return [...new Set([...text.matchAll(re)].map((m) => m[0]))]
}

function lintEn(text, allowRemoval) {
	const { glossary } = data()
	const out = []
	for (const w of runs(KANA_RUN, text)) out.push({ rule: 'kana', word: w, use: '(英語の文に仮名)' })
	for (const w of runs(HAN_RUN, text)) out.push({ rule: 'han', word: w, use: '(英語の文に漢字)' })
	for (const w of runs(FULLWIDTH_RUN, text)) out.push({ rule: 'fullwidth', word: w, use: '(半角の記号にする)' })
	for (const word of glossary.forbidden.en) {
		if (allowRemoval && EN_REMOVAL_WORDS.has(word.toLowerCase())) continue
		const m = enRe(word).exec(text)
		if (m) out.push({ rule: 'forbidden', word: m[0], use: '(使わない語。用語集の forbidden.en)' })
	}
	return out
}

function lintZh(text, allowRemoval) {
	const { glossary, chars } = data()
	const out = []
	for (const w of runs(KANA_RUN, text)) out.push({ rule: 'kana', word: w, use: '(繁體中文の文に仮名)' })
	for (const ch of new Set([...text])) {
		const simp = chars.zh_simplified[ch]
		if (simp !== undefined) out.push({ rule: 'simplified', word: ch, use: simp })
		const shin = chars.ja_shinjitai[ch]
		if (shin !== undefined) out.push({ rule: 'shinjitai', word: ch, use: shin })
	}
	for (const fw of glossary.forbidden['zh-TW']) {
		if (allowRemoval && ZH_REMOVAL_WORDS.has(fw.word)) continue
		if (containsForbidden(text, fw)) out.push({ rule: 'forbidden', word: fw.word, use: fw.use })
	}
	for (const fw of glossary.forbidden['zh-TW_ja_words']) {
		if (containsForbidden(text, fw)) out.push({ rule: 'ja_word', word: fw.word, use: fw.use })
	}
	return out
}

/** 1 つの文の違反の配列 (違反が無ければ空) */
export function lintText(lang, text, { allowRemoval = false } = {}) {
	const s = String(text ?? '')
	if (lang === 'en') return lintEn(s, allowRemoval)
	if (lang === 'zh-tw' || lang === 'zh-TW') return lintZh(s, allowRemoval)
	throw new Error(`site-lint: unknown lang: ${lang}`)
}

/** JSON / yml の値を 1 つ検査する (html の除外は無い) */
export function lintValue(lang, value, opts = {}) {
	return lintText(lang, value, opts)
}

// ---- visibleTexts ----

const VOID = new Set([
	'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])
const RAW = new Set(['script', 'style', 'template'])
const ATTRS = ['alt', 'title', 'aria-label', 'placeholder']

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', copy: '©', yen: '¥', times: '×', middot: '·', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }

/** HTML の文字参照を戻す */
export function decodeEntities(s) {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (all, ref) => {
		if (ref[0] === '#') {
			const cp = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10)
			return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : all
		}
		return NAMED[ref.toLowerCase()] ?? all
	})
}

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu

function parseAttrs(src) {
	const attrs = new Map()
	for (const m of src.matchAll(ATTR_RE)) {
		const name = m[1].toLowerCase()
		if (!attrs.has(name)) attrs.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''))
	}
	return attrs
}

const norm = (s) => s.replace(/\s+/gu, ' ').trim()
/**
 * URL の値か: 空白を含まず、`scheme://`・`mailto:`・`ms-windows-store:`・`/` のどれかで始まる。
 * `Deepmosaic: …`・`FAQ: …`・`/ month`・`/en/ is …` のような「語 + コロン」や空白を含む文は URL とみなさない (検査にかける)
 */
const isUrlLike = (s) => /^(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|ms-windows-store:|\/)\S*$/iu.test(s.trim())

/** head の meta の content が見える文か (description・og:*・twitter:* の文。URL の値は除く) */
function metaText(attrs) {
	const key = (attrs.get('property') ?? attrs.get('name') ?? '').toLowerCase()
	if (!(key === 'description' || key.startsWith('og:') || key.startsWith('twitter:'))) return null
	const content = attrs.get('content')
	if (content === undefined || isUrlLike(content)) return null
	return { key, content }
}

/**
 * 閉じタグを省ける要素の暗黙の閉じ: キーの要素が開いたとき、スタックの先頭がこの名前なら畳む (HTML の省略規則の一部)。
 * data-ja-allowed などの除外・allowRemoval が後ろの兄弟要素に広がらないようにする
 */
const IMPLIED_CLOSE = {
	li: ['li'],
	dt: ['dt', 'dd'],
	dd: ['dt', 'dd'],
	option: ['option'],
	tr: ['tr', 'td', 'th'],
	td: ['td', 'th'],
	th: ['td', 'th'],
}
/** 開くと開いている <p> を閉じるブロック要素 (p 自身を含む) */
const CLOSES_P = new Set([
	'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer',
	'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section',
	'table', 'ul',
])
/** 自己終了か: 属性の原文の末尾が `/` で、その直前が空白・引用符・先頭のとき (`href=/x/` の値の `/` は自己終了でない) */
const isSelfClosing = (attrSrc) => /(?:^|[\s"'])\/\s*$/u.test(attrSrc)

const TOKEN_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</gu

/** html の見える文の一覧 */
export function visibleTexts(html) {
	const out = []
	/** 開いている要素: { name, excluded, allowRemoval } */
	const stack = []
	let inHead = false
	let inTitle = false
	const excluded = () => stack.some((e) => e.excluded)
	const removal = () => stack.some((e) => e.allowRemoval)
	const push = (text, where) => {
		const t = norm(text)
		if (!t) return
		const item = { text: t, where }
		if (removal()) item.allowRemoval = true
		out.push(item)
	}

	TOKEN_RE.lastIndex = 0
	let m
	while ((m = TOKEN_RE.exec(html)) !== null) {
		const tok = m[0]
		if (tok.startsWith('<!') || tok.startsWith('<?')) continue
		if (m[1] === undefined) {
			// 文
			if (inTitle) push(decodeEntities(tok), '<title>')
			else if (!inHead && !excluded()) {
				const parent = stack.length ? stack[stack.length - 1].name : 'body'
				push(decodeEntities(tok), `text <${parent}>`)
			}
			continue
		}
		const name = m[1].toLowerCase()
		const closing = tok.startsWith('</')
		if (closing) {
			if (name === 'head') inHead = false
			if (name === 'title') inTitle = false
			const idx = stack.map((e) => e.name).lastIndexOf(name)
			if (idx >= 0) stack.length = idx
			continue
		}
		const attrs = parseAttrs(m[2] ?? '')
		if (name === 'head') {
			inHead = true
			continue
		}
		if (name === 'body') inHead = false
		if (inHead) {
			if (name === 'title') inTitle = true
			if (name === 'meta') {
				const mt = metaText(attrs)
				if (mt) push(mt.content, `<meta ${mt.key}>`)
			}
			if (RAW.has(name)) skipRaw(name)
			continue
		}
		closeImplied(name)
		const isExcluded = attrs.has('data-ja-allowed') || attrs.has('data-i18n-switch')
		const isRemoval = attrs.get('data-i18n-allow') === 'mosaic_removal'
		if (!excluded() && !isExcluded) {
			for (const a of ATTRS) {
				const v = attrs.get(a)
				if (v === undefined) continue
				// 要素自身の data-i18n-allow を属性の文にも効かせる
				stack.push({ name: '#attr', excluded: false, allowRemoval: isRemoval })
				push(v, `<${name} ${a}>`)
				stack.pop()
			}
		}
		if (RAW.has(name)) {
			skipRaw(name)
			continue
		}
		if (VOID.has(name) || isSelfClosing(m[2] ?? '')) continue
		stack.push({ name, excluded: isExcluded, allowRemoval: isRemoval })
	}
	return out

	/** name の開始タグで暗黙に閉じる要素をスタックから畳む */
	function closeImplied(name) {
		const closes = new Set(IMPLIED_CLOSE[name] ?? [])
		if (CLOSES_P.has(name)) closes.add('p')
		while (stack.length && closes.has(stack[stack.length - 1].name)) stack.pop()
	}

	/** <script> などの中身を読み飛ばす */
	function skipRaw(name) {
		const re = new RegExp(`</${name}\\s*>`, 'giu')
		re.lastIndex = TOKEN_RE.lastIndex
		const end = re.exec(html)
		TOKEN_RE.lastIndex = end ? re.lastIndex : html.length
	}
}
