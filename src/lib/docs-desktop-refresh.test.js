// docs (Desktop) 01 / 03 / 05 / 06 章がアプリの今の画面と同じ内容であることを
// 固定する回帰テスト。
//
//   node --test src/lib/docs-desktop-refresh.test.js
//
// ここでは:
//
//   - 01-intro の #about は節見出しから始まり、版の注記が無い。
//   - docs のどの章 (Web 版を含む) にも「次回のデスクトップ更新」「配布中の v…」などの
//     版の断り書きが無い (表示されない Liquid コメントは対象外)。
//   - HOME の分類できない動画は、サイドバーの「他のフォルダ」行 (フォルダ・タグで分類できない) で案内する
//     (「他のプロジェクトフォルダに N 件」のバナーの説明を書かない)。
//   - 無効の機能を書かない (CLAUDE.md「未実装・無効の機能は書かない」)。
//   - プロジェクトの書き出し zip にタイムライン素材が入ること。
//   - 残り検出可能時間が動画の全長より少ないと、検出は開始前に止まること。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '_includes', 'docs')

/**
 * 版の断り書きの言い回し (docs に書かない)。
 * 「次回更新日」(Enterprise の請求の更新日、07-team) は別物なので、版の断り書きに固有の形だけを拾う。
 */
const PRERELEASE_WORDING = [
	/次回のデスクトップ更新/,
	/配布中の v\d/,
	/Desktop 版では次回の更新/,
	/次回の更新で追加/,
	/このページ冒頭の注記/,
]

const readChapter = (name) => readFileSync(join(DOCS_DIR, name), 'utf8')

/** Desktop 版の章 (`NN-*.html`)。Web 版 (`web.html`) は別の製品面なので含めない。 */
const DESKTOP_CHAPTERS = readdirSync(DOCS_DIR).filter((f) => /^\d{2}-.+\.html$/.test(f))

/** docs の全章 (Desktop 版の章 + Web 版の `web.html`)。 */
const ALL_CHAPTERS = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.html'))

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<section id="…">` から対応する `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** `<h3 …>見出し</h3>` から次の `<h3` (無ければ節の終わり) までの中身。見つからなければ null。 */
function subsectionOf(sectionHtml, heading) {
	const m = sectionHtml.match(new RegExp(`<h3[^>]*>${heading}</h3>`))
	if (m === null) return null
	const start = m.index + m[0].length
	const next = sectionHtml.indexOf('<h3', start)
	return sectionHtml.slice(start, next < 0 ? undefined : next)
}

/** `<li>` のうち、素の文字列が `prefix` で始まる最初の 1 件の素の文字列。無ければ null。 */
function listItemOf(sectionHtml, prefix) {
	for (const m of sectionHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
		const text = textOf(m[1]).trim()
		if (text.startsWith(prefix)) return text
	}
	return null
}

test('sectionOf / subsectionOf / listItemOf は無い ID・見出し・項目なら null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange
	const html = '<section id="a"><h3 class="x">見出し</h3><ul><li>項目 A: 本文</li></ul></section>'

	// Act / Assert
	assert.equal(sectionOf(html, '存在しない'), null)
	assert.equal(subsectionOf(html, '存在しない見出し'), null)
	assert.equal(listItemOf(html, '項目 B'), null)
	assert.match(subsectionOf(sectionOf(html, 'a'), '見出し'), /本文/)
	assert.equal(listItemOf(html, '項目 A'), '項目 A: 本文')
})

test('Desktop 版の章が 1 つ以上見つかる (読み取り対象が空で緑になるのを防ぐ)', () => {
	assert.ok(DESKTOP_CHAPTERS.includes('01-intro.html'), `章の一覧: ${DESKTOP_CHAPTERS.join(', ')}`)
	assert.ok(DESKTOP_CHAPTERS.length >= 6)
	assert.ok(ALL_CHAPTERS.includes('web.html'), `全章の一覧: ${ALL_CHAPTERS.join(', ')}`)
})

