// ビルド出力 (_site) の全 HTML に HTML コメント (`<!-- … -->`) が無いことの検査 (check-site のモジュール)。
//
//   - 許すのは条件付きコメント (`<!--[if …]>` と `<![endif]-->`) だけ。
//   - ページのソースの説明は出力に出ない Liquid のコメントに書く。
//   - 純ロジック (findHtmlComments) は src/lib/public-repo.test.js が検査する。

/** 許す HTML コメント (条件付きコメント)。 */
const ALLOWED = [/^<!--\[if\b/i, /^<!\[endif\]-->/i]

/** 1 行に詰めた短い抜き書き。 */
const excerpt = (s) => s.replace(/\s+/g, ' ').slice(0, 60)

/**
 * HTML の中の、許していない HTML コメントの一覧。
 * @param {string} html
 * @returns {{ index: number, text: string }[]}
 */
export function findHtmlComments(html) {
	const out = []
	const re = /<!--[\s\S]*?(?:-->|$)/g
	let m
	while ((m = re.exec(html))) {
		if (ALLOWED.some((a) => a.test(m[0]))) continue
		out.push({ index: m.index, text: m[0] })
	}
	return out
}

export default function check(ctx) {
	const errors = []
	for (const rel of ctx.listHtml('')) {
		for (const c of findHtmlComments(ctx.read(rel))) {
			errors.push(`${rel}: HTML コメントが出力に残っている: ${excerpt(c.text)}`)
		}
	}
	return errors
}
