#!/usr/bin/env node
// 英中のページ・l10n のデータの source_hash を、今の ja のソースの値に書き直す。
//
//   node scripts/i18n/accept-site.mjs <英中のファイル…> [--section <節の id>[,<節の id>…]]…
//
//   - .html: front matter の `source:` (リポの root 基準) を読み、`source_hash:` を書き換える (無ければ `source:` の次の行に足す)
//   - .yml : `_source:` を読み、`_source_hash:` を書き換える (無ければ `_source:` の次の行に足す)
//   - 訳の include (`_includes/docs/<lang>/*.html`): 先頭の Liquid コメントの節ごとの hash を、元のファイルの今の値に書き直す。
//     コメントが無ければ、言語のフォルダを外した日本語の include を元のファイルとして先頭に足す。
//     `--section` を付けると、その節の hash だけを書き直し、ほかの節は前の値を残す。
//     訳の一番外の節の id の並びが日本語と違うときは書き換えない (訳を先に合わせる)
//   - 元のファイルの改行コード (CRLF / LF) を保つ。値は引用符で囲む (YAML が数値と読まないように)
//   - ja を直したら英中も直してからこれを実行する (訳を直さずに hash だけ書き直さない)
//   - 終了コード: 0 = 全部書いた / 1 = source が無い・実在しないファイル・書き換えられないファイルがある / 2 = 引数の誤り
//   - リポの root は既定でこのスクリプトの 2 階層上。テストでは env `I18N_SITE_ROOT` で差し替える。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	sourceHash,
	readFrontMatter,
	readYmlScalar,
	kindOf,
	readIncludeHeader,
	formatIncludeHeader,
	includeSourceFor,
	sectionHashesOf,
	sectionIdsOf,
} from './source-hash.mjs'
import { isMain } from './is-main.mjs'

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 行の配列の中で key の行を value に置き換える。無ければ afterKey の行の次に足す。 */
function upsert(lines, start, end, key, value, afterKey) {
	const line = `${key}: "${value}"`
	const re = new RegExp(`^${key}:`)
	for (let i = start; i < end; i += 1) {
		if (re.test(lines[i])) {
			lines[i] = line
			return
		}
	}
	const after = new RegExp(`^${afterKey}:`)
	for (let i = start; i < end; i += 1) {
		if (after.test(lines[i])) {
			lines.splice(i + 1, 0, line)
			return
		}
	}
	throw new Error(`${afterKey}: の行が無い`)
}

/** 1 ファイルの hash を書き直す。書いた hash を返す。失敗は Error を投げる。 */
export function acceptFile(file, root = DEFAULT_ROOT) {
	const text = readFileSync(file, 'utf8')
	const eol = text.includes('\r\n') ? '\r\n' : '\n'
	const lines = text.split(/\r?\n/)
	const isYml = kindOf(file) === 'yml'
	const source = isYml ? readYmlScalar(text, '_source') : readFrontMatter(text).source
	if (!source) throw new Error(isYml ? '_source: が無い' : 'front matter に source: が無い')
	const src = join(root, source)
	if (!existsSync(src)) throw new Error(`source のファイルが無い: ${source}`)
	const hash = sourceHash(src)
	if (isYml) {
		upsert(lines, 0, lines.length, '_source_hash', hash, '_source')
	} else {
		const close = lines.indexOf('---', 1)
		if (lines[0] !== '---' || close === -1) throw new Error('front matter が無い')
		upsert(lines, 1, close, 'source_hash', hash, 'source')
	}
	writeFileSync(file, lines.join(eol))
	return hash
}

/** root から見たパス (区切りは `/`)。 */
const relFrom = (root, file) => relative(root, file).split(sep).join('/')

/** 訳の include として扱うファイルか (先頭のコメントがある、または訳の include の置き場にある)。 */
export function isTranslatedInclude(file, root = DEFAULT_ROOT) {
	if (kindOf(file) !== 'html') return false
	if (includeSourceFor(relFrom(root, file))) return true
	return readIncludeHeader(readFileSync(file, 'utf8')) !== null
}

