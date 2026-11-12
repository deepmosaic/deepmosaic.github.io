// T-2210 (i18n1112 I18N-712): お問い合わせ・導入相談・組織への参加・会社概要・404 の英中のページ (10 本) の出力の検査 (check-site のモジュール)。
//
//   - 10 ページが存在し、`<html lang>` が言語と一致する (en / zh-Hant-TW)。
//   - お問い合わせ・導入相談 (`/<lang>/contact/`・`/<lang>/enterprise/inquiry/`): アイランドの root (`data-island="inquiry-form"`) があり、
//     `data-kind` が ja の同じページと同じ (ja が無ければ general / enterprise)、root の直下に `<noscript>` がある (CI の ja の検査と同じ)、
//     確認のメールと返答が日本語で届く旨の 1 文がある。
//   - 組織への参加 (`/<lang>/join/`): `<meta name="robots" content="noindex` と `<meta name="referrer" content="no-referrer">` があり、
//     計測 (googletagmanager・cloudflareinsights・line-scdn) が無い。`data-join` の構造 (3 つの表示・コード・ボタン・コピー・Store) がある。
//   - 会社概要 (`/<lang>/company/about`): 社名 `Deepmosaic LLC` と、正式名を入れた `data-ja-allowed` の要素がある。
//   - 404: 英中の 404 に振り分けの印 (`data-lang-404`) が無い (行き先なので)。ルートの `404.html` にはある。
//   - 見える文の言語の検査は checks/lang-text.mjs (I18N-702)、hreflang は checks/head.mjs と checks/complete.mjs が受け持つ。
//   - 対象はレイアウトを通ったページ (`<link rel="canonical"` を持つ) だけ (checks/pages-product.mjs と同じ線引き)。
//     英中のページが無いことは、対応する ja のページがレイアウトを通っている (= 実際のビルド) ときだけエラーにする。

const LANGS = [
	{ dir: 'en', htmlLang: 'en', mailNote: 'The confirmation email and our reply will be in Japanese.' },
	{ dir: 'zh-tw', htmlLang: 'zh-Hant-TW', mailNote: '確認電子郵件與回覆將以日文寄送。' },
]
const PAGES = [
	{ key: 'contact', ja: 'contact/index.html', x: (d) => `${d}/contact/index.html`, kind: 'general' },
	{ key: 'inquiry', ja: 'enterprise/inquiry/index.html', x: (d) => `${d}/enterprise/inquiry/index.html`, kind: 'enterprise' },
	{ key: 'join', ja: 'join/index.html', x: (d) => `${d}/join/index.html` },
	{ key: 'about', ja: 'company/about.html', x: (d) => `${d}/company/about.html` },
	{ key: '404', ja: '404.html', x: (d) => `${d}/404.html` },
]
/** join の構造 (ja の join/index.html と src/main.js の initJoinPage が使う属性) */
const JOIN_MARKERS = [
	'data-join',
	'data-join-view="code"',
	'data-join-view="admin"',
	'data-join-view="invalid"',
	'data-join-code',
	'data-join-open-code',
	'data-join-open-admin',
	'data-join-copy',
	'data-join-copy-status',
	'data-join-install',
	'data-join-store',
]
const TRACKERS = ['googletagmanager', 'cloudflareinsights', 'line-scdn']

const isBuilt = (html) => /<link rel="canonical"/.test(html)
const LANG_404 = /\sdata-lang-404(?=[\s=>/])/
const ISLAND_RE = /<div\b[^>]*\bdata-island="inquiry-form"[^>]*>/
const attrOf = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null

/** 出力の文と比べるために実体参照を戻す */
const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&amp;/g, '&')

function checkInquiry(rel, html, ja, page, L) {
	const errors = []
	const m = html.match(ISLAND_RE)
	if (!m) return [`${rel}: data-island="inquiry-form" のアイランドが無い`]
	const jaTag = ja?.match(ISLAND_RE)?.[0]
	const want = (jaTag && attrOf(jaTag, 'data-kind')) || page.kind
	const kind = attrOf(m[0], 'data-kind')
	if (kind !== want) errors.push(`${rel}: data-kind が ja と違う: ${kind} / ${want}`)
	if (!/^\s*<noscript>/.test(html.slice(m.index + m[0].length))) errors.push(`${rel}: アイランドの直下に JS 無効時の代わり (<noscript>) が無い`)
	if (!decode(html).includes(L.mailNote)) errors.push(`${rel}: 確認のメールと返答が日本語で届く旨の 1 文 (「${L.mailNote}」) が無い`)
	return errors
}

function checkJoin(rel, html) {
	const errors = []
	if (!/<meta name="robots" content="noindex/.test(html)) errors.push(`${rel}: <meta name="robots" content="noindex…"> が無い`)
	if (!html.includes('<meta name="referrer" content="no-referrer">')) errors.push(`${rel}: <meta name="referrer" content="no-referrer"> が無い (計測なしのページ)`)
	for (const t of TRACKERS) if (html.includes(t)) errors.push(`${rel}: 計測 (${t}) がある (no_tracking のページ)`)
	for (const mk of JOIN_MARKERS) {
		const re = new RegExp(`\\s${mk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s=>/])`)
		if (!re.test(html)) errors.push(`${rel}: ${mk} が無い (src/main.js の initJoinPage が動かない)`)
	}
	return errors
}

function checkAbout(rel, html) {
	const errors = []
	if (!html.includes('Deepmosaic LLC')) errors.push(`${rel}: 社名 Deepmosaic LLC が無い`)
	if (!/<(\w+)\b[^>]*\sdata-ja-allowed\b[^>]*>Deepmosaic合同会社<\/\1>/.test(html)) {
		errors.push(`${rel}: 正式な社名 (Deepmosaic合同会社) を入れた data-ja-allowed の要素が無い`)
	}
	return errors
}

export default function check(ctx) {
	const errors = []
	for (const page of PAGES) {
		const ja = ctx.exists(page.ja) ? ctx.read(page.ja) : null
		const jaBuilt = ja !== null && isBuilt(ja)
		for (const L of LANGS) {
			const rel = page.x(L.dir)
			if (!ctx.exists(rel)) {
				if (jaBuilt) errors.push(`${rel} が無い (${page.ja} の英中の版)`)
				continue
			}
			const html = ctx.read(rel)
			if (!isBuilt(html)) continue
			const lang = html.match(/<html\b[^>]*\slang="([^"]*)"/)?.[1]
			if (lang !== L.htmlLang) errors.push(`${rel}: <html lang> が "${L.htmlLang}" でない (${lang ?? '無し'})`)
			if (page.kind) errors.push(...checkInquiry(rel, html, ja, page, L))
			if (page.key === 'join') errors.push(...checkJoin(rel, html))
			if (page.key === 'about') errors.push(...checkAbout(rel, html))
			if (page.key === '404' && LANG_404.test(html)) errors.push(`${rel}: 英中の 404 に data-lang-404 がある (振り分けの行き先なので置かない)`)
		}
		if (page.key === '404' && jaBuilt && !LANG_404.test(ja)) {
			errors.push('404.html: ルートの 404 に data-lang-404 が無い (英中の 404 へ振り分けられない)')
		}
	}
	return errors
}
