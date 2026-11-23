#!/usr/bin/env node
// 訳の include (`_includes/docs/<lang>/*.html`) のうち、日本語の節が変わって訳の直しが要る節を出す。
//
//   node scripts/i18n/docs-diff.mjs [en|zh-tw] [<訳の include>…] [--brief]
//
//   - 引数なし: 全部の言語の訳の include。言語を渡すとその言語だけ、ファイルを渡すとそのファイルだけ
//   - 直しが要る節ごとに、理由 (日本語が変わった / hash が無い / 日本語に無い) と、日本語の節の今のソース (コメントを除いたもの) を出す
//   - `--brief`: 節の名前だけを出し、日本語の文は出さない
//   - git があれば、訳の include を最後に変えたコミットからの日本語の include の差分を見るコマンドを添える
//   - 直したら node scripts/i18n/accept-site.mjs <訳の include> --section <節の id> で hash を書き直す
//   - 終了コード: 0 = 直す節が無い / 1 = 直す節がある / 2 = 引数の誤り (知らない言語・無いファイル)
//   - リポの root は既定でこのスクリプトの 2 階層上。テストでは env `I18N_SITE_ROOT` で差し替える。

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRANSLATED_LANGS, translatedIncludes, diffIncludeSections } from './source-hash.mjs'
import { isMain } from './is-main.mjs'

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 引数を読む。戻り値: { langs, files, brief } か { error }。 */
export function parseArgs(argv, root) {
	const langs = []
	const files = []
	let brief = false
	for (const a of argv) {
		if (a === '--brief') brief = true
		else if (a.startsWith('--')) return { error: `知らない引数: ${a}` }
		else if (TRANSLATED_LANGS.includes(a)) langs.push(a)
		else if (/[\\/]|\.html$/.test(a)) {
			const abs = resolve(a)
			if (!existsSync(abs)) return { error: `ファイルが無い: ${a}` }
			files.push(relative(root, abs).split(sep).join('/'))
		} else return { error: `知らない言語: ${a} (${TRANSLATED_LANGS.join(' / ')})` }
	}
	return { langs, files, brief }
}

/** 訳の include を最後に変えたコミット (短い形)。git が使えない・コミットが無ければ null。 */
function lastCommit(root, rel) {
	const r = spawnSync('git', ['log', '-1', '--format=%h', '--', rel], { cwd: root, encoding: 'utf8' })
	return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null
}

/** 1 本分の報告の行。直す節が無ければ空の配列。 */
export function reportFor(root, rel, { brief = false } = {}) {
	const d = diffIncludeSections(root, rel)
	if (!d.header) return [`== ${rel}`, `  先頭に元のファイルと節ごとの hash の Liquid コメントが無い (node scripts/i18n/accept-site.mjs ${rel})`]
	if (!d.sourceExists) return [`== ${rel}`, `  source のファイルが無い (${d.source})`]
	const order = JSON.stringify(d.ownIds) !== JSON.stringify(d.jaIds)
	if (!order && d.stale.length + d.missing.length + d.extra.length === 0) return []
	const lines = [`== ${rel} (元: ${d.source})`]
	const commit = lastCommit(root, rel)
	if (commit) lines.push(`  git の差分: git diff ${commit} -- ${d.source}`)
	if (order) lines.push(`  節の id の並びが違う: ja ${JSON.stringify(d.jaIds)} / 訳 ${JSON.stringify(d.ownIds)}`)
	const textOf = (name) => d.jaSections.find((p) => p.name === name)?.text ?? ''
	const show = (name, why) => {
		lines.push(`  節 ${name}: ${why}`)
		if (!brief) {
			lines.push('  ---- 日本語の今のソース ----')
			for (const l of textOf(name).split('\n')) lines.push(`  | ${l}`)
			lines.push('  ----')
		}
	}
	for (const name of d.stale) show(name, '日本語が変わった')
	for (const name of d.missing) show(name, 'hash が無い (日本語に節が増えた)')
	for (const name of d.extra) lines.push(`  節 ${name}: 日本語に無い (消えたか改名された)`)
	return lines
}

function main(argv) {
	const root = process.env.I18N_SITE_ROOT ? resolve(process.env.I18N_SITE_ROOT) : DEFAULT_ROOT
	const args = parseArgs(argv, root)
	if (args.error) {
		console.error(`docs-diff: ${args.error}`)
		console.error('使い方: node scripts/i18n/docs-diff.mjs [en|zh-tw] [<訳の include>…] [--brief]')
		return 2
	}
	let targets = translatedIncludes(root)
	if (args.langs.length) targets = targets.filter((t) => args.langs.includes(t.lang))
	if (args.files.length) targets = targets.filter((t) => args.files.includes(t.rel))
	const unknown = args.files.filter((f) => !targets.some((t) => t.rel === f))
	if (unknown.length) {
		console.error(`docs-diff: 訳の include ではない: ${unknown.join(', ')}`)
		return 2
	}
	let stale = 0
	for (const { rel } of targets) {
		const lines = reportFor(root, rel, { brief: args.brief })
		if (lines.length === 0) continue
		stale += 1
		console.log(lines.join('\n'))
	}
	console.log(`docs-diff: 直しが要るファイル ${stale} 本 / 揃っているファイル ${targets.length - stale} 本`)
	return stale ? 1 : 0
}

if (isMain(import.meta.url)) {
	process.exitCode = main(process.argv.slice(2))
}
