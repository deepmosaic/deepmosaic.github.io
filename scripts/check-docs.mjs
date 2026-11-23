#!/usr/bin/env node
// docs (/docs/ と /docs/web/、生成されていれば英中の /en/docs/・/en/docs/web/・/zh-tw/docs/・/zh-tw/docs/web/) の回帰ガード。
//
//   node scripts/check-docs.mjs             # ビルド出力 (_site/) を検査。問題があれば exit 1
//   node scripts/check-docs.mjs --fix-dims  # ソース (_includes/docs/ の下の .html。言語のフォルダを含む) の <img> の
//                                           # width/height を assets/ の実寸に書き換える
//
// 検査内容 (純ロジックは src/lib/docs-check.js、`npm test` で検証):
//   1. 各言語の Desktop 版のページに契約 ID (LEGACY_DOCS_IDS の 20 個) がすべて存在する
//   2. 目次の ID が本文に存在する (英中は _data/l10n/<lang>/docs_toc.yml があればそれ、無ければ _data/docs_toc.yml)。
//      英中の目次の ID の並びは日本語と同じ
//   3. docs 内のページ内リンク (href="#…") が解決する
//   4. _site/**/*.html と llms.txt からの /docs/#… /docs/web/#… (英中は /en/docs/#… など) の深いリンクが、
//      その言語のページの id で解決する
//   5. docs の <img> が実在し、alt と width/height を持ち、寸法が実ファイル (WebP) と一致する
//   日本語の 2 ページは必須、英中のページは生成されていれば見る。
//
// CI (.github/workflows/jekyll.yml の Verify build output) から `|| fail=1` で呼ばれる。
// 先に `npm run build && bundle exec jekyll build` が必要。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	LEGACY_DOCS_IDS,
	checkDocsPage,
	compareTocIds,
	docsPages,
	extractDocsContent,
	extractDocsDeepLinks,
	extractIds,
	fixImageDims,
	parseTocIds,
	parseWebpSize,
} from '../src/lib/docs-check.js'
import { isMain } from './i18n/is-main.mjs'

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 実ファイルの寸法 (WebP のみ)。無ければ undefined、WebP 以外は null。 */
function imageSizeFrom(baseDir) {
	return (src) => {
		if (!src.startsWith('/')) return null // 外部 URL は検査対象外
		const file = path.join(baseDir, src.replace(/^\//, '').split('?')[0])
		if (!fs.existsSync(file)) return undefined
		if (!file.toLowerCase().endsWith('.webp')) return null
		return parseWebpSize(fs.readFileSync(file))
	}
}

function walkHtml(dir, out = []) {
	if (!fs.existsSync(dir)) return out
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name)
		if (entry.isDirectory()) walkHtml(p, out)
		else if (entry.name.endsWith('.html')) out.push(p)
	}
	return out
}

/**
 * `_includes/docs/` の下 (言語のフォルダを含む) の <img> の width/height を実寸に書き換える。
 * 戻り値: 書き換えたファイル [{ file (root から見たパス), changed (件数) }]
 */
export function fixDocsDims(root = DEFAULT_ROOT) {
	const imageSize = imageSizeFrom(root)
	const out = []
	for (const file of walkHtml(path.join(root, '_includes', 'docs')).sort()) {
		const before = fs.readFileSync(file, 'utf8')
		const { html, changed } = fixImageDims(before, imageSize)
		if (changed > 0) {
			fs.writeFileSync(file, html)
			out.push({ file: path.relative(root, file).split(path.sep).join('/'), changed })
		}
	}
	return out
}

/** 目次の ID ({ desktop, web })。英中は l10n の写しがあればそれを読む。 */
function tocFor(root, lang) {
	const rel = lang === 'ja' ? path.join('_data', 'docs_toc.yml') : path.join('_data', 'l10n', lang, 'docs_toc.yml')
	const file = path.join(root, rel)
	return fs.existsSync(file) ? parseTocIds(fs.readFileSync(file, 'utf8')) : null
}

/**
 * ビルド出力の docs を検査する。
 * 戻り値: { problems (文字列の配列), pages (見たページ), sources (深いリンクを探したファイルの数) }
 */
export function checkDocsSite(root = DEFAULT_ROOT, site = path.join(root, '_site')) {
	const jaToc = tocFor(root, 'ja') ?? {}
	const imageSize = imageSizeFrom(site)
	const problems = []
	const pages = []
	const idsByPage = new Map()
	for (const p of docsPages()) {
		const file = path.join(site, p.file)
		if (!fs.existsSync(file)) {
			if (p.lang === 'ja') problems.push(`${p.page} が生成されていない (${path.relative(root, file)})`)
			continue
		}
		pages.push(p.page)
		const jaIds = jaToc[p.kind] ?? []
		let tocIds = jaIds
		if (p.lang !== 'ja') {
			const own = tocFor(root, p.lang)
			if (own) {
				tocIds = own[p.kind] ?? []
				problems.push(...compareTocIds(p.page, jaIds, tocIds))
			}
		}
		// ヘッダー / フッターの画像やリンクは docs の責任範囲ではないので本文だけを見る
		const html = extractDocsContent(fs.readFileSync(file, 'utf8'))
		idsByPage.set(p.page, extractIds(html))
		const requiredIds = p.kind === 'desktop' ? LEGACY_DOCS_IDS : []
		problems.push(...checkDocsPage({ page: p.page, html, requiredIds, tocIds, imageSize }))
	}

	// サイト全体 (+ llms.txt) からの深いリンク。英中のページへのリンクはその言語のページの id で判定する
	const sources = walkHtml(site)
	const llms = path.join(site, 'llms.txt')
	if (fs.existsSync(llms)) sources.push(llms)
	const jaPages = new Set(docsPages().filter((p) => p.lang === 'ja').map((p) => p.page))
	for (const file of sources) {
		const text = fs.readFileSync(file, 'utf8')
		const from = path.relative(site, file).split(path.sep).join('/')
		for (const link of extractDocsDeepLinks(text)) {
			const ids = idsByPage.get(link.page)
			if (!ids) {
				// 日本語のページが無いことは上で数えた
				if (!jaPages.has(link.page)) problems.push(`${from}: ${link.page}#${link.id} のページが生成されていない`)
			} else if (!ids.has(link.id)) {
				problems.push(`${from}: ${link.page}#${link.id} の飛び先が無い`)
			}
		}
	}
	return { problems, pages, sources: sources.length }
}

function main(argv) {
	const root = DEFAULT_ROOT
	if (argv.includes('--fix-dims')) {
		const changed = fixDocsDims(root)
		for (const c of changed) console.log(`updated ${c.changed} <img> in ${c.file}`)
		const total = changed.reduce((n, c) => n + c.changed, 0)
		console.log(total === 0 ? 'all <img> width/height already match' : `fixed ${total} <img>`)
		return 0
	}
	if (!fs.existsSync(path.join(root, '_site'))) {
		console.error('::error::_site/ が無い — 先に `npm run build && bundle exec jekyll build` を実行すること')
		return 1
	}
	const { problems, pages, sources } = checkDocsSite(root)
	if (problems.length > 0) {
		for (const p of problems) console.error(`::error::${p}`)
		console.error(`docs check: ${problems.length} 件の問題`)
		return 1
	}
	console.log(`docs check: OK (${pages.length} ページ: ${pages.join(' ')}, ${sources} ファイルの深いリンクを検査)`)
	return 0
}

if (isMain(import.meta.url)) {
	process.exitCode = main(process.argv.slice(2))
}
