// T-2204 (i18n1112 I18N-706): サイトのアイランド・JS がページの言語を知るための小さな部品。
//
//   - 言語は <html lang> から読む (W7-site.md §0-C)。Jekyll の layout が ja `ja` / en `en` / zh-tw `zh-Hant-TW` を出す。
//     ja のページの island の root に data-lang を足すと ja の HTML が変わる (ja-identity が落ちる) ので属性は使わない。
//   - pageLang(doc): `en` で始まれば 'en'、`zh` で始まれば 'zh-tw'、それ以外・取れないとき (node のテストで document が無い) は 'ja'。
//   - pick(byLang, lang): 同じファイルに置いた 3 言語の表 (`{ ja: …, en: …, 'zh-tw': … }`) から選ぶ。無ければ ja。
//   - DOM を読む以外の副作用なし (document の代わりを渡してテストできる)。

/** @typedef {'ja' | 'en' | 'zh-tw'} SiteLang */

/**
 * ページの言語。
 * @param {{ documentElement?: { lang?: string } } | null | undefined} [doc]
 * @returns {SiteLang}
 */
export function pageLang(doc = globalThis.document) {
	const lang = String(doc?.documentElement?.lang ?? '').toLowerCase()
	if (lang.startsWith('en')) return 'en'
	if (lang.startsWith('zh')) return 'zh-tw'
	return 'ja'
}

/**
 * 3 言語の表から言語の値を選ぶ (無ければ ja)。
 * @template T
 * @param {Partial<Record<SiteLang, T>> & { ja: T }} byLang
 * @param {string} lang
 * @returns {T}
 */
export function pick(byLang, lang) {
	return byLang[lang] ?? byLang.ja
}
