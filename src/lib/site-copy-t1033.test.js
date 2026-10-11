// T-1033 (2026-10-11) 使用許諾契約書 (EULA) の公開面を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1033.test.js
//
//   - `company/eula.html` を新設する。条立ては第1条〜第12条で、条ごとの必須の語 (禁止事項・責任の制限・
//     利用規約との関係など) と、前文の「本契約への同意は、当社の利用規約への同意を含みます」を固定する。
//     アプリの同意画面は 1 チェックなので、この一文が利用規約への同意の根拠になる (計画 W0-2)。
//   - 版の単一真実源は `_data/legal.yml` の `version`。EULA の「最終更新日」と一致させる (計画 W0-1)。
//     desktop `src/lib/legal/version.ts` と web の verbatim は各リポのテストで同じ値に固定する。
//   - 台数の条項は device lock のあるデスクトップ版だけに限定する (計画 W0-3)。
//   - 責任の制限は軽過失に限り、上限には 1 万円の下限額を置く (無料利用者で上限 0 円 = 全部免除になるのを避ける、
//     リーダー決定 2026-10-11)。全部免除の文言は置かない。
//   - 導線はフッターの会社情報 (5 番目の法務リンク)・`_data/lang/ja.json`・`llms.txt`。DL ボタン (data-dl) は増減しない。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` / `site-copy-t964.test.js` と同じ流儀)。

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

/** 先頭の `---`〜`---` (front matter) を `key: value` の Map に。`#` コメント行は飛ばす。無ければ null。 */
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

/** `第N条（` の h2 から次の h2 (無ければ末尾) までの素の文字列。見出しが無ければ null。 */
function articleBlock(html, n) {
	const src = stripComments(html)
	const start = src.search(new RegExp(`<h2[^>]*>\\s*第${n}条（`))
	if (start < 0) return null
	const rest = src.slice(start + 1)
	const next = rest.search(/<h2[\s>]/)
	const block = next < 0 ? src.slice(start) : src.slice(start, start + 1 + next)
	return textOf(block)
}

/**
 * `key: "value"` 1 階層だけを読む極小パーサ (T-1032 と同じ仕様)。空行と `#` コメント行は飛ばし、
 * それ以外の形 (引用符なし・`|` / `>`・インデント・値なし) の行は throw する (黙って読み飛ばさない)。
 */
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

/** 表示幅を全角換算で数える (半角 = 0.5、それ以外 = 1)。 */
function zenkakuWidth(s) {
	let w = 0
	for (const ch of s) w += /[\x20-\x7e]/.test(ch) ? 0.5 : 1
	return w
}

const EULA = 'company/eula.html'
const LEGAL_VERSION = '2026-10-12'
/** 変更前のフッターの data-dl の個数 (DL ボタンを増減しない、計画 W0-6)。 */
const FOOTER_DATA_DL_COUNT = 1

/** 前文 = h1 から第1条の h2 までの素の文字列。 */
function preamble(html) {
	const src = stripComments(html)
	const h1 = src.search(/<h1[\s>]/)
	const h2 = src.search(/<h2[^>]*>\s*第1条（/)
	if (h1 < 0 || h2 < 0) return null
	return textOf(src.slice(h1, h2))
}

// --- 1. ヘルパーのガード ---

test('ヘルパー: 見つからないときは null を返す (検査のすり抜けを防ぐ)', () => {
	assert.equal(lastUpdated('<p>x</p>'), null)
	assert.equal(articleBlock('<h2>第1条（a）</h2>x', 2), null)
	assert.equal(frontMatter('x'), null)
	assert.equal(preamble('<p>x</p>'), null)
})

test('ヘルパー: 陽性対照 (見つかるときは値を返す)', () => {
	assert.equal(articleBlock('<h2>第1条（a）</h2>x<h2>第2条（b）</h2>y', 1), '第1条（a）x')
	assert.equal(articleBlock('<h2>第1条（a）</h2>x<h2>第2条（b）</h2>y', 2), '第2条（b）y')
	assert.equal(frontMatter('---\na: b\n# c\n---\n').get('a'), 'b')
	assert.equal(zenkakuWidth('使用許諾｜Ab'), 5 + 1)
})

test('parseFlatYaml: key: "value" だけを読み、それ以外の形は throw する', () => {
	assert.deepEqual(parseFlatYaml('# c\n\na: "b"\n'), { a: 'b' })
	for (const bad of ['a: b', 'a: |', '  a: "b"', 'a:']) {
		assert.throws(() => parseFlatYaml(bad), /読めない行/, bad)
	}
})

// --- 2. front matter ---

test('EULA: front matter が terms と同形で、seo_title は全角 30 字以内', () => {
	// Act
	const fm = frontMatter(read(EULA))

	// Assert
	assert.ok(fm, 'front matter が無い')
	assert.equal(fm.get('layout'), 'default')
	assert.equal(fm.get('title'), '使用許諾契約書')
	assert.equal(fm.get('permalink'), '/company/eula')
	assert.ok((fm.get('description') ?? '').length > 0, 'description が空')
	const seo = fm.get('seo_title') ?? ''
	assert.ok(seo.length > 0, 'seo_title が無い')
	assert.ok(zenkakuWidth(seo) <= 30, `seo_title が長い: ${seo}`)
})

