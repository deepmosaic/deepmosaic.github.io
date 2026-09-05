// docs (/docs/ と /docs/web/) の回帰ガードの純ロジック (TICKET-SITE-48)。
//
// DOM に触らず文字列だけを扱う。実行入口は scripts/check-docs.mjs (ファイル I/O 担当)。
// `node --test src/lib/*.test.js` で検証する。
//
// 守りたい契約:
//   1. 既存 20 個の節 ID (about … trouble) はアプリ内ヘルプ / /price/ / /spec/ / llms.txt が
//      参照する (TICKET-SITE-16)。改名すると外部リンクが無言で壊れる
//   2. 目次 (_data/docs_toc.yml) の ID は本文に存在する
//   3. サイト内から /docs/#… へ張った深いリンクは解決する
//   4. docs の <img> は src が実在し、width / height / alt を持ち、寸法が実ファイルと一致する
//      (CLS 対策。スクショを撮り直して寸法が変わったのに属性だけ古い、を検出する)

/** /docs/ の既存 ID (契約)。追加はよいが削除・改名はここも含めて意図的に行うこと。 */
export const LEGACY_DOCS_IDS = Object.freeze([
	'about',
	'install',
	'setup',
	'license',
	'plan',
	'import',
	'detect-options',
	'detect',
	'edit-overview',
	'edit-player',
	'edit-toolbar',
	'edit-mosaic',
	'edit-encode',
	'review',
	'premiere',
	'update',
	'uninstall',
	'usage',
	'spec',
	'trouble',
])

/**
 * ビルド済みページから docs の本文 (目次 + 各章) だけを切り出す。
 * ヘッダー / フッター (ロゴ画像やナビ) は検査対象外。目印は docs の骨組みが持つ
 * `data-island="scrollspy"` と、footer.html の `<footer`。見つからなければ全体を返す。
 */
export function extractDocsContent(html) {
	const start = html.indexOf('data-island="scrollspy"')
	if (start < 0) return html
	const end = html.indexOf('<footer', start)
	return html.slice(start, end < 0 ? undefined : end)
}

/** HTML 中の id="…" をすべて集める。 */
export function extractIds(html) {
	const ids = new Set()
	for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1])
	return ids
}

/** ページ内リンク (href="#x") の x を集める。空の "#" は無視。 */
export function extractLocalAnchors(html) {
	const out = []
	for (const m of html.matchAll(/href="#([^"]+)"/g)) out.push(decodeURIComponent(m[1]))
	return out
}

/**
 * テキスト (HTML / Markdown / llms.txt) から docs への深いリンクを集める。
 * `/docs/#x` `/docs#x` `/docs/web/#x` `/docs/web#x` と絶対 URL 形を受け付ける。
 * 戻り値: [{ page: '/docs/' | '/docs/web/', id }]
 */
