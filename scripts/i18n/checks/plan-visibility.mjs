// ビルド出力 (_site) の全 HTML の data-plans (試算の部品に渡すプランの JSON) の検査 (check-site のモジュール)。
//
//   - 載せてよいのは公開のプラン (`public: true`) だけ。
//   - お見積りのプラン (`quote_label` を持つ) は金額の欄 (PRICE_KEYS) を持たない。
//   - 純ロジック (showsPrice・findPlanData・planDataErrors) は src/lib/plan-visibility.test.js が検査する。

/** 金額の欄。お見積りのプランと public が false のプランは持たない。 */
export const PRICE_KEYS = ['price', 'price_display', 'price_incl_display', 'price_unit']

/**
 * 画面に金額を出すプランか (公開で、お見積りでない)。
 * @param {Record<string, unknown>} tier
 */
export function showsPrice(tier) {
	const quote = typeof tier.quote_label === 'string' && tier.quote_label.trim() !== ''
	return tier.public === true && !quote
}

const ENTITIES = { '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' }
const decode = (s) => s.replace(/&(?:quot|#39|#x27|lt|gt|amp);/g, (m) => ENTITIES[m])

/**
 * HTML の中の data-plans の値 (JSON) を読んだものの一覧。読めない JSON は例外にする。
 * @param {string} html
 * @returns {unknown[]}
 */
export function findPlanData(html) {
	const out = []
	for (const m of html.matchAll(/\sdata-plans=(?:'([^']*)'|"([^"]*)")/g)) {
		const raw = decode(m[1] ?? m[2])
		try {
			out.push(JSON.parse(raw))
		} catch {
			throw new Error(`data-plans が JSON として読めない: ${raw.slice(0, 60)}`)
		}
	}
	return out
}

/**
 * HTML の data-plans の決まりの違反の一覧。
 * @param {string} html
 * @returns {string[]}
 */
export function planDataErrors(html) {
	let lists
	try {
		lists = findPlanData(html)
	} catch (e) {
		return [e.message]
	}
	const errors = []
	for (const list of lists) {
		if (!Array.isArray(list)) {
			errors.push('data-plans がプランの配列でない')
			continue
		}
		for (const tier of list) {
			const code = tier?.code ?? '(code なし)'
			if (tier?.public !== true) {
				errors.push(`data-plans に公開でないプラン ${code} がある`)
				continue
			}
			if (showsPrice(tier)) continue
			const keys = PRICE_KEYS.filter((k) => k in tier)
			if (keys.length > 0) errors.push(`data-plans のお見積りのプラン ${code} に金額の欄がある: ${keys.join(', ')}`)
		}
	}
	return errors
}

export default function check(ctx) {
	const errors = []
	for (const rel of ctx.listHtml('')) {
		for (const e of planDataErrors(ctx.read(rel))) errors.push(`${rel}: ${e}`)
	}
	return errors
}