test('stripComments は Liquid / HTML のコメントだけを落とす', () => {
	// Arrange
	const source = 'A{%- comment -%}次回のデスクトップ更新{%- endcomment -%}B<!-- x -->C{% comment %}y{% endcomment %}D'

	// Act / Assert
	assert.equal(stripComments(source), 'ABCD')
})

// ── 01-intro: 版の注記を置かない ───────────────────────────────────

test('01-intro の #about は節見出しから始まり、版の注記が無い', () => {
	// Arrange
	const html = readChapter('01-intro.html')
	const about = sectionOf(stripComments(html), 'about')
	assert.ok(about, '#about の節が無い')

	// Act
	const headingAt = about.indexOf('docs-h2.html')
	const firstParagraphAt = about.indexOf('<p')

	// Assert
	assert.equal(html.indexOf('<section id="about"'), html.indexOf('<section id='), '01-intro の最初の節が #about でない')
	assert.ok(headingAt >= 0, '#about に節見出しが無い')
	assert.ok(firstParagraphAt > headingAt, '#about の見出しより前に段落がある')
	assert.ok(!/role="note"/.test(about), '#about に role="note" の囲みが残っている')
})

test('docs のどの章にも版の断り書きが無い', () => {
	for (const chapter of ALL_CHAPTERS) {
		// Arrange / Act
		const text = textOf(stripComments(readChapter(chapter)))
		const found = PRERELEASE_WORDING.filter((re) => re.test(text)).map(String)

		// Assert
		assert.deepEqual(found, [], `${chapter} に版の断り書きがある: ${found.join(' / ')}`)
	}
})

// ── サイドバーの「他のフォルダ」行 ─────────────────────────────────

test('画面に無い「他のプロジェクトフォルダに N 件」バナーの記述がどの章にも無い', () => {
	for (const chapter of DESKTOP_CHAPTERS) {
		// Arrange / Act
		const text = textOf(readChapter(chapter))

		// Assert
		assert.ok(!text.includes('他のプロジェクトフォルダに'), `${chapter} に画面に無いバナーの文言がある`)
		assert.ok(!/のバナーから「表示する」/.test(text), `${chapter} にバナーの「表示する」の案内が残っている`)
	}
})

test('03-detect のプロジェクトフォルダの説明がサイドバーの「他のフォルダ」行を案内する', () => {
	// Arrange
	const importSection = sectionOf(readChapter('03-detect.html'), 'import')
	assert.ok(importSection, '#import の節が無い')
	const folder = subsectionOf(importSection, 'プロジェクトフォルダ')
	assert.ok(folder, '#import に「プロジェクトフォルダ」の小見出しが無い')

	// Act
	const text = textOf(folder)

	// Assert
	assert.match(text, /サイドバー/, `サイドバーに触れていない: ${text}`)
	assert.match(text, /「他のフォルダ」/, `「他のフォルダ」行の案内が無い: ${text}`)
	assert.match(text, /フォルダとタグは使えません|フォルダやタグ/, `分類できないことを書いていない: ${text}`)
	assert.match(
		text,
		/このプロジェクトフォルダに切り替える/,
		`分類できないときの直し方 (右クリックの切り替え) が無い: ${text}`,
	)
})

test('06-ops のトラブルシューティングも「他のフォルダ」行を案内する', () => {
	// Arrange
	const trouble = sectionOf(readChapter('06-ops.html'), 'trouble')
	assert.ok(trouble, '#trouble の節が無い')

	// Act
	const item = listItemOf(trouble, '検出したのにホーム画面に出てこない場合')

	// Assert
	assert.ok(item, '「検出したのにホーム画面に出てこない場合」の項目が無い')
	assert.match(item, /サイドバーの「他のフォルダ」/, `「他のフォルダ」行の案内が無い: ${item}`)
})

