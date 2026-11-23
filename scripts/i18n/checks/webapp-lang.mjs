// Web 版 (app.deepmosaic.co.jp) へのリンクの表示言語のパラメータの検査 (check-site のモジュール)。
//
//   - `en/` 配下の全 .html: href のホストが Web 版の `<a>` は `lang=en` をちょうど 1 つ持つ。`zh-tw/` 配下は `lang=zh-TW` をちょうど 1 つ。
//   - それ以外 (ja。`enterprise/` も ja) の全 .html: Web 版の `<a>` は `lang` を持たない (ja は Web 版の既定なので付けない)。
//   - href は実体参照 (`&amp;` など) を解いてから URL で解釈する。解釈できない href はエラー。
//   - 期待値の正は `_data/site.yml` の `web_app.lang_query` / `lang_param` で、下の定数はその写し
//     (src/lib/i18n-site-webapp-lang.test.js が一致を固定する)。Web 版がこのパラメータを読む。

import { TRANSLATED_DIRS } from '../ja-identity.mjs'

/** Web 版の表示言語のパラメータの名前 (`_data/site.yml` の `web_app.lang_query`) */
export const LANG_QUERY = 'lang'
/** ページの言語 (`page.lang`) → Web 版の locale (`_data/site.yml` の `web_app.lang_param`。ja は無い) */
export const LANG_PARAM = { en: 'en', 'zh-tw': 'zh-TW' }

const WEB_APP_HOST = 'app.deepmosaic.co.jp'

const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&amp;/g, '&')

/** HTML の `<a>` の href のうち、Web 版のホストの文字を含むもの (実体参照を解いた値) */
const webAppHrefs = (html) =>
	[...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => decode(m[1])).filter((h) => h.includes(WEB_APP_HOST))

/** サイトの相対パスの言語 (英中のディレクトリでなければ ja)。ja-identity の線引きと同じ */
const langOf = (rel) => TRANSLATED_DIRS.find((d) => rel.startsWith(`${d}/`)) ?? 'ja'

/** 1 つの href の検査。エラーの文 (問題なしは null) */
export function checkHref(rel, href, lang) {
	let url
	try {
		url = new URL(href)
	} catch {
		return `${rel}: Web 版へのリンクの href を解釈できない: ${href}`
	}
	if (url.hostname !== WEB_APP_HOST) return null
	const got = url.searchParams.getAll(LANG_QUERY)
	const want = LANG_PARAM[lang]
	if (want === undefined) {
		return got.length === 0 ? null : `${rel}: ja のページの Web 版へのリンクに ${LANG_QUERY} がある (付けない): ${href}`
	}
	if (got.length === 1 && got[0] === want) return null
	return `${rel}: Web 版へのリンクに ${LANG_QUERY}=${want} がちょうど 1 つでない (${got.length} 個: [${got.join(', ')}]): ${href}`
}

export default function check(ctx) {
	const errors = []
	for (const rel of ctx.listHtml()) {
		const lang = langOf(rel)
		for (const href of webAppHrefs(ctx.read(rel))) {
			const e = checkHref(rel, href, lang)
			if (e) errors.push(e)
		}
	}
	return errors
}
