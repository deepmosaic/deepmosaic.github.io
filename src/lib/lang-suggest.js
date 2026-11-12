// T-2211 (i18n1112 I18N-713): サイトの言語の自動の案内 (帯) の判定 (純関数だけ。DOM と storage は lang-suggest-mount.js)。
//
// ユーザーの決定 3 (新しい利用者はブラウザの言語で自動に決める) のサイトの分。サイトは URL が言語を表すので、
// **自動のリダイレクトはしない** (Googlebot は英語の環境で描画するので canonical と検索結果の言語が崩れる。設計書 §1.5)。
// 代わりに ja のページでブラウザの言語が英中のとき、英中のページへの案内の帯を出し、選んだ言語を覚える (W7-site.md §0-I)。
//
//   - resolveSiteLang(languages): desktop の fromSystem (設計書 §1.2) と同じ規則。情報が無い (空) ときだけ 'ja' (= 帯を出さない)
//   - decideSuggestion({ pageLang, languages, stored, alternates }) → { lang, href } | null
//   - 保存値 (localStorage の STORAGE_KEY) は 'ja' | 'en' | 'zh-tw'。'ja' は「帯を閉じた・日本語を選んだ」

/** @typedef {'ja' | 'en' | 'zh-tw'} SiteLang */

/** localStorage のキー (値は 'ja' | 'en' | 'zh-tw') */
export const STORAGE_KEY = 'dm-site-lang'

/**
 * 帯の文の 3 言語の表。ja は帯に出ない (候補が ja のときは帯を出さない) が、キーの集合を揃えるために置く。
 *   message: 帯の文 / action: 行き先のリンク / close: 閉じるのボタン / region: 帯の aria-label
 * en / zh-tw は用語集 (scripts/i18n/glossary.json) の close = close / 關閉 に合わせる。
 */
export const TEXT = {
	ja: {
		message: 'このページは日本語でもご覧いただけます。',
		action: '日本語で見る',
		close: '閉じる',
		region: '表示言語の案内',
	},
	en: {
		message: 'This page is also available in English.',
		action: 'View in English',
		close: 'Close',
		region: 'Language suggestion',
	},
	'zh-tw': {
		message: '本頁面也提供繁體中文版。',
		action: '以繁體中文檢視',
		close: '關閉',
		region: '語言建議',
	},
}

/**
 * ブラウザの言語の並び (navigator.languages) からサイトの言語を決める。
 * 先頭から見て、主タグが ja → 'ja'、zh (zh-TW / zh-HK / zh-CN / zh-SG / zh-Hans / zh-Hant …) → 'zh-tw'、en → 'en'。
 * どれにも当たらなければ 'en'。言語の情報が無い (空・空文字だけ・配列でない) ときは 'ja' (帯を出さない)。
 * @param {unknown} languages
 * @returns {SiteLang}
 */
export function resolveSiteLang(languages) {
	if (!Array.isArray(languages)) return 'ja'
	const tags = languages.filter((t) => typeof t === 'string' && t.trim() !== '')
	if (tags.length === 0) return 'ja'
	for (const raw of tags) {
		const primary = raw.trim().replace(/_/g, '-').split('-')[0].toLowerCase()
		if (primary === 'ja') return 'ja'
		if (primary === 'zh') return 'zh-tw'
		if (primary === 'en') return 'en'
	}
	return 'en'
}

/**
 * 保存値を読む。'ja' | 'en' | 'zh-tw' (zh-TW も可) だけを受け、それ以外は null (保存値なしと同じ)。
 * @param {unknown} value
 * @returns {SiteLang | null}
 */
export function normalizeStored(value) {
	if (typeof value !== 'string') return null
	const v = value.toLowerCase()
	return v === 'ja' || v === 'en' || v === 'zh-tw' ? v : null
}

/**
 * hreflang の値 (`ja` / `en` / `zh-Hant-TW` / `zh-tw`) をサイトの言語にする。x-default と他は null。
 * @param {unknown} hreflang
 * @returns {SiteLang | null}
 */
export function hreflangToSiteLang(hreflang) {
	if (typeof hreflang !== 'string') return null
	const v = hreflang.toLowerCase()
	if (v === 'ja') return 'ja'
	if (v === 'en') return 'en'
	if (v === 'zh-hant-tw' || v === 'zh-tw') return 'zh-tw'
	return null
}

/**
 * alternate の href (本番の絶対 URL) をサイト内のパスにする (今の配信元の中で移る。ローカル・プレビューでも本番へ飛ばない)。
 * http(s) と `/` で始まるパスだけを受け、他 (javascript: など) は null。
 * @param {unknown} href
 * @returns {string | null}
 */
export function toSitePath(href) {
	if (typeof href !== 'string' || href.trim() === '') return null
	let url
	try {
		url = new URL(href, 'https://www.deepmosaic.co.jp/')
	} catch {
		return null
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
	return url.pathname + url.search + url.hash
}

/**
 * 帯を出すか、どの言語へ案内するか。
 *   - 英中のページ → null (案内は ja のページだけ)
 *   - 保存値 'ja' → null (帯を閉じた・日本語を選んだ)
 *   - 候補 = 保存値 (en / zh-tw) があればそれ、無ければ resolveSiteLang(languages)。候補が ja → null
 *   - alternates[候補] (その言語のページのパス) が無い → null (docs・法務・404 は alternate を持たない)
 * @param {{ pageLang: SiteLang, languages: unknown, stored: unknown, alternates?: Partial<Record<SiteLang, string>> | null }} input
 * @returns {{ lang: 'en' | 'zh-tw', href: string } | null}
 */
export function decideSuggestion({ pageLang, languages, stored, alternates }) {
	if (pageLang !== 'ja') return null
	const saved = normalizeStored(stored)
	if (saved === 'ja') return null
	const lang = saved ?? resolveSiteLang(languages)
	if (lang === 'ja') return null
	const href = alternates?.[lang]
	if (typeof href !== 'string' || href === '') return null
	return { lang, href }
}
