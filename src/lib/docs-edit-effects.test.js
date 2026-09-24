// docs 第 4 章「編集」のフェード / トランジションの節を、desktop 2.4.0 の「効果」のパレットからの
// ドラッグ&ドロップ (T-539 / T-540) とクリップごとのフェード (T-535 / T-536) に合わせた内容を固定する
// 回帰テスト (T-544)。
//
//   node --test src/lib/docs-edit-effects.test.js
//
// 守りたい契約 (2026-09-24 のユーザー決定を含む):
//   1. 置く場所はタイムライン: 上部の「効果」のパレットからチップを、継ぎ目 (つなぎ) / ルーラーの先頭・末尾
//      (全体のフェード) / クリップの帯の左端・右端 (クリップのフェード) へドラッグする
//   2. 詳細な値 (秒数・種類) の入力はサイドバーだけ — タイムラインの印 (バッジ / 帯 / ランプ) をクリックすると
//      サイドバーの該当タブが開く
//   3. 置けない所 (空白のある継ぎ目 / トランジションのある端 / 反対側の端) は、何も変えずに理由が出る
//   4. T-536 で撤去した「パネル上部のチップ」を書かない (サイドバーのタブにチップは無い)
//   5. 撮り直した 2 枚 + 新しい edit-effects の 3 枚を 1 回ずつ、実際の絵を説明する alt 付きで参照する
//
// 節 ID (edit-fade / edit-transition) と目次は T-513 の `docs-edit-timeline.test.js` が固定している。
// 読み取りはこのファイル内で完結させる (`docs-edit-timeline.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { extractImages, parseWebpSize } from './docs-check.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Liquid の `{% comment %}` を落とす (表示されない文字列は検査対象外)。 */
const stripComments = (source) => source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<section id="…">` から対応する `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** 定義表 (`.kv-row`) のうち、キーの素の文字列が `key` で始まる行の値の素の文字列。無ければ null。 */
function kvValueOf(sectionHtml, key) {
	const rows = sectionHtml.matchAll(
		/<div class="kv-key">([\s\S]*?)<\/div>\s*<div class="kv-val">([\s\S]*?)<\/div>/g,
	)
	for (const m of rows) {
		if (textOf(m[1]).trim().startsWith(key)) return textOf(m[2]).trim()
	}
	return null
}

/** 語の並びのうち、`text` に含まれないもの。 */
const missingWords = (text, words) => words.filter((w) => !text.includes(w))

const edit = stripComments(read('_includes', 'docs', '04-edit.html'))
const fadeText = textOf(sectionOf(edit, 'edit-fade') ?? '')
const transitionText = textOf(sectionOf(edit, 'edit-transition') ?? '')

// ── 読み取り部品のすり抜け防止 ─────────────────────────────────────────────

test('kvValueOf はキーの前方一致で値の素の文字列を返し、無ければ null', () => {
	// Arrange
	const html =
		'<div class="kv-row"><div class="kv-key">置き方 <kbd>X</kbd></div>\n' +
		'  <div class="kv-val">チップを <b>継ぎ目</b> へ</div></div>'

	// Act / Assert
	assert.equal(kvValueOf(html, '置き方'), 'チップを 継ぎ目 へ')
	assert.equal(kvValueOf(html, '外す'), null)
})

// ── #edit-fade ────────────────────────────────────────────────────────────

