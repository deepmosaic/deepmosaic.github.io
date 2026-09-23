// docs (Desktop) 01 / 03 / 05 / 06 章を次回のデスクトップ更新 (v2.4) の実装に合わせた内容を
// 固定する回帰テスト (T-509)。
//
//   node --test src/lib/docs-desktop-refresh.test.js
//
// 2026-09-23 のユーザー決定で **docs を desktop のリリースより先に公開する**。そのため:
//
//   - 01-intro の冒頭 (#about の中、見出しより前) に「先取り」の注記を置く。アプリ内ヘルプは
//     `/docs#about` へ深いリンクで来るので、節の外に置くと注記を飛ばして読まれる。
//     注記は desktop のリリース時に T-515 で外す — そのときはこのテストも合わせて直す。
//   - 撤去済みの HOME の「他のプロジェクトフォルダに N 件」バナー (T-411) の説明を、サイドバーの
//     「他のフォルダ」行 (フォルダ・タグで分類できない) に置き換える。
//   - 無効化済みのアノテーションモード (T-246、`ANNOTATION_MODE_ENABLED=false`) を書かない
//     (CLAUDE.md「未実装・無効の機能は書かない」)。
//   - プロジェクトの書き出し zip にタイムライン素材が入ること (T-266)。
//   - 残り検出可能時間が動画の全長より少ないと、検出は開始前に止まること (T-277)。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '_includes', 'docs')

/** 01-intro 冒頭の先取り注記 (ユーザー指定の文面、T-515 で外す)。 */
const PRERELEASE_NOTE =
	'本ドキュメントは次回のデスクトップ更新 (v2.4) の内容です。配布中の v2.3.7 では一部の機能と表記が異なります。'

const readChapter = (name) => readFileSync(join(DOCS_DIR, name), 'utf8')

/** Desktop 版の章 (`NN-*.html`)。Web 版 (`web.html`) は別の製品面なので含めない。 */
const DESKTOP_CHAPTERS = readdirSync(DOCS_DIR).filter((f) => /^\d{2}-.+\.html$/.test(f))

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
})

// ── 01-intro: 先取り注記 ────────────────────────────────────────────────────

test('01-intro の #about の冒頭 (見出しより前) に先取り注記がある', () => {
	// Arrange
	const about = sectionOf(readChapter('01-intro.html'), 'about')
	assert.ok(about, '#about の節が無い')

	// Act
	const noteAt = about.indexOf(PRERELEASE_NOTE)
	const headingAt = about.indexOf('docs-h2.html')

	// Assert
	assert.ok(noteAt >= 0, `先取り注記の文面が #about に無い (文面はユーザー指定: ${PRERELEASE_NOTE})`)
	assert.ok(headingAt >= 0, '#about に節見出しが無い')
	assert.ok(noteAt < headingAt, '注記が見出しより後ろにある (冒頭に置く)')
})

test('先取り注記は role="note" の囲みで、01-intro の最初の節の中にある', () => {
	// Arrange
	const html = readChapter('01-intro.html')

	// Act
	const firstSection = html.indexOf('<section id=')
	const noteBox = html.match(/<(?:div|p|aside)[^>]*role="note"[^>]*>([\s\S]*?)<\/(?:div|p|aside)>/)

	// Assert
	assert.equal(html.indexOf('<section id="about"'), firstSection, '01-intro の最初の節が #about でない')
	assert.ok(noteBox, 'role="note" の囲みが無い')
	assert.ok(textOf(noteBox[1]).includes(PRERELEASE_NOTE), '注記の囲みに文面が入っていない')
})

// ── 撤去済みのバナー → サイドバーの「他のフォルダ」行 (T-411) ───────────────

test('撤去済みの「他のプロジェクトフォルダに N 件」バナーの記述がどの章にも残っていない', () => {
	for (const chapter of DESKTOP_CHAPTERS) {
		// Arrange / Act
		const text = textOf(readChapter(chapter))

		// Assert
		assert.ok(!text.includes('他のプロジェクトフォルダに'), `${chapter} に撤去済みバナーの文言が残っている`)
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

test('廃止したサイドバーの「最近追加した動画」行をどの章にも書いていない', () => {
	for (const chapter of DESKTOP_CHAPTERS) {
		assert.ok(!readChapter(chapter).includes('最近追加した動画'), `${chapter} に廃止した行が残っている`)
	}
})

// ── 無効化済みのアノテーションモード (T-246) ─────────────────────────────────

test('無効化済みのアノテーションモードをどの章にも書いていない', () => {
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

// ── プロジェクトの書き出し zip に素材を同梱 (T-266) ──────────────────────────

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

// ── 残り検出可能時間 < 動画の全長なら開始前に止まる (T-277) ──────────────────

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
		`T-277 の開始前の停止を書いていない: ${text}`,
	)
	assert.match(text, /プランをご確認ください/, 'アプリが出す文面 (T-277) を引いていない')
})

test('06-ops の「開始」が押せない場合にも、残り時間が全長より少ないケースがある', () => {
	// Arrange
	const trouble = sectionOf(readChapter('06-ops.html'), 'trouble')
	assert.ok(trouble, '#trouble の節が無い')

	// Act
	const item = listItemOf(trouble, '「開始」が押せない場合')

	// Assert
	assert.ok(item, '「「開始」が押せない場合」の項目が無い')
	assert.match(item, /残りの検出可能時間が動画の全長より少ない/, `T-277 のケースが無い: ${item}`)
})
