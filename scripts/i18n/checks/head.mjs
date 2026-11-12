// T-2203 (i18n1112 I18N-705): head の多言語化の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 対象は canonical を持つページ (= layout を通ったページ)。canonical の無い HTML は見ない
//   - ページの言語はディレクトリで決める (`en/` → en、`zh-tw/` → zh-tw、それ以外 → ja)
//   - canonical: 自己参照 (https://www.deepmosaic.co.jp + そのページの URL。`x/index.html` → `/x/`、`x/y.html` → `/x/y` か `/x/y.html`)
//   - 台帳 (`_data/i18n_pages.yml`) の鍵 = canonical のパスから言語の接頭辞を除いたもの。
//       台帳のページ: hreflang がちょうど 4 本 (ja・en・zh-Hant-TW・x-default)、href = origin + (""・/en・/zh-tw) + 鍵、x-default = en の URL。
//                     og:locale:alternate が他の 2 言語の値 (順は問わない)。
//       台帳に無いページ (docs・法務・404): hreflang も og:locale:alternate も 0 本。
//   - <html lang> と og:locale がディレクトリの言語と一致 (ja `ja`・`ja_JP` / en `en`・`en_US` / zh-tw `zh-Hant-TW`・`zh_TW`)
//   - JSON-LD (script[type=application/ld+json]) が JSON として読める。
//       SoftwareApplication: inLanguage が言語と一致。英中は description・featureList・disambiguatingDescription を
//                            site-lint の lintText にかける (仮名など。JSON-LD は誤認の訂正の文なので除去の語だけは許す)。
//       BreadcrumbList: 1 つ目の item が言語のトップ (origin + 接頭辞 + `/`)。
//       FAQPage (英中のページだけ): Question の数がページの `<details` の数と一致 (ja の index は既存の CI が見る)。
//   - 英中のページがまだ無い間は ja の側の検査だけが効く (台帳の全版の存在は I18N-712 の checks/complete.mjs が見る)。

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { lintText } from '../site-lint.mjs'

const ORIGIN = 'https://www.deepmosaic.co.jp'
const LEDGER = '_data/i18n_pages.yml'

const LANGS = {
	ja: { prefix: '', html: 'ja', og: 'ja_JP', hreflang: 'ja' },
	en: { prefix: '/en', html: 'en', og: 'en_US', hreflang: 'en' },
	'zh-tw': { prefix: '/zh-tw', html: 'zh-Hant-TW', og: 'zh_TW', hreflang: 'zh-Hant-TW' },
}

/**
 * 台帳の yml を読む (このファイルの形だけ: `"<パス>": [a, b]` の行とコメント・空行)。
 * 戻り値は Map<パス, 言語の配列> (書いた順)。読めない行があれば例外。
 */