/**
 * 訳の include 1 本の節ごとの hash を書き直す。sections (節の id の配列) を渡すとその節だけ。
 * 書いた節の名前の配列を返す。失敗は Error を投げる (ファイルは書き換えない)。
 */
export function acceptInclude(file, root = DEFAULT_ROOT, { sections = null } = {}) {
	const text = readFileSync(file, 'utf8')
	const eol = text.includes('\r\n') ? '\r\n' : '\n'
	const header = readIncludeHeader(text)
	const source = header?.source ?? includeSourceFor(relFrom(root, file))
	if (!source) throw new Error('先頭のコメントに source: が無く、訳の include の置き場でもない')
	const src = join(root, source)
	if (!existsSync(src)) throw new Error(`source のファイルが無い: ${source}`)
	const ja = readFileSync(src, 'utf8')
	const body = header ? text.slice(header.length) : text
	const jaIds = sectionIdsOf(ja)
	const ownIds = sectionIdsOf(body)
	if (JSON.stringify(jaIds) !== JSON.stringify(ownIds)) {
		throw new Error(`節の id の並びが ${source} と違う (ja ${JSON.stringify(jaIds)} / 訳 ${JSON.stringify(ownIds)})。訳を合わせてから受け入れる`)
	}
	const fresh = sectionHashesOf(ja)
	let next = fresh
	if (sections) {
		const names = new Set(fresh.map((h) => h.name))
		const unknown = sections.filter((n) => !names.has(n))
		if (unknown.length) throw new Error(`節 ${unknown.join(', ')} は ${source} に無い`)
		const old = new Map((header?.hashes ?? []).map((h) => [h.name, h.hash]))
		next = fresh
			.map((h) => (sections.includes(h.name) ? h : old.has(h.name) ? { name: h.name, hash: old.get(h.name) } : null))
			.filter(Boolean)
	}
	writeFileSync(file, formatIncludeHeader(source, next, eol) + body)
	return sections ?? fresh.map((h) => h.name)
}

/** 引数を読む。戻り値: { files, sections (null = 全部) } か { error }。 */
export function parseArgs(argv) {
	const files = []
	let sections = null
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === '--section') {
			const v = argv[i + 1]
			if (!v || v.startsWith('--')) return { error: '--section の後に節の id が無い' }
			sections = [...(sections ?? []), ...v.split(',').map((s) => s.trim()).filter(Boolean)]
			i += 1
		} else if (argv[i].startsWith('--')) {
			return { error: `知らない引数: ${argv[i]}` }
		} else {
			files.push(argv[i])
		}
	}
	if (files.length === 0) return { error: 'ファイルが無い' }
	return { files, sections }
}

function main(argv) {
	const args = parseArgs(argv)
	if (args.error) {
		console.error(`accept-site: ${args.error}`)
		console.error('使い方: node scripts/i18n/accept-site.mjs <英中のファイル…> [--section <節の id>[,<節の id>…]]')
		return 2
	}
	const root = process.env.I18N_SITE_ROOT ? resolve(process.env.I18N_SITE_ROOT) : DEFAULT_ROOT
	let failed = 0
	for (const f of args.files) {
		try {
			const abs = resolve(f)
			if (isTranslatedInclude(abs, root)) {
				const names = acceptInclude(abs, root, { sections: args.sections })
				console.log(`accept-site: ${f} ← 節 ${names.length} 個 (${names.join(', ')})`)
			} else {
				if (args.sections) throw new Error('--section は訳の include にだけ使える')
				const hash = acceptFile(abs, root)
				console.log(`accept-site: ${f} ← ${hash}`)
			}
		} catch (e) {
			failed += 1
			console.error(`accept-site: ${f}: ${e.message}`)
		}
	}
	return failed ? 1 : 0
}

if (isMain(import.meta.url)) {
	process.exitCode = main(process.argv.slice(2))
}
