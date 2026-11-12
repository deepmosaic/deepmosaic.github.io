// T-2199 (i18n1112 I18N-701): ページの言語の値の検査 (check-site のモジュール)。
//
//   - `en/`・`zh-tw/` 以外の全 .html: 先頭の `<html` タグが lang="ja"、og:locale があれば ja_JP
//   - `en/**`: lang="en"・en_US / `zh-tw/**`: lang="zh-Hant-TW"・zh_TW
//   - og:locale:alternate は見ない (台帳のページだけに出る別の言語の値)

const RULES = [
	{ prefix: 'en/', lang: 'en', og: 'en_US' },
	{ prefix: 'zh-tw/', lang: 'zh-Hant-TW', og: 'zh_TW' },
]
const JA = { lang: 'ja', og: 'ja_JP' }

export default function check(ctx) {
	const errors = []
	for (const rel of ctx.listHtml('')) {
		const want = RULES.find((r) => rel.startsWith(r.prefix)) ?? JA
		const html = ctx.read(rel)
		const tag = html.match(/<html\b[^>]*>/i)?.[0]
		if (!tag) {
			errors.push(`${rel}: <html> タグが無い`)
			continue
		}
		const lang = tag.match(/\slang=["']([^"']*)["']/)?.[1]
		if (lang !== want.lang) errors.push(`${rel}: <html lang> が "${want.lang}" でない (${lang ?? '無し'})`)
		const og = html.match(/<meta\b[^>]*\sproperty=["']og:locale["'][^>]*>/)?.[0]
		if (og) {
			const content = og.match(/\scontent=["']([^"']*)["']/)?.[1]
			if (content !== want.og) errors.push(`${rel}: og:locale が "${want.og}" でない (${content ?? '無し'})`)
		}
	}
	return errors
}