export function parseLedger(text) {
	const out = new Map()
	text.split(/\r?\n/).forEach((raw, i) => {
		const line = raw.replace(/\s+#.*$/, '').trim()
		if (line === '' || line.startsWith('#')) return
		const m = line.match(/^"([^"]+)"\s*:\s*\[([^\]]*)\]$/)
		if (!m) throw new Error(`${LEDGER} の ${i + 1} 行目が読めない: ${raw}`)
		const langs = m[2]
			.split(',')
			.map((s) => s.trim().replace(/^["']|["']$/g, ''))
			.filter((s) => s !== '')
		out.set(m[1], langs)
	})
	return out
}

/** `_site` 内の相対パス → 言語 */
function langOf(rel) {
	if (rel.startsWith('en/')) return 'en'
	if (rel.startsWith('zh-tw/')) return 'zh-tw'
	return 'ja'
}

/** `_site` 内の相対パス → このページとして許す URL の候補 */
function urlCandidates(rel) {
	if (rel === 'index.html') return ['/']
	if (rel.endsWith('/index.html')) return [`/${rel.slice(0, -'index.html'.length)}`]
	return [`/${rel}`, `/${rel.slice(0, -'.html'.length)}`]
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`))?.[1]

/** head の値を拾う */
function headOf(html) {
	const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''
	const canonical = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/g)].map((m) => attr(m[0], 'href'))
	const hreflang = [...html.matchAll(/<link\b[^>]*\bhreflang=[^>]*>/g)].map((m) => ({
		lang: attr(m[0], 'hreflang'),
		href: attr(m[0], 'href'),
	}))
	const og = [...html.matchAll(/<meta\b[^>]*\bproperty=["']og:locale["'][^>]*>/g)].map((m) => attr(m[0], 'content'))
	const ogAlt = [...html.matchAll(/<meta\b[^>]*\bproperty=["']og:locale:alternate["'][^>]*>/g)].map((m) => attr(m[0], 'content'))
	const jsonLd = [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
	const details = (html.match(/<details[\s>]/g) ?? []).length
	return { htmlLang: attr(htmlTag, 'lang'), canonical, hreflang, og, ogAlt, jsonLd, details }
}

/** 台帳のページの hreflang の検査 */
function checkHreflang(rel, key, hreflang) {
	const errors = []
	const want = {
		ja: `${ORIGIN}${key}`,
		en: `${ORIGIN}/en${key}`,
		'zh-Hant-TW': `${ORIGIN}/zh-tw${key}`,
		'x-default': `${ORIGIN}/en${key}`,
	}
	if (hreflang.length !== 4) errors.push(`${rel}: hreflang が 4 本でない (${hreflang.length} 本)`)
	for (const [lang, href] of Object.entries(want)) {
		const got = hreflang.filter((h) => h.lang === lang)
		if (got.length !== 1) errors.push(`${rel}: hreflang="${lang}" が 1 本でない (${got.length} 本)`)
		else if (got[0].href !== href) errors.push(`${rel}: hreflang="${lang}" の href が ${href} でない (${got[0].href})`)
	}
	return errors
}

/** JSON-LD の検査 */
function checkJsonLd(rel, lang, head) {
	const errors = []
	const L = LANGS[lang]
	for (const raw of head.jsonLd) {
		let data
		try {
			data = JSON.parse(raw)
		} catch (e) {
			errors.push(`${rel}: JSON-LD が読めない (${e.message})`)
			continue
		}
		const type = data['@type']
		if (type === 'SoftwareApplication') {
			if (data.inLanguage !== L.html) errors.push(`${rel}: SoftwareApplication の inLanguage が "${L.html}" でない (${data.inLanguage})`)
			if (lang !== 'ja') {
				for (const field of ['description', 'featureList', 'disambiguatingDescription']) {
					const values = [data[field] ?? []].flat()
					for (const v of values) {
						// 除去の語は誤認の訂正の否定文 (disambiguatingDescription) だけに許す。description・featureList は既定で検査する
						for (const bad of lintText(lang, String(v), { allowRemoval: field === 'disambiguatingDescription' })) {
							errors.push(`${rel}: SoftwareApplication の ${field}: ${bad.word} → ${bad.use}`)
						}
					}
				}
			}
		} else if (type === 'BreadcrumbList') {
			const first = data.itemListElement?.[0]?.item
			const top = `${ORIGIN}${L.prefix}/`
			if (first !== top) errors.push(`${rel}: パンくずの 1 つ目の item が ${top} でない (${first})`)
		} else if (type === 'FAQPage' && lang !== 'ja') {
			const n = (data.mainEntity ?? []).filter((q) => q['@type'] === 'Question').length
			if (n !== head.details) errors.push(`${rel}: FAQPage の Question の数 (${n}) が <details> の数 (${head.details}) と違う`)
		}
	}
	return errors
}

/** 1 ページの検査 */
function checkPage(rel, html, ledger) {
	const errors = []
	const lang = langOf(rel)
	const L = LANGS[lang]
	const head = headOf(html)
	// canonical を持たない HTML は layout (`_layouts/default.html`、全ページで canonical を出す) を通っていないので見ない
	// (ja-lang などほかの検査の模型・断片の HTML。実際の _site の 17 本は全部 canonical を持つ)。
	// 英中のページが canonical を持つことは I18N-712 の checks/complete.mjs で見る (既存の ja-lang のテストが
	// canonical の無い en/・zh-tw/ の模型で check-site の exit 0 を期待しているので、ここではエラーにしない)
	if (head.canonical.length === 0) return errors

	if (head.htmlLang !== L.html) errors.push(`${rel}: <html lang> が "${L.html}" でない (${head.htmlLang ?? '無し'})`)
	if (head.og.length !== 1 || head.og[0] !== L.og) errors.push(`${rel}: og:locale が "${L.og}" の 1 本でない (${head.og.join(', ') || '無し'})`)

	const self = urlCandidates(rel).map((u) => `${ORIGIN}${u}`)
	if (head.canonical.length !== 1 || !self.includes(head.canonical[0])) {
		errors.push(`${rel}: canonical が自己参照でない (${head.canonical.join(', ')}、期待 ${self.join(' か ')})`)
	}

	// 台帳の鍵 = canonical (origin が違えば置き場所) のパスから言語の接頭辞を除いたもの
	const path = head.canonical[0].startsWith(ORIGIN) ? head.canonical[0].slice(ORIGIN.length) : self[0]
	const key = L.prefix && path.startsWith(`${L.prefix}/`) ? path.slice(L.prefix.length) : path
	if (ledger.has(key)) {
		errors.push(...checkHreflang(rel, key, head.hreflang))
		const wantAlt = Object.keys(LANGS)
			.filter((k) => k !== lang)
			.map((k) => LANGS[k].og)
			.sort()
		if (JSON.stringify([...head.ogAlt].sort()) !== JSON.stringify(wantAlt)) {
			errors.push(`${rel}: og:locale:alternate が ${wantAlt.join(', ')} でない (${head.ogAlt.join(', ') || '無し'})`)
		}
	} else {
		if (head.hreflang.length > 0) errors.push(`${rel}: 台帳に無いページに hreflang がある (${head.hreflang.length} 本)`)
		if (head.ogAlt.length > 0) errors.push(`${rel}: 台帳に無いページに og:locale:alternate がある (${head.ogAlt.length} 本)`)
	}

	errors.push(...checkJsonLd(rel, lang, head))
	return errors
}

export default function check(ctx) {
	const ledgerPath = join(ctx.root, LEDGER)
	if (!existsSync(ledgerPath)) return [`${LEDGER} が無い`]
	let ledger
	try {
		ledger = parseLedger(readFileSync(ledgerPath, 'utf8'))
	} catch (e) {
		return [e.message]
	}
	const errors = []
	for (const rel of ctx.listHtml('')) errors.push(...checkPage(rel, ctx.read(rel), ledger))
	return errors
}
