// T-2206 (i18n1112 I18N-708): 英中の 404 への振り分けの判定 (純関数)。
//
// GitHub Pages は 404 を 1 本 (ルートの `404.html`) しか置けない (W7-site.md §0-G)。ルートの 404 には
// `[data-lang-404]` の印があり、`src/main.js` がその印を見つけたときだけ、この関数の行き先へ `location.replace` する。
//
//   - `/en/` で始まるパス → `/en/404.html`、`/zh-tw/` で始まるパス → `/zh-tw/404.html`
//   - 行き先自身 (`/en/404.html`・`/zh-tw/404.html`) とそれ以外 (`/foo`・`/english/`・`/en` など) → null (何もしない)
//   - 大文字小文字は区別する (サイトの URL は小文字だけ)

const TARGETS = [
	['/en/', '/en/404.html'],
	['/zh-tw/', '/zh-tw/404.html'],
]

/**
 * @param {unknown} pathname `location.pathname`
 * @returns {string | null}
 */
export function lang404Target(pathname) {
	if (typeof pathname !== 'string') return null
	for (const [prefix, target] of TARGETS) {
		if (pathname.startsWith(prefix)) return pathname === target ? null : target
	}
	return null
}
