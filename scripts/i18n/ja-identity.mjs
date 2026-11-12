#!/usr/bin/env node
// T-2199 (i18n1112 I18N-701): ja のページの出力が基点の _site とバイト一致することの検査。
//
//   node scripts/i18n/ja-identity.mjs <基点の _site> <今の _site>
//
//   - 英中のディレクトリ (先頭の `en/`・`zh-tw/`) 以外の全 .html を再帰で列挙して比べる。
//     `enterprise/` のように `en` で始まる別のディレクトリは対象に入る (ディレクトリ名の完全一致で外す)。
//   - 比べる前に許した差分だけを除く (normalizeJaHtml)。残りがバイト単位で一致しなければ失敗。
//   - llms.txt・llms-full.txt・robots.txt (EXACT_FILES) は、基点に在ればそのままバイト単位で比べる。
//   - 終了コード: 0 = 一致 / 1 = 差分あり (ファイルの増減か内容の違い) / 2 = 使い方の誤り・ディレクトリが無い
//   - 依存なし (node の標準モジュールだけ)。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep, resolve } from 'node:path'
import { isMain } from './is-main.mjs'

/** ja-identity の対象から外す、_site 直下のディレクトリ (英中のページの置き場)。 */
export const TRANSLATED_DIRS = ['en', 'zh-tw']

/**
 * .html 以外で、基点とバイト単位で一致しなければならないファイル (W7 で変えてはいけない公開物)。
 * 基点に在るものだけを比べる。sitemap.xml (英中のページが増える) と feed.xml (ビルド時刻が入る) は対象外。
 */
export const EXACT_FILES = ['llms.txt', 'llms-full.txt', 'robots.txt']

/** 中身を持たない要素 (閉じタグを探さない)。 */
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

const SWITCH_OPEN = /<([a-zA-Z][\w-]*)\b[^>]*?\sdata-i18n-switch(?=[\s=>/])[^>]*>/g
const HREFLANG_TAG = /<link\b[^>]*\bhreflang=[^>]*>/g
const OG_ALT_TAG = /<meta\b[^>]*\bproperty=["']og:locale:alternate["'][^>]*>/g

/**
 * [start, end) を消す。消した結果その行が空白だけになったら、行 (改行を含む) ごと消す。
 * 戻り値は [新しい文字列, 次に探し始める位置]。
 */
function cut(text, start, end) {
	const lineStart = text.lastIndexOf('\n', start - 1) + 1
	let lineEnd = text.indexOf('\n', end)
	if (lineEnd === -1) lineEnd = text.length
	const before = text.slice(lineStart, start)
	const after = text.slice(end, lineEnd)
	if (/^[ \t]*$/.test(before) && /^[ \t]*$/.test(after)) {
		const stop = lineEnd < text.length ? lineEnd + 1 : lineEnd
		return [text.slice(0, lineStart) + text.slice(stop), lineStart]
	}
	return [text.slice(0, start) + text.slice(end), start]
}

/** 開始タグの位置から、同じタグ名の入れ子を数えて対応する閉じタグの終わりを返す (見つからなければ開始タグの終わり)。 */
function elementEnd(text, tagName, openEnd) {
	const re = new RegExp(`<(/?)${tagName}(?=[\\s>/])[^>]*>`, 'gi')
	re.lastIndex = openEnd
	let depth = 1
	let m
	while ((m = re.exec(text))) {
		if (m[1] === '/') {
			depth -= 1
			if (depth === 0) return m.index + m[0].length
		} else if (!m[0].endsWith('/>')) {
			depth += 1
		}
	}
	return openEnd
}

/** 1 つのタグだけを消す (void 要素の hreflang / og:locale:alternate 用)。 */
function removeTags(text, pattern) {
	let out = text
	let from = 0
	for (;;) {
		pattern.lastIndex = from
		const m = pattern.exec(out)
		if (!m) return out
		;[out, from] = cut(out, m.index, m.index + m[0].length)
	}
}

/** data-i18n-switch 属性を持つ要素を丸ごと消す。 */
function removeSwitchElements(text) {
	let out = text
	let from = 0
	for (;;) {
		SWITCH_OPEN.lastIndex = from
		const m = SWITCH_OPEN.exec(out)
		if (!m) return out
		const tag = m[1].toLowerCase()
		const openEnd = m.index + m[0].length
		const end = VOID_TAGS.has(tag) || m[0].endsWith('/>') ? openEnd : elementEnd(out, tag, openEnd)
		;[out, from] = cut(out, m.index, end)
	}
}

/**
 * ja のページの HTML から、多言語化で許した差分だけを除く。
 *   1. CRLF → LF
 *   2. `.css?v=<数字>` / `.js?v=<数字>` (ビルド時刻) → `?v=0`
 *   3. `<link … hreflang=…>` のタグ (タグだけの行は行ごと)
 *   4. `<meta property="og:locale:alternate" …>` のタグ (同上)
 *   5. `data-i18n-switch` 属性を持つ要素 (入れ子の同じタグを数えて閉じタグまで。void 要素と自己閉じはタグだけ。要素だけの行は行ごと)
 * それ以外の違い (空白 1 つ・属性の順・空行) は残す。
 */
export function normalizeJaHtml(text) {
	let out = text.replace(/\r\n/g, '\n')
	out = out.replace(/(\.(?:css|js))\?v=\d+/g, '$1?v=0')
	out = removeTags(out, HREFLANG_TAG)
	out = removeTags(out, OG_ALT_TAG)
	out = removeSwitchElements(out)
	return out
}

/** siteDir 以下の ja の .html を相対パス (区切りは `/`) で列挙する。 */
export function listJaHtml(siteDir) {
	const out = []
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const abs = join(dir, name)
			const rel = relative(siteDir, abs).split(sep).join('/')
			if (statSync(abs).isDirectory()) {
				if (!TRANSLATED_DIRS.includes(rel)) walk(abs)
			} else if (name.endsWith('.html')) {
				out.push(rel)
			}
		}
	}
	walk(siteDir)
	return out.sort()
}

