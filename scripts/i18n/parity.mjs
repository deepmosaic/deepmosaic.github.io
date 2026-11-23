// ja のソースと英中のソースの構造の一致の検査 (純関数)。
//
//   structureOf(src)  → { ids, dataDl, islands, dataAttrs, imgSrcs, includes }
//   compareStructure(jaSrc, xSrc, { allowExtraIncludes = ['ja-link.html'], ignoreLangFolders = true }) → 違いの文字列の配列 (空なら一致)
//   stripLangFolder(path) → パスの途中の `en/`・`zh-tw/` のフォルダを外したもの
//
//   - Liquid の `{% comment %}` と HTML のコメントを除いてから正規表現で抜く。
//   - id・data-dl・data-island・img の src・include の名前は**並び**で比べる。data-* は**名前の集合**で比べる。
//   - 多言語化の印 (data-i18n-allow・data-i18n-switch・data-ja-allowed・data-lang-404) は data-* に数えない。
//   - img の src と include の名前は、既定で言語のフォルダ (`/en/`・`/zh-tw/`) を外して比べる。訳で言語別の画像
//     (`assets/img/screenshots/<lang>/<同じ名前>`) や訳の include (`docs/<lang>/<同じ名前>`) に替えても、日本語のままでも一致する。
//   - 各ページの node テストが使う (例: compareStructure(read('price/index.html'), read('en/price/index.html')))。
//     include の組 (`_includes/docs/01-intro.html` と `_includes/docs/en/01-intro.html`) にも同じように使う。

/** img の src と include の名前の比較で外す、言語のフォルダ。 */
export const LANG_FOLDERS = ['en', 'zh-tw']

const LANG_FOLDER_RE = new RegExp(`(^|/)(?:${LANG_FOLDERS.join('|')})/`, 'g')

/** パスの途中の言語のフォルダ (`en/`・`zh-tw/`) を外す。 */
export function stripLangFolder(path) {
	return path.replace(LANG_FOLDER_RE, '$1')
}

/** data-* の比較で数えない、多言語化の印。 */
export const I18N_MARKERS = ['data-i18n-allow', 'data-i18n-switch', 'data-ja-allowed', 'data-lang-404']

function stripComments(src) {
	return src
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

const all = (re, text, group = 1) => [...text.matchAll(re)].map((m) => m[group])

/** ソースの構造を抜く。 */
export function structureOf(src) {
	const s = stripComments(src)
	const attr = (name) => new RegExp(`\\s${name}=(["'])(.*?)\\1`, 'g')
	const tags = all(/<[a-zA-Z][^>]*>/g, s, 0)
	const dataAttrs = new Set()
	for (const t of tags) for (const n of all(/\s(data-[\w-]+)(?=[\s=>/])/g, t)) if (!I18N_MARKERS.includes(n)) dataAttrs.add(n)
	return {
		ids: all(attr('id'), s, 2),
		dataDl: all(attr('data-dl'), s, 2),
		islands: all(attr('data-island'), s, 2),
		dataAttrs: [...dataAttrs].sort(),
		imgSrcs: tags.filter((t) => /^<img\b/i.test(t)).flatMap((t) => all(attr('src'), t, 2)),
		includes: all(/\{%-?\s*include\s+([^\s%]+)/g, s),
	}
}

const fmt = (arr) => JSON.stringify(arr)

/** ja と英中のソースの構造の違いを返す (空なら一致)。 */
export function compareStructure(jaSrc, xSrc, { allowExtraIncludes = ['ja-link.html'], ignoreLangFolders = true } = {}) {
	const a = structureOf(jaSrc)
	const b = structureOf(xSrc)
	const dropAllowed = (list) => list.filter((n) => !allowExtraIncludes.includes(n))
	a.includes = dropAllowed(a.includes)
	b.includes = dropAllowed(b.includes)
	if (ignoreLangFolders) {
		for (const s of [a, b]) {
			s.imgSrcs = s.imgSrcs.map(stripLangFolder)
			s.includes = s.includes.map(stripLangFolder)
		}
	}
	const out = []
	for (const key of ['ids', 'dataDl', 'islands', 'imgSrcs', 'includes', 'dataAttrs']) {
		if (fmt(a[key]) !== fmt(b[key])) {
			const onlyJa = a[key].filter((v) => !b[key].includes(v))
			const onlyX = b[key].filter((v) => !a[key].includes(v))
			const detail = onlyJa.length || onlyX.length ? `ja だけ ${fmt(onlyJa)} / 訳だけ ${fmt(onlyX)}` : '並びが違う'
			out.push(`${key}: ${detail} (ja ${fmt(a[key])} / 訳 ${fmt(b[key])})`)
		}
	}
	return out
}