test('サイドバーに無い「最近追加した動画」行をどの章にも書いていない', () => {
	for (const chapter of DESKTOP_CHAPTERS) {
		assert.ok(!readChapter(chapter).includes('最近追加した動画'), `${chapter} に画面に無い行がある`)
	}
})

// ── 無効の機能を書かない ─────────────────────────────────────────

test('アノテーションの語をどの章にも書いていない', () => {
	for (const chapter of DESKTOP_CHAPTERS) {
		// Arrange / Act
		const text = textOf(readChapter(chapter))

		// Assert
		assert.ok(!text.includes('アノテーション'), `${chapter} にアノテーションモードの記述が残っている`)
	}
})

test('05-export の検出漏れの確認は、アノテーション以外の確認手段を残している', () => {
	// Arrange
	const review = sectionOf(readChapter('05-export.html'), 'review')
	assert.ok(review, '#review の節が無い')

	// Act
	const text = textOf(review)

	// Assert — 節自体は外部参照の契約 (LEGACY_DOCS_IDS) なので空にしない
	for (const tool of ['欠落フレームへジャンプ', '空白のみ再生', 'モザイク適用プレビュー', '人物ギャラリー']) {
		assert.ok(text.includes(tool), `#review から「${tool}」が消えている`)
	}
})

// ── プロジェクトの書き出し zip に素材を同梱 ──────────────────────────

test('05-export のエクスポートの説明に、zip にタイムライン素材が入ることが書いてある', () => {
	// Arrange
	const projectIo = sectionOf(readChapter('05-export.html'), 'project-io')
	assert.ok(projectIo, '#project-io の節が無い')
	const exportPart = subsectionOf(projectIo, 'エクスポート')
	assert.ok(exportPart, '#project-io に「エクスポート」の小見出しが無い')

	// Act
	const text = textOf(exportPart)

	// Assert
	assert.match(text, /zip には[^。]*素材/, `zip の中身にタイムライン素材が無い: ${text}`)
})

test('05-export の「編集内容を取り込む」は素材も補うと書いてある (編集だけ届いて素材が無い、を防ぐ)', () => {
	// Arrange
	const projectIo = sectionOf(readChapter('05-export.html'), 'project-io')
	assert.ok(projectIo, '#project-io の節が無い')

	// Act
	const m = projectIo.match(
		/<div class="kv-key">編集内容を取り込む<\/div>\s*<div class="kv-val">([\s\S]*?)<\/div>/,
	)

	// Assert
	assert.ok(m, '「編集内容を取り込む」の行が無い')
	assert.match(textOf(m[1]), /素材/, `素材の扱いに触れていない: ${textOf(m[1])}`)
})

// ── 残り検出可能時間 < 動画の全長なら開始前に止まる ──────────────────

test('03-detect の検出オプションに、残り時間が全長より少ないと開始できないことが書いてある', () => {
	// Arrange
	const options = sectionOf(readChapter('03-detect.html'), 'detect-options')
	assert.ok(options, '#detect-options の節が無い')

	// Act
	const text = textOf(options)

	// Assert
	assert.match(
		text,
		/残りの検出可能時間が動画の全長より少ない/,
		`開始前の停止を書いていない: ${text}`,
	)
	assert.match(text, /プランをご確認ください/, 'アプリが出す文面を引いていない')
})

test('06-ops の「開始」が押せない場合にも、残り時間が全長より少ないケースがある', () => {
	// Arrange
	const trouble = sectionOf(readChapter('06-ops.html'), 'trouble')
	assert.ok(trouble, '#trouble の節が無い')

	// Act
	const item = listItemOf(trouble, '「開始」が押せない場合')

	// Assert
	assert.ok(item, '「「開始」が押せない場合」の項目が無い')
	assert.match(item, /残りの検出可能時間が動画の全長より少ない/, `残りの時間が足りないケースが無い: ${item}`)
})
