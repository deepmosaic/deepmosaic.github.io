// 検出対象の図 (`_includes/detectable-objects.html` の埋め込み SVG) の出力の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - トップ (`index.html`・`en/index.html`・`zh-tw/index.html`): `#hero-detectable` の figure の中に `<svg … role="img">` がちょうど 1 つあり、
//     aria-labelledby の id の <title> がある。<text> が 6 本。<text> と <title> の中身がその言語の期待値と同じ
//     (ja はこのモジュールの表、英中は `_data/l10n/<lang>/parts.yml` の do_ キー)。英中の <text> と <title> に仮名が無い。
//     ページに `detectable-objects.webp` の文字列が無い。
//   - docs (`docs/index.html`・`en/docs/index.html`・`zh-tw/docs/index.html`): <details> の中に同じ svg (id は docs-detectable-title) があり、文がその言語の期待値と同じ。
//   - ページが無い・レイアウトを通っていない (`<link rel="canonical"` が無い) ページは見ない (checks/pages-top-en.mjs と同じ線引き)。

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { decodeEntities } from '../site-lint.mjs'

/** ja の図の文字 (左 2 行 + 右 4 行)。図の文字は「男女の顔」。 */
export const JA_TEXTS = ['検出支援', 'できる物体', '男性器', '女性器', '男女の顔', 'モザイク']
/** ja の読み上げ名。検索の語として「男性の顔・女性の顔」と分けて書く。 */
export const JA_TITLE = '検出支援できる物体: 男性器・女性器・男性の顔・女性の顔・モザイク'

const TOP_PAGES = { 'index.html': 'ja', 'en/index.html': 'en', 'zh-tw/index.html': 'zh-tw' }
const DOCS_PAGES = { 'docs/index.html': 'ja', 'en/docs/index.html': 'en', 'zh-tw/docs/index.html': 'zh-tw' }
const PARTS_ORDER = ['do_head_1', 'do_head_2', 'do_item_male', 'do_item_female', 'do_item_faces', 'do_item_mosaic']
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const isBuilt = (html) => /<link rel="canonical"/.test(html)

/** parts.yml (平らな `key: "value"`) から do_ キーだけを読む。ファイルが無ければ null。 */
function readParts(root, lang) {
	const file = join(root, '_data', 'l10n', lang, 'parts.yml')
	if (!existsSync(file)) return null
	const out = {}
	for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
		const m = raw.match(/^(do_[a-z0-9_]+):\s*"((?:[^"\\]|\\.)*)"/)
		if (m) out[m[1]] = JSON.parse(`"${m[2]}"`)
	}
	return out
}

function expectedFor(root, lang) {
	if (lang === 'ja') return { title: JA_TITLE, texts: JA_TEXTS }
	const p = readParts(root, lang)
	if (!p) return null
	return { title: p.do_title, texts: PARTS_ORDER.map((k) => p[k]) }
}

const clean = (s) => decodeEntities(s.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()

/** 断片の中の svg を見て、エラーの文字列の配列を返す。 */
function checkSvg(where, fragment, { lang, idPrefix, expected }) {
	const errors = []
	const svgs = fragment.match(/<svg\b[^>]*>/g) ?? []
	const imgSvgs = svgs.filter((t) => /\srole="img"/.test(t))
	if (imgSvgs.length !== 1) {
		errors.push(`${where}: 検出対象の図の <svg role="img"> が ${imgSvgs.length} 個 (1 個のはず)`)
		return errors
	}
	const label = imgSvgs[0].match(/\saria-labelledby="([^"]*)"/)?.[1]
	if (idPrefix && label !== `${idPrefix}-title`) errors.push(`${where}: aria-labelledby が ${idPrefix}-title でない: ${label}`)
	const start = fragment.indexOf(imgSvgs[0])
	const end = fragment.indexOf('</svg>', start)
	const svg = fragment.slice(start, end < 0 ? undefined : end)
	const title = svg.match(new RegExp(`<title id="${label}">([\\s\\S]*?)</title>`))?.[1]
	if (title === undefined) errors.push(`${where}: aria-labelledby (${label}) の <title> が無い`)
	const texts = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => clean(m[1]))
	if (texts.length !== 6) errors.push(`${where}: <text> が ${texts.length} 本 (6 本のはず)`)
	if (expected) {
		if (title !== undefined && clean(title) !== expected.title) errors.push(`${where}: <title> が期待値と違う: ${clean(title)}`)
		if (texts.length === 6 && texts.join('|') !== expected.texts.join('|')) errors.push(`${where}: <text> が期待値と違う: ${texts.join(' / ')}`)
	}
	if (lang !== 'ja') {
		for (const t of [...texts, clean(title ?? '')]) if (KANA.test(t)) errors.push(`${where}: 図の文字に仮名が残っている: ${t}`)
	}
	return errors
}

function checkTop(ctx, rel, lang) {
	const html = ctx.read(rel)
	if (!isBuilt(html)) return []
	const errors = []
	if (html.includes('detectable-objects.webp')) errors.push(`${rel}: 古い detectable-objects.webp の参照が残っている`)
	const figure = html.match(/<figure id="hero-detectable"[\s\S]*?<\/figure>/)?.[0]
	if (!figure) return [...errors, `${rel}: #hero-detectable の figure が無い`]
	const expected = expectedFor(ctx.root, lang)
	return [...errors, ...checkSvg(`${rel} #hero-detectable`, figure, { lang, idPrefix: null, expected })]
}

function checkDocs(ctx, rel, lang) {
	const html = ctx.read(rel)
	if (!isBuilt(html)) return []
	const errors = []
	if (html.includes('detectable-objects.webp')) errors.push(`${rel}: 古い detectable-objects.webp の参照が残っている`)
	const details = [...html.matchAll(/<details\b[\s\S]*?<\/details>/g)].map((m) => m[0]).filter((d) => d.includes('docs-detectable-title'))
	if (details.length !== 1) return [...errors, `${rel}: <details> の中に検出対象の図 (docs-detectable-title) が無い`]
	return [...errors, ...checkSvg(`${rel} <details>`, details[0], { lang, idPrefix: 'docs-detectable', expected: expectedFor(ctx.root, lang) })]
}

/** @param {{ root: string, exists(rel: string): boolean, read(rel: string): string }} ctx */
export default function check(ctx) {
	const errors = []
	for (const [rel, lang] of Object.entries(TOP_PAGES)) {
		if (ctx.exists(rel)) errors.push(...checkTop(ctx, rel, lang))
	}
	for (const [rel, lang] of Object.entries(DOCS_PAGES)) {
		if (ctx.exists(rel)) errors.push(...checkDocs(ctx, rel, lang))
	}
	return errors
}
