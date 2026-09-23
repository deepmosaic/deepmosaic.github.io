// docs 第 4 章「編集」(`_includes/docs/04-edit.html`) にタイムライン編集を書き足したことと、
// キーボードショートカット表が desktop の単一情報源と 1:1 であることを固定する回帰テスト (T-513)。
//
//   node --test src/lib/docs-edit-timeline.test.js
//
// 守りたい契約:
//   1. 目次 (`_data/docs_toc.yml` の desktop) は**追加のみ** — T-513 より前の節 ID (契約の 20 個を含む) は
//      1 つも消えず、新しい 8 個 (NEW_SECTIONS) が目次と本文の両方にある
//   2. ショートカット表 (`#shortcuts`) の行は desktop `src/lib/edit-shortcuts.ts` の `EDIT_SHORTCUTS` から
//      無効化済みの 1 群 (owner / group が annotation の 9 個) を除いた 47 個と、ID・分類・キーが並び順まで一致する
//      (下の EDIT_SHORTCUTS_FIXTURE が写し。desktop 側の割当を変えたら、ここと表を同時に直す)
//   3. タイムライン編集の各機能 (CHANGELOG T-513 の列挙) に本文が触れている
//   4. T-496 で撮る新しいスクリーンショット 8 枚 (NEW_SCREENSHOTS) を参照している
//      (撮影前は `scripts/check-docs.mjs` がこの 8 枚だけを「画像ファイルが無い」と報告する)
//
// 読み取りはこのファイル内で完結させる (`docs-web-refresh.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { LEGACY_DOCS_IDS, extractImages, parseTocIds } from './docs-check.js'

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

/**
 * キーの欄の表記をキーの並びに戻す。`/` と空白は「どれか」、`+` は「同時押し」の区切り
 * (`+` そのもののキーは単独の `+` として残す)。desktop の `keys` 配列と同じ平たい並びになる。
 *   `Ctrl+Shift+K` → [Ctrl, Shift, K] / `+ / =` → [+, =] / `J / K / L` → [J, K, L]
 */
function keyTokens(cellHtml) {
	const tokens = []
	for (const part of textOf(cellHtml).trim().split(/\s*\/\s*|\s+/)) {
		if (part === '') continue
		if (part === '+') tokens.push('+')
		else tokens.push(...part.split('+').filter((k) => k !== ''))
	}
	return tokens
}

/**
 * ショートカット表の行を `{ id, group, keys }` にする。分類の欄は `rowspan` で束ねるので、
 * 束ねた数を超えて続く行は分類を `null` にする (rowspan の数え間違いで表が崩れるのを検出する)。
 */
function shortcutRows(sectionHtml) {
	const rows = []
	let group = null
	let remaining = 0
	for (const row of sectionHtml.matchAll(/<tr data-shortcut="([^"]+)">([\s\S]*?)<\/tr>/g)) {
		const cells = [...row[2].matchAll(/<td(?:\s+rowspan="(\d+)")?[^>]*>([\s\S]*?)<\/td>/g)]
		if (cells.length === 3) {
			group = textOf(cells[0][2]).trim()
			remaining = Number(cells[0][1] ?? 1)
		}
		const keysCell = cells.length === 3 ? cells[1] : cells[0]
		remaining -= 1
		rows.push({ id: row[1], group: remaining >= 0 ? group : null, keys: keysCell ? keyTokens(keysCell[2]) : [] })
	}
	return rows
}

