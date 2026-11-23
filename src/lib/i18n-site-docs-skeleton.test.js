// 英中の docs のページの骨組み (`en/docs/index.html`・`en/docs/web/index.html`・`zh-tw/…`) と目次の訳 (`_data/l10n/<lang>/docs_toc.yml`) の仕様テスト。
//
//   node --test src/lib/i18n-site-docs-skeleton.test.js
//
//   - 骨組みの front matter (lang・permalink・ja_url・source・title・seo_title・description・schemas) と、日本語の骨組みとの構造の一致
//   - 本文は言語のフォルダの訳の include (`docs/<lang>/<名前>.html`) を日本語と同じ並びで読み、目次は言語の目次を引く
//   - 本文の訳の include がそろっていて公開し (`published: false` が無い)、台帳 (`_data/i18n_pages.yml`) に載る
//   - 骨組みの中のリンクは同じ言語の docs を指す
//   - 目次の訳は日本語と同じ群の数・同じ id・同じ並びで、名前が空でなく、文の検査 (lintValue) を通る

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { compareStructure, structureOf } from '../../scripts/i18n/parity.mjs'
import { readFrontMatter, checkTranslatedSources } from '../../scripts/i18n/source-hash.mjs'
import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { parseLedger } from '../../scripts/i18n/checks/head.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const LANGS = ['en', 'zh-tw']
const KINDS = [
	{ kind: 'desktop', ja: 'docs/index.html', path: '/docs/', includes: ['01-intro', '02-account', '03-detect', '04-edit', '05-export', '06-ops', '07-team'], nested: ['store-edition'] },
	{ kind: 'web', ja: 'docs/web/index.html', path: '/docs/web/', includes: ['web'], nested: [] },
]
const skeletonOf = (lang, k) => `${lang}/${k.ja}`

/** 全角 30 文字の目安 (ASCII は半分に数える) */
const width = (s) => [...s].reduce((n, c) => n + (c.charCodeAt(0) < 0x80 ? 0.5 : 1), 0)

for (const lang of LANGS) {
	for (const k of KINDS) {
		const rel = skeletonOf(lang, k)

		test(`骨組み ${rel}: front matter が英中のページの規則に合う`, () => {
			const fm = readFrontMatter(read(rel))
			assert.equal(fm.layout, 'default')
			assert.equal(fm.lang, lang)
			assert.equal(fm.permalink, `/${lang}${k.path}`)
			assert.equal(fm.ja_url, k.path)
			assert.equal(fm.source, k.ja)
			for (const key of ['title', 'seo_title', 'description']) {
				assert.ok(fm[key] && fm[key].trim() !== '', `${key} が無い`)
				assert.deepEqual(lintValue(lang, fm[key]), [], `${key} の文`)
			}
			assert.ok(width(fm.seo_title) <= 30, `seo_title が全角 30 文字を超える (${width(fm.seo_title)})`)
			assert.match(read(rel), /\nschemas:\r?\n {2}- breadcrumb\r?\n/)
		})

		test(`骨組み ${rel}: 日本語の骨組みと構造が同じ (id・data-*・include の並び。include は言語のフォルダを除いて比べる)`, () => {
			assert.deepEqual(compareStructure(read(k.ja), read(rel)), [])
		})

		test(`骨組み ${rel}: 本文は言語のフォルダの訳の include を読み、目次は言語の目次を引く`, () => {
			const src = read(rel)
			const body = structureOf(src).includes.filter((n) => n.startsWith('docs/'))
			assert.deepEqual(body, k.includes.map((n) => `docs/${lang}/${n}.html`))
			assert.match(src, new RegExp(`assign docs_toc = site\\.data\\.l10n\\[page\\.lang\\]\\.docs_toc\\.${k.kind}\\b`))
		})

		test(`骨組み ${rel}: 中のリンクは同じ言語の docs を指す`, () => {
			const hrefs = [...read(rel).matchAll(/\shref="([^"]*)"/g)].map((m) => m[1])
			assert.ok(hrefs.length > 0)
			for (const h of hrefs) assert.match(h, new RegExp(`^/${lang}/docs/`), h)
		})

		test(`骨組み ${rel}: 本文の訳の include がそろっていて公開し (published: false が無い)、台帳に載る`, () => {
			const files = [...k.includes, ...k.nested].map((n) => `_includes/docs/${lang}/${n}.html`)
			assert.deepEqual(files.filter((f) => !existsSync(join(ROOT, f))), [], '訳の include が無い')
			const fmText = read(rel).split(/^---\s*$/m)[1] ?? ''
			assert.doesNotMatch(fmText, /^published:/m, 'published の行がある')
			const ledger = parseLedger(read('_data/i18n_pages.yml'))
			assert.ok(ledger.has(k.path), `台帳に ${k.path} が無い`)
		})
	}
}

