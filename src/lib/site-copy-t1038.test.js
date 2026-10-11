// T-1038 (2026-10-12) 法務文書 6 ページの横断テスト。
//
//   node --test src/lib/site-copy-t1038.test.js
//
//   - 版の契約: `_data/legal.yml` の version = 使用許諾契約書 (`company/eula.html`) の最終更新日
//     = 利用規約 (`company/terms.html`) の最終更新日。値は 2026-10-12 で固定。
//     リポをまたぐ同じ値 (desktop `src/lib/legal/version.ts` の LEGAL_VERSION /
//     desktop `src-tauri/installer/eula.txt` の 2 行目 / web の verbatim) は各リポのテストが持つ。
//     サイトで固定できるのは eula = terms = legal.yml まで。
//   - 6 ページ (about / terms / privacy / cookie / eula / asct) の最終更新日を ISO の同じ日付にそろえる。
//   - permalink は `/company/<slug>` (`.html` 無し・末尾スラッシュ無し)。同意画面 (desktop / web) が
//     参照する `/company/eula` `/company/terms` `/company/privacy` もこれに含まれる。
//   - フッターの法務リンク 6 本と、法務ページ間の相互リンクが実在する permalink を指す。
//   - llms.txt の Optional 節に 6 本が載る。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** 本文の「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?([^\s（(]+)/)
	return m ? m[1] : null
}

/** `key: "value"` の 1 階層だけを読む極小 YAML パーサ (それ以外の形は throw)。 */
function parseFlatYaml(text) {
	const out = {}
	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === '' || /^#/.test(line)) continue
		const m = line.match(/^([A-Za-z_][\w-]*): "([^"]*)"\s*$/)
		if (!m) throw new Error(`parseFlatYaml: 読めない行: ${line}`)
		out[m[1]] = m[2]
	}
	return out
}

/** 先頭の `---` ブロックを Map で返す。無ければ null。 */
function frontMatter(html) {
	const m = html.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!m) return null
	const map = new Map()
	for (const line of m[1].split(/\r?\n/)) {
		if (line.trim() === '' || line.trim().startsWith('#')) continue
		const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
		if (kv) map.set(kv[1], kv[2].trim())
	}
	return map
}

/** コメントを落とした後の `href="…"` を出現順に並べる。 */
function hrefsOf(html) {
	return [...stripComments(html).matchAll(/href="([^"]*)"/g)].map((m) => m[1])
}

/** 版の値。変えるときは desktop / web / installer の eula.txt と同時に (計画 W0-1)。 */
const LEGAL_VERSION = '2026-10-12'
const MIN_DATE = '2026-10-12'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SLUGS = ['about', 'terms', 'privacy', 'cookie', 'eula', 'asct']
const pageOf = (slug) => `company/${slug}.html`
const FOOTER_ORDER = SLUGS.map((s) => `/company/${s}`)

/** 6 ページの permalink の集合。 */
const permalinks = () => new Set(SLUGS.map((s) => frontMatter(read(pageOf(s)))?.get('permalink')))
/** そのページの `/company/` への href。 */
const companyHrefs = (slug) => hrefsOf(read(pageOf(slug))).filter((h) => h.startsWith('/company/'))

// --- 1. ヘルパーのガード ---

test('ヘルパー: 陽性対照と陰性対照 (検査のすり抜けを防ぐ)', () => {
	assert.equal(lastUpdated('<p>x</p>'), null)
	assert.equal(lastUpdated('<p>最終更新日: 2026-10-12（制定: 2019-06-01）</p>'), '2026-10-12')
	assert.equal(frontMatter('x'), null)
	assert.equal(frontMatter('---\npermalink: /a\n---\n').get('permalink'), '/a')
	assert.throws(() => parseFlatYaml('a: b'), /読めない行/)
	assert.deepEqual(parseFlatYaml('# c\nversion: "1"\n'), { version: '1' })
	assert.deepEqual(hrefsOf('<!-- <a href="/x"> --><a href="/y">'), ['/y'])
})

