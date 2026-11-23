// docs の訳の include (`_includes/docs/<en|zh-tw>/<名前>.html`) が日本語の include に追随していることの検査の仕様テスト。
//
//   node --test src/lib/i18n-site-docs-include-hash.test.js
//
//   - 節 (一番外の `<section id>`、節の外は `_head`) ごとの hash (scripts/i18n/source-hash.mjs)
//   - 訳の include の先頭の Liquid コメント (元のファイルと節ごとの hash) の読み書き
//   - checkTranslatedSources が訳の include の元のファイル・節の並び・節ごとの hash を見ること
//   - accept-site.mjs が訳の include の hash を書き直すこと (節を指定して 1 つだけも)
//   - docs-diff.mjs が hash の合わない節と日本語の節の今の文を出すこと
//   - parity の compareStructure が include の組を、言語のフォルダを除いた名前で比べること
//   - fixture は一時ディレクトリに作る。リポの `_includes/docs/<lang>/` は読むだけ。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
	HEAD_SECTION,
	normalizeSource,
	splitSections,
	sectionHashesOf,
	readIncludeHeader,
	formatIncludeHeader,
	includeSourceFor,
	translatedIncludes,
	checkTranslatedSources,
} from '../../scripts/i18n/source-hash.mjs'
import { compareStructure, stripLangFolder } from '../../scripts/i18n/parity.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(ROOT, 'scripts', 'i18n')

function makeTree(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-docs-include-'))
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(dir, rel)
		mkdirSync(dirname(abs), { recursive: true })
		writeFileSync(abs, body)
	}
	return dir
}

function runNode(script, args, dir) {
	return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
		encoding: 'utf8',
		cwd: dir,
		env: { ...process.env, I18N_SITE_ROOT: dir },
	})
}

const JA = `{%- assign free_plan = site.data.plans.tiers | where: "code", "free" | first -%}
<section id="about" class="scroll-mt-24">
  {% include docs-h2.html kicker="導入" title="はじめに" %}
  <p>アプリの概要です。</p>
  <img src="/assets/img/screenshots/home.webp" width="10" height="10" alt="ホーム画面">
</section><section id="install" class="scroll-mt-24">
  <p>インストールの手順です。</p>
  <section id="install-inner"><p>入れ子の節は外の節に含める。</p></section>
  {% include docs/store-edition.html %}
</section>

<section id="setup" class="scroll-mt-24">
  <p>初回セットアップです。</p>
</section>
`

const EN_BODY = `{%- assign free_plan = site.data.plans.tiers | where: "code", "free" | first -%}
<section id="about" class="scroll-mt-24">
  {% include docs-h2.html kicker="Getting started" title="Introduction" %}
  <p>An overview of the app.</p>
  <img src="/assets/img/screenshots/en/home.webp" width="10" height="10" alt="The home screen">
</section><section id="install" class="scroll-mt-24">
  <p>How to install.</p>
  <section id="install-inner"><p>Nested sections belong to the outer section.</p></section>
  {% include docs/en/store-edition.html %}
</section>

<section id="setup" class="scroll-mt-24">
  <p>First-time setup.</p>
</section>
`

/** ja の節ごとの hash を正しく持つ訳の include の全文。 */
function goodEn(ja = JA, body = EN_BODY) {
	return formatIncludeHeader('_includes/docs/01-intro.html', sectionHashesOf(ja)) + body
}

// ---------------------------------------------------------------- 節の分け方と hash

