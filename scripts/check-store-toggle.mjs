#!/usr/bin/env node
// T-2304 (backlog1113): Microsoft Store のボタンの切り替え (`_data/site.yml` の `distribution.store_enabled`) を true にしたときの出力の検査。
//
//   node scripts/check-store-toggle.mjs [--keep]
//
//   - 普段のビルドは false (既定) なので、true の出力は誰も見ない。Store のページが公開されて 1 行を true にした日に
//     初めて壊れていたと分かるのを避けるため、切り替えだけを true にしたデータでサイト全体をビルドして確かめる。
//   - Jekyll の `site.data` は `--config` で上書きできない (データは `data_dir` から読む) ので、`_data` を丸ごと
//     リポの中の `.store-toggle-data/` (先頭が `.` なので出力に入らない) へ写し、写しの site.yml の値だけを true にする。
//     ビルドは `--config _config.yml,<一時の設定>` で `data_dir` をその写しに向け、出力は OS の一時フォルダに出す。
//     本物の `_data` と `_site` は触らない。終わったら写しと一時フォルダを消す (`--keep` で出力を残す)。
//   - 検査は `scripts/i18n/checks/store.mjs` の `checkStore(ctx, true)` (4 か所 × 言語に 1 つずつ、href・文・計測の目印、
//     置き場所以外に出ていないこと、T-1921: 法務文書の配信ストア版の記述が出ていること)。ほかの check-site のモジュール (英中の data-dl の一致など) も同じ出力に当てる。
//   - 前提: `npm run build` 済み (assets/dist) と Ruby / Bundler (`bundle exec jekyll`)。
//   - 終了コード: 0 = 合格 / 1 = 検査の不合格 / 2 = 準備やビルドの失敗。

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { makeContext, runChecks } from './i18n/check-site.mjs'
import { checkStore } from './i18n/checks/store.mjs'
import { isMain } from './i18n/is-main.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_COPY = '.store-toggle-data'

/** site.yml の文字列の `store_enabled: false` を true にする (1 か所だけ。無ければ例外) */
export function enableStore(yaml) {
	const re = /^([ \t]+store_enabled:[ \t]*)false\b/m
	if (!re.test(yaml)) throw new Error('_data/site.yml に `store_enabled: false` が無い')
	return yaml.replace(re, '$1true')
}

async function main(argv) {
	const keep = argv.includes('--keep')
	const copy = join(ROOT, DATA_COPY)
	const tmp = mkdtempSync(join(tmpdir(), 'store-toggle-'))
	const dest = join(tmp, '_site')
	let code = 0
	try {
		if (existsSync(copy)) rmSync(copy, { recursive: true, force: true })
		cpSync(join(ROOT, '_data'), copy, { recursive: true })
		const sitePath = join(copy, 'site.yml')
		writeFileSync(sitePath, enableStore(readFileSync(sitePath, 'utf8')))
		if (!/^[ \t]+store_enabled:[ \t]*true\b/m.test(readFileSync(sitePath, 'utf8'))) throw new Error('写しの site.yml を true にできなかった')
		const override = join(tmp, 'store-on.yml')
		writeFileSync(override, `data_dir: ${DATA_COPY}\n`)
		const res = spawnSync('bundle', ['exec', 'jekyll', 'build', '--strict_front_matter', '--disable-disk-cache', '--config', `_config.yml,${override.split('\\').join('/')}`, '--destination', dest], {
			cwd: ROOT,
			stdio: ['ignore', 'pipe', 'pipe'],
			encoding: 'utf8',
			shell: process.platform === 'win32',
		})
		if (res.status !== 0) {
			process.stderr.write(res.stdout ?? '')
			process.stderr.write(res.stderr ?? '')
			console.error(`check-store-toggle: jekyll build が失敗した (status ${res.status})`)
			return 2
		}
		// ほかの check-site のモジュール (英中の data-dl の一致など) も true の出力に当てる。store は本物の site.yml (false) を
		// 読むので、ここでは外して true として検査する
		const { errors: others } = await runChecks({ siteDir: dest, root: ROOT, checksDir: join(ROOT, 'scripts', 'i18n', 'checks') })
		const errors = [...others.filter((e) => !e.startsWith('[store] ')), ...checkStore(makeContext(dest, ROOT), true).map((e) => `[store] ${e}`)]
		for (const e of errors) console.error(`[store-toggle] ${e}`)
		console.log(errors.length === 0 ? 'check-store-toggle: OK (store_enabled: true の出力に 4 か所 × 言語の Store のボタン)' : `check-store-toggle: ${errors.length} 件`)
		code = errors.length === 0 ? 0 : 1
		if (keep) console.log(`出力: ${dest}`)
	} catch (e) {
		console.error(`check-store-toggle: ${e?.message ?? e}`)
		code = 2
	} finally {
		rmSync(copy, { recursive: true, force: true })
		if (!keep) rmSync(tmp, { recursive: true, force: true })
	}
	return code
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((code) => process.exit(code))
