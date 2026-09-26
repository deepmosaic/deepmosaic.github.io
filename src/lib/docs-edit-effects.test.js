// docs 第 4 章「編集」のフェード / トランジションの節を、desktop の「継ぎ目のはさみ → フェード / つなぎ →
// サイドバー」の導線 (T-630 / T-631、「効果」のパレット T-539 は T-634 で撤去) に合わせた内容を固定する
// 回帰テスト (T-637。T-544 の DnD 版を書き直した)。
//
//   node --test src/lib/docs-edit-effects.test.js
//
// 守りたい契約 (2026-09-24 / 2026-09-26 のユーザー決定を含む):
//   1. 導線: 継ぎ目の「はさみ」を押すと「フェード」「つなぎ」を選ぶメニューが開き、選ぶとサイドバーの
//      該当タブがその継ぎ目にフォーカスして開く (#edit-fade / #edit-transition / #timeline-edit)
//   2. 撤去した「効果」のパレットとチップのドラッグを書かない (本文・alt・figcaption のすべて)
//   3. 詳細な値 (秒数・種類) の入力はサイドバーだけ — タイムラインの上では入力しない
//   4. つなぎのある辺にはクリップのフェードを、空白のある継ぎ目にはつなぎを、理由付きで置けない
//   5. 画像は edit-join-menu / edit-fade / edit-transition の 3 枚を 1 回ずつ、絵を説明する alt 付きで参照し、
//      撤去したパレットを写した edit-effects を参照しない
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

/** 語の並びのうち、`text` に含まれるもの。 */
const presentWords = (text, words) => words.filter((w) => text.includes(w))

const edit = stripComments(read('_includes', 'docs', '04-edit.html'))
const fadeHtml = sectionOf(edit, 'edit-fade') ?? ''
const transitionHtml = sectionOf(edit, 'edit-transition') ?? ''
const fadeText = textOf(fadeHtml)
const transitionText = textOf(transitionHtml)

/** 撤去した導線の語 (T-634 でパレットごと撤去)。 */
const REMOVED_WORDS = ['「効果」のパレット', 'チップ', 'ドラッグして置']

/** 本文と、img の alt / figcaption (タグを落とすと消える alt も含める) をまとめた検査対象。 */
function shownTextOf(html) {
	const alts = extractImages(html).map((img) => img.alt ?? '')
	return [textOf(html), ...alts].join(' ')
}

// ── 読み取り部品のすり抜け防止 ─────────────────────────────────────────────

test('kvValueOf はキーの前方一致で値の素の文字列を返し、無ければ null', () => {
	// Arrange
	const html =
		'<div class="kv-row"><div class="kv-key">選び方 <kbd>X</kbd></div>\n' +
		'  <div class="kv-val">はさみを <b>押す</b></div></div>'

	// Act / Assert
	assert.equal(kvValueOf(html, '選び方'), 'はさみを 押す')
	assert.equal(kvValueOf(html, '外す'), null)
})

test('shownTextOf は本文に出ない alt の文字列も検査対象に含める', () => {
	// Arrange
	const html = '<p>本文</p><img src="/a.webp" alt="チップの絵" width="1" height="1">'

	// Act / Assert
	assert.match(shownTextOf(html), /チップの絵/)
})

// ── 1. 導線 (はさみ → フェード / つなぎ → サイドバー) ─────────────────────────

