// T-2322 (backlog1113) front matter が YAML として読めることを npm test で確かめる仕様テスト。
//
//   node --test src/lib/front-matter.test.js
//
// 背景: T-2231 で英語のトップの description に引用符なしの `: ` を書いたら、npm test は通り、
// `bundle exec jekyll build --strict_front_matter` で初めて落ちた。テストの front matter の読み取り (fmScalar) が
// 行を文字列として切り出すだけで、YAML として正しいかを見ていなかったため。
//
//   - lintFrontMatter: Jekyll (Psych) が落ちる代表的な形を見本 (文字列) で 1 つずつ落とす。正しい形は通す
//   - サイトの front matter を持つ全ページ (ja・en・zh-tw・_layouts・llms.txt など) が lintFrontMatter を通る
//   - fmScalar: 引用符つきの値 (`"…: …"`) の引用符を外して返す (i18n-site-*.test.js が使う読み取り)
//   - 実ファイルは壊さない (見本はすべて文字列)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { extractFrontMatter, fmScalar, lintFrontMatter, listFrontMatterFiles } from './front-matter.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 見本の front matter (1 行の値) を検査して、問題の文を返す */
const problemsOf = (fm) => lintFrontMatter(fm).map((p) => p.message)
const assertBad = (fm, why) => assert.ok(lintFrontMatter(fm).length > 0, `${why} を見落とした: ${JSON.stringify(fm)}`)
const assertOk = (fm) => assert.deepEqual(problemsOf(fm), [], JSON.stringify(fm))

test('引用符なしの値の中の `: ` を落とす (T-2231 の形)', () => {
	assertBad('layout: default\ndescription: Deepmosaic for Windows: AI detects body areas', '値の中の `: `')
	assertBad('title: a:\tb', '値の中の `:` + タブ')
	assertBad('title: ends with colon:', '値の末尾の `:`')
	assertBad('schemas:\n  - faq: x', '配列の要素の中の `: `')
	const [p] = lintFrontMatter('layout: default\ndescription: a: b')
	assert.equal(p.line, 2, '問題の行番号 (front matter の中で 1 始まり)')
})

test('引用符なしの値の先頭の YAML の記号を落とす', () => {
	for (const c of ['@', '`', '*', '&', '!', '%', '|', '>', '[', '{', '#']) {
		assertBad(`title: ${c}value`, `値の先頭の ${c}`)
		assertBad(`schemas:\n  - ${c}value`, `配列の要素の先頭の ${c}`)
	}
	assertBad('title: - x', '値の先頭の `- `')
	assertBad('title: ? x', '値の先頭の `? `')
})

test('引用符の閉じ忘れ・閉じた後の余り・不正なエスケープを落とす', () => {
	assertBad('description: "Deepmosaic: AI', '" の閉じ忘れ')
	assertBad("description: 'Deepmosaic: AI", "' の閉じ忘れ")
	assertBad('description: "a" b', '" を閉じた後の余り')
	assertBad("description: 'a' b", "' を閉じた後の余り")
	assertBad('description: "a \\q b"', '" の中の不正なエスケープ')
})

test('タブのインデントと、読めない行の形を落とす', () => {
	assertBad('schemas:\n\t- faq', 'タブのインデント')
	assertBad('schemas:\n \t- faq', '空白に続くタブのインデント')
	assertBad('title:value', '`:` の後に空白の無いキー')
	assertBad('just a line', 'キーでも配列でもない行')
	assertBad('  - faq', 'キーの無い配列')
	assertBad('title: a\n  - faq', '値を持つキーの下の配列')
	assertBad('schemas:\n  - faq\n    - x', 'インデントのずれた配列')
})