// ── desktop の単一情報源の写し ─────────────────────────────────────────────
//
// 写し元: desktop リポ `src/lib/edit-shortcuts.ts` の `EDIT_SHORTCUTS` (desktop 04b4cff 時点、56 個)。
// 並びもそのまま。group が 'アノテーション' の 9 個 (annotation_ok … annotation_close) は機能が
// 無効化されている (T-246) ので docs に載せない = ここにも写さない。
// 形: [id, group, keys] (keys は `ShortcutDef.keys` そのまま)。
const EDIT_SHORTCUTS_FIXTURE = [
	['play_pause', '再生', ['Space']],
	['jkl_transport', '再生', ['J', 'K', 'L']],
	['mute_toggle', '再生', ['V']],
	['speed_down', '再生', [',']],
	['speed_up', '再生', ['.']],
	['blank_only_toggle', '再生', ['B']],
	['step_fwd', 'フレーム移動', ['→']],
	['step_back', 'フレーム移動', ['←']],
	['go_start', 'フレーム移動', ['Home']],
	['go_end', 'フレーム移動', ['End']],
	['jump_prev_empty', 'フレーム移動', ['[']],
	['jump_next_empty', 'フレーム移動', [']']],
	['frame_zoom_in', 'ズーム・表示', ['+', '=']],
	['frame_zoom_out', 'ズーム・表示', ['-']],
	['frame_zoom_reset', 'ズーム・表示', ['0']],
	['hud_toggle', 'ズーム・表示', ['H']],
	['preview_mode_toggle', 'ズーム・表示', ['M']],
	['class_menu_toggle', 'ズーム・表示', ['C']],
	['bbox_add_single', 'BBox 編集', ['1']],
	['bbox_add_persistent', 'BBox 編集', ['2']],
	['delete_bbox', 'BBox 編集', ['Delete']],
	['undo_frame', 'BBox 編集', ['Ctrl', 'Z']],
	['mosaic_panel_open', 'ツール', ['G']],
	['scene_split', 'ツール', ['Ctrl', 'K']],
	['timeline_clip_split', 'タイムライン', ['Ctrl', 'Shift', 'K']],
	['timeline_clip_delete', 'タイムライン', ['Backspace']],
	['timeline_undo', 'タイムライン', ['Ctrl', 'Shift', 'Z']],
	['timeline_redo', 'タイムライン', ['Ctrl', 'Shift', 'Y']],
	['timeline_nudge_back', 'タイムライン', ['Ctrl', '←']],
	['timeline_nudge_fwd', 'タイムライン', ['Ctrl', '→']],
	['timeline_duplicate', 'タイムライン', ['Ctrl', 'D']],
	['timeline_copy', 'タイムライン', ['Ctrl', 'C']],
	['timeline_paste', 'タイムライン', ['Ctrl', 'V']],
	['timeline_delete', 'タイムライン', ['Delete']],
	['person_gallery_toggle', 'ページ', ['P']],
	['media_panel_toggle', 'ページ', ['A']],
	['timeline_panel_toggle', 'ページ', ['T']],
	['timeline_collapse_toggle', 'ページ', ['Ctrl', 'Shift', 'T']],
	['encode_dialog_open', 'ページ', ['Ctrl', 'Enter']],
	['open_folder', 'ページ', ['Ctrl', 'Shift', 'O']],
	['premiere_send', 'ページ', ['Ctrl', 'Shift', 'P']],
	['mouse_wheel_step', 'マウス', ['ホイール']],
	['mouse_wheel_zoom', 'マウス', ['Ctrl', 'ホイール']],
	['mouse_pan', 'マウス', ['中ボタンドラッグ']],
	['mouse_dblclick_delete', 'マウス', ['ダブルクリック']],
	['mouse_context_menu', 'マウス', ['右クリック']],
	['mouse_eraser', 'マウス', ['右ドラッグ']],
].map(([id, group, keys]) => ({ id, group, keys }))

/** 表の行数 (= 写しの数)。desktop の 56 個 − 無効化済みの 9 個。 */
const SHORTCUT_ROW_COUNT = 47

/** T-513 で足した節。/docs/#… の深いリンクになるので、変えるときは参照元も直す。 */
const NEW_SECTIONS = [
	'edit-sidebar',
	'timeline-edit',
	'edit-media',
	'edit-text',
	'edit-watermark',
	'edit-audio',
	'edit-fade',
	'edit-transition',
]

/** T-513 より前の desktop 目次の ID (契約の 20 個を含む)。追加のみで、1 つも消さない。 */
const PRE_T513_TOC_IDS = [
	'about', 'install', 'setup', 'layout', 'theme',
	'license', 'plan', 'account', 'support',
	'import', 'detect-options', 'batch', 'detect', 'queue',
	'edit-overview', 'edit-player', 'edit-zoom', 'edit-bbox', 'edit-scenes', 'edit-toolbar', 'edit-mosaic', 'edit-persons', 'shortcuts',
	'edit-encode', 'timecode', 'encode-progress', 'project-io', 'premiere', 'review',
	'update', 'data', 'uninstall', 'usage', 'spec', 'trouble', 'web',
	'team',
]

/** T-496 で撮る新しいスクリーンショット (T-495 の撮影ハーネスが出すファイル名)。 */
const NEW_SCREENSHOTS = [
	'/assets/img/screenshots/edit-sidebar-media.webp',
	'/assets/img/screenshots/edit-timeline-clips.webp',
	'/assets/img/screenshots/edit-timeline-menu.webp',
	'/assets/img/screenshots/edit-text.webp',
	'/assets/img/screenshots/edit-watermark.webp',
	'/assets/img/screenshots/edit-audio.webp',
	'/assets/img/screenshots/edit-fade.webp',
	'/assets/img/screenshots/edit-transition.webp',
]

