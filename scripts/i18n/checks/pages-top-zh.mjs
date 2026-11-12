// T-2208 (i18n1112 I18N-710): 繁体字中国語 (台湾) のトップページ (`_site/zh-tw/index.html`) の出力の検査 (check-site のモジュール)。
// 項目は checks/pages-top-en.mjs (I18N-709) と同じで、語と lang を zh-tw に読み替え、価格の書き方を足した。
//
//   - 存在する。`<html lang="zh-Hant-TW"`。
//   - 製品の方向の語 (`加上馬賽克` か `套用馬賽克`) があり、否定の注記 (`data-i18n-allow="mosaic_removal"` の要素で、
//     中身が否定の語 `不具備` か `無法` を含むもの) が hero と末尾の CTA の 2 本以上ある (中身が空の要素は数えない)。
//   - JSON-LD の `disambiguatingDescription` がある (CI の ja の検査と同じ役割)。
//   - `<details` の数と FAQPage の `"@type": "Question"` の数が一致し、ja の `_site/index.html` と同じ件数。
//   - `%%…%%` のプレースホルダが残っていない。
//   - `data-dl="` が 1 つ以上で、値の集合が ja の `_site/index.html` と同じ。DL の href に直接クエリが焼き込まれていない。
//   - hreflang の `<link rel="alternate">` が 4 本 (I18N-705 の checks/head.mjs と重なってよい)。
//   - 価格: `¥` (と `&yen;`) が無く、`日圓` がある (設計書 §15-11、zh-tw は「2,980 日圓」の形)。
//   - 見える文の言語の検査は checks/lang-text.mjs (I18N-702) が受け持つ。
//   - 対象はレイアウトを通ったページ (`<link rel="canonical"` を持つ) だけ。checks/head.mjs・pages-top-en.mjs と同じ線引きで、
//     他のチケットのテストが作る `_site` の模型 (レイアウトの無い HTML) では何もしない。
//     zh-tw/index.html が無いことは、ja の index.html がレイアウトを通っている (= 実際のビルド) ときだけエラーにする。

const ZH = 'zh-tw/index.html'
const JA = 'index.html'

const isBuilt = (html) => /<link rel="canonical"/.test(html)
const count = (re, s) => (s.match(re) ?? []).length
/** 否定の注記: data-i18n-allow="mosaic_removal" の要素で、中身 (次のタグまで) に否定の語を含むもの */
const NOTE_RE = /\sdata-i18n-allow="mosaic_removal"[^>]*>[^<]*(不具備|無法)/g
const MIN_NOTES = 2 // hero と cta-download.html
const dataDlSet = (html) => [...new Set([...html.matchAll(/\sdata-dl="([^"]*)"/g)].map((m) => m[1]))].sort()

export default function check(ctx) {
	const ja = ctx.exists(JA) ? ctx.read(JA) : null
	if (!ctx.exists(ZH)) return ja !== null && isBuilt(ja) ? [`${ZH}: 生成されていない`] : []
	const html = ctx.read(ZH)
	if (!isBuilt(html)) return []
	const errors = []

	if (!/<html lang="zh-Hant-TW"/.test(html)) errors.push(`${ZH}: <html lang="zh-Hant-TW"> でない`)
	if (!/加上馬賽克|套用馬賽克/.test(html)) errors.push(`${ZH}: 製品の方向の語 (加上馬賽克 / 套用馬賽克) が無い`)
	const notes = count(NOTE_RE, html)
	if (notes < MIN_NOTES) {
		errors.push(`${ZH}: 否定の注記 (data-i18n-allow="mosaic_removal" の要素で中身に 不具備 / 無法 を含むもの) が ${MIN_NOTES} 本未満 (${notes} 本)`)
	}
	if (!html.includes('disambiguatingDescription')) errors.push(`${ZH}: JSON-LD の disambiguatingDescription が無い`)

	const details = count(/<details/g, html)
	const questions = count(/"@type": "Question"/g, html)
	if (details !== questions) errors.push(`${ZH}: FAQ の表示件数 (${details}) と FAQPage の Question の数 (${questions}) が違う`)
	if (ja !== null) {
		const jaDetails = count(/<details/g, ja)
		if (details !== jaDetails) errors.push(`${ZH}: FAQ の表示件数 (${details}) が ja (${jaDetails}) と違う`)
	}

	const ph = html.match(/%%[A-Z_]+%%/)
	if (ph) errors.push(`${ZH}: 置換されていないプレースホルダが残っている: ${ph[0]}`)

	const dl = dataDlSet(html)
	if (dl.length === 0) errors.push(`${ZH}: data-dl が無い (DL の計測が止まる)`)
	if (ja !== null) {
		const jaDl = dataDlSet(ja)
		if (dl.join(',') !== jaDl.join(',')) errors.push(`${ZH}: data-dl の値の集合が ja と違う: [${dl.join(', ')}] / [${jaDl.join(', ')}]`)
	}
	if (/download\/latest\/windows\?|apps\.microsoft\.com\/detail\/9PDKMKWHN9RW\?/.test(html)) {
		errors.push(`${ZH}: DL リンクの href に直接クエリが焼き込まれている`)
	}

	const hreflang = count(/<link rel="alternate" hreflang=/g, html)
	if (hreflang !== 4) errors.push(`${ZH}: hreflang が 4 本でない (${hreflang} 本)`)

	if (/¥|&yen;|&#165;|&#xa5;/i.test(html)) errors.push(`${ZH}: 価格に ¥ がある (zh-tw は「2,980 日圓」の形)`)
	if (!html.includes('日圓')) errors.push(`${ZH}: 価格の 日圓 が無い`)

	return errors
}
