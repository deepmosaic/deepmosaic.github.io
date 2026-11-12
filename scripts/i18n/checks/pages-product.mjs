// T-2209 (i18n1112 I18N-711): 料金・申し込み・動作環境・モザイク除去についての英中のページ (8 本) の出力の検査 (check-site のモジュール)。
//
//   - 8 ページが存在し、`<html lang>` が言語と一致する (en / zh-Hant-TW)。
//   - 料金 (`/en/price/`・`/zh-tw/price/`): `data-dl` があり値の集合が ja の `_site/price/index.html` と同じ、導入相談 (`/<lang>/enterprise/inquiry/`) への
//     リンクがある (ja の CI の「導入相談の導線」と同じ役割)、維持管理費用の注記 (l10n plans の enterprise の `price_note`) がある。zh-tw に `¥` が無く `日圓` がある。
//   - 動作環境 (`/en/spec/`・`/zh-tw/spec/`): `data-dl` がある、kv-table の行 (`class="kv-row`) の数が ja の `/spec/` と同じ。
//   - 申し込み (`/en/subscribe/`・`/zh-tw/subscribe/`): 申し込みのボタン (`?checkout=` を含む href) の集合が ja と同じ (Web 版の URL に言語を足さない)、
//     `<details` の数と FAQPage の Question の数が一致し ja と同じ件数。
//   - モザイク除去について (`/en/mosaic-removal/`・`/zh-tw/mosaic-removal/`): can-cannot の 2 つの見出し (l10n parts の `cc_can_title` / `cc_cannot_title`) と
//     項目 (l10n entity の `can` / `cannot` の全部) がある、製品の方向の語 (`adds mosaic` / `加上馬賽克`) がある。
//   - `%%…%%` のプレースホルダが残っていない。
//   - 見える文の言語の検査は checks/lang-text.mjs (I18N-702) が受け持つ。
//   - 対象はレイアウトを通ったページ (`<link rel="canonical"` を持つ) だけ (checks/head.mjs・pages-top-en.mjs と同じ線引き)。
//     英中のページが無いことは、対応する ja のページがレイアウトを通っている (= 実際のビルド) ときだけエラーにする。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LANGS = [
	{ dir: 'en', htmlLang: 'en' },
	{ dir: 'zh-tw', htmlLang: 'zh-Hant-TW' },
]
const PAGES = ['price', 'spec', 'subscribe', 'mosaic-removal']