test('#edit-fade は「効果」のパレットからチップをドラッグして置くと書いている', () => {
	// Arrange / Act
	const missing = missingWords(fadeText, ['「効果」', 'フェードイン', 'フェードアウト', 'チップ', 'ドラッグ'])

	// Assert
	assert.deepEqual(missing, [], `#edit-fade が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-fade は全体 (ルーラーの両端) とクリップ (帯の左端・右端) の 2 つの落とし先を書いている', () => {
	// Arrange / Act
	const missing = missingWords(fadeText, [
		'ルーラーの先頭',
		'ルーラーの末尾',
		'左端',
		'右端',
		'クリップのフェード',
		'全体のフェード',
	])

	// Assert
	assert.deepEqual(missing, [], `#edit-fade が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-fade はランプのクリックでサイドバーの「フェード」を開き、秒数はそこで入れると書いている', () => {
	// Arrange / Act
	const missing = missingWords(fadeText, ['ランプ', 'クリック', 'サイドバーの「フェード」', '選択中のクリップ', '秒', '外す'])

	// Assert
	assert.deepEqual(missing, [], `#edit-fade が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-fade は置いたときの既定 1 秒と入力の範囲 0〜20 秒を書いている (desktop の DEFAULT_FADE_SECONDS / FADE_MAX_SECONDS)', () => {
	// Arrange / Act / Assert
	assert.match(fadeText, /1 秒/, '置いたときの既定 (1 秒) が書かれていない')
	assert.match(fadeText, /0〜20 秒/, '入力の範囲 (0〜20 秒) が書かれていない')
})

test('#edit-fade はキーボードの経路 (チップで Enter) と、未選択なら全体のフェードになることを書いている', () => {
	// Arrange / Act / Assert
	assert.match(fadeText, /Enter/, 'キーボードの経路が書かれていない')
	assert.match(fadeText, /選んでいなければ全体/, '未選択のときの行き先 (全体のフェード) が書かれていない')
})

test('#edit-fade は置けない所 (反対側の端 / トランジションのある端) で何も変えずに理由が出ると書いている', () => {
	// Arrange
	const value = kvValueOf(sectionOf(edit, 'edit-fade') ?? '', '置けない所')

	// Act
	const missing = value === null ? ['(行が無い)'] : missingWords(value, ['末尾側', 'トランジション', '理由', '外すと'])

	// Assert
	assert.deepEqual(missing, [], `「置けない所」の行が触れていない語: ${missing.join(' / ')}`)
})

// ── #edit-transition ──────────────────────────────────────────────────────

test('#edit-transition は「効果」の「つなぎ」のチップを継ぎ目のバッジへドラッグすると書いている', () => {
	// Arrange
	const value = kvValueOf(sectionOf(edit, 'edit-transition') ?? '', '置き方')

	// Act
	const missing =
		value === null ? ['(行が無い)'] : missingWords(value, ['「効果」', '「つなぎ」', 'チップ', '継ぎ目', 'バッジ', 'ドラッグ', '0.5 秒', '斜線の帯'])

	// Assert
	assert.deepEqual(missing, [], `「置き方」の行が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-transition はバッジ / 帯のクリックでサイドバーの「つなぎ」が開き、種類と長さはそこで選ぶと書いている', () => {
	// Arrange / Act
	const missing = missingWords(transitionText, ['クリック', 'サイドバーの「つなぎ」', '0.1〜5 秒', 'なし'])

	// Assert
	assert.deepEqual(missing, [], `#edit-transition が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-transition は T-536 で撤去した「パネル上部のチップ」を書いていない', () => {
	// Arrange / Act / Assert
	assert.doesNotMatch(transitionText, /パネル上部のチップ/, '撤去済みのパネルのチップが残っている')
})

test('#edit-transition は空白のある継ぎ目に置けず、空白を自動で詰めないと書いている', () => {
	// Arrange
	const value = kvValueOf(sectionOf(edit, 'edit-transition') ?? '', '空白のある継ぎ目')

	// Act
	const missing = value === null ? ['(行が無い)'] : missingWords(value, ['置けません', '理由', '自動では詰めません'])

	// Assert
	assert.deepEqual(missing, [], `「空白のある継ぎ目」の行が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-transition はキーボードの経路とプレビューの合成を書いている', () => {
	// Arrange / Act / Assert
	assert.match(transitionText, /Enter/, 'キーボードの経路が書かれていない')
	assert.ok(kvValueOf(sectionOf(edit, 'edit-transition') ?? '', 'プレビュー'), '「プレビュー」の行が無い')
})

// ── 他の節の導線 ───────────────────────────────────────────────────────────

test('#timeline-edit の「継ぎ目」の行は「効果」のチップとサイドバーの導線を書いている (旧: パネルのチップ)', () => {
	// Arrange
	const value = kvValueOf(sectionOf(edit, 'timeline-edit') ?? '', '継ぎ目')

	// Act
	const missing = value === null ? ['(行が無い)'] : missingWords(value, ['「効果」', 'サイドバー', '「つなぎ」', 'トランジション'])

	// Assert
	assert.deepEqual(missing, [], `「継ぎ目」の行が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-sidebar の「フェード」の行はクリップごとのフェードにも触れている', () => {
	// Arrange (キーはアイコンの include から始まるので、前方一致ではなく「フェード」を含む行を探す)
	const rows = (sectionOf(edit, 'edit-sidebar') ?? '').matchAll(
		/<div class="kv-key">([\s\S]*?)<\/div>\s*<div class="kv-val">([\s\S]*?)<\/div>/g,
	)

	// Act
	const row = [...rows].find((m) => textOf(m[1]).trim().endsWith('フェード'))

	// Assert
	assert.ok(row, '#edit-sidebar に「フェード」の行が無い')
	assert.match(textOf(row[2]), /クリップ/, `「フェード」の行がクリップのフェードに触れていない: ${textOf(row[2])}`)
})

// ── 画像 (T-542 の撮影) ────────────────────────────────────────────────────

/** [画像, 載せる節, alt が触れるべき語 (実際の絵を説明している)]。 */
const EFFECT_SCREENSHOTS = [
	['/assets/img/screenshots/edit-effects.webp', 'edit-fade', ['「効果」', 'チップ', 'ランプ', '帯']],
	['/assets/img/screenshots/edit-fade.webp', 'edit-fade', ['ランプ', 'サイドバーの「フェード」', '選択中のクリップ']],
	['/assets/img/screenshots/edit-transition.webp', 'edit-transition', ['継ぎ目', '帯', 'サイドバーの「つなぎ」']],
]

for (const [src, sectionId, words] of EFFECT_SCREENSHOTS) {
	test(`${src} を #${sectionId} で 1 回だけ、絵を説明する alt と width / height 付きで参照している`, () => {
		// Arrange
		const inPage = extractImages(edit).filter((img) => img.src === src)
		const inSection = extractImages(sectionOf(edit, sectionId) ?? '').filter((img) => img.src === src)

		// Act
		const [img] = inSection
		const missing = img?.alt ? missingWords(img.alt, words) : ['(alt が無い)']

		// Assert
		assert.equal(inPage.length, 1, `${src} の参照が ${inPage.length} 回`)
		assert.equal(inSection.length, 1, `${src} が #${sectionId} に無い`)
		assert.ok(img.width && img.height, `${src} に width / height が無い`)
		assert.deepEqual(missing, [], `${src} の alt が触れていない語: ${missing.join(' / ')}`)
	})

	test(`${src} の実ファイルがあり、寸法が <img> の width / height と一致する`, () => {
		// Arrange
		const file = join(ROOT, src.replace(/^\//, ''))
		const [img] = extractImages(edit).filter((i) => i.src === src)

		// Act
		const size = existsSync(file) ? parseWebpSize(readFileSync(file)) : null

		// Assert
		assert.ok(size, `${src} が無いか WebP として読めない`)
		assert.deepEqual({ width: img?.width, height: img?.height }, size)
	})
}

test('撤去済みのパネルのチップを写した旧 alt (「トランジションパネルのチップ」) が残っていない', () => {
	// Arrange / Act
	const alts = extractImages(edit).map((img) => img.alt ?? '')

	// Assert
	assert.ok(!alts.some((alt) => alt.includes('トランジションパネルのチップ')), '旧 alt が残っている')
})