const edit = stripComments(read('_includes', 'docs', '04-edit.html'))
const desktopToc = parseTocIds(read('_data', 'docs_toc.yml')).desktop ?? []

// ── 読み取り部品のすり抜け防止 ─────────────────────────────────────────────

test('keyTokens は同時押し (+) と「どれか」(/) を desktop の keys と同じ平たい並びにする', () => {
	// Arrange / Act / Assert
	assert.deepEqual(keyTokens('<kbd>Ctrl+Shift+K</kbd>'), ['Ctrl', 'Shift', 'K'])
	assert.deepEqual(keyTokens('<kbd>+</kbd> / <kbd>=</kbd>'), ['+', '='])
	assert.deepEqual(keyTokens('<kbd>J</kbd> / <kbd>K</kbd> / <kbd>L</kbd>'), ['J', 'K', 'L'])
	assert.deepEqual(keyTokens('<kbd>Ctrl</kbd>+ホイール'), ['Ctrl', 'ホイール'])
	assert.deepEqual(keyTokens('<kbd>-</kbd>'), ['-'])
})

test('shortcutRows は rowspan を超えて続く行の分類を null にする (表の崩れを見逃さない)', () => {
	// Arrange
	const html =
		'<tr data-shortcut="a"><td rowspan="1">再生</td><td><kbd>V</kbd></td><td>x</td></tr>' +
		'<tr data-shortcut="b"><td><kbd>B</kbd></td><td>y</td></tr>'

	// Act
	const rows = shortcutRows(html)

	// Assert
	assert.deepEqual(rows, [
		{ id: 'a', group: '再生', keys: ['V'] },
		{ id: 'b', group: null, keys: ['B'] },
	])
})

test('写しは 47 個で、ID の重複も無効化済みの群も無い', () => {
	// Arrange
	const ids = EDIT_SHORTCUTS_FIXTURE.map((s) => s.id)

	// Act / Assert
	assert.equal(EDIT_SHORTCUTS_FIXTURE.length, SHORTCUT_ROW_COUNT)
	assert.equal(new Set(ids).size, ids.length, '写しに重複した ID がある')
	assert.ok(!ids.some((id) => id.startsWith('annotation_')), '無効化済みの annotation_* が写しに混ざっている')
	assert.ok(!EDIT_SHORTCUTS_FIXTURE.some((s) => s.group === 'アノテーション'), '無効化済みの分類が写しに混ざっている')
})

// ── 目次 (追加のみ) ────────────────────────────────────────────────────────

test('目次は追加のみ — T-513 より前の ID (契約の 20 個を含む) が 1 つも消えていない', () => {
	// Arrange
	const required = [...new Set([...PRE_T513_TOC_IDS, ...LEGACY_DOCS_IDS])]

	// Act
	const missing = required.filter((id) => !desktopToc.includes(id))

	// Assert
	assert.ok(desktopToc.length > 0, 'desktop の目次が読めない')
	assert.deepEqual(missing, [], `目次から消えた ID: ${missing.join(', ')}`)
})

for (const id of NEW_SECTIONS) {
	test(`#${id} の節が 04-edit の本文と目次の両方にある`, () => {
		// Arrange / Act / Assert
		assert.ok(sectionOf(edit, id), `04-edit.html に <section id="${id}"> が無い`)
		assert.ok(desktopToc.includes(id), `docs_toc.yml の desktop に ${id} が無い`)
	})
}

test('新しい節は目次でも本文でも同じ順に並ぶ (目次の現在位置表示が前後しない)', () => {
	// Arrange
	const inBody = NEW_SECTIONS.map((id) => edit.indexOf(`<section id="${id}"`))
	const inToc = NEW_SECTIONS.map((id) => desktopToc.indexOf(id))

	// Act
	const sorted = (xs) => [...xs].sort((a, b) => a - b)

	// Assert (見つからない節があると全部 -1 で「並んでいる」ことになるので先に止める)
	assert.ok(inBody.every((i) => i >= 0), `04-edit.html に無い節がある: ${inBody.join(', ')}`)
	assert.ok(inToc.every((i) => i >= 0), `目次に無い節がある: ${inToc.join(', ')}`)
	assert.deepEqual(inBody, sorted(inBody), '04-edit.html の節の順が NEW_SECTIONS と違う')
	assert.deepEqual(inToc, sorted(inToc), '目次の順が NEW_SECTIONS と違う')
})

// ── ショートカット表 (desktop edit-shortcuts.ts と 1:1) ─────────────────────