const isBuilt = (html) => /<link rel="canonical"/.test(html)
const count = (re, s) => (s.match(re) ?? []).length
const dataDlSet = (html) => [...new Set([...html.matchAll(/\sdata-dl="([^"]*)"/g)].map((m) => m[1]))].sort()
const checkoutSet = (html) => [...new Set([...html.matchAll(/\shref="([^"]*\?checkout=[^"]*)"/g)].map((m) => m[1]))].sort()

/** 出力の文と比べるために実体参照を戻す (Jekyll は {{ }} の出力を escape しないが、念のため) */
const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&amp;/g, '&')

/** l10n の yml から `key: "…"` の値を読む (先頭が一致した最初の 1 つ) */
function yamlScalar(text, key) {
	const m = text.match(new RegExp(`^\\s*${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
	return m ? m[1].replace(/\\"/g, '"') : null
}

/** l10n の yml からトップレベルの `key:` の下の `  - "…"` の配列を読む */
function yamlList(text, key) {
	const lines = text.replace(/\r\n/g, '\n').split('\n')
	const i = lines.findIndex((l) => l === `${key}:`)
	if (i === -1) return null
	const out = []
	for (const l of lines.slice(i + 1)) {
		const m = l.match(/^\s+-\s+"((?:[^"\\]|\\.)*)"\s*$/)
		if (!m) break
		out.push(m[1].replace(/\\"/g, '"'))
	}
	return out
}

function readRoot(ctx, rel) {
	try {
		return readFileSync(join(ctx.root, rel), 'utf8')
	} catch {
		return null
	}
}

function checkPrice(ctx, rel, html, ja, dir) {
	const errors = []
	const dl = dataDlSet(html)
	if (dl.length === 0) errors.push(`${rel}: data-dl が無い (DL の計測が止まる)`)
	if (ja !== null) {
		const jaDl = dataDlSet(ja)
		if (dl.join(',') !== jaDl.join(',')) errors.push(`${rel}: data-dl の値の集合が ja と違う: [${dl.join(', ')}] / [${jaDl.join(', ')}]`)
	}
	if (!html.includes(`href="/${dir}/enterprise/inquiry/"`)) errors.push(`${rel}: 導入相談 (/${dir}/enterprise/inquiry/) へのリンクが無い`)
	const plans = readRoot(ctx, `_data/l10n/${dir}/plans.yml`)
	const note = plans === null ? null : yamlScalar(plans, 'price_note')
	if (!note) errors.push(`${rel}: _data/l10n/${dir}/plans.yml の price_note を読めない`)
	else if (!decode(html).includes(note)) errors.push(`${rel}: 維持管理費用の注記 (price_note「${note}」) が無い`)
	if (dir === 'zh-tw') {
		if (/[¥￥]|&yen;|&#165;|&#xa5;/i.test(html)) errors.push(`${rel}: ¥ がある (zh-tw は「日圓」)`)
		if (!html.includes('日圓')) errors.push(`${rel}: 日圓 が無い`)
	}
	return errors
}

function checkSpec(rel, html, ja) {
	const errors = []
	if (dataDlSet(html).length === 0) errors.push(`${rel}: data-dl が無い (DL の計測が止まる)`)
	if (ja !== null) {
		const rows = count(/class="kv-row/g, html)
		const jaRows = count(/class="kv-row/g, ja)
		if (rows !== jaRows) errors.push(`${rel}: kv-row の行の数 (${rows}) が ja (${jaRows}) と違う`)
	}
	return errors
}

function checkSubscribe(rel, html, ja) {
	const errors = []
	const buttons = checkoutSet(html)
	if (buttons.length === 0) errors.push(`${rel}: 申し込みのボタン (?checkout=) が無い`)
	if (ja !== null) {
		const jaButtons = checkoutSet(ja)
		if (buttons.join(',') !== jaButtons.join(',')) errors.push(`${rel}: 申し込みのボタン (?checkout=) の行き先が ja と違う: [${buttons.join(', ')}] / [${jaButtons.join(', ')}]`)
	}
	const details = count(/<details/g, html)
	const questions = count(/"@type": "Question"/g, html)
	if (details !== questions) errors.push(`${rel}: FAQ の表示件数 (${details}) と FAQPage の Question の数 (${questions}) が違う`)
	if (ja !== null) {
		const jaDetails = count(/<details/g, ja)
		if (details !== jaDetails) errors.push(`${rel}: FAQ の表示件数 (${details}) が ja (${jaDetails}) と違う`)
	}
	return errors
}

function checkRemoval(ctx, rel, html, dir) {
	const errors = []
	const text = decode(html)
	const word = dir === 'en' ? 'adds mosaic' : '加上馬賽克'
	if (!text.includes(word)) errors.push(`${rel}: 製品の方向の語 (${word}) が無い`)
	const parts = readRoot(ctx, `_data/l10n/${dir}/parts.yml`)
	for (const key of ['cc_can_title', 'cc_cannot_title']) {
		const v = parts === null ? null : yamlScalar(parts, key)
		if (!v) errors.push(`${rel}: _data/l10n/${dir}/parts.yml の ${key} を読めない`)
		else if (!text.includes(`>${v}<`)) errors.push(`${rel}: can-cannot の見出し ${key} (「${v}」) が無い`)
	}
	const entity = readRoot(ctx, `_data/l10n/${dir}/entity.yml`)
	for (const key of ['can', 'cannot']) {
		const items = entity === null ? null : yamlList(entity, key)
		if (!items || items.length === 0) {
			errors.push(`${rel}: _data/l10n/${dir}/entity.yml の ${key} を読めない`)
			continue
		}
		const missing = items.filter((v) => !text.includes(`<span>${v}</span>`))
		if (missing.length > 0) errors.push(`${rel}: can-cannot の ${key} の項目が ${missing.length} 件無い (${items.length} 件のうち): ${missing[0]}`)
	}
	return errors
}

export default function check(ctx) {
	const errors = []
	for (const name of PAGES) {
		const jaRel = `${name}/index.html`
		const ja = ctx.exists(jaRel) ? ctx.read(jaRel) : null
		const jaBuilt = ja !== null && isBuilt(ja)
		for (const { dir, htmlLang } of LANGS) {
			const rel = `${dir}/${name}/index.html`
			if (!ctx.exists(rel)) {
				if (jaBuilt) errors.push(`${rel}: 生成されていない`)
				continue
			}
			const html = ctx.read(rel)
			if (!isBuilt(html)) continue
			if (!new RegExp(`<html lang="${htmlLang}"`).test(html)) errors.push(`${rel}: <html lang="${htmlLang}"> でない`)
			const ph = html.match(/%%[A-Z_]+%%/)
			if (ph) errors.push(`${rel}: 置換されていないプレースホルダが残っている: ${ph[0]}`)
			const jaForCompare = jaBuilt ? ja : null
			if (name === 'price') errors.push(...checkPrice(ctx, rel, html, jaForCompare, dir))
			else if (name === 'spec') errors.push(...checkSpec(rel, html, jaForCompare))
			else if (name === 'subscribe') errors.push(...checkSubscribe(rel, html, jaForCompare))
			else errors.push(...checkRemoval(ctx, rel, html, dir))
		}
	}
	return errors
}
