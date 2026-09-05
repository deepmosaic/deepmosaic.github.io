#!/usr/bin/env node
// docs (/docs/ と /docs/web/) の回帰ガード (TICKET-SITE-48)。
//
//   node scripts/check-docs.mjs             # ビルド出力 (_site/) を検査。問題があれば exit 1
//   node scripts/check-docs.mjs --fix-dims  # ソース (_includes/docs/*.html) の <img> の
//                                           # width/height を assets/ の実寸に書き換える
//
// 検査内容 (純ロジックは src/lib/docs-check.js、`npm test` で検証):
//   1. /docs/ に契約 ID (LEGACY_DOCS_IDS の 20 個) がすべて存在する
//   2. _data/docs_toc.yml の ID が本文に存在する
//   3. docs 内のページ内リンク (href="#…") が解決する
//   4. _site/**/*.html と llms.txt からの /docs/#… /docs/web/#… の深いリンクが解決する
//   5. docs の <img> が実在し、alt と width/height を持ち、寸法が実ファイル (WebP) と一致する
//
// CI (.github/workflows/jekyll.yml の Verify build output) から `|| fail=1` で呼ばれる。
// 先に `npm run build && bundle exec jekyll build` が必要。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	LEGACY_DOCS_IDS,
	checkDocsPage,
	extractDocsContent,
	extractDocsDeepLinks,
	extractIds,
	fixImageDims,
	parseTocIds,
	parseWebpSize,
} from '../src/lib/docs-check.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = path.join(ROOT, '_site')
const FIX_DIMS = process.argv.includes('--fix-dims')

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
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name)
		if (entry.isDirectory()) walkHtml(p, out)
		else if (entry.name.endsWith('.html')) out.push(p)
	}
	return out
}

function runFixDims() {
	const imageSize = imageSizeFrom(ROOT)
	const dir = path.join(ROOT, '_includes', 'docs')
	let total = 0
	for (const name of fs.readdirSync(dir)) {
		if (!name.endsWith('.html')) continue
		const file = path.join(dir, name)
		const before = fs.readFileSync(file, 'utf8')
		const { html, changed } = fixImageDims(before, imageSize)
		if (changed > 0) {
			fs.writeFileSync(file, html)
			console.log(`updated ${changed} <img> in _includes/docs/${name}`)
			total += changed
		}
	}
	console.log(total === 0 ? 'all <img> width/height already match' : `fixed ${total} <img>`)
}

function runCheck() {
	if (!fs.existsSync(SITE)) {
		console.error('::error::_site/ が無い — 先に `npm run build && bundle exec jekyll build` を実行すること')
		process.exit(1)
	}
	const toc = parseTocIds(fs.readFileSync(path.join(ROOT, '_data', 'docs_toc.yml'), 'utf8'))
	const imageSize = imageSizeFrom(SITE)
	const pages = [
		{ page: '/docs/', file: path.join(SITE, 'docs', 'index.html'), requiredIds: LEGACY_DOCS_IDS, tocIds: toc.desktop ?? [] },
		{ page: '/docs/web/', file: path.join(SITE, 'docs', 'web', 'index.html'), requiredIds: [], tocIds: toc.web ?? [] },
	]
	const problems = []
	const idsByPage = new Map()
	for (const p of pages) {
		if (!fs.existsSync(p.file)) {
			problems.push(`${p.page} が生成されていない (${path.relative(ROOT, p.file)})`)
			continue
		}
		// ヘッダー / フッターの画像やリンクは docs の責任範囲ではないので本文だけを見る
		const html = extractDocsContent(fs.readFileSync(p.file, 'utf8'))
		idsByPage.set(p.page, extractIds(html))
		problems.push(...checkDocsPage({ page: p.page, html, requiredIds: p.requiredIds, tocIds: p.tocIds, imageSize }))
	}

	// サイト全体 (+ llms.txt) からの深いリンク
	const sources = walkHtml(SITE)
	const llms = path.join(SITE, 'llms.txt')
	if (fs.existsSync(llms)) sources.push(llms)
	for (const file of sources) {
		const text = fs.readFileSync(file, 'utf8')
		for (const link of extractDocsDeepLinks(text)) {
			const ids = idsByPage.get(link.page)
			if (ids && !ids.has(link.id)) {
				problems.push(`${path.relative(SITE, file)}: ${link.page}#${link.id} の飛び先が無い`)
			}
		}
	}

	if (problems.length > 0) {
		for (const p of problems) console.error(`::error::${p}`)
		console.error(`docs check: ${problems.length} 件の問題`)
		process.exit(1)
	}
	console.log(`docs check: OK (${pages.length} ページ, ${sources.length} ファイルの深いリンクを検査)`)
}

if (FIX_DIMS) runFixDims()
else runCheck()