test('splitSections: 一番外の <section id> ごとに分け、最初の節の前は _head、入れ子の節は外の節に含める', () => {
	const parts = splitSections(normalizeSource(JA, 'html'))
	assert.deepEqual(parts.map((p) => p.name), [HEAD_SECTION, 'about', 'install', 'setup'])
	assert.equal(HEAD_SECTION, '_head')
	assert.match(parts[0].text, /^\{%- assign free_plan/)
	assert.ok(parts[2].text.startsWith('<section id="install"'))
	assert.ok(parts[2].text.includes('install-inner'))
	assert.ok(parts[2].text.endsWith('</section>'))
	assert.ok(!parts[1].text.includes('install'), '同じ行で次の節が始まっても前の節に入れない')
})

test('splitSections: 節の前に何も無ければ _head を作らず、節が無いファイルは _head だけ', () => {
	assert.deepEqual(splitSections(normalizeSource('<section id="a"><p>x</p></section>\n')).map((p) => p.name), ['a'])
	assert.deepEqual(splitSections(normalizeSource('{%- if x -%}\n<p>y</p>\n{%- endif -%}\n')).map((p) => p.name), [HEAD_SECTION])
	assert.deepEqual(splitSections(normalizeSource('')), [])
})

test('sectionHashesOf: 節ごとに 16 桁の hex。コメント・CRLF・行末の空白・空行の違いでは変わらず、変えた節の hash だけが変わる', () => {
	const base = sectionHashesOf(JA)
	assert.deepEqual(base.map((h) => h.name), [HEAD_SECTION, 'about', 'install', 'setup'])
	for (const h of base) assert.match(h.hash, /^[0-9a-f]{16}$/)

	const noisy = JA.replace(/\n/g, '   \r\n')
		.replace('<p>アプリの概要です。</p>', '<p>アプリの概要です。</p>{% comment %}メモ{% endcomment %}\r\n\r\n')
	assert.deepEqual(sectionHashesOf(noisy), base)

	const edited = sectionHashesOf(JA.replace('インストールの手順です。', 'インストールの手順。'))
	const changed = edited.filter((h, i) => h.hash !== base[i].hash).map((h) => h.name)
	assert.deepEqual(changed, ['install'])
})

// ---------------------------------------------------------------- 先頭のコメントの読み書き

test('formatIncludeHeader / readIncludeHeader: 元のファイルと節ごとの hash を Liquid のコメントで持ち、読み戻せる', () => {
	const hashes = [
		{ name: HEAD_SECTION, hash: '0123456789abcdef' },
		{ name: 'about', hash: 'fedcba9876543210' },
	]
	const header = formatIncludeHeader('_includes/docs/01-intro.html', hashes)
	assert.equal(
		header,
		'{%- comment -%}\nsource: _includes/docs/01-intro.html\nhash:\n  _head: 0123456789abcdef\n  about: fedcba9876543210\n{%- endcomment -%}\n',
	)
	assert.equal(formatIncludeHeader('a.html', hashes, '\r\n').split('\r\n').length, 7)
	const text = header + '<section id="about"></section>\n'
	const h = readIncludeHeader(text)
	assert.equal(h.source, '_includes/docs/01-intro.html')
	assert.deepEqual(h.hashes, hashes)
	assert.equal(text.slice(h.length), '<section id="about"></section>\n')
	const crlf = readIncludeHeader(formatIncludeHeader('a.html', hashes, '\r\n') + 'x')
	assert.equal(crlf.source, 'a.html')
	assert.deepEqual(crlf.hashes, hashes)
})

test('readIncludeHeader: 先頭がそのコメントでなければ null (途中のコメント・source の無いコメントは数えない)', () => {
	assert.equal(readIncludeHeader('<p>x</p>\n'), null)
	assert.equal(readIncludeHeader('<p>x</p>\n{%- comment -%}\nsource: a.html\nhash:\n{%- endcomment -%}\n'), null)
	assert.equal(readIncludeHeader('{%- comment -%}部品の使い方{%- endcomment -%}\n<p>x</p>'), null)
})

test('先頭のコメントはビルドの出力に出ない形 (前後の空白を削る {%- -%})、本文の正規化では消える', () => {
	const text = goodEn()
	assert.ok(text.startsWith('{%- comment -%}\n'))
	assert.equal(normalizeSource(text), normalizeSource(EN_BODY))
})

test('includeSourceFor: 訳の include の言語のフォルダを外した日本語の include のパス', () => {
	assert.equal(includeSourceFor('_includes/docs/en/01-intro.html'), '_includes/docs/01-intro.html')
	assert.equal(includeSourceFor('_includes/docs/zh-tw/web.html'), '_includes/docs/web.html')
	assert.equal(includeSourceFor('_includes/docs/01-intro.html'), null)
	assert.equal(includeSourceFor('en/docs/index.html'), null)
})

// ---------------------------------------------------------------- checkTranslatedSources

test('訳の include の規則: リポの _includes/docs/<lang>/ の訳が全部日本語に追随している', () => {
	assert.deepEqual(checkTranslatedSources(ROOT).filter((e) => e.startsWith('_includes/')), [])
})

test('訳の include の規則: 正しい訳は通り、日本語の節を直すとその節の名前と直し方を出す', () => {
	const dir = makeTree({ '_includes/docs/01-intro.html': JA, '_includes/docs/en/01-intro.html': goodEn() })
	try {
		assert.deepEqual(translatedIncludes(dir), [{ rel: '_includes/docs/en/01-intro.html', lang: 'en' }])
		assert.deepEqual(checkTranslatedSources(dir), [])

		// コメントだけの変更は捕まえない
		writeFileSync(join(dir, '_includes/docs/01-intro.html'), JA.replace('<p>初回', '{% comment %}x{% endcomment %}<p>初回'))
		assert.deepEqual(checkTranslatedSources(dir), [])

		writeFileSync(join(dir, '_includes/docs/01-intro.html'), JA.replace('初回セットアップです。', '初回のセットアップです。'))
		const errs = checkTranslatedSources(dir)
		assert.equal(errs.length, 1, errs.join('\n'))
		assert.ok(errs[0].startsWith('_includes/docs/en/01-intro.html: '), errs[0])
		assert.ok(errs[0].includes('節 setup'), errs[0])
		assert.ok(errs[0].includes('_includes/docs/01-intro.html'), errs[0])
		assert.ok(errs[0].includes('accept-site.mjs _includes/docs/en/01-intro.html --section setup'), errs[0])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('訳の include の規則: 先頭のコメントが無い・元のファイルが無い・日本語の節が増えた / 消えた・節の並びが違うを捕まえる', () => {
	const dir = makeTree({ '_includes/docs/01-intro.html': JA, '_includes/docs/zh-tw/01-intro.html': EN_BODY })
	const rel = '_includes/docs/zh-tw/01-intro.html'
	const errsOf = () => checkTranslatedSources(dir).filter((e) => e.startsWith(rel))
	try {
		assert.ok(errsOf().some((e) => e.includes('コメント')), '先頭のコメントが無い')

		writeFileSync(join(dir, rel), formatIncludeHeader('_includes/docs/nope.html', sectionHashesOf(JA)) + EN_BODY)
		assert.ok(errsOf().some((e) => e.includes('_includes/docs/nope.html')), '元のファイルが無い')

		// 日本語に節が増えた (訳にも足したが hash が無い)
		const jaMore = JA + '<section id="layout"><p>画面の構成です。</p></section>\n'
		writeFileSync(join(dir, '_includes/docs/01-intro.html'), jaMore)
		writeFileSync(join(dir, rel), goodEn(JA, EN_BODY + '<section id="layout"><p>Layout.</p></section>\n'))
		assert.ok(errsOf().some((e) => e.includes('節 layout')), errsOf().join('\n'))

		// 日本語の節が消えた (訳には残っている)
		writeFileSync(join(dir, '_includes/docs/01-intro.html'), JA.replace(/\n<section id="setup"[\s\S]*$/, '\n'))
		writeFileSync(join(dir, rel), goodEn())
		const gone = errsOf()
		assert.ok(gone.some((e) => e.includes('節 setup')), gone.join('\n'))
		assert.ok(gone.some((e) => e.includes('並び')), gone.join('\n'))

		// 訳の節の並びが日本語と違う
		writeFileSync(join(dir, '_includes/docs/01-intro.html'), JA)
		const swapped = EN_BODY.replace('id="about"', 'id="tmp"').replace('id="setup"', 'id="about"').replace('id="tmp"', 'id="setup"')
		writeFileSync(join(dir, rel), goodEn(JA, swapped))
		assert.ok(errsOf().some((e) => e.includes('並び') && e.includes('["about","install","setup"]')), errsOf().join('\n'))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('訳の include の規則: 言語のフォルダの外 (_includes/docs 直下) と en/ zh-tw/ のページは訳の include として数えない', () => {
	const dir = makeTree({ '_includes/docs/01-intro.html': JA, '_includes/docs/web.html': '<p>x</p>\n' })
	try {
		assert.deepEqual(translatedIncludes(dir), [])
		assert.deepEqual(checkTranslatedSources(dir), [])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- accept-site

test('accept-site: 訳の include の hash を全部書き直し、本文と改行コードを保つ (コメントが無ければ先頭に足す)', () => {
	const crlf = EN_BODY.replace(/\n/g, '\r\n')
	const dir = makeTree({
		'_includes/docs/01-intro.html': JA,
		'_includes/docs/en/01-intro.html': crlf,
		'_includes/docs/zh-tw/01-intro.html': formatIncludeHeader('_includes/docs/01-intro.html', [{ name: 'about', hash: '0000000000000000' }]) + EN_BODY,
	})
	try {
		const r = runNode('accept-site.mjs', ['_includes/docs/en/01-intro.html', '_includes/docs/zh-tw/01-intro.html'], dir)
		assert.equal(r.status, 0, r.stdout + r.stderr)
		const en = readFileSync(join(dir, '_includes/docs/en/01-intro.html'), 'utf8')
		assert.equal(en, formatIncludeHeader('_includes/docs/01-intro.html', sectionHashesOf(JA), '\r\n') + crlf)
		const zh = readFileSync(join(dir, '_includes/docs/zh-tw/01-intro.html'), 'utf8')
		assert.equal(zh, goodEn())
		assert.deepEqual(checkTranslatedSources(dir), [])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accept-site: --section で指定した節の hash だけを書き直し、ほかの節の古い hash は残す', () => {
	const jaNew = JA.replace('アプリの概要です。', 'アプリの概要。').replace('初回セットアップです。', '初回のセットアップ。')
	const dir = makeTree({ '_includes/docs/01-intro.html': jaNew, '_includes/docs/en/01-intro.html': goodEn() })
	const rel = '_includes/docs/en/01-intro.html'
	try {
		assert.equal(checkTranslatedSources(dir).length, 2)
		const r = runNode('accept-site.mjs', [rel, '--section', 'about'], dir)
		assert.equal(r.status, 0, r.stdout + r.stderr)
		const left = checkTranslatedSources(dir)
		assert.equal(left.length, 1, left.join('\n'))
		assert.ok(left[0].includes('節 setup'))
		const header = readIncludeHeader(readFileSync(join(dir, rel), 'utf8'))
		assert.equal(header.hashes.find((h) => h.name === 'setup').hash, sectionHashesOf(JA).find((h) => h.name === 'setup').hash)

		assert.equal(runNode('accept-site.mjs', [rel, '--section', 'setup,about'], dir).status, 0)
		assert.deepEqual(checkTranslatedSources(dir), [])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accept-site: 訳の節の並びが日本語と違う・日本語に無い節を指定した・--section の値が無い → exit 1 で書き換えない', () => {
	const swapped = EN_BODY.replace('id="setup"', 'id="other"')
	const dir = makeTree({
		'_includes/docs/01-intro.html': JA,
		'_includes/docs/en/01-intro.html': swapped,
		'_includes/docs/zh-tw/01-intro.html': goodEn(),
	})
	try {
		const r = runNode('accept-site.mjs', ['_includes/docs/en/01-intro.html'], dir)
		assert.equal(r.status, 1, r.stdout + r.stderr)
		assert.match(r.stderr, /並び/)
		assert.equal(readFileSync(join(dir, '_includes/docs/en/01-intro.html'), 'utf8'), swapped)

		const before = readFileSync(join(dir, '_includes/docs/zh-tw/01-intro.html'), 'utf8')
		const r2 = runNode('accept-site.mjs', ['_includes/docs/zh-tw/01-intro.html', '--section', 'nope'], dir)
		assert.equal(r2.status, 1, r2.stdout + r2.stderr)
		assert.match(r2.stderr, /nope/)
		assert.equal(readFileSync(join(dir, '_includes/docs/zh-tw/01-intro.html'), 'utf8'), before)

		assert.equal(runNode('accept-site.mjs', ['_includes/docs/zh-tw/01-intro.html', '--section'], dir).status, 2)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('accept-site: --section はページと l10n には使えない (exit 1)', () => {
	const dir = makeTree({
		'price/index.html': '<p>料金</p>\n',
		'en/price/index.html': '---\nlang: en\nsource: price/index.html\n---\n<p>Price</p>\n',
	})
	try {
		assert.equal(runNode('accept-site.mjs', ['en/price/index.html', '--section', 'about'], dir).status, 1)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- docs-diff

test('docs-diff: 揃っていれば exit 0、日本語の節が変わると exit 1 でその節の名前と日本語の今の文を出す', () => {
	const dir = makeTree({
		'_includes/docs/01-intro.html': JA,
		'_includes/docs/en/01-intro.html': goodEn(),
		'_includes/docs/zh-tw/01-intro.html': goodEn(),
	})
	try {
		const ok = runNode('docs-diff.mjs', [], dir)
		assert.equal(ok.status, 0, ok.stdout + ok.stderr)

		writeFileSync(join(dir, '_includes/docs/01-intro.html'), JA.replace('初回セットアップです。', '初回のセットアップ手順です。'))
		const r = runNode('docs-diff.mjs', ['en'], dir)
		assert.equal(r.status, 1, r.stdout + r.stderr)
		assert.ok(r.stdout.includes('_includes/docs/en/01-intro.html'), r.stdout)
		assert.ok(!r.stdout.includes('_includes/docs/zh-tw/01-intro.html'), '言語で絞る')
		assert.ok(r.stdout.includes('setup'), r.stdout)
		assert.ok(r.stdout.includes('初回のセットアップ手順です。'), '日本語の節の今の文')
		assert.ok(!r.stdout.includes('アプリの概要です。'), '変わっていない節の文は出さない')

		const brief = runNode('docs-diff.mjs', ['--brief'], dir)
		assert.equal(brief.status, 1)
		assert.ok(brief.stdout.includes('_includes/docs/zh-tw/01-intro.html'))
		assert.ok(!brief.stdout.includes('初回のセットアップ手順です。'), '--brief は文を出さない')

		const one = runNode('docs-diff.mjs', ['_includes/docs/zh-tw/01-intro.html'], dir)
		assert.equal(one.status, 1)
		assert.ok(!one.stdout.includes('_includes/docs/en/01-intro.html'), 'ファイルで絞る')
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('docs-diff: 知らない言語・無いファイルは exit 2、訳の include が 1 本も無ければ exit 0', () => {
	const dir = makeTree({ '_includes/docs/01-intro.html': JA })
	try {
		assert.equal(runNode('docs-diff.mjs', [], dir).status, 0)
		assert.equal(runNode('docs-diff.mjs', ['fr'], dir).status, 2)
		assert.equal(runNode('docs-diff.mjs', ['_includes/docs/en/none.html'], dir).status, 2)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---------------------------------------------------------------- parity (include の組)

test('stripLangFolder: パスの途中の en/ zh-tw/ のフォルダだけを外す', () => {
	assert.equal(stripLangFolder('/assets/img/screenshots/en/home.webp'), '/assets/img/screenshots/home.webp')
	assert.equal(stripLangFolder('/assets/img/screenshots/zh-tw/home.webp'), '/assets/img/screenshots/home.webp')
	assert.equal(stripLangFolder('docs/en/store-edition.html'), 'docs/store-edition.html')
	assert.equal(stripLangFolder('/assets/img/screenshots/home.webp'), '/assets/img/screenshots/home.webp')
	assert.equal(stripLangFolder('/assets/img/len/en-us.webp'), '/assets/img/len/en-us.webp')
})

test('compareStructure: include の組は先頭のコメントと言語のフォルダ (画像・include) の違いを除けば一致し、日本語の画像のままでも一致する', () => {
	assert.deepEqual(compareStructure(JA, goodEn()), [])
	const jaImages = goodEn().replace('/screenshots/en/home.webp', '/screenshots/home.webp')
	assert.deepEqual(compareStructure(JA, jaImages), [])
	assert.ok(compareStructure(JA, goodEn().replace('/screenshots/en/home.webp', '/screenshots/en/other.webp')).some((m) => m.startsWith('imgSrcs')))
	assert.ok(compareStructure(JA, goodEn().replace('docs/en/store-edition.html', 'docs/en/other.html')).some((m) => m.startsWith('includes')))
	assert.ok(compareStructure(JA, goodEn().replace('id="install-inner"', 'id="inner"')).some((m) => m.startsWith('ids')))
	assert.ok(compareStructure(JA, goodEn(), { ignoreLangFolders: false }).length > 0, '言語のフォルダを除かない比べ方も選べる')
})

test('訳の include の構造: リポの _includes/docs/<lang>/ の訳が日本語の include と同じ構造', () => {
	for (const { rel } of translatedIncludes(ROOT)) {
		const ja = includeSourceFor(rel)
		assert.deepEqual(compareStructure(readFileSync(join(ROOT, ja), 'utf8'), readFileSync(join(ROOT, rel), 'utf8')), [], rel)
	}
})
