// ビルド出力の SEO の検査 (内部リンクの形・sitemap の lastmod・Organization の sameAs・?checkout= の nofollow)。
//
//   1. 内部リンクの形: 全ページの <a href>・data-links='…' の JSON・<script data-lang-links> の JSON の "href"。
//      対象は `/` で始まり `//` で始まらないものと、自分のドメイン (https://www.deepmosaic.co.jp/) の絶対 URL
//      (クエリと # 以降は外して判定)。
//        - 末尾が `/`          → `<パス>index.html` があること
//        - 拡張子なし          → `<パス>.html` があること (/company/* の形)。`<パス>/index.html` しか無ければ 301 を経由する
//        - `.html` で終わる    → エラー (/index.html・/company/about.html は canonical と別の重複 URL)
//        - それ以外の拡張子    → ファイルがあること
//   2. sitemap.xml: 全 <url> に ISO 8601 の <lastmod>、<url> が 3 件以上なら値が 2 種類以上 (浅いクローンで全部そろうのを捕まえる)、
//      <loc> も 1. と同じ規則
//   3. Organization の JSON-LD: JSON.parse でき、sameAs が https:// の配列で、GitHub と同じページの twitter:site の X を含む
//   4. href に ?checkout= / &checkout= を含む <a> は rel に nofollow を含む
//
// ctx.read / ctx.exists / ctx.listHtml だけで _site を読む。依存なし。

const ORIGIN = 'https://www.deepmosaic.co.jp'
const GITHUB = 'https://github.com/deepmosaic'
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const MIN_URLS_FOR_VARIETY = 3

const A_TAG = /<a\b[^>]*>/gi
const ATTR = (name) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')
const JSON_HREF = /"href"\s*:\s*"([^"]*)"/g
const DATA_LINKS = /\sdata-links\s*=\s*'([^']*)'/gi
const LANG_LINKS = /<script\b[^>]*\bdata-lang-links\b[^>]*>([\s\S]*?)<\/script>/gi
const LD_JSON = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

const attr = (tag, name) => {
	const m = tag.match(ATTR(name))
	return m ? (m[1] ?? m[2]) : null
}

const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