test('#edit-fade は継ぎ目のはさみ → 「フェード」→ サイドバーの導線を書いている', () => {
	// Arrange / Act
	const missing = missingWords(fadeText, ['はさみ', '「フェード」', '「つなぎ」', 'サイドバーの「フェード」', '継ぎ目'])

	// Assert
	assert.deepEqual(missing, [], `#edit-fade が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-fade は全体のフェードとクリップのフェードの入れ方 (サイドバーの節) を書いている', () => {
	// Arrange / Act
	const missing = missingWords(fadeText, ['全体のフェード', 'クリップのフェード', '選択中のクリップ', '選択中の継ぎ目', 'ランプ', '0〜20 秒'])

	// Assert
	assert.deepEqual(missing, [], `#edit-fade が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-transition は継ぎ目のはさみ → 「つなぎ」→ サイドバーの導線と、帯のクリックでも開くことを書いている', () => {
	// Arrange / Act
	const missing = missingWords(transitionText, ['はさみ', '「つなぎ」', 'サイドバーの「つなぎ」', '帯', 'クリック', '0.1〜5 秒', 'なし'])

	// Assert
	assert.deepEqual(missing, [], `#edit-transition が触れていない語: ${missing.join(' / ')}`)
})

test('#timeline-edit の「継ぎ目」の行は、はさみのメニューからサイドバーのタブが開くと書いている', () => {
	// Arrange
	const value = kvValueOf(sectionOf(edit, 'timeline-edit') ?? '', '継ぎ目')

	// Act
	const missing = value === null ? ['(行が無い)'] : missingWords(value, ['「フェード」', '「つなぎ」', 'メニュー', 'サイドバー', 'トランジション'])

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

// ── 2. 撤去した導線 (「効果」のパレット / チップのドラッグ) ───────────────────

test('タイムラインの節に「効果」のパレットとチップのドラッグの記述が残っていない (本文・alt・figcaption)', () => {
	// Arrange (#edit-overview は「ツールチップ」や枠のラベルの「チップ」を正しく含むので、タイムラインの行だけを見る)
	const overviewTimeline = kvValueOf(sectionOf(edit, 'edit-overview') ?? '', 'タイムライン') ?? ''
	const targets = [
		['edit-overview の「タイムライン」の行', overviewTimeline],
		...['timeline-edit', 'edit-fade', 'edit-transition'].map((id) => [`#${id}`, shownTextOf(sectionOf(edit, id) ?? '')]),
	]

	// Act
	const leftovers = targets.flatMap(([label, text]) => presentWords(text, REMOVED_WORDS).map((w) => `${label}: ${w}`))

	// Assert
	assert.deepEqual(leftovers, [], `撤去した導線の記述が残っている: ${leftovers.join(' / ')}`)
})

// ── 3. 値の入力はサイドバーだけ ─────────────────────────────────────────────

test('#edit-fade / #edit-transition は、値の入力がサイドバーだけでタイムラインの上では入力しないと書いている', () => {
	// Arrange / Act / Assert
	for (const [id, text] of [
		['edit-fade', fadeText],
		['edit-transition', transitionText],
	]) {
		assert.match(text, /タイムラインの上では[^。]*入力しません/, `#${id} がサイドバーだけで入力することを書いていない`)
	}
})

// ── 4. 置けない所 (理由付き) ───────────────────────────────────────────────

test('#edit-fade はつなぎのある辺にクリップのフェードを入れられず、理由が出ると書いている', () => {
	// Arrange
	const value = kvValueOf(fadeHtml, '置けない所')

	// Act
	const missing = value === null ? ['(行が無い)'] : missingWords(value, ['トランジション', '理由', '外すと'])

	// Assert
	assert.deepEqual(missing, [], `「置けない所」の行が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-transition は空白のある継ぎ目に置けず、行に理由が出て、空白を自動で詰めないと書いている', () => {
	// Arrange
	const value = kvValueOf(transitionHtml, '空白のある継ぎ目')

	// Act
	const missing = value === null ? ['(行が無い)'] : missingWords(value, ['置けません', '理由', '自動では詰めません'])

	// Assert
	assert.deepEqual(missing, [], `「空白のある継ぎ目」の行が触れていない語: ${missing.join(' / ')}`)
})

test('#edit-transition はクリップのフェードが書き出しで無視されることと、プレビューの合成を書いている', () => {
	// Arrange / Act / Assert
	assert.match(transitionText, /フェード[^。]*書き出しで無視/, 'つなぎを置いた継ぎ目のクリップのフェードが無視されることが書かれていない')
	assert.ok(kvValueOf(transitionHtml, 'プレビュー'), '「プレビュー」の行が無い')
})

// ── 5. 画像 (T-637 の撮影) ─────────────────────────────────────────────────

/** [画像, 載せる節, alt が触れるべき語 (実際の絵を説明している)]。 */
const EFFECT_SCREENSHOTS = [
	['/assets/img/screenshots/edit-join-menu.webp', 'edit-fade', ['はさみ', '「フェード」', '「つなぎ」', 'メニュー']],
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

	// 撮影 (アプリの起動) はウェーブ末尾にリーダーが 1 回だけ行う。届くまでの新規画像は todo として
	// 失敗を表示し続け (隠さない)、置いた時点で通常の検査になる。
	const file = join(ROOT, src.replace(/^\//, ''))
	const todo = existsSync(file) ? false : `${src} はリーダーの撮影待ち (T-637)`
	test(`${src} の実ファイルがあり、寸法が <img> の width / height と一致する`, { todo }, () => {
		// Arrange
		const [img] = extractImages(edit).filter((i) => i.src === src)

		// Act
		const size = existsSync(file) ? parseWebpSize(readFileSync(file)) : null

		// Assert
		assert.ok(size, `${src} が無いか WebP として読めない`)
		assert.deepEqual({ width: img?.width, height: img?.height }, size)
	})
}

test('撤去したパレットを写した edit-effects を参照せず、実ファイルも残していない', () => {
	// Arrange
	const src = '/assets/img/screenshots/edit-effects.webp'

	// Act
	const refs = extractImages(edit).filter((img) => img.src === src)

	// Assert
	assert.equal(refs.length, 0, `${src} をまだ参照している`)
	assert.ok(!existsSync(join(ROOT, src.replace(/^\//, ''))), `${src} の実ファイルが残っている`)
})
