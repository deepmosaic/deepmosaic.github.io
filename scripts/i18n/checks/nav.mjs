// T-2204 (i18n1112 I18N-706): ヘッダー・フッター・言語の切り替え・対象外のリンクの印の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 対象は <header> を持つページ (header.html を include したページ)。ページの言語はディレクトリで決める (`en/`・`zh-tw/`・それ以外 = ja)。
//   - 全ページ: data-i18n-switch の切り替え (404 の振り分けの印 data-lang-404 を除く) がちょうど 3 か所 (<header> の中の要素・ドロワーの JSON `script[data-lang-links]`・<footer> の中の要素)。
//       行き先: canonical のパスから言語の接頭辞を除いた鍵が台帳 (`_data/i18n_pages.yml`) にあれば、ja = 鍵・en = /en + 鍵・zh-tw = /zh-tw + 鍵。
//               無ければ各言語のトップ (`/`・`/en/`・`/zh-tw/`)。
//       各リンクに lang と hreflang (ja / en / zh-Hant-TW)、今の言語にだけ aria-current="true" (JSON は current: true)。
//   - 英中のページ: <header> / <footer> の見える文 (data-i18n-switch の中を除く) と data-links の JSON に仮名が無い。
//       対象外 (docs・法務 5 本) へのリンクは ja の URL (接頭辞なし) で hreflang="ja"、リンクの中かすぐ後ろに印 (`ja_only_badge`) がある。
//   - canonical の無いページは見ない (layout を通らない HTML。head.mjs と同じ扱い)。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseLedger } from './head.mjs'

const LANGS = {
	ja: { prefix: '', hreflang: 'ja' },
	en: { prefix: '/en', hreflang: 'en' },
	'zh-tw': { prefix: '/zh-tw', hreflang: 'zh-Hant-TW' },
}
const ORDER = ['ja', 'en', 'zh-tw']
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const JA_ONLY = /^\/(docs(?:[/#?].*)?|company\/(?:terms|privacy|cookie|eula|asct)(?:\.html)?)$/
const LANG_404 = /\sdata-lang-404(?=[\s=>/])/
const PREFIXED_JA_ONLY = /^\/(?:en|zh-tw)\/(?:docs|company\/(?:terms|privacy|cookie|eula|asct))\b/

function langOf(rel) {
	if (rel.startsWith('en/')) return 'en'
	if (rel.startsWith('zh-tw/')) return 'zh-tw'
	return 'ja'
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`))?.[1]

/** data-i18n-switch を持つ要素を全部返す ({ tag, open, body, start, end })。 */
function switchElements(html) {
	const out = []
	const re = /<([a-zA-Z][\w-]*)\b[^>]*?\sdata-i18n-switch(?=[\s=>/])[^>]*>/g
	let m
	while ((m = re.exec(html))) {
		const tag = m[1].toLowerCase()
		const openEnd = m.index + m[0].length
		const close = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi')
		close.lastIndex = openEnd
		let depth = 1
		let end = openEnd
		let c
		while ((c = close.exec(html))) {
			depth += c[1] === '/' ? -1 : 1
			if (depth === 0) {
				end = c.index + c[0].length
				break
			}
		}
		out.push({ tag, open: m[0], body: html.slice(openEnd, end), start: m.index, end })
		re.lastIndex = end
	}
	return out
}

const regionOf = (html, tag) => {
	const m = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`))
	return m ? { text: m[0], start: m.index, end: m.index + m[0].length } : null
}

/** 切り替えのリンクを { href, lang, hreflang, current } の配列にする。 */
function linksOf(el) {
	if (el.tag === 'script') {
		try {
			const items = JSON.parse(el.body.replace(/<\/script>$/, ''))
			return items.map((i) => ({ href: i.href, lang: i.lang, hreflang: i.lang, current: i.current === true }))
		} catch {
			return null
		}
	}
	return (el.body.match(/<a\b[^>]*>/g) ?? []).map((a) => ({
		href: attr(a, 'href'),
		lang: attr(a, 'lang'),
		hreflang: attr(a, 'hreflang'),
		current: attr(a, 'aria-current') === 'true',
	}))
}

/** html から data-i18n-switch の要素を除いた文字列。 */
function withoutSwitches(html) {
	let out = html
	for (const el of switchElements(html).reverse()) out = out.slice(0, el.start) + out.slice(el.end)
	return out
}

/** 見える文 (タグ・script・style・コメントを除いた本文と、alt・title・aria-label)。 */
function visible(html) {
	const s = html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '')
	const attrs = [...s.matchAll(/\s(?:alt|title|aria-label|placeholder)="([^"]*)"/g)].map((m) => m[1])
	return [s.replace(/<[^>]*>/g, ' '), ...attrs].join(' ')
}

