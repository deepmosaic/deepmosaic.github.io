// T-2200 (i18n1112 I18N-702): 英中のページの見える文の検査 (check-site のモジュール)。
//
//   - `_site/en/**/*.html` を en、`_site/zh-tw/**/*.html` を zh-tw として、site-lint の visibleTexts → lintText にかける
//   - パスが `/mosaic-removal/` を含むページは全体を allowRemoval (除去の語だけを許す)
//   - 違反は `<ファイル>: <場所>: <語> → <用語集の use>` の形 (英中のページがまだ無い間は 0 件で素通り)

import { visibleTexts, lintText } from '../site-lint.mjs'

const LANGS = [
	{ prefix: 'en/', lang: 'en' },
	{ prefix: 'zh-tw/', lang: 'zh-tw' },
]

export default function check(ctx) {
	const errors = []
	for (const { prefix, lang } of LANGS) {
		for (const rel of ctx.listHtml(prefix)) {
			const pageRemoval = `/${rel}`.includes('/mosaic-removal/')
			for (const item of visibleTexts(ctx.read(rel))) {
				const allowRemoval = pageRemoval || item.allowRemoval === true
				for (const v of lintText(lang, item.text, { allowRemoval })) {
					errors.push(`${rel}: ${item.where}: ${v.word} → ${v.use}`)
				}
			}
		}
	}
	return errors
}
