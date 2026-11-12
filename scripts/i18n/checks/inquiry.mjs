// T-2206 (i18n1112 I18N-708): 英中の問い合わせフォームと 404 の振り分けの検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 英中の `/contact/`・`/enterprise/inquiry/` (あれば): アイランドの root (`data-island="inquiry-form"`) があり、
//       `data-kind`・`data-endpoint` が ja の同じページと同じ (ja のページが無ければ data-kind は general / enterprise)、
//       アイランドの root の直下に `<noscript>` があり、その文に仮名が無い (ヘッダーの noscript は見ない)。
//       英中のページがまだ無ければ何もしない。
//   - ルートの `404.html` に `[data-lang-404]` の印があれば (I18N-712 の後)、`en/404.html` と `zh-tw/404.html` がある
//       (src/main.js が印を見て英中の 404 へ location.replace するので、行き先が無いと 404 の先が 404 になる)。

const LANGS = ['en', 'zh-tw']
const PAGES = [
	{ rel: 'contact/index.html', kind: 'general' },
	{ rel: 'enterprise/inquiry/index.html', kind: 'enterprise' },
]

/** 仮名 (半角カナ・中黒を含む) */
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const ISLAND_RE = /<div\b[^>]*\bdata-island="inquiry-form"[^>]*>/
const LANG_404 = /\sdata-lang-404(?=[\s=>/])/

const attrOf = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null

function islandOf(html) {
	const tag = html.match(ISLAND_RE)?.[0]
	if (!tag) return null
	return { kind: attrOf(tag, 'data-kind'), endpoint: attrOf(tag, 'data-endpoint') }
}

/**
 * アイランドの root の直下にある最初の <noscript> の文 (タグを除く)。無ければ null。
 * 英中のページはヘッダーのモバイルナビにも <noscript> があるので、ページ全体ではなくアイランドの中だけを見る。
 */
const ISLAND_NOSCRIPT_RE = /^<div\b[^>]*\bdata-island="inquiry-form"[^>]*>\s*<noscript>([\s\S]*?)<\/noscript>/
function islandNoscriptText(html) {
	const m = html.match(ISLAND_RE)
	if (!m) return null
	const inner = html.slice(m.index).match(ISLAND_NOSCRIPT_RE)
	return inner ? inner[1].replace(/<[^>]*>/g, ' ') : null
}

function checkPage(ctx, lang, page) {
	const rel = `${lang}/${page.rel}`
	if (!ctx.exists(rel)) return []
	const errors = []
	const html = ctx.read(rel)
	const island = islandOf(html)
	if (!island) return [`${rel}: data-island="inquiry-form" のアイランドが無い`]

	const ja = ctx.exists(page.rel) ? islandOf(ctx.read(page.rel)) : null
	const wantKind = ja?.kind ?? page.kind
	if (island.kind !== wantKind) errors.push(`${rel}: data-kind が ja と違う: ${island.kind} / ${wantKind}`)
	if (ja && island.endpoint !== ja.endpoint) {
		errors.push(`${rel}: data-endpoint が ja と違う: ${island.endpoint} / ${ja.endpoint}`)
	}
	const noscript = islandNoscriptText(html)
	if (noscript === null) {
		errors.push(`${rel}: アイランドの中に JS 無効時の代わり (<noscript>) が無い`)
	} else {
		const kana = noscript.match(KANA)
		if (kana) errors.push(`${rel}: <noscript> の文に仮名がある (${kana[0]})`)
	}
	return errors
}

export default function check(ctx) {
	const errors = []
	for (const lang of LANGS) for (const page of PAGES) errors.push(...checkPage(ctx, lang, page))

	if (ctx.exists('404.html') && LANG_404.test(ctx.read('404.html'))) {
		for (const lang of LANGS) {
			const rel = `${lang}/404.html`
			if (!ctx.exists(rel)) errors.push(`404.html に data-lang-404 があるのに ${rel} が無い (振り分けの行き先)`)
		}
	}
	return errors
}