/** 内部リンクなら `_site` 基準のパス (先頭の / 付き、クエリと # なし)、そうでなければ null。 */
export function internalPath(href) {
	let rest
	if (href.startsWith(`${ORIGIN}/`) || href === ORIGIN) rest = href.slice(ORIGIN.length) || '/'
	else if (href.startsWith('/') && !href.startsWith('//')) rest = href
	else return null
	const path = rest.split(/[?#]/)[0] || '/'
	try {
		return decodeURIComponent(path)
	} catch {
		return path
	}
}

/** 内部のパスの行き先を判定する。問題が無ければ null、あれば理由の文。 */
export function linkProblem(ctx, path) {
	const rel = path.slice(1)
	if (path.endsWith('/')) return ctx.exists(`${rel}index.html`) ? null : '行き先が無い'
	const last = rel.split('/').pop()
	const ext = last.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase()
	if (ext === 'html') return '.html の URL を指している (canonical と別の重複 URL。.html を外す)'
	if (ext) return ctx.exists(rel) ? null : '行き先が無い'
	if (ctx.exists(`${rel}.html`)) return null
	if (ctx.exists(`${rel}/index.html`)) return '301 を経由する (末尾に / を付ける)'
	return '行き先が無い'
}

/** ページの中のリンクの href を全部集める (<a>・data-links・data-lang-links)。 */
function collectHrefs(html) {
	const out = []
	for (const tag of html.match(A_TAG) ?? []) {
		const href = attr(tag, 'href')
		if (href !== null) out.push(decodeEntities(href))
	}
	for (const re of [DATA_LINKS, LANG_LINKS]) {
		for (const m of html.matchAll(re)) {
			for (const h of decodeEntities(m[1]).matchAll(JSON_HREF)) out.push(h[1])
		}
	}
	return out
}

function checkLinks(ctx, rel, html) {
	const errors = []
	for (const href of collectHrefs(html)) {
		const path = internalPath(href)
		if (path === null) continue
		const problem = linkProblem(ctx, path)
		if (problem) errors.push(`${rel}: href="${href}" — ${problem}`)
	}
	return errors
}

function checkNofollow(rel, html) {
	const errors = []
	for (const tag of html.match(A_TAG) ?? []) {
		const href = decodeEntities(attr(tag, 'href') ?? '')
		if (!/[?&]checkout=/.test(href)) continue
		const rels = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/)
		if (!rels.includes('nofollow')) errors.push(`${rel}: href="${href}" — ?checkout= のリンクに rel="nofollow" が無い`)
	}
	return errors
}

/** JSON-LD の中から @type が Organization の物を探す (@graph と配列も見る)。 */
function findOrganization(node) {
	if (Array.isArray(node)) {
		for (const n of node) {
			const found = findOrganization(n)
			if (found) return found
		}
		return null
	}
	if (!node || typeof node !== 'object') return null
	const type = node['@type']
	if (type === 'Organization' || (Array.isArray(type) && type.includes('Organization'))) return node
	return node['@graph'] ? findOrganization(node['@graph']) : null
}

function sameAsProblems(sameAs, twitterSite) {
	if (!Array.isArray(sameAs)) return ['sameAs が配列でない']
	const problems = []
	const bad = sameAs.filter((u) => typeof u !== 'string' || !u.startsWith('https://'))
	if (bad.length > 0) problems.push(`sameAs に https:// でない要素がある (${JSON.stringify(bad)})`)
	const want = [GITHUB]
	if (twitterSite) want.push(`https://x.com/${twitterSite}`)
	for (const w of want) if (!sameAs.includes(w)) problems.push(`sameAs に ${w} が無い`)
	return problems
}

function checkSameAs(rel, html) {
	const tw = (html.match(/<meta\b[^>]*\bname\s*=\s*["']twitter:site["'][^>]*>/i) ?? [])[0]
	const twitterSite = tw ? (attr(tw, 'content') ?? '').replace(/^@/, '') : ''
	const errors = []
	for (const m of html.matchAll(LD_JSON)) {
		if (!m[1].includes('Organization')) continue
		let data
		try {
			data = JSON.parse(m[1])
		} catch (e) {
			errors.push(`${rel}: Organization の JSON-LD を JSON.parse できない (${e.message})`)
			continue
		}
		const org = findOrganization(data)
		if (!org) continue
		for (const p of sameAsProblems(org.sameAs, twitterSite)) errors.push(`${rel}: ${p}`)
	}
	return errors
}

function checkSitemap(ctx) {
	if (!ctx.exists('sitemap.xml')) return ['sitemap.xml が無い']
	const xml = ctx.read('sitemap.xml')
	const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1])
	const errors = []
	const values = new Set()
	let valid = 0
	for (const u of urls) {
		const loc = (u.match(/<loc>\s*([^<]*?)\s*<\/loc>/) ?? [])[1] ?? ''
		const lastmod = (u.match(/<lastmod>\s*([^<]*?)\s*<\/lastmod>/) ?? [])[1]
		if (lastmod === undefined) errors.push(`sitemap.xml: ${loc} — <lastmod> が無い`)
		else if (!ISO_8601.test(lastmod)) errors.push(`sitemap.xml: ${loc} — <lastmod>${lastmod}</lastmod> が ISO 8601 の日時でない`)
		else {
			values.add(lastmod)
			valid++
		}
		const path = internalPath(loc)
		if (path === null) {
			errors.push(`sitemap.xml: <loc>${loc}</loc> — 自分のドメインの URL でない`)
			continue
		}
		const problem = linkProblem(ctx, path)
		if (problem) errors.push(`sitemap.xml: <loc>${loc}</loc> — ${problem}`)
	}
	if (urls.length >= MIN_URLS_FOR_VARIETY && valid === urls.length && values.size < 2) {
		errors.push(`sitemap.xml: ${urls.length} 件の <lastmod> がすべて同じ値 (浅いクローンでビルドした疑い)`)
	}
	return errors
}

export default function check(ctx) {
	const errors = []
	for (const rel of ctx.listHtml()) {
		const html = ctx.read(rel)
		errors.push(...checkLinks(ctx, rel, html), ...checkNofollow(rel, html), ...checkSameAs(rel, html))
	}
	errors.push(...checkSitemap(ctx))
	return errors
}
