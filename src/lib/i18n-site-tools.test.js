// T-2199 (i18n1112 I18N-701, 2026-11-12) サイトの多言語化の土台と検査の道具の仕様テスト。
//
//   node --test src/lib/i18n-site-tools.test.js
//
//   - ja-identity (ja のページの出力が基点とバイト一致すること) の正規化と CLI
//   - source_hash (英中のページ・l10n のデータが元の ja のソースに追随していること)
//   - parity (ja と英中のソースの構造の一致)
//   - check-site (ビルド出力の検査の束ね役) の CLI
//   - 英中のファイルの規則と `_config.yml` の page.lang の既定
//   - node テストは `_site` を読まない (CI では npm test がビルドの前に走る)。fixture は一時ディレクトリに作る。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { normalizeJaHtml } from '../../scripts/i18n/ja-identity.mjs'
import {
	normalizeSource,
	sourceHash,
	readFrontMatter,
	checkTranslatedSources,
} from '../../scripts/i18n/source-hash.mjs'
import { structureOf, compareStructure } from '../../scripts/i18n/parity.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(ROOT, 'scripts', 'i18n')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** 一時ディレクトリに { 相対パス: 内容 } のファイル群を書く。 */
function makeTree(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-site-tools-'))
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(dir, rel)
		mkdirSync(dirname(abs), { recursive: true })
		writeFileSync(abs, body)
	}
	return dir
}

function runNode(script, args, opts = {}) {
	return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { encoding: 'utf8', ...opts })
}

// ---------------------------------------------------------------- 1. normalizeJaHtml

test('normalizeJaHtml: ?v=<ビルド時刻> の違いは消える', () => {
	const a = '<link href="/assets/dist/app.css?v=1700000000"><script src="/assets/dist/app.js?v=1700000000"></script>\n'
	const b = '<link href="/assets/dist/app.css?v=1800000000"><script src="/assets/dist/app.js?v=1800000000"></script>\n'
	assert.equal(normalizeJaHtml(a), normalizeJaHtml(b))
})

test('normalizeJaHtml: CRLF と LF の違いは消える', () => {
	assert.equal(normalizeJaHtml('<p>a</p>\r\n<p>b</p>\r\n'), normalizeJaHtml('<p>a</p>\n<p>b</p>\n'))
})

