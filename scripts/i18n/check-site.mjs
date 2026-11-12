#!/usr/bin/env node
// T-2199 (i18n1112 I18N-701): ビルド出力 (_site) の多言語化の検査の束ね役。
//
//   node scripts/i18n/check-site.mjs [siteDir=_site] [--checks <dir>] [--root <dir>]
//
//   - `scripts/i18n/checks/*.mjs` を名前の順に import し、各モジュールの `export default function check(ctx)`
//     (同期・非同期のどちらでもよい) が返すエラーの文字列の配列を集める。
//   - ctx = { siteDir, root, read(rel), exists(rel), listHtml(prefix = ''), frontMatter(srcRel) }
//       read / exists / listHtml は siteDir 基準 (区切りは `/`)、frontMatter はリポの root 基準。
//   - 表示: エラーは 1 行ずつ `[<モジュール名>] <文>`、最後に件数。例外を投げたモジュールも 1 件のエラーとして数える。
//   - 終了コード: 0 = エラー 0 件 / 1 = 1 件以上 / 2 = siteDir や checks のディレクトリが無い
//   - 後のチケットは `scripts/i18n/checks/<自分の名前>.mjs` を足すだけ (この本体と他のモジュールは触らない)。
//   - `--checks` / `--root` はテスト用 (既定は このスクリプトの隣の checks/ と 2 階層上のリポの root)。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFrontMatter } from './source-hash.mjs'
import { isMain } from './is-main.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 検査に渡す ctx を作る。 */
export function makeContext(siteDir, root) {
	const listHtml = (prefix = '') => {
		const start = join(siteDir, prefix)
		if (!existsSync(start)) return []
		const out = []
		const walk = (d) => {
			for (const name of readdirSync(d)) {
				const abs = join(d, name)
				if (statSync(abs).isDirectory()) walk(abs)
				else if (name.endsWith('.html')) out.push(relative(siteDir, abs).split(sep).join('/'))
			}
		}
		if (statSync(start).isDirectory()) walk(start)
		return out.sort()
	}
	return {
		siteDir,
		root,
		read: (rel) => readFileSync(join(siteDir, rel), 'utf8'),
		exists: (rel) => existsSync(join(siteDir, rel)),
		listHtml,
		frontMatter: (srcRel) => readFrontMatter(readFileSync(join(root, srcRel), 'utf8')),
	}
}

/** checksDir の全モジュールを名前の順に実行し、`[名前] 文` の配列を返す。 */
export async function runChecks({ siteDir, root, checksDir }) {
	const ctx = makeContext(siteDir, root)
	const mods = readdirSync(checksDir).filter((n) => n.endsWith('.mjs')).sort()
	const errors = []
	for (const file of mods) {
		const name = basename(file, '.mjs')
		try {
			const mod = await import(pathToFileURL(join(checksDir, file)).href)
			if (typeof mod.default !== 'function') {
				errors.push(`[${name}] default export が関数でない`)
				continue
			}
			const res = (await mod.default(ctx)) ?? []
			for (const e of res) errors.push(`[${name}] ${e}`)
		} catch (e) {
			errors.push(`[${name}] 検査が例外で止まった: ${e?.message ?? e}`)
		}
	}
	return { modules: mods.length, errors }
}

function parseArgs(argv) {
	const opts = { siteDir: '_site', checksDir: join(HERE, 'checks'), root: join(HERE, '..', '..') }
	const rest = []
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === '--checks') opts.checksDir = argv[++i]
		else if (argv[i] === '--root') opts.root = argv[++i]
		else rest.push(argv[i])
	}
	if (rest[0]) opts.siteDir = rest[0]
	return { siteDir: resolve(opts.siteDir), checksDir: resolve(opts.checksDir), root: resolve(opts.root) }
}

async function main(argv) {
	const opts = parseArgs(argv)
	for (const [label, d] of [['siteDir', opts.siteDir], ['checks', opts.checksDir]]) {
		if (!existsSync(d) || !statSync(d).isDirectory()) {
			console.error(`check-site: ${label} のディレクトリが無い: ${d}`)
			return 2
		}
	}
	const { modules, errors } = await runChecks(opts)
	if (errors.length === 0) {
		console.log(`check-site: OK (${modules} モジュール)`)
		return 0
	}
	for (const e of errors) console.log(e)
	console.log(`check-site: ${errors.length} 件のエラー (${modules} モジュール)`)
	return 1
}

if (isMain(import.meta.url)) {
	process.exitCode = await main(process.argv.slice(2))
}
