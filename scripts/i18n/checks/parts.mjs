// T-2205 (i18n1112 I18N-707): 共通 include (料金カード・DL の CTA) の英中の出力の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 対象は `en/` と `zh-tw/` の .html のうち、同じパスの ja のページ (接頭辞を除いたパス) があるもの。英中のページがまだ無ければ何もしない。
//   - 料金カード (pricing-cards.html の出力): ja のページにカードがあれば、英中にも同じ数・同じ順・同じプラン名 (h3) のカードがあり、
//       価格 (text-[36px] の span) と税の注記 (text-[13px] の span) の数値 (桁区切りを除いた数の並び) が ja と同じ。
//       Free の横帯 (card mt-5 の h3) も同じ数値。zh-tw は価格・税込・横帯に `¥` が無く `日圓` がある。
//   - data-dl の値の多重集合が ja の同じページと同じ (GA4 の計測の目印を英中でも揃える)。
//   - cta-download.html の not_removal_note の <p> は英中で data-i18n-allow="mosaic_removal" を持つ (ja のページに無い要素は求めない)。

const PREFIXES = { en: 'en/', 'zh-tw': 'zh-tw/' }

/** カードの価格・税の注記 (pricing-cards.html の出力の形) */
const CARD_RE =
	/<h3 class="[^"]*">([^<]*)<\/h3>\s*<div class="flex flex-wrap items-baseline[^"]*">\s*<span class="text-\[36px\][^"]*">([^<]*)<\/span>\s*<span class="text-\[13px\][^"]*">([^<]*)<\/span>/g
/** Free の横帯の見出し */
const STRIP_RE = /<div class="card mt-5 flex[^"]*">\s*(?:<div[^>]*>\s*)?<h3[^>]*>([^<]*)<\/h3>/g
/** not_removal_note の <p> の開始タグ */
const NOTE_P_RE = /<p class="mx-auto mt-1\.5 max-w-\[560px\] text-\[12\.5px\] leading-\[1\.8\] text-ink-4"[^>]*>/g

const numbers = (s) => (s.replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) ?? []).join(' ')

function cardsOf(html) {
	const cards = [...html.matchAll(CARD_RE)].map((m) => ({ name: m[1].trim(), price: m[2], unit: m[3] }))
	const strips = [...html.matchAll(STRIP_RE)].map((m) => m[1])
	return { cards, strips }
}

const dataDlOf = (html) => [...html.matchAll(/\sdata-dl="([^"]*)"/g)].map((m) => m[1]).sort()

function checkPage(lang, rel, html, jaHtml) {
	const errors = []
	const ja = cardsOf(jaHtml)
	const it = cardsOf(html)

	if (ja.cards.length > 0 || ja.strips.length > 0) {
		if (it.cards.length !== ja.cards.length || it.strips.length !== ja.strips.length) {
			errors.push(
				`${rel}: 料金カードの数が ja と違う (カード ${it.cards.length} / ${ja.cards.length}、横帯 ${it.strips.length} / ${ja.strips.length})`,
			)
		}
		ja.cards.forEach((jc, i) => {
			const c = it.cards[i]
			if (!c) return
			if (c.name !== jc.name) errors.push(`${rel}: 料金カード ${i + 1} のプラン名が ja と違う: ${c.name} / ${jc.name}`)
			if (numbers(c.price) !== numbers(jc.price)) errors.push(`${rel}: ${jc.name} の価格の数値が ja と違う: ${c.price} / ${jc.price}`)
			if (numbers(c.unit) !== numbers(jc.unit)) errors.push(`${rel}: ${jc.name} の税の注記の数値 (価格) が ja と違う: ${c.unit} / ${jc.unit}`)
			if (lang === 'zh-tw') {
				for (const [what, text, jaText] of [
					['価格', c.price, jc.price],
					['税の注記', c.unit, jc.unit],
				]) {
					if (text.includes('¥')) errors.push(`${rel}: ${jc.name} の${what}に ¥ がある (zh-tw は 日圓): ${text}`)
					if (jaText.includes('¥') && !text.includes('日圓')) errors.push(`${rel}: ${jc.name} の${what}に 日圓 が無い: ${text}`)
				}
			}
		})
		ja.strips.forEach((js, i) => {
			const s = it.strips[i]
			if (s === undefined) return
			if (numbers(s) !== numbers(js)) errors.push(`${rel}: 横帯 ${i + 1} の価格の数値が ja と違う: ${s} / ${js}`)
			if (lang === 'zh-tw') {
				if (s.includes('¥')) errors.push(`${rel}: 横帯 ${i + 1} に ¥ がある (zh-tw は 日圓): ${s}`)
				if (js.includes('¥') && !s.includes('日圓')) errors.push(`${rel}: 横帯 ${i + 1} に 日圓 が無い: ${s}`)
			}
		})
	}

	const dl = dataDlOf(html)
	const jaDl = dataDlOf(jaHtml)
	if (dl.join(',') !== jaDl.join(',')) {
		errors.push(`${rel}: data-dl の値が ja と違う: [${dl.join(', ')}] / [${jaDl.join(', ')}]`)
	}

	const notes = [...html.matchAll(NOTE_P_RE)].map((m) => m[0])
	const jaNotes = [...jaHtml.matchAll(NOTE_P_RE)].length
	if (notes.length !== jaNotes) {
		errors.push(`${rel}: not_removal_note の <p> の数が ja と違う: ${notes.length} / ${jaNotes}`)
	}
	for (const tag of notes) {
		if (!/\sdata-i18n-allow="mosaic_removal"/.test(tag)) {
			errors.push(`${rel}: not_removal_note の <p> に data-i18n-allow="mosaic_removal" が無い`)
		}
	}
	return errors
}

/** @param {{ listHtml(prefix?: string): string[], exists(rel: string): boolean, read(rel: string): string }} ctx */
export default function check(ctx) {
	const errors = []
	for (const [lang, prefix] of Object.entries(PREFIXES)) {
		for (const rel of ctx.listHtml(prefix)) {
			const jaRel = rel.slice(prefix.length)
			if (!ctx.exists(jaRel)) continue
			errors.push(...checkPage(lang, rel, ctx.read(rel), ctx.read(jaRel)))
		}
	}
	return errors
}
