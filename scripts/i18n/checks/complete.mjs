// T-2210 (i18n1112 I18N-712): W7 (公式サイトの多言語化) の完成の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 台帳 (`_data/i18n_pages.yml`) の全部の鍵について、ja / en / zh-tw の 3 版が `_site` にあり、3 版のそれぞれが hreflang で
//     3 版 + x-default (= en) を指す (対称)。hreflang の細かい形 (og:locale:alternate) は checks/head.mjs が見る。ここは「3 版がそろい、互いに指す」こと。
//     ウェーブ末尾の追い修正 (2026-11-12): 3 版とも hreflang がちょうど 4 本、英中の版は自分自身を指す canonical がちょうど 1 本
//     (head.mjs は canonical の無いページを見ないので、英中の canonical の欠けはここで捕まえる)。
//   - `sitemap.xml` に英中の索引対象のページ (台帳から join を除いた鍵 × 2) があり、英中の join と 404 が無い。
//   - `_site/en/**` と `_site/zh-tw/**` の `.html` が、台帳の英中の版 + 英中の 404 とちょうど同じ (余計なページ = probe の消し忘れが無い)。
//   - `_site/assets/dist/app.js` に 404 の振り分け (`data-lang-404`) の処理がある (I18N-708 の取り込み)。
//   - 実際のビルドのときだけ見る: ja のトップ (`index.html`) がレイアウトを通っている (`<link rel="canonical"` を持つ) こと。
//     ほかの検査の模型 (canonical の無い断片の HTML) では何もしない (checks/head.mjs・pages-*.mjs と同じ線引き)。

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseLedger } from './head.mjs'

const ORIGIN = 'https://www.deepmosaic.co.jp'
const LEDGER = '_data/i18n_pages.yml'
const PREFIX = { ja: '', en: '/en', 'zh-tw': '/zh-tw' }
const TRANSLATED = ['en', 'zh-tw']
/** 索引しない鍵 (noindex・sitemap: false。台帳には載るが sitemap には出ない) */
const NOT_INDEXED = ['/join/']

/** 台帳の鍵と言語 → `_site` の中の相対パス */
export function relOf(lang, key) {
	const p = `${PREFIX[lang]}${key}`.slice(1)
	if (p === '' || p.endsWith('/')) return `${p}index.html`
	return `${p}.html`
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`))?.[1]
function hreflangOf(html) {
	return [...html.matchAll(/<link\b[^>]*\bhreflang=[^>]*>/g)].map((m) => ({ lang: attr(m[0], 'hreflang'), href: attr(m[0], 'href') }))
}

function canonicalOf(html) {
	return [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/g)].map((m) => attr(m[0], 'href'))
}

function checkSymmetry(ctx, key) {
	const errors = []
	const want = {
		ja: `${ORIGIN}${key}`,
		en: `${ORIGIN}/en${key}`,
		'zh-Hant-TW': `${ORIGIN}/zh-tw${key}`,
		'x-default': `${ORIGIN}/en${key}`,
	}
	for (const lang of ['ja', ...TRANSLATED]) {
		const rel = relOf(lang, key)
		if (!ctx.exists(rel)) {
			errors.push(`${rel} が無い (台帳の ${key} の ${lang} の版)`)
			continue
		}
		const page = ctx.read(rel)
		const links = hreflangOf(page)
		for (const [hl, href] of Object.entries(want)) {
			if (!links.some((l) => l.lang === hl && l.href === href)) errors.push(`${rel}: hreflang="${hl}" が ${href} を指していない (3 版の対称が崩れている)`)
		}
		if (links.length !== 4) errors.push(`${rel}: hreflang が 4 本でない (${links.length} 本。ja・en・zh-Hant-TW・x-default)`)
		// 英中の版は自分自身を指す canonical をちょうど 1 本 (checks/head.mjs は canonical の無いページを見ないので、ここで漏れを捕まえる)
		if (TRANSLATED.includes(lang)) {
			const self = `${ORIGIN}${PREFIX[lang]}${key}`
			const canonical = canonicalOf(page)
			if (canonical.length !== 1 || canonical[0] !== self) {
				errors.push(`${rel}: canonical が自分自身 (${self}) を指す 1 本でない (${canonical.join(', ') || 'なし'})`)
			}
		}
	}
	return errors
}

function checkSitemap(ctx, ledger) {
	if (!ctx.exists('sitemap.xml')) return ['sitemap.xml が無い']
	const locs = new Set([...ctx.read('sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].trim()))
	const errors = []
	for (const [key] of ledger) {
		for (const lang of TRANSLATED) {
			const url = `${ORIGIN}${PREFIX[lang]}${key}`
			if (NOT_INDEXED.includes(key)) {
				if (locs.has(url)) errors.push(`sitemap.xml: 索引しないページ ${PREFIX[lang]}${key} がある (sitemap: false)`)
			} else if (!locs.has(url)) errors.push(`sitemap.xml: ${PREFIX[lang]}${key} が無い`)
		}
	}
	for (const lang of TRANSLATED) {
		for (const u of [`${ORIGIN}${PREFIX[lang]}/404.html`, `${ORIGIN}${PREFIX[lang]}/404`]) {
			if (locs.has(u)) errors.push(`sitemap.xml: 英中の 404 (${u.slice(ORIGIN.length)}) がある`)
		}
	}
	return errors
}

function checkExactPages(ctx, ledger) {
	const want = new Set()
	for (const [key, langs] of ledger) for (const lang of langs) if (TRANSLATED.includes(lang)) want.add(relOf(lang, key))
	for (const lang of TRANSLATED) want.add(`${lang}/404.html`)
	const got = new Set(TRANSLATED.flatMap((lang) => ctx.listHtml(lang).map((rel) => (rel.startsWith(`${lang}/`) ? rel : `${lang}/${rel}`))))
	const errors = []
	for (const rel of [...got].sort()) if (!want.has(rel)) errors.push(`${rel}: 台帳に無い英中のページ (probe の消し忘れか、台帳の書き忘れ)`)
	for (const rel of [...want].sort()) if (!got.has(rel)) errors.push(`${rel} が無い (台帳の英中の版か、英中の 404)`)
	return errors
}

function checkAppJs(ctx) {
	const rel = 'assets/dist/app.js'
	if (!ctx.exists(rel)) return [`${rel} が無い`]
	return ctx.read(rel).includes('data-lang-404') ? [] : [`${rel}: 404 の振り分け (data-lang-404) の処理が無い (src/main.js の取り込み漏れ)`]
}

export default function check(ctx) {
	if (!ctx.exists('index.html') || !/<link rel="canonical"/.test(ctx.read('index.html'))) return []
	const ledgerPath = join(ctx.root, LEDGER)
	if (!existsSync(ledgerPath)) return [`${LEDGER} が無い`]
	let ledger
	try {
		ledger = parseLedger(readFileSync(ledgerPath, 'utf8'))
	} catch (e) {
		return [e.message]
	}
	const errors = []
	for (const [key, langs] of ledger) {
		for (const lang of TRANSLATED) if (!langs.includes(lang)) errors.push(`${LEDGER}: ${key} に ${lang} が無い (W7 は全部の鍵に英中の 2 版)`)
		errors.push(...checkSymmetry(ctx, key))
	}
	errors.push(...checkSitemap(ctx, ledger))
	errors.push(...checkExactPages(ctx, ledger))
	errors.push(...checkAppJs(ctx))
	return errors
}