/** latin1 で読む (バイト列を失わずに文字列として正規化するため)。 */
const readBytes = (p) => readFileSync(p).toString('latin1')
const toUtf8 = (s) => Buffer.from(s, 'latin1').toString('utf8')

/** 最初に違う行の前後 3 行を返す。 */
function firstDiff(a, b) {
	const la = a.split('\n')
	const lb = b.split('\n')
	let i = 0
	while (i < la.length && i < lb.length && la[i] === lb[i]) i += 1
	const from = Math.max(0, i - 3)
	const show = (lines, mark) =>
		lines
			.slice(from, i + 4)
			.map((l, k) => `${mark}${String(from + k + 1).padStart(5)}| ${toUtf8(l)}`)
			.join('\n')
	return `  (${i + 1} 行目から違う)\n  --- 基点\n${show(la, '  -')}\n  +++ 今\n${show(lb, '  +')}`
}

/** 2 つの _site の ja のページを比べる。 */
export function compareSites(baseDir, curDir) {
	const base = listJaHtml(baseDir)
	const cur = listJaHtml(curDir)
	const curSet = new Set(cur)
	const baseSet = new Set(base)
	const problems = []
	for (const f of base) if (!curSet.has(f)) problems.push(`消えた: ${f}`)
	for (const f of cur) if (!baseSet.has(f)) problems.push(`増えた: ${f}`)
	for (const f of base) {
		if (!curSet.has(f)) continue
		const a = normalizeJaHtml(readBytes(join(baseDir, f)))
		const b = normalizeJaHtml(readBytes(join(curDir, f)))
		if (a !== b) problems.push(`内容が違う: ${f}\n${firstDiff(a, b)}`)
	}
	for (const f of EXACT_FILES) {
		const basePath = join(baseDir, f)
		if (!existsSync(basePath)) continue
		const curPath = join(curDir, f)
		if (!existsSync(curPath)) problems.push(`消えた: ${f}`)
		else if (!readFileSync(basePath).equals(readFileSync(curPath))) problems.push(`内容が違う: ${f} (バイト単位で一致しない)`)
	}
	return { files: base.length, problems }
}

function main(argv) {
	const [baseArg, curArg] = argv
	if (!baseArg || !curArg) {
		console.error('使い方: node scripts/i18n/ja-identity.mjs <基点の _site> <今の _site>')
		return 2
	}
	const baseDir = resolve(baseArg)
	const curDir = resolve(curArg)
	for (const d of [baseDir, curDir]) {
		if (!existsSync(d) || !statSync(d).isDirectory()) {
			console.error(`ja-identity: ディレクトリが無い: ${d}`)
			return 2
		}
	}
	const { files, problems } = compareSites(baseDir, curDir)
	if (problems.length === 0) {
		console.log(`ja-identity: OK (${files} files)`)
		return 0
	}
	for (const p of problems) console.log(`ja-identity: ${p}`)
	console.log(`ja-identity: NG (${problems.length} 件の差分 / 基点 ${files} files)`)
	return 1
}

if (isMain(import.meta.url)) {
	process.exitCode = main(process.argv.slice(2))
}