// --- 3. 条の見出し ---

test('EULA: 条の見出しは第1条〜第12条が順に 12 本', () => {
	// Act
	const nums = [...stripComments(read(EULA)).matchAll(/<h2[^>]*>\s*第(\d+)条（/g)].map((m) => Number(m[1]))

	// Assert
	assert.deepEqual(nums, Array.from({ length: 12 }, (_, i) => i + 1))
})

// --- 4. 必須の語 ---

test('EULA: 前文に「本契約への同意は、当社の利用規約への同意を含みます」がある', () => {
	const text = preamble(read(EULA))
	assert.ok(text, '前文が無い')
	assert.match(text, /本契約への同意は、当社の利用規約への同意を含みます/)
})

const REQUIRED = {
	1: [/デスクトップ版/, /Web 版/, /学習済みモデル/],
	2: [/非独占的/, /譲渡不能/, /再許諾/, /デスクトップ版[^。]*同時に\s?1\s?台/],
	3: [/リバースエンジニアリング/, /逆コンパイル/, /逆アセンブル/, /学習済みモデル/, /復号/, /無料/, /再許諾/, /公序良俗/],
	4: [/成果物/, /利用者[^。]*に帰属/],
	5: [/自動更新/, /(再度|改めて)[^。]*同意/],
	6: [/検出漏れ/, /誤検出/, /最終[^。]*確認/],
	7: [/軽過失/, /12か月/, /1万円/, /故意又は重過失/],
	8: [/削除/, /終了/],
	9: [/輸出/],
	10: [/日本法/, /東京地方裁判所/],
	11: [/優先/],
	12: [/一般の利益/, /効力発生日/, /ウェブサイト/],
}

for (const [n, patterns] of Object.entries(REQUIRED)) {
	test(`EULA: 第${n}条に必須の語がある`, () => {
		// Act
		const block = articleBlock(read(EULA), n)

		// Assert
		assert.ok(block, `第${n}条が無い`)
		for (const re of patterns) assert.match(block, re)
	})
}

test('EULA: 第1条は利用規約とプライバシーポリシーへリンクする', () => {
	const src = stripComments(read(EULA))
	const start = src.search(/<h2[^>]*>\s*第1条（/)
	const end = src.search(/<h2[^>]*>\s*第2条（/)
	const raw = src.slice(start, end)
	assert.match(raw, /href="\/company\/terms"/)
	assert.match(raw, /href="\/company\/privacy"/)
})

test('EULA: 第7条は全部免除の文言を置かない', () => {
	const block = articleBlock(read(EULA), 7)
	assert.ok(block)
	assert.doesNotMatch(block, /一切[^。]*責任を負わない/)
})

// --- 5. 入れない語 ---

test('EULA: 本文に「除去」「SAM」「サイドカー」を書かない', () => {
	const text = textOf(read(EULA))
	assert.doesNotMatch(text, /除去/)
	assert.doesNotMatch(text, /SAM/)
	assert.doesNotMatch(text, /サイドカー/)
})

// --- 6. 構造 ---

test('EULA: <ul> の直下に <ol> を入れない', () => {
	assert.doesNotMatch(stripComments(read(EULA)), /<ul>\s*<ol/)
})

// --- 7. 版 ---

test('版: EULA の最終更新日 = _data/legal.yml の version = 2026-10-12', () => {
	// Act
	const version = parseFlatYaml(read('_data/legal.yml')).version

	// Assert
	assert.equal(version, LEGAL_VERSION)
	assert.equal(lastUpdated(read(EULA)), version)
})

// --- 8. 導線 ---

test('導線: フッターの会社情報は about / terms / privacy / cookie / eula / asct の順', () => {
	// Act
	const hrefs = [...stripComments(read('_includes/footer.html')).matchAll(/href="(\/company\/[^"]*)"/g)].map((m) => m[1])

	// Assert
	assert.equal(hrefs.length, 6)
	assert.deepEqual(hrefs, [
		'/company/about',
		'/company/terms',
		'/company/privacy',
		'/company/cookie',
		'/company/eula',
		'/company/asct',
	])
})

test('導線: ja.json に eula の文言がある', () => {
	assert.equal(JSON.parse(read('_data/lang/ja.json')).eula, '使用許諾契約書')
})

test('導線: llms.txt に使用許諾契約書の行がある', () => {
	assert.match(read('llms.txt'), /^- \[使用許諾契約書[^\]]*\]\([^)]*\/company\/eula\)$/m)
})

// --- 9. data-dl 不変 ---

test('フッター: data-dl の個数は変えない', () => {
	const count = (stripComments(read('_includes/footer.html')).match(/data-dl=/g) ?? []).length
	assert.equal(count, FOOTER_DATA_DL_COUNT)
})