test('正しい形は通す (今のサイトで使っている書き方)', () => {
	assertOk('layout: default\ntitle: モザイク作業を最終確認だけに')
	assertOk('description: "Deepmosaic for Windows: AI detects body areas"')
	assertOk("description: 'it''s: fine'")
	assertOk('description: "a \\"quoted\\" word" # 末尾のコメント')
	assertOk('seo_title: 会社概要｜Deepmosaic合同会社')
	assertOk('description: 全角のコロン：は問題ない')
	assertOk('permalink: /en/company/about')
	assertOk('url: https://www.deepmosaic.co.jp/')
	assertOk('title: a:b は空白が無いので値の一部')
	assertOk('# コメント\n  # インデントしたコメント\n\nlayout: null')
	assertOk('noindex: true\nsitemap: false\nsource_hash: "08b2d7"')
	assertOk('schemas:\n  - software-application\n  # 途中のコメント\n  - faq\nfaq_data: subscribe')
	assertOk('title:')
	assertOk('')
})

test('extractFrontMatter: `---` の間を取り出す (CRLF も同じ)。無ければ null', () => {
	assert.equal(extractFrontMatter('---\nlayout: default\n---\n<p>x</p>'), 'layout: default')
	assert.equal(extractFrontMatter('---\r\nlayout: default\r\n---\r\n<p>x</p>'), 'layout: default')
	assert.equal(extractFrontMatter('---\n---\n'), '')
	assert.equal(extractFrontMatter('<p>no front matter</p>'), null)
	assert.equal(extractFrontMatter('---\nlayout: default\n'), null, '閉じの `---` が無い')
})

test('サイトの front matter を持つ全ページ (ja・en・zh-tw) が YAML として読める形', () => {
	const files = listFrontMatterFiles(ROOT)
	// ja・en・zh-tw の代表と、layout: null のテキスト・_layouts が対象に入っていること (列挙の漏れの検出)
	for (const rel of ['index.html', 'en/index.html', 'zh-tw/index.html', 'en/subscribe/index.html', 'zh-tw/join/index.html', 'llms.txt', '_layouts/default.html']) {
		assert.ok(files.includes(rel), `${rel} が検査の対象に無い`)
	}
	assert.ok(files.length >= 40, `対象が少なすぎる (${files.length} 件)`)
	// 公開しない物は対象外
	assert.ok(!files.some((f) => /^(node_modules|src|scripts|e2e|docs_draft|_site)\//.test(f)), '公開しないフォルダが対象に入っている')

	const failures = []
	for (const rel of files) {
		const fm = extractFrontMatter(readFileSync(join(ROOT, rel), 'utf8'))
		assert.notEqual(fm, null, `${rel} の front matter が閉じていない`)
		for (const p of lintFrontMatter(fm)) failures.push(`${rel}:${p.line + 1} ${p.message}`)
	}
	assert.deepEqual(failures, [], `front matter が YAML として読めない (bundle exec jekyll build --strict_front_matter で落ちる):\n${failures.join('\n')}`)
})

test('fmScalar: 引用符つきの値の引用符を外し、`: ` を含む中身をそのまま返す', () => {
	const fm = [
		'title: Mosaic work',
		'seo_title: AI software | Deepmosaic',
		'description: "Deepmosaic for Windows: AI detects body areas, faces"',
		"single: 'a: b'",
		'source_hash: "08b2d7"',
		'noindex: true',
	].join('\n')
	assert.equal(fmScalar(fm, 'description'), 'Deepmosaic for Windows: AI detects body areas, faces')
	assert.equal(fmScalar(fm, 'single'), 'a: b')
	assert.equal(fmScalar(fm, 'source_hash'), '08b2d7')
	assert.equal(fmScalar(fm, 'title'), 'Mosaic work', 'seo_title: の行に当たらない')
	assert.equal(fmScalar(fm, 'seo_title'), 'AI software | Deepmosaic')
	assert.equal(fmScalar(fm, 'noindex'), 'true')
	assert.equal(fmScalar(fm, 'missing'), undefined)
	assert.equal(fmScalar('title: "a\'', 'title'), '"a\'', '引用符の種類が違えば外さない')
})

test('fmScalar: 英語のトップの description (T-2231 で引用符つきにした値) を引用符なしで返す', () => {
	const fm = extractFrontMatter(readFileSync(join(ROOT, 'en/index.html'), 'utf8'))
	const desc = fmScalar(fm, 'description')
	assert.ok(desc.startsWith('Deepmosaic for Windows: '), desc)
	assert.ok(!/^["']|["']$/.test(desc), `引用符が残っている: ${desc}`)
})
