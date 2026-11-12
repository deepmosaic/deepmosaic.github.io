// T-2207 (i18n1112 I18N-709): 英語のトップページ (`_site/en/index.html`) の出力の検査 (check-site のモジュール)。
//
//   - 存在する。`<html lang="en"`。
//   - 製品の方向の語 (`adds mosaic` か `apply mosaic`) があり、否定の注記 (`data-i18n-allow="mosaic_removal"` の要素で、
//     中身が否定の語 `no feature` か `cannot` を含むもの) が hero と末尾の CTA の 2 本以上ある (中身が空の要素は数えない)。
//   - JSON-LD の `disambiguatingDescription` がある (CI の ja の検査と同じ役割)。
//   - `<details` の数と FAQPage の `"@type": "Question"` の数が一致し、ja の `_site/index.html` と同じ件数。
//   - `%%…%%` のプレースホルダが残っていない。
//   - `data-dl="` が 1 つ以上で、値の集合が ja の `_site/index.html` と同じ。DL の href に直接クエリが焼き込まれていない。
//   - hreflang の `<link rel="alternate">` が 4 本 (I18N-705 の checks/head.mjs と重なってよい)。
//   - 見える文の言語の検査は checks/lang-text.mjs (I18N-702) が受け持つ。
//   - 対象はレイアウトを通ったページ (`<link rel="canonical"` を持つ) だけ。checks/head.mjs と同じ線引きで、
//     他のチケットのテストが作る `_site` の模型 (レイアウトの無い HTML) では何もしない。
//     en/index.html が無いことは、ja の index.html がレイアウトを通っている (= 実際のビルド) ときだけエラーにする。

const EN = 'en/index.html'
const JA = 'index.html'

const isBuilt = (html) => /<link rel="canonical"/.test(html)
const count = (re, s) => (s.match(re) ?? []).length
/** 否定の注記: data-i18n-allow="mosaic_removal" の要素で、中身 (次のタグまで) に否定の語を含むもの */
const NOTE_RE = /\sdata-i18n-allow="mosaic_removal"[^>]*>[^<]*\b(no feature|cannot)\b/g
const MIN_NOTES = 2 // hero と cta-download.html
const dataDlSet = (html) => [...new Set([...html.matchAll(/\sdata-dl="([^"]*)"/g)].map((m) => m[1]))].sort()

export default function check(ctx) {
	const ja = ctx.exists(JA) ? ctx.read(JA) : null
	if (!ctx.exists(EN)) return ja !== null && isBuilt(ja) ? [`${EN}: 生成されていない`] : []
	const html = ctx.read(EN)
	if (!isBuilt(html)) return []
	const errors = []

	if (!/<html lang="en"/.test(html)) errors.push(`${EN}: <html lang="en"> でない`)
	if (!/adds mosaic|apply mosaic/i.test(html)) errors.push(`${EN}: 製品の方向の語 (adds mosaic / apply mosaic) が無い`)
	const notes = count(NOTE_RE, html)
	if (notes < MIN_NOTES) {
		errors.push(`${EN}: 否定の注記 (data-i18n-allow="mosaic_removal" の要素で中身に no feature / cannot を含むもの) が ${MIN_NOTES} 本未満 (${notes} 本)`)
	}
	if (!html.includes('disambiguatingDescription')) errors.push(`${EN}: JSON-LD の disambiguatingDescription が無い`)

	const details = count(/<details/g, html)
	const questions = count(/"@type": "Question"/g, html)
	if (details !== questions) errors.push(`${EN}: FAQ の表示件数 (${details}) と FAQPage の Question の数 (${questions}) が違う`)
	if (ja !== null) {
		const jaDetails = count(/<details/g, ja)
		if (details !== jaDetails) errors.push(`${EN}: FAQ の表示件数 (${details}) が ja (${jaDetails}) と違う`)
	}

	const ph = html.match(/%%[A-Z_]+%%/)
	if (ph) errors.push(`${EN}: 置換されていないプレースホルダが残っている: ${ph[0]}`)

	const dl = dataDlSet(html)
	if (dl.length === 0) errors.push(`${EN}: data-dl が無い (DL の計測が止まる)`)
	if (ja !== null) {
		const jaDl = dataDlSet(ja)
		if (dl.join(',') !== jaDl.join(',')) errors.push(`${EN}: data-dl の値の集合が ja と違う: [${dl.join(', ')}] / [${jaDl.join(', ')}]`)
	}
	if (/download\/latest\/windows\?|apps\.microsoft\.com\/detail\/9PDKMKWHN9RW\?/.test(html)) {
		errors.push(`${EN}: DL リンクの href に直接クエリが焼き込まれている`)
	}

	const hreflang = count(/<link rel="alternate" hreflang=/g, html)
	if (hreflang !== 4) errors.push(`${EN}: hreflang が 4 本でない (${hreflang} 本)`)

	return errors
}