export function extractDocsDeepLinks(text) {
	const out = []
	const re = /(?:https?:\/\/[^\s"')]+)?\/docs(\/web)?\/?#([A-Za-z0-9_-]+)/g
	for (const m of text.matchAll(re)) {
		out.push({ page: m[1] ? '/docs/web/' : '/docs/', id: m[2] })
	}
	return out
}

/** <img …> を属性ごとに分解する。 */
export function extractImages(html) {
	const out = []
	for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
		const attrs = {}
		for (const a of m[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
		out.push({
			src: attrs.src ?? null,
			alt: attrs.alt ?? null,
			width: attrs.width ? Number(attrs.width) : null,
			height: attrs.height ? Number(attrs.height) : null,
			tag: m[0],
		})
	}
	return out
}

/**
 * WebP の寸法をヘッダから読む (VP8 / VP8L / VP8X)。壊れていれば null。
 * 依存を増やさないため自前で読む (CI に ImageMagick を要求しない)。
 */
export function parseWebpSize(buf) {
	if (!buf || buf.length < 30) return null
	if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
	const chunk = buf.toString('ascii', 12, 16)
	if (chunk === 'VP8 ') {
		// lossy: 10 byte frame header 後に 14bit 幅 / 高さ
		const w = buf.readUInt16LE(26) & 0x3fff
		const h = buf.readUInt16LE(28) & 0x3fff
		return { width: w, height: h }
	}
	if (chunk === 'VP8L') {
		const b0 = buf[21]
		const b1 = buf[22]
		const b2 = buf[23]
		const b3 = buf[24]
		const w = 1 + (((b1 & 0x3f) << 8) | b0)
		const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
		return { width: w, height: h }
	}
	if (chunk === 'VP8X') {
		const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
		const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
		return { width: w, height: h }
	}
	return null
}

/**
 * `_data/docs_toc.yml` の最小パーサ。想定する形だけを読む:
 *   desktop:
 *     - title: 導入
 *       items:
 *         - { id: about, label: はじめに }
 * 戻り値: { desktop: ['about', …], web: [...] }
 */
export function parseTocIds(yaml) {
	const out = {}
	let current = null
	for (const raw of yaml.split(/\r?\n/)) {
		const line = raw.replace(/#.*$/, '').trimEnd()
		if (!line.trim()) continue
		const top = line.match(/^([A-Za-z_]+):\s*$/)
		if (top) {
			current = top[1]
			out[current] = []
			continue
		}
		const item = line.match(/\{\s*id:\s*([A-Za-z0-9_-]+)\s*,/)
		if (item && current) out[current].push(item[1])
	}
	return out
}

/**
 * 1 ページ分の検査。ファイル I/O を伴わない部分だけをここで行う。
 * @param {object} p
 * @param {string} p.page        '/docs/' など (メッセージ用)
 * @param {string} p.html        ビルド済み HTML
 * @param {string[]} p.requiredIds  必ず存在すべき ID (契約)
 * @param {string[]} p.tocIds       目次の ID
 * @param {(src: string) => ({width:number,height:number}|null|undefined)} p.imageSize
 *        src → 実ファイルの寸法。undefined = ファイル無し、null = 寸法不明 (WebP 以外)
 * @returns {string[]} 問題の一覧 (空なら合格)
 */
export function checkDocsPage({ page, html, requiredIds = [], tocIds = [], imageSize }) {
	const problems = []
	const ids = extractIds(html)
	for (const id of requiredIds) {
		if (!ids.has(id)) problems.push(`${page}: 契約 ID "#${id}" が存在しない (外部リンクが壊れる)`)
	}
	for (const id of tocIds) {
		if (!ids.has(id)) problems.push(`${page}: 目次の ID "#${id}" が本文に無い`)
	}
	for (const id of new Set(extractLocalAnchors(html))) {
		if (!ids.has(id)) problems.push(`${page}: ページ内リンク "#${id}" の飛び先が無い`)
	}
	for (const img of extractImages(html)) {
		const label = img.src ?? img.tag.slice(0, 60)
		if (!img.src) {
			problems.push(`${page}: src の無い <img>`)
			continue
		}
		if (!img.alt) problems.push(`${page}: alt の無い <img src="${img.src}">`)
		if (!img.width || !img.height) problems.push(`${page}: width/height の無い <img src="${img.src}"> (CLS)`)
		const actual = imageSize(img.src)
		if (actual === undefined) {
			problems.push(`${page}: 画像ファイルが無い: ${label}`)
		} else if (actual && img.width && img.height && (actual.width !== img.width || actual.height !== img.height)) {
			problems.push(
				`${page}: <img src="${img.src}"> の width/height (${img.width}x${img.height}) が実ファイル (${actual.width}x${actual.height}) と違う — node scripts/check-docs.mjs --fix-dims`,
			)
		}
	}
	return problems
}

/**
 * ソース HTML の <img src="…"> の width / height を実寸へ書き換える (--fix-dims)。
 * 属性が無い場合は src の直後に足す。戻り値は書き換え後の文字列と変更件数。
 */
export function fixImageDims(html, imageSize) {
	let changed = 0
	const out = html.replace(/<img\b([^>]*)>/g, (tag, attrsStr) => {
		const src = attrsStr.match(/\ssrc="([^"]+)"/)?.[1]
		if (!src) return tag
		const actual = imageSize(src)
		if (!actual) return tag
		const cur = extractImages(tag)[0]
		if (cur.width === actual.width && cur.height === actual.height) return tag
		changed += 1
		let next = attrsStr
		if (/\swidth="[^"]*"/.test(next)) next = next.replace(/\swidth="[^"]*"/, ` width="${actual.width}"`)
		else next = next.replace(/\ssrc="[^"]+"/, (s) => `${s} width="${actual.width}"`)
		if (/\sheight="[^"]*"/.test(next)) next = next.replace(/\sheight="[^"]*"/, ` height="${actual.height}"`)
		else next = next.replace(/\swidth="[^"]+"/, (s) => `${s} height="${actual.height}"`)
		return `<img${next}>`
	})
	return { html: out, changed }
}