export default function check(ctx) {
	const errors = []
	const ledger = parseLedger(readFileSync(join(ctx.root, '_data/i18n_pages.yml'), 'utf8'))
	const badges = {}
	for (const lang of ['en', 'zh-tw']) {
		badges[lang] = JSON.parse(readFileSync(join(ctx.root, `_data/lang/${lang}.json`), 'utf8')).ja_only_badge
	}

	for (const rel of ctx.listHtml()) {
		const html = ctx.read(rel)
		const header = regionOf(html, 'header')
		if (!header) continue
		const canonical = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/)?.[0]
		if (!canonical) continue
		const lang = langOf(rel)
		const path = new URL(attr(canonical, 'href')).pathname
		const prefix = LANGS[lang].prefix
		const key = prefix && path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path
		const dests = ledger.has(key) ? ORDER.map((l) => LANGS[l].prefix + key) : ['/', '/en/', '/zh-tw/']

		// 切り替え 3 か所
		const footer = regionOf(html, 'footer')
		// 404 の振り分けの印 (ルートの 404.html の `<div hidden data-i18n-switch data-lang-404>`、W7-site.md §0-G・I18N-712) は切り替えではないので数えない
		const els = switchElements(html).filter((e) => !LANG_404.test(e.open))
		const inHeader = els.filter((e) => e.tag !== 'script' && e.start > header.start && e.end <= header.end)
		const drawer = els.filter((e) => e.tag === 'script' && /\sdata-lang-links(?=[\s=>/])/.test(e.open))
		const inFooter = els.filter((e) => footer && e.start > footer.start && e.end <= footer.end)
		if (els.length !== 3 || inHeader.length !== 1 || drawer.length !== 1 || inFooter.length !== 1) {
			errors.push(
				`${rel}: 言語の切り替えが 3 か所 (ヘッダー・ドロワーの JSON・フッター) でない (全 ${els.length} / ヘッダー ${inHeader.length} / ドロワー ${drawer.length} / フッター ${inFooter.length})`,
			)
		}
		for (const el of [...inHeader, ...drawer, ...inFooter]) {
			const where = el.tag === 'script' ? 'ドロワー' : el.start < header.end ? 'ヘッダー' : 'フッター'
			const links = linksOf(el)
			if (!links) {
				errors.push(`${rel}: ${where}の切り替えの JSON が読めない`)
				continue
			}
			const got = links.map((l) => l.href)
			if (JSON.stringify(got) !== JSON.stringify(dests)) {
				errors.push(`${rel}: ${where}の切り替えの行き先が台帳と違う (期待 ${JSON.stringify(dests)} / 実際 ${JSON.stringify(got)})`)
			}
			const langs = links.map((l) => l.lang)
			const hl = ORDER.map((l) => LANGS[l].hreflang)
			if (JSON.stringify(langs) !== JSON.stringify(hl) || links.some((l) => l.hreflang !== l.lang)) {
				errors.push(`${rel}: ${where}の切り替えの lang / hreflang が ${JSON.stringify(hl)} でない`)
			}
			const current = links.filter((l) => l.current).map((l) => l.lang)
			if (JSON.stringify(current) !== JSON.stringify([LANGS[lang].hreflang])) {
				errors.push(`${rel}: ${where}の切り替えの aria-current (今の言語) が ${LANGS[lang].hreflang} だけでない (${JSON.stringify(current)})`)
			}
		}

		if (lang === 'ja') continue

		// 英中: ヘッダー・フッターに仮名が無い
		for (const [name, region] of [
			['ヘッダー', header],
			['フッター', footer],
		]) {
			if (!region) continue
			const text = withoutSwitches(region.text)
			const v = visible(text)
			if (KANA.test(v)) errors.push(`${rel}: ${name}の見える文に仮名がある: ${v.match(/\S*[぀-ヿ]\S*/u)?.[0]}`)
			const links = text.match(/data-links='([^']*)'/)?.[1]
			if (links && KANA.test(links)) errors.push(`${rel}: ${name}の data-links に仮名がある`)
			// 対象外のリンクは ja の URL + hreflang="ja" + 印
			const anchors = [...text.matchAll(/<a\b[^>]*>/g)]
			for (const m of anchors) {
				const href = attr(m[0], 'href') ?? ''
				if (PREFIXED_JA_ONLY.test(href)) {
					errors.push(`${rel}: ${name}の対象外のページへのリンクが ja の URL でない: ${href}`)
					continue
				}
				if (!JA_ONLY.test(href)) continue
				if (attr(m[0], 'hreflang') !== 'ja') errors.push(`${rel}: ${name}の ${href} のリンクに hreflang="ja" が無い`)
				const after = text.slice(m.index + m[0].length, m.index + m[0].length + 400)
				const closeAt = after.indexOf('</' + 'a>')
				const followingSpan = closeAt < 0 ? '' : (after.slice(closeAt + 4).match(/^\s*<span\b[^>]*>[^<]*<\/span>/)?.[0] ?? '')
				const tail = closeAt < 0 ? after : after.slice(0, closeAt) + followingSpan
				if (!tail.includes(badges[lang])) errors.push(`${rel}: ${name}の ${href} のリンクに日本語のページの印 (${badges[lang]}) が無い`)
			}
		}
	}
	return errors
}
