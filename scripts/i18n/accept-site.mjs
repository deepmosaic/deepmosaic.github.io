#!/usr/bin/env node
// T-2199 (i18n1112 I18N-701): 英中のページ・l10n のデータの source_hash を、今の ja のソースの値に書き直す。
//
//   node scripts/i18n/accept-site.mjs <英中のファイル…>
//
//   - .html: front matter の `source:` (リポの root 基準) を読み、`source_hash:` を書き換える (無ければ `source:` の次の行に足す)
//   - .yml : `_source:` を読み、`_source_hash:` を書き換える (無ければ `_source:` の次の行に足す)
//   - 元のファイルの改行コード (CRLF / LF) を保つ。値は引用符で囲む (YAML が数値と読まないように)
//   - ja を直したら英中も直してからこれを実行する (訳を直さずに hash だけ書き直さない)
//   - 終了コード: 0 = 全部書いた / 1 = source が無い・実在しないファイルがある / 2 = 引数が無い
//   - リポの root は既定でこのスクリプトの 2 階層上。テストでは env `I18N_SITE_ROOT` で差し替える。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceHash, readFrontMatter, readYmlScalar, kindOf } from './source-hash.mjs'
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

function main(argv) {
	if (argv.length === 0) {
		console.error('使い方: node scripts/i18n/accept-site.mjs <英中のファイル…>')
		return 2
	}
	const root = process.env.I18N_SITE_ROOT ? resolve(process.env.I18N_SITE_ROOT) : DEFAULT_ROOT
	let failed = 0
	for (const f of argv) {
		try {
			const hash = acceptFile(resolve(f), root)
			console.log(`accept-site: ${f} ← ${hash}`)
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