test('骨組みと目次の訳: source_hash と _source_hash が今の日本語と一致する (checkTranslatedSources)', () => {
	const errors = checkTranslatedSources(ROOT).filter((e) => /docs\/|docs_toc/.test(e))
	assert.deepEqual(errors, [])
})

// ---- 目次の訳 ----

/** docs_toc.yml を { desktop: [{ title, ids, labels }], web: [...] } に読む (群の title と項目の id・label) */
function readToc(text) {
	const out = {}
	let kind = null
	let group = null
	const unq = (s) => s.trim().replace(/^"(.*)"$/, '$1')
	for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
		const line = raw.replace(/\s+#.*$/, '')
		if (/^\s*(#|$)/.test(line)) continue
		const top = line.match(/^(\w+):\s*$/)
		if (top) {
			kind = top[1]
			out[kind] = []
			continue
		}
		const t = line.match(/^\s+- title:\s*(.+)$/)
		if (t && kind) {
			group = { title: unq(t[1]), ids: [], labels: [] }
			out[kind].push(group)
			continue
		}
		const item = line.match(/^\s+- \{\s*id:\s*([\w-]+),\s*label:\s*(.+?)\s*\}\s*$/)
		if (item && group) {
			group.ids.push(item[1])
			group.labels.push(unq(item[2]))
		}
	}
	return out
}

const JA_TOC = readToc(read('_data/docs_toc.yml'))

test('目次の読み取り: 日本語の目次は desktop と web の群を読める (陽性対照)', () => {
	assert.ok(JA_TOC.desktop.length >= 2 && JA_TOC.web.length >= 1)
	assert.ok(JA_TOC.desktop.flatMap((g) => g.ids).includes('trouble'))
})

for (const lang of LANGS) {
	const rel = `_data/l10n/${lang}/docs_toc.yml`

	test(`目次の訳 ${rel}: 群の数・id・並びが日本語と同じ`, () => {
		const toc = readToc(read(rel))
		for (const kind of ['desktop', 'web']) {
			assert.deepEqual(
				toc[kind].map((g) => g.ids),
				JA_TOC[kind].map((g) => g.ids),
				kind,
			)
		}
		assert.deepEqual(Object.keys(toc).filter((k) => !k.startsWith('_')).sort(), ['desktop', 'web'])
	})

	test(`目次の訳 ${rel}: 群の名前と項目の名前が空でなく、文の検査を通る`, () => {
		const toc = readToc(read(rel))
		const errors = []
		for (const kind of ['desktop', 'web']) {
			for (const g of toc[kind]) {
				for (const s of [g.title, ...g.labels]) {
					if (!s) errors.push(`${kind}: 空の名前`)
					for (const e of lintValue(lang, s)) errors.push(`${kind}: ${s}: ${e.rule} ${e.word}`)
				}
			}
		}
		assert.deepEqual(errors, [])
	})

	test(`目次の訳 ${rel}: 日本語の目次を元のファイルとして持つ`, () => {
		assert.match(read(rel), /^_source: "_data\/docs_toc\.yml"$/m)
	})
}