test(`ショートカット表は ${SHORTCUT_ROW_COUNT} 行で、すべての行が data-shortcut を持つ`, () => {
	// Arrange
	const section = sectionOf(edit, 'shortcuts')
	assert.ok(section, '#shortcuts が無い')
	const tbody = section.match(/<tbody>([\s\S]*?)<\/tbody>/)
	assert.ok(tbody, '#shortcuts に <tbody> が無い')

	// Act
	const allRows = tbody[1].match(/<tr\b/g) ?? []
	const idRows = shortcutRows(tbody[1])

	// Assert
	assert.equal(allRows.length, SHORTCUT_ROW_COUNT, `<tr> の数: ${allRows.length}`)
	assert.equal(idRows.length, allRows.length, 'data-shortcut の無い行がある')
})

test('ショートカット表の ID・分類・キーが desktop の写しと並び順まで一致する', () => {
	// Arrange
	const section = sectionOf(edit, 'shortcuts') ?? ''

	// Act
	const rows = shortcutRows(section)

	// Assert
	assert.deepEqual(rows, EDIT_SHORTCUTS_FIXTURE)
})

test('ショートカットの節は Delete の効き先 (最後に操作した場所) を説明している', () => {
	// Arrange
	const text = textOf(sectionOf(edit, 'shortcuts') ?? '')

	// Act / Assert
	assert.match(text, /最後に(操作|触)/, `Delete の効き先が書かれていない: ${text.slice(0, 200)}`)
})

// ── タイムライン編集の各機能 (CHANGELOG T-513 の列挙) ────────────────────────

/** [節 ID, その節が触れるべき語]。語は画面の表記 (desktop の UI 文言) に合わせる。 */
const FEATURE_WORDS = [
	['edit-sidebar', ['メディア', 'テキスト', '透かし', '音声', 'フェード', 'トランジション', 'ドロワー', '幅', 'ダブルクリック']],
	['timeline-edit', ['トリム', '分割', '削除', '並べ替え', '空白', 'フィルムストリップ', '履歴', '右クリック', '複製', 'コピー', 'ペースト', '高さ', '折りたた']],
	['edit-media', ['動画', '音声', '画像', 'タイムラインに追加', '透かしに設定', '5 秒', 'モザイク']],
	['edit-text', ['ゴシック', '游ゴシック', '明朝', 'MS ゴシック', 'BIZ UDゴシック', '太字', 'テキストレーン', 'ドラッグ']],
	['edit-watermark', ['画像', '位置', '大きさ', '不透明度', '余白']],
	['edit-audio', ['BGM', '波形', '音量', 'ミュート', 'フェードイン', 'フェードアウト']],
	['edit-fade', ['フェードイン', 'フェードアウト', '先頭へ', '末尾へ']],
	['edit-transition', ['ディゾルブ', 'ワイプ', 'スライド', '黒フェード', '白フェード', '継ぎ目']],
	['edit-player', ['消しゴム', '✕', 'この ID をすべて削除']],
	['edit-overview', ['ツールチップ', 'サイドバー']],
]

for (const [id, words] of FEATURE_WORDS) {
	test(`#${id} は ${words.join(' / ')} に触れている`, () => {
		// Arrange
		const section = sectionOf(edit, id)
		assert.ok(section, `#${id} が無い`)
		const text = textOf(section)

		// Act
		const missing = words.filter((w) => !text.includes(w))

		// Assert
		assert.deepEqual(missing, [], `#${id} が触れていない語: ${missing.join(' / ')}`)
	})
}

test('テキストのフォントは 5 種類と書いてある (desktop TEXT_FONT_FAMILIES と同数)', () => {
	// Arrange
	const text = textOf(sectionOf(edit, 'edit-text') ?? '')

	// Act / Assert
	assert.match(text, /5 種類/, `フォントの数が書かれていない: ${text.slice(0, 200)}`)
})

test('取り込んだ素材には AI 検出のモザイクがかからないと断ってある', () => {
	// Arrange
	const text = textOf(sectionOf(edit, 'edit-media') ?? '')

	// Act / Assert
	assert.match(text, /検出の対象外/, `素材が検出の対象外であることが書かれていない: ${text.slice(0, 200)}`)
})

// ── 新しいスクリーンショット (T-496 で到着) ──────────────────────────────────

test('T-496 で撮る 8 枚をそれぞれ 1 回ずつ、alt と width / height 付きで参照している', () => {
	// Arrange
	const images = extractImages(edit)

	// Act
	const problems = NEW_SCREENSHOTS.flatMap((src) => {
		const hits = images.filter((img) => img.src === src)
		if (hits.length !== 1) return [`${src} の参照が ${hits.length} 回`]
		const [img] = hits
		return img.alt && img.width && img.height ? [] : [`${src} に alt / width / height が揃っていない`]
	})

	// Assert
	assert.deepEqual(problems, [])
})