test('normalizeJaHtml: hreflang の行と og:locale:alternate の行が消える', () => {
	const base = '<head>\n<link rel="canonical" href="https://x/" />\n<meta property="og:locale" content="ja_JP" />\n</head>\n'
	const cur =
		'<head>\n<link rel="canonical" href="https://x/" />\n' +
		'<link rel="alternate" hreflang="ja" href="https://x/" />\n' +
		'  <link rel="alternate" hreflang="en" href="https://x/en/" />\n' +
		'<meta property="og:locale" content="ja_JP" />\n' +
		'<meta property="og:locale:alternate" content="en_US" />\n' +
		'</head>\n'
	assert.equal(normalizeJaHtml(cur), normalizeJaHtml(base))
	// og:locale (alternate でない方) は消さない
	assert.match(normalizeJaHtml(cur), /og:locale" content="ja_JP"/)
})

test('normalizeJaHtml: data-i18n-switch の要素 (入れ子の同じタグを含む) が丸ごと消え、要素だけの行は行ごと消える', () => {
	const base = '<nav>\n<a href="/">ホーム</a>\n</nav>\n'
	const cur =
		'<nav>\n<a href="/">ホーム</a>\n' +
		'  <div class="lang" data-i18n-switch>\n    <div>x</div>\n    <a href="/en/">English</a>\n  </div>\n' +
		'</nav>\n'
	assert.equal(normalizeJaHtml(cur), normalizeJaHtml(base))
})

test('normalizeJaHtml: 行の途中の data-i18n-switch の要素は要素だけ消える', () => {
	const base = '<p>前<b>強</b>後</p>\n'
	const cur = '<p>前<span data-i18n-switch="1"><span>English</span></span><b>強</b>後</p>\n'
	assert.equal(normalizeJaHtml(cur), normalizeJaHtml(base))
})

test('normalizeJaHtml: void 要素と自己閉じの data-i18n-switch はタグだけ消える', () => {
	const base = '<div>\n<p>a</p>\n</div>\n'
	const cur = '<div>\n<link data-i18n-switch rel="x">\n<p>a</p><input data-i18n-switch />\n<br data-i18n-switch>\n</div>\n'
	assert.equal(normalizeJaHtml(cur), normalizeJaHtml(base))
})

test('normalizeJaHtml: data-i18n-switch-foo のような別の属性は消さない', () => {
	const src = '<div data-i18n-switch-foo>x</div>\n'
	assert.equal(normalizeJaHtml(src), src)
})

test('normalizeJaHtml: 許した差分以外の 1 バイトの違い (空白 1 つ・属性の順) は残る (陰性対照)', () => {
	const base = '<a class="x" href="/">ホーム</a>\n'
	assert.notEqual(normalizeJaHtml('<a class="x"  href="/">ホーム</a>\n'), normalizeJaHtml(base))
	assert.notEqual(normalizeJaHtml('<a href="/" class="x">ホーム</a>\n'), normalizeJaHtml(base))
	assert.notEqual(normalizeJaHtml('<a class="x" href="/">ホー厶</a>\n'), normalizeJaHtml(base))
	// ?v= 以外のクエリは消さない
	assert.notEqual(
		normalizeJaHtml('<img src="/a.png?w=1">\n'),
		normalizeJaHtml('<img src="/a.png?w=2">\n'),
	)
	// 空行の増減も差分として残る (要素を消して空になった行だけを消す)
	assert.notEqual(normalizeJaHtml('<p>a</p>\n\n<p>b</p>\n'), normalizeJaHtml('<p>a</p>\n<p>b</p>\n'))
})

// ---------------------------------------------------------------- 2. ja-identity の CLI

const PAGE = (body) => `<!DOCTYPE html>\n<html lang="ja">\n<head>\n<link href="/assets/dist/app.css?v=1700000000">\n</head>\n<body>${body}</body>\n</html>\n`

function siteFixture(extra = {}, stamp = '1700000000') {
	return {
		'index.html': PAGE('トップ').replace('1700000000', stamp),
		'price/index.html': PAGE('料金'),
		'enterprise/inquiry/index.html': PAGE('法人'),
		...extra,
	}
}

test('ja-identity: 同じ (ビルド時刻だけ違う) → exit 0 と OK の件数', () => {
	const base = makeTree(siteFixture())
	const cur = makeTree(siteFixture({}, '1800000000'))
	try {
		const r = runNode('ja-identity.mjs', [base, cur])
		assert.equal(r.status, 0, r.stdout + r.stderr)
		assert.match(r.stdout, /ja-identity: OK \(3 files\)/)
	} finally {
		rmSync(base, { recursive: true, force: true })
		rmSync(cur, { recursive: true, force: true })
	}
})

test('ja-identity: llms.txt・llms-full.txt・robots.txt は基点とバイト一致、1 字違い・消えたら exit 1 (基点に無いものは比べない)', () => {
	const base = makeTree(siteFixture({ 'llms.txt': '# Deepmosaic\n', 'robots.txt': 'User-agent: *\n' }))
	const same = makeTree(siteFixture({ 'llms.txt': '# Deepmosaic\n', 'robots.txt': 'User-agent: *\n', 'llms-full.txt': '基点に無い\n' }))
	const changed = makeTree(siteFixture({ 'llms.txt': '# Deepmosaic \n', 'robots.txt': 'User-agent: *\n' }))
	const removed = makeTree(siteFixture({ 'llms.txt': '# Deepmosaic\n' }))
	try {
		assert.equal(runNode('ja-identity.mjs', [base, same]).status, 0)
		const r1 = runNode('ja-identity.mjs', [base, changed])
		assert.equal(r1.status, 1)
		assert.match(r1.stdout, /内容が違う: llms\.txt/)
		assert.doesNotMatch(r1.stdout, /robots\.txt/)
		const r2 = runNode('ja-identity.mjs', [base, removed])
		assert.equal(r2.status, 1)
		assert.match(r2.stdout, /消えた: robots\.txt/)
	} finally {
		for (const d of [base, same, changed, removed]) rmSync(d, { recursive: true, force: true })
	}
})

test('ja-identity: llms のビルドの日付だけが違っても一致とみなし、日付以外の 1 字違いは落とす', () => {
	const llms = (d, tail = '') => `# Deepmosaic\n- 最終更新 / Last updated: ${d}\n${tail}`
	const full = (d) => `生成日 / Generated: ${d} — 出典\n`
	const base = makeTree(siteFixture({ 'llms.txt': llms('2026-11-12'), 'llms-full.txt': full('2026-11-12') }))
	const nextDay = makeTree(siteFixture({ 'llms.txt': llms('2026-11-13'), 'llms-full.txt': full('2026-11-13') }))
	const changed = makeTree(siteFixture({ 'llms.txt': llms('2026-11-13', 'x\n'), 'llms-full.txt': full('2026-11-13') }))
	try {
		assert.equal(runNode('ja-identity.mjs', [base, nextDay]).status, 0)
		const r = runNode('ja-identity.mjs', [base, changed])
		assert.equal(r.status, 1)
		assert.match(r.stdout, /内容が違う: llms\.txt/)
		assert.doesNotMatch(r.stdout, /llms-full\.txt/)
	} finally {
		for (const d of [base, nextDay, changed]) rmSync(d, { recursive: true, force: true })
	}
})

test('ja-identity: ja のページの文字が 1 字違う → exit 1 で該当のファイル名を出す', () => {
	const base = makeTree(siteFixture())
	const cur = makeTree(siteFixture({ 'price/index.html': PAGE('料全') }))
	try {
		const r = runNode('ja-identity.mjs', [base, cur])
		assert.equal(r.status, 1)
		assert.match(r.stdout + r.stderr, /price\/index\.html/)
		assert.doesNotMatch(r.stdout + r.stderr, /enterprise\/inquiry\/index\.html/)
	} finally {
		rmSync(base, { recursive: true, force: true })
		rmSync(cur, { recursive: true, force: true })
	}
})

test('ja-identity: enterprise/ は en/ と前方一致でも比較の対象に入る', () => {
	const base = makeTree(siteFixture())
	const cur = makeTree(siteFixture({ 'enterprise/inquiry/index.html': PAGE('法人X') }))
	try {
		const r = runNode('ja-identity.mjs', [base, cur])
		assert.equal(r.status, 1)
		assert.match(r.stdout + r.stderr, /enterprise\/inquiry\/index\.html/)
	} finally {
		rmSync(base, { recursive: true, force: true })
		rmSync(cur, { recursive: true, force: true })
	}
})

test('ja-identity: en/ と zh-tw/ のページだけが増えた → exit 0', () => {
	const base = makeTree(siteFixture())
	const cur = makeTree(
		siteFixture({ 'en/x.html': PAGE('English'), 'zh-tw/index.html': PAGE('中文') }),
	)
	try {
		const r = runNode('ja-identity.mjs', [base, cur])
		assert.equal(r.status, 0, r.stdout + r.stderr)
		assert.match(r.stdout, /OK \(3 files\)/)
	} finally {
		rmSync(base, { recursive: true, force: true })
		rmSync(cur, { recursive: true, force: true })
	}
})

test('ja-identity: ja のページが 1 つ増えた / 消えた → exit 1', () => {
	const base = makeTree(siteFixture())
	const added = makeTree(siteFixture({ 'spec/index.html': PAGE('動作環境') }))
	const removedFiles = siteFixture()
	delete removedFiles['price/index.html']
	const removed = makeTree(removedFiles)
	try {
		const r1 = runNode('ja-identity.mjs', [base, added])
		assert.equal(r1.status, 1)
		assert.match(r1.stdout + r1.stderr, /spec\/index\.html/)
		const r2 = runNode('ja-identity.mjs', [base, removed])
		assert.equal(r2.status, 1)
		assert.match(r2.stdout + r2.stderr, /price\/index\.html/)
	} finally {
		for (const d of [base, added, removed]) rmSync(d, { recursive: true, force: true })
	}
})

test('ja-identity: 引数が足りない・ディレクトリが無い → exit 2', () => {
	assert.equal(runNode('ja-identity.mjs', []).status, 2)
	assert.equal(runNode('ja-identity.mjs', [join(tmpdir(), 'no-such-dir-i18n-a'), join(tmpdir(), 'no-such-dir-i18n-b')]).status, 2)
})

// ---------------------------------------------------------------- 3. source_hash と accept-site

test('normalizeSource: コメント・CRLF・行末の空白の違いでは hash が変わらず、本文の 1 字の違いで変わる (html)', () => {
	const a = '<p>こんにちは</p>\n<p>料金</p>\n'
	const b = '<p>こんにちは</p>   \r\n{% comment %}メモ{% endcomment %}\r\n<!-- 注記 -->\r\n<p>料金</p>{%- comment -%}x{%- endcomment -%}\r\n'
	const c = '<p>こんにちは</p>\n<p>料全</p>\n'
	assert.equal(normalizeSource(a, 'html'), normalizeSource(b, 'html'))
	assert.notEqual(normalizeSource(a, 'html'), normalizeSource(c, 'html'))
})

test('normalizeSource: yml の # の行を除く', () => {
	const a = 'name: Light\nprice: 980\n'
	const b = '# 料金の正\nname: Light   \n  # 補足\nprice: 980\n\n'
	assert.equal(normalizeSource(a, 'yml'), normalizeSource(b, 'yml'))
	assert.notEqual(normalizeSource(a, 'yml'), normalizeSource('name: Light\nprice: 981\n', 'yml'))
})

test('sourceHash: 正規化した本文の sha256 (hex 64 桁)、拡張子で html / yml を選ぶ', () => {
	const dir = makeTree({
		'a.html': '<p>x</p>\n',
		'b.html': '<!-- c -->\r\n<p>x</p>  \r\n',
		'c.yml': 'k: v\n',
		'd.yml': '# c\nk: v\n',
	})
	try {
		const h = sourceHash(join(dir, 'a.html'))
		assert.match(h, /^[0-9a-f]{64}$/)
		assert.equal(sourceHash(join(dir, 'b.html')), h)
		assert.equal(sourceHash(join(dir, 'c.yml')), sourceHash(join(dir, 'd.yml')))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('readFrontMatter: --- の間の key: value を読み、引用符を外す', () => {
	const fm = readFrontMatter('---\r\nlayout: default\r\nlang: en\r\ntitle: "Price"\r\nsource: \'price/index.html\'\r\n---\r\n<p>x</p>\r\n')
	assert.deepEqual(fm, { layout: 'default', lang: 'en', title: 'Price', source: 'price/index.html' })
	assert.deepEqual(readFrontMatter('<p>no front matter</p>'), {})
})

test('accept-site: html の source_hash と yml の _source_hash を正しい値に書き換え、改行コードを保つ', () => {
	const dir = makeTree({
		'price/index.html': '<p>料金</p>\n',
		'_data/plans.yml': 'tiers: []\n',
		// CRLF の html。source_hash が古い
		'en/price/index.html': '---\r\nlang: en\r\nsource: price/index.html\r\nsource_hash: "old"\r\ntitle: Price\r\n---\r\n<p>Price</p>\r\n',
		// LF の html。source_hash が無い (source の次の行に足す)
		'zh-tw/price/index.html': '---\nlang: zh-tw\nsource: price/index.html\ntitle: 價格\n---\n<p>價格</p>\n',
		// yml
		'_data/l10n/en/plans.yml': '_source: "_data/plans.yml"\n_source_hash: "old"\ntax_note: "excl. tax"\n',
	})
	try {
		const r = runNode('accept-site.mjs', [
			'en/price/index.html',
			'zh-tw/price/index.html',
			'_data/l10n/en/plans.yml',
		], { cwd: dir, env: { ...process.env, I18N_SITE_ROOT: dir } })
		assert.equal(r.status, 0, r.stdout + r.stderr)
		const want = sourceHash(join(dir, 'price/index.html'))
		const en = readFileSync(join(dir, 'en/price/index.html'), 'utf8')
		assert.ok(en.includes(`\r\nsource_hash: "${want}"\r\n`), en)
		assert.doesNotMatch(en.replace(/\r\n/g, ''), /\n/, 'CRLF のファイルに LF だけの行ができた')
		const zh = readFileSync(join(dir, 'zh-tw/price/index.html'), 'utf8')
		assert.ok(zh.includes(`source: price/index.html\nsource_hash: "${want}"\ntitle:`), zh)
		assert.doesNotMatch(zh, /\r/)
		const yml = readFileSync(join(dir, '_data/l10n/en/plans.yml'), 'utf8')
		assert.ok(yml.includes(`_source_hash: "${sourceHash(join(dir, '_data/plans.yml'))}"\n`), yml)
		assert.ok(yml.endsWith('tax_note: "excl. tax"\n'))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accept-site: source の無いファイル・source が実在しないファイルは exit 1', () => {
	const dir = makeTree({
		'en/a.html': '---\nlang: en\n---\n<p>x</p>\n',
		'en/b.html': '---\nlang: en\nsource: nope.html\n---\n<p>x</p>\n',
	})
	try {
		const env = { ...process.env, I18N_SITE_ROOT: dir }
		assert.equal(runNode('accept-site.mjs', ['en/a.html'], { cwd: dir, env }).status, 1)
		assert.equal(runNode('accept-site.mjs', ['en/b.html'], { cwd: dir, env }).status, 1)
		assert.equal(runNode('accept-site.mjs', [], { cwd: dir, env }).status, 2)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- 4. parity

const JA_SRC = `---
layout: default
---
{% include header.html %}
<!-- <div id="commented-out" data-dl="ghost"></div> -->
{% comment %}<img src="/ghost.webp">{% endcomment %}
<section id="hero" class="a">
  <a href="/x" data-dl="hero" data-dl-variant="lite">ダウンロード</a>
  <img src="/assets/img/a.webp" width="10" height="10" alt="画面">
  <div data-island="RoiCalculator" data-props='{}'></div>
</section>
<section id="faq">{% include faq.html items=site.data.faq.faq %}</section>
{%- include footer.html -%}
`

test('structureOf: コメントを除いて id・data-dl・island・data-* の名前・img・include の並びを抜く', () => {
	const s = structureOf(JA_SRC)
	assert.deepEqual(s.ids, ['hero', 'faq'])
	assert.deepEqual(s.dataDl, ['hero'])
	assert.deepEqual(s.islands, ['RoiCalculator'])
	assert.deepEqual(s.imgSrcs, ['/assets/img/a.webp'])
	assert.deepEqual(s.includes, ['header.html', 'faq.html', 'footer.html'])
	assert.deepEqual(s.dataAttrs, ['data-dl', 'data-dl-variant', 'data-island', 'data-props'])
})

test('compareStructure: 同じ構造 (文だけ違う) → []、ja-link.html と多言語化の印の追加は許す', () => {
	const en = JA_SRC.replace('ダウンロード', 'Download')
		.replace('alt="画面"', 'alt="Screen (Japanese UI)"')
		.replace('<section id="faq">', '<section id="faq">{% include ja-link.html href="/docs/" label="Docs" %}<p data-i18n-allow="mosaic_removal" data-ja-allowed>x</p>')
	assert.deepEqual(compareStructure(JA_SRC, en), [])
})

test('compareStructure: data-dl が消えた / id が違う / include の並びが違う / img が違う → 違いを返す', () => {
	assert.ok(compareStructure(JA_SRC, JA_SRC.replace(' data-dl="hero"', '')).length > 0)
	assert.ok(compareStructure(JA_SRC, JA_SRC.replace('id="faq"', 'id="questions"')).length > 0)
	const swapped = JA_SRC.replace('{% include header.html %}', '{% include footer.html %}').replace('{%- include footer.html -%}', '{% include header.html %}')
	assert.ok(compareStructure(JA_SRC, swapped).some((m) => m.includes('include')))
	assert.ok(compareStructure(JA_SRC, JA_SRC.replace('/assets/img/a.webp', '/assets/img/b.webp')).length > 0)
	assert.ok(compareStructure(JA_SRC, JA_SRC.replace('data-island="RoiCalculator"', 'data-island="Other"')).length > 0)
	assert.ok(compareStructure(JA_SRC, JA_SRC.replace(" data-props='{}'", '')).length > 0)
	// 許す include は引数で変えられる
	const withExtra = JA_SRC.replace('<section id="faq">', '<section id="faq">{% include ja-link.html %}')
	assert.ok(compareStructure(JA_SRC, withExtra, { allowExtraIncludes: [] }).length > 0)
})

// ---------------------------------------------------------------- 5. 英中のファイルの規則

test('英中のファイルの規則: リポの en/・zh-tw/ のページと _data/l10n の hash が全部一致する (今は 0 件で素通り)', () => {
	assert.deepEqual(checkTranslatedSources(ROOT), [])
})

test('英中のファイルの規則: fixture の 1 件が正しければ通り、欠けや古い hash を捕まえる (陽性対照)', () => {
	const files = {
		'price/index.html': '<p>料金</p>\n',
		'_data/plans.yml': 'tiers: []\n',
		'en/price/index.html': '',
		'_data/l10n/en/plans.yml': '',
	}
	const dir = makeTree(files)
	try {
		const h = sourceHash(join(dir, 'price/index.html'))
		const hy = sourceHash(join(dir, '_data/plans.yml'))
		const good = `---\nlang: en\npermalink: /en/price/\nja_url: /price/\nsource: price/index.html\nsource_hash: "${h}"\n---\n<p>Price</p>\n`
		writeFileSync(join(dir, 'en/price/index.html'), good)
		writeFileSync(join(dir, '_data/l10n/en/plans.yml'), `_source: "_data/plans.yml"\n_source_hash: "${hy}"\n`)
		assert.deepEqual(checkTranslatedSources(dir), [])

		// ja を直したのに英中を追随させていない
		writeFileSync(join(dir, 'price/index.html'), '<p>料金表</p>\n')
		assert.ok(checkTranslatedSources(dir).some((e) => e.includes('en/price/index.html') && e.includes('source_hash')))
		writeFileSync(join(dir, 'price/index.html'), '<p>料金</p>\n')

		// lang がディレクトリと食い違う・permalink の接頭辞が違う・ja_url が無い
		writeFileSync(join(dir, 'en/price/index.html'), good.replace('lang: en', 'lang: zh-tw').replace('permalink: /en/price/', 'permalink: /price/').replace('ja_url: /price/\n', ''))
		const errs = checkTranslatedSources(dir)
		assert.ok(errs.some((e) => e.includes('lang')), errs.join('\n'))
		assert.ok(errs.some((e) => e.includes('permalink')), errs.join('\n'))
		assert.ok(errs.some((e) => e.includes('ja_url')), errs.join('\n'))

		// source の無い試しのページ (_probe の消し忘れ)
		writeFileSync(join(dir, 'en/price/index.html'), good)
		writeFileSync(join(dir, 'en/_probe.html'), '---\nlang: en\npermalink: /en/_probe/\n---\n')
		assert.ok(checkTranslatedSources(dir).some((e) => e.includes('en/_probe.html') && e.includes('source')))
		rmSync(join(dir, 'en/_probe.html'))

		// l10n の hash が古い
		writeFileSync(join(dir, '_data/l10n/en/plans.yml'), '_source: "_data/plans.yml"\n_source_hash: "0000"\n')
		assert.ok(checkTranslatedSources(dir).some((e) => e.includes('_data/l10n/en/plans.yml')))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('英中のファイルの規則: en/ があるのに .html が 0 件ならエラー (列挙の書き損じを捕まえる)', () => {
	const dir = makeTree({ 'en/README.txt': 'x' })
	try {
		assert.ok(checkTranslatedSources(dir).some((e) => e.includes('en/')))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- 6. _config.yml

/** defaults の各要素を { path, values: { key: value } } で返す (素朴な読み)。 */
function configDefaults(text) {
	const block = text.replace(/\r\n/g, '\n').split(/^defaults:\s*$/m)[1]
	assert.ok(block, '_config.yml に defaults が無い')
	return block
		.split(/^\s*- scope:\s*$/m)
		.slice(1)
		.map((chunk) => {
			const path = chunk.match(/^\s*path:\s*"?([^"\n]*)"?\s*$/m)?.[1]
			const values = {}
			const v = chunk.split(/^\s*values:\s*$/m)[1] ?? ''
			for (const line of v.split('\n')) {
				const m = line.match(/^\s+([\w-]+):\s*(.+?)\s*$/)
				if (m) values[m[1]] = m[2].replace(/^["']|["']$/g, '')
			}
			return { path, values }
		})
}

test('_config.yml: defaults の path "" に lang: ja、path "en" / "zh-tw" の defaults は無い', () => {
	const defs = configDefaults(read('_config.yml'))
	const root = defs.find((d) => d.path === '')
	assert.ok(root, 'path: "" の defaults が無い')
	assert.equal(root.values.lang, 'ja')
	assert.equal(root.values.layout, 'default')
	for (const d of defs) {
		assert.ok(!/^(en|zh-tw)(\/|$)/.test(d.path ?? ''), `path: "${d.path}" の defaults は enterprise/ にも当たるので置かない`)
	}
})

// ウェーブ末尾の追い修正 (T-2210): scripts/ の全部を除外にした (scripts/i18n はその中に含まれる)
test('_config.yml: exclude に scripts/i18n (か、それを含む scripts) がある', () => {
	const cfg = read('_config.yml').replace(/\r\n/g, '\n')
	const ex = cfg.split(/^exclude:\s*$/m)[1].split(/^\S/m)[0]
	assert.match(ex, /^\s*-\s*scripts(\/i18n)?\s*(#.*)?$/m)
})

// ---------------------------------------------------------------- 7. check-site

test('check-site: エラーを返すモジュールがあれば exit 1 で [名前] 文 の形、無ければ exit 0', () => {
	const site = makeTree({ 'index.html': PAGE('トップ'), 'en/index.html': PAGE('Top') })
	const checksBad = makeTree({
		'a-ok.mjs': 'export default function check(ctx) { return [] }\n',
		'b-bad.mjs':
			'export default async function check(ctx) {\n' +
			'  const files = ctx.listHtml("")\n' +
			'  return [`files=${files.join(",")}`, `exists=${ctx.exists("index.html")}`, `en=${ctx.listHtml("en").join(",")}`]\n' +
			'}\n',
	})
	const checksOk = makeTree({ 'a-ok.mjs': 'export default function check(ctx) { return ctx.read("index.html").includes("トップ") ? [] : ["no"] }\n' })
	try {
		const r1 = runNode('check-site.mjs', [site, '--checks', checksBad])
		assert.equal(r1.status, 1, r1.stdout + r1.stderr)
		const out = r1.stdout + r1.stderr
		assert.match(out, /^\[b-bad\] files=en\/index\.html,index\.html$/m)
		assert.match(out, /^\[b-bad\] exists=true$/m)
		assert.match(out, /^\[b-bad\] en=en\/index\.html$/m)
		assert.doesNotMatch(out, /\[a-ok\]/)
		assert.match(out, /3 件/)

		const r2 = runNode('check-site.mjs', [site, '--checks', checksOk])
		assert.equal(r2.status, 0, r2.stdout + r2.stderr)
		assert.match(r2.stdout, /check-site: OK/)
	} finally {
		for (const d of [site, checksBad, checksOk]) rmSync(d, { recursive: true, force: true })
	}
})

test('check-site: 例外を投げるモジュールはエラーとして数える・siteDir が無ければ exit 2', () => {
	const site = makeTree({ 'index.html': PAGE('x') })
	const checks = makeTree({ 'boom.mjs': 'export default function check() { throw new Error("壊れた") }\n' })
	try {
		const r = runNode('check-site.mjs', [site, '--checks', checks])
		assert.equal(r.status, 1)
		assert.match(r.stdout + r.stderr, /\[boom\].*壊れた/)
		assert.equal(runNode('check-site.mjs', [join(tmpdir(), 'no-such-site-i18n')]).status, 2)
	} finally {
		rmSync(site, { recursive: true, force: true })
		rmSync(checks, { recursive: true, force: true })
	}
})

test('checks/ja-lang: ja のページは lang="ja" / ja_JP、en/ は en / en_US、zh-tw/ は zh-Hant-TW / zh_TW', async () => {
	const { default: check } = await import('../../scripts/i18n/checks/ja-lang.mjs')
	const html = (lang, og) =>
		`<!DOCTYPE html>\n<html lang="${lang}">\n<head>${og ? `<meta property="og:locale" content="${og}" />` : ''}<meta property="og:locale:alternate" content="xx_XX" /></head></html>\n`
	const good = makeTree({
		'index.html': html('ja', 'ja_JP'),
		'enterprise/inquiry/index.html': html('ja', 'ja_JP'),
		'company/about.html': html('ja', null),
		'en/index.html': html('en', 'en_US'),
		'zh-tw/index.html': html('zh-Hant-TW', 'zh_TW'),
	})
	const bad = makeTree({
		'index.html': html('en', 'ja_JP'),
		'enterprise/inquiry/index.html': html('ja', 'en_US'),
		'en/index.html': html('ja', 'en_US'),
		'zh-tw/index.html': html('zh-Hant-TW', 'zh_CN'),
		'frag.html': '<p>no html tag</p>\n',
	})
	try {
		const r = runNode('check-site.mjs', [good])
		assert.equal(r.status, 0, r.stdout + r.stderr)
		const r2 = runNode('check-site.mjs', [bad])
		assert.equal(r2.status, 1)
		const out = r2.stdout + r2.stderr
		for (const f of ['index.html', 'enterprise/inquiry/index.html', 'en/index.html', 'zh-tw/index.html', 'frag.html']) {
			assert.match(out, new RegExp(`\\[ja-lang\\] ${f.replace(/[./]/g, '\\$&')}`), out)
		}
		assert.equal(typeof check, 'function')
	} finally {
		rmSync(good, { recursive: true, force: true })
		rmSync(bad, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- CI と build-site-base

test('jekyll.yml: Verify build output が check-plan-catalog の前に check-site を呼ぶ (ja-identity は CI に載せない)', () => {
	const yml = read('.github/workflows/jekyll.yml')
	const site = yml.indexOf('node scripts/i18n/check-site.mjs _site || fail=1')
	const plan = yml.indexOf('node scripts/check-plan-catalog.mjs || fail=1')
	assert.ok(site > 0, 'check-site の行が無い')
	assert.ok(plan > site, 'check-site は check-plan-catalog の前')
	assert.ok(!yml.includes('ja-identity'), 'ja-identity は基点が要るので CI に載せない')
})

test('build-site-base.sh: set -euo pipefail・--detach・strict_front_matter・JEKYLL_ENV を付けない', () => {
	const p = join(SCRIPTS, 'build-site-base.sh')
	assert.ok(existsSync(p))
	const sh = readFileSync(p, 'utf8')
	assert.match(sh, /set -euo pipefail/)
	assert.match(sh, /git -C "\$repo" worktree add --detach/)
	assert.match(sh, /npm ci/)
	assert.match(sh, /bundle exec jekyll build --strict_front_matter -d/)
	assert.match(sh, /git -C "\$repo" worktree remove --force/)
	assert.doesNotMatch(sh, /^[^#]*JEKYLL_ENV=/m, 'JEKYLL_ENV を付けない (unset は可)')
})

test('build-site-base.sh: 出力先を jekyll の cd の前に絶対パスへ直す (相対パスで出力が一時 worktree ごと消えないように)', () => {
	const sh = readFileSync(join(SCRIPTS, 'build-site-base.sh'), 'utf8')
	const abs = sh.search(/^out="\$\(cd "\$\(dirname "\$2"\)" && /m)
	const cd = sh.search(/^\s*cd "\$src"\s*$/m)
	assert.ok(abs > 0, 'out を絶対パスにする行が無い')
	assert.ok(cd > abs, '絶対パスにするのは cd "$src" より前')
	assert.doesNotMatch(sh, /^out="\$2"$/m, '引数をそのまま out にしない')
})

test('CLI はジャンクション / シンボリックリンク越しに起動しても検査を飛ばさない (exit 2 = 使い方の誤り)', (t) => {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-site-tools-link-'))
	const link = join(dir, 'scripts-link')
	try {
		try {
			symlinkSync(SCRIPTS, link, process.platform === 'win32' ? 'junction' : 'dir')
		} catch (e) {
			t.skip(`リンクを作れない環境: ${e.code}`)
			return
		}
		const missing = join(dir, 'no-such-site')
		for (const [name, args] of [
			['check-site.mjs', [missing]],
			['ja-identity.mjs', []],
			['accept-site.mjs', []],
		]) {
			const r = spawnSync(process.execPath, [join(link, name), ...args], { encoding: 'utf8' })
			assert.equal(r.status, 2, `${name} はリンク越しでも main を呼び exit 2 になる: ${r.stdout}${r.stderr}`)
		}
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
