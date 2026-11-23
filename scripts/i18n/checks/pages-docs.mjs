// 英中の docs のページ (`/en/docs/`・`/en/docs/web/`・`/zh-tw/docs/`・`/zh-tw/docs/web/`) の出力の検査 (check-site のモジュール)。
//
//   - 対象はレイアウトを通った (`<link rel="canonical"` を持つ) 英中の docs のページだけ。生成されていなければ何も言わない
//     (訳がそろうまで骨組みを出さないため)。`<html lang>` が言語と一致する (en / zh-Hant-TW)。
//   - 本文 (`</header>` の後から最後の `<footer` の手前まで) を、日本語の同じページの本文と比べる。日本語のページが生成されていれば:
//       id の並び・目次 (`.docs-toc` の `<nav>` と `<details>` の中の `href="#…"` の並び)・ページ内リンク (`href="#…"`) の数・
//       data-dl の並び・`<img` の数・表の行 (`class="kv-row`) の数・`<details` の数が同じ。
//   - 置き換え漏れのプレースホルダ (`%%…%%`) が無い。
//   - Web 版へのリンクは表示言語のパラメータをちょうど 1 つ持つ (checks/webapp-lang.mjs と同じ決まり)。
//   - 法務のページ (`/company/{terms,privacy,cookie,eula,asct}`) へのリンクは日本語のページ用の部品 (`_includes/ja-link.html`) を通っている
//     = ja の URL (接頭辞なし) で hreflang="ja"、リンクの中かすぐ後ろに日本語のページの印 (`_data/lang/<lang>.json` の `ja_only_badge`) がある。
//   - 訳のあるページ (台帳 `_data/i18n_pages.yml` の鍵と `/docs/`・`/docs/web/`) へのリンクは、その言語の接頭辞 (`/en`・`/zh-tw`) を付ける。
//   - 見える文の言語の検査は checks/lang-text.mjs、目次・ページ内リンク・画像・契約の id は scripts/check-docs.mjs が受け持つ。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkHref } from './webapp-lang.mjs'
import { parseLedger } from './head.mjs'