// --- 2. 版の一致 ---

test('版: legal.yml の version = EULA の最終更新日 = 利用規約の最終更新日 = 2026-10-12', () => {
	// Arrange
	const version = parseFlatYaml(read('_data/legal.yml')).version

	// Act
	const eula = lastUpdated(read(pageOf('eula')))
	const terms = lastUpdated(read(pageOf('terms')))

	// Assert
	assert.match(version, ISO_DATE)
	assert.equal(version, LEGAL_VERSION)
	assert.equal(eula, version)
	assert.equal(terms, version)
})

// --- 3. 6 ページの日付 ---

test('最終更新日: 6 ページすべてが ISO で MIN_DATE 以降、かつ同じ日付', () => {
	// Act
	const dates = SLUGS.map((s) => [s, lastUpdated(read(pageOf(s)))])

	// Assert
	assert.equal(dates.length, 6)
	for (const [slug, date] of dates) {
		assert.ok(date, `${slug}: 最終更新日が無い`)
		assert.match(date, ISO_DATE, slug)
		assert.ok(date >= MIN_DATE, `${slug}: ${date} < ${MIN_DATE}`)
	}
	assert.equal(new Set(dates.map(([, d]) => d)).size, 1, JSON.stringify(dates))
})

// --- 4. permalink ---

test('permalink: 6 ページとも /company/<slug> (.html 無し・末尾スラッシュ無し) で slug がファイル名と一致', () => {
	for (const slug of SLUGS) {
		// Act
		const fm = frontMatter(read(pageOf(slug)))

		// Assert
		assert.ok(fm, `${slug}: front matter が無い`)
		assert.equal(fm.get('permalink'), `/company/${slug}`)
	}
	assert.equal(permalinks().size, 6)
})

// --- 5. フッター ---

test('フッター: 法務リンク 6 本がこの順で並び、すべて実在する permalink を指す', () => {
	// Act
	const hrefs = hrefsOf(read('_includes/footer.html')).filter((h) => h.startsWith('/company/'))

	// Assert
	assert.deepEqual(hrefs, FOOTER_ORDER)
	const known = permalinks()
	for (const h of hrefs) assert.ok(known.has(h), h)
})

// --- 6. 相互リンク ---

test('相互リンク: 法務ページ間のリンクが正しいパスで張られている', () => {
	const expected = {
		eula: ['/company/terms', '/company/privacy'],
		terms: ['/company/eula'],
		privacy: ['/company/cookie'],
		cookie: ['/company/privacy'],
		asct: ['/company/eula', '/company/terms'],
	}
	for (const [slug, targets] of Object.entries(expected)) {
		// Act
		const hrefs = companyHrefs(slug)

		// Assert
		for (const t of targets) assert.ok(hrefs.includes(t), `${slug} → ${t} が無い`)
	}
})

test('相互リンク: 旧形式 /company/*.html を使わず、/company/ への href はすべて実在する permalink', () => {
	const known = permalinks()
	for (const slug of SLUGS) {
		// Act
		const all = hrefsOf(read(pageOf(slug)))

		// Assert
		for (const h of all) assert.doesNotMatch(h, /\/company\/[a-z]+\.html/, `${slug}: ${h}`)
		for (const h of companyHrefs(slug)) assert.ok(known.has(h), `${slug}: リンク切れ ${h}`)
	}
})

// --- 7. llms.txt ---

test('llms.txt: Optional 節に法務 6 ページが載る', () => {
	// Arrange
	const llms = read('llms.txt')
	const start = llms.indexOf('\n## Optional')
	assert.ok(start >= 0, 'Optional 節が無い')

	// Act
	const rest = llms.slice(start + 1)
	const next = rest.indexOf('\n## ')
	const section = next >= 0 ? rest.slice(0, next) : rest

	// Assert
	for (const slug of SLUGS) assert.ok(section.includes(`/company/${slug})`), slug)
})
