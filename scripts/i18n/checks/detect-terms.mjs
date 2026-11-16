// 検索向けの語 (男性の顔・女性の顔) の出力の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - トップ (`index.html`・`en/index.html`・`zh-tw/index.html`) の次の 4 つが、その言語の語を含むこと。
//       <title> (ja `顔` / en `faces` / zh-tw `臉部`)
//       <meta name="description">・JSON-LD の SoftwareApplication の featureList (配列を連結した文字列)・`#detect-targets` の <h2>
//         (ja `男性の顔`・`女性の顔` / en `male faces`・`female faces` / zh-tw `男性臉部`・`女性臉部`)
//   - description に古い言い方 (ja `人間の顔` / en `human faces` / zh-tw `人的臉部`) が無いこと。
//   - `#detect-targets` の <h2> に除去の語が無いこと (語彙ポリシー: 見出しに「除去」を置かない)。
//   - ページが無い・レイアウトを通っていない (`<link rel="canonical"` が無い) ページは見ない (checks/detectable.mjs と同じ線引き)。

import { decodeEntities } from '../site-lint.mjs'

const PAGES = {
	'index.html': { title: '顔', faces: ['男性の顔', '女性の顔'], human: '人間の顔', removal: /除去|解除/ },
	'en/index.html': { title: 'faces', faces: ['male faces', 'female faces'], human: 'human faces', removal: /remov/i },
	'zh-tw/index.html': { title: '臉部', faces: ['男性臉部', '女性臉部'], human: '人的臉部', removal: /去除|移除|去馬賽克/ },
}

/**
 * 語を含むか。英字で始まる語は前が英字でないときだけ一致とみなす (`female faces` の中の `male faces` を数えない)。大文字小文字は問わない。
 */
export function hasTerm(text, word) {
	if (!/^[A-Za-z]/.test(word)) return text.includes(word)
	const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp(`(^|[^A-Za-z])${escaped}`, 'i').test(text)
}

const isBuilt = (html) => /<link rel="canonical"/.test(html)

const firstMatch = (html, re) => {
	const m = html.match(re)
	return m ? decodeEntities(m[1]) : null
}

/** JSON-LD の SoftwareApplication の featureList を連結した文字列。見つからなければ null。 */
function featureListOf(html) {
	for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
		let data
		try {
			data = JSON.parse(m[1])
		} catch {
			continue
		}
		if (data?.['@type'] === 'SoftwareApplication') return [data.featureList ?? []].flat().join(' ')
	}
	return null
}

/** `#detect-targets` の節の中の最初の <h2> の文字列。節や h2 が無ければ null。 */
function detectHeadingOf(html) {
	const at = html.indexOf('id="detect-targets"')
	if (at < 0) return null
	const end = html.indexOf('</section>', at)
	const section = html.slice(at, end < 0 ? undefined : end)
	const h2 = section.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)
	return h2 ? decodeEntities(h2[1].replace(/<[^>]*>/g, '')).trim() : null
}

function checkPage(rel, html, spec) {
	const errors = []
	const surfaces = {
		title: firstMatch(html, /<title>([^<]*)<\/title>/),
		description: firstMatch(html, /<meta name="description" content="([^"]*)"/),
		featureList: featureListOf(html),
		h2: detectHeadingOf(html),
	}
	for (const [name, text] of Object.entries(surfaces)) {
		if (text === null) {
			errors.push(`${rel}: ${name === 'h2' ? '#detect-targets の <h2>' : name} が無い`)
			continue
		}
		const words = name === 'title' ? [spec.title] : spec.faces
		for (const w of words) if (!hasTerm(text, w)) errors.push(`${rel}: ${name} に「${w}」が無い: ${text}`)
	}
	if (surfaces.description && hasTerm(surfaces.description, spec.human)) errors.push(`${rel}: description に古い言い方「${spec.human}」がある`)
	if (surfaces.h2 && spec.removal.test(surfaces.h2)) errors.push(`${rel}: #detect-targets の <h2> に除去の語がある: ${surfaces.h2}`)
	return errors
}

export default function check(ctx) {
	return Object.entries(PAGES).flatMap(([rel, spec]) => {
		if (!ctx.exists(rel)) return []
		const html = ctx.read(rel)
		return isBuilt(html) ? checkPage(rel, html, spec) : []
	})
}