export const DOCS_LANGS = [
	{ dir: 'en', htmlLang: 'en' },
	{ dir: 'zh-tw', htmlLang: 'zh-Hant-TW' },
]
/** 日本語のページ → 英中のページ (lang のフォルダの下の同じ場所) */
export const DOCS_PAGES = ['docs/index.html', 'docs/web/index.html']
/** 訳を持つ docs のパス (台帳に載る前から訳のあるページとして扱う) */
const DOCS_KEYS = ['/docs/', '/docs/web/']
const LEGAL = /^\/company\/(?:terms|privacy|cookie|eula|asct)(?:\.html)?(?:[#?].*)?$/
const PREFIXED_LEGAL = /^\/(?:en|zh-tw)\/company\/(?:terms|privacy|cookie|eula|asct)\b/
const WEB_APP_HOST = 'app.deepmosaic.co.jp'

const isBuilt = (html) => /<link rel="canonical"/.test(html)
const count = (re, s) => (s.match(re) ?? []).length
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&amp;/g, '&')

/** 本文 (ヘッダーの後からフッターの手前まで)。ヘッダーやフッターが無ければその端まで */
export function bodyOf(html) {
	const h = html.indexOf('</header>')
	const start = h < 0 ? 0 : h + '</header>'.length
	const f = html.lastIndexOf('<footer')
	return html.slice(start, f < start ? html.length : f)
}

/** 目次 (`.docs-toc` の `<nav>` / `<details>`) の中の `href="#…"` を、目次ごとに並べる */
export function tocsOf(body) {
	const out = []
	for (const m of body.matchAll(/<(nav|details)\b[^>]*\bclass="[^"]*\bdocs-toc\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)) {
		out.push([...m[2].matchAll(/\shref="#([^"]*)"/g)].map((x) => x[1]))
	}
	return out
}

/** 本文の構造の数え上げ */
export function docsStructure(body) {
	return {
		ids: [...body.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]),
		tocs: tocsOf(body),
		inPageLinks: count(/\shref="#/g, body),
		dataDl: [...body.matchAll(/\sdata-dl="([^"]*)"/g)].map((m) => m[1]),
		imgs: count(/<img\b/g, body),
		kvRows: count(/\sclass="kv-row\b/g, body),
		details: count(/<details\b/g, body),
	}
}

const LABELS = {
	ids: 'id の並び',
	tocs: '目次の並び',
	inPageLinks: 'ページ内リンクの数',
	dataDl: 'data-dl の並び',
	imgs: '画像の数',
	kvRows: '表の行 (kv-row) の数',
	details: '<details> の数',
}

/** 日本語と英中の本文の構造の違い (エラーの文字列の配列) */
export function compareDocsStructure(rel, jaRel, jaBody, xBody) {
	const a = docsStructure(jaBody)
	const b = docsStructure(xBody)
	const errors = []
	for (const key of Object.keys(LABELS)) {
		const ja = JSON.stringify(a[key])
		const x = JSON.stringify(b[key])
		if (ja === x) continue
		const detail = ja.length + x.length > 400 ? '' : ` (ja ${ja} / 訳 ${x})`
		let diff = ''
		if (Array.isArray(a[key]) && !Array.isArray(a[key][0])) {
			const onlyJa = a[key].filter((v) => !b[key].includes(v))
			const onlyX = b[key].filter((v) => !a[key].includes(v))
			diff = onlyJa.length || onlyX.length ? `: ja だけ ${JSON.stringify(onlyJa)} / 訳だけ ${JSON.stringify(onlyX)}` : ': 並びが違う'
		}
		errors.push(`${rel}: ${LABELS[key]}が ${jaRel} と違う${diff}${detail}`)
	}
	return errors
}

/** 本文のリンクの検査 (Web 版・法務・訳のあるページ) */
export function checkLinks(rel, body, lang, badge, translatedKeys) {
	const errors = []
	const prefix = `/${lang}`
	for (const m of body.matchAll(/<a\b[^>]*>/g)) {
		const raw = attr(m[0], 'href')
		if (raw === undefined) continue
		const href = decode(raw)
		if (href.includes(WEB_APP_HOST)) {
			const e = checkHref(rel, href, lang)
			if (e) errors.push(e)
			continue
		}
		if (PREFIXED_LEGAL.test(href)) {
			errors.push(`${rel}: 法務のページへのリンクが ja の URL でない (法務は日本語のページだけ。ja-link.html を使う): ${href}`)
			continue
		}
		if (LEGAL.test(href)) {
			if (attr(m[0], 'hreflang') !== 'ja') errors.push(`${rel}: 法務のページへのリンク ${href} に hreflang="ja" が無い (ja-link.html を使う)`)
			const after = body.slice(m.index + m[0].length, m.index + m[0].length + 600)
			const closeAt = after.indexOf('</a>')
			const following = closeAt < 0 ? '' : (after.slice(closeAt + 4).match(/^\s*<span\b[^>]*>[^<]*<\/span>/)?.[0] ?? '')
			const tail = closeAt < 0 ? after : after.slice(0, closeAt) + following
			if (!tail.includes(badge)) errors.push(`${rel}: 法務のページへのリンク ${href} に日本語のページの印 (${badge}) が無い (ja-link.html を使う)`)
			continue
		}
		if (!href.startsWith('/') || href.startsWith('//')) continue
		const path = href.replace(/[#?].*$/, '')
		if (translatedKeys.has(path)) errors.push(`${rel}: 訳のあるページへのリンクに ${prefix} が無い: ${href}`)
	}
	return errors
}

export default function check(ctx) {
	const errors = []
	const ledger = parseLedger(readFileSync(join(ctx.root, '_data/i18n_pages.yml'), 'utf8'))
	const translatedKeys = new Set([...ledger.keys(), ...DOCS_KEYS])
	for (const L of DOCS_LANGS) {
		const badge = JSON.parse(readFileSync(join(ctx.root, `_data/lang/${L.dir}.json`), 'utf8')).ja_only_badge
		for (const jaRel of DOCS_PAGES) {
			const rel = `${L.dir}/${jaRel}`
			if (!ctx.exists(rel)) continue
			const html = ctx.read(rel)
			if (!isBuilt(html)) continue
			const lang = html.match(/<html\b[^>]*\slang="([^"]*)"/)?.[1]
			if (lang !== L.htmlLang) errors.push(`${rel}: <html lang> が "${L.htmlLang}" でない (${lang ?? '無し'})`)
			const body = bodyOf(html)
			const left = body.match(/%%[^%\s]+%%/)
			if (left) errors.push(`${rel}: 置き換え漏れのプレースホルダがある: ${left[0]}`)
			errors.push(...checkLinks(rel, body, L.dir, badge, translatedKeys))
			if (!ctx.exists(jaRel)) continue
			const ja = ctx.read(jaRel)
			if (!isBuilt(ja)) continue
			errors.push(...compareDocsStructure(rel, jaRel, bodyOf(ja), body))
		}
	}
	return errors
}
