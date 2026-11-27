// docs が今の画面の項目と文で書かれていることの回帰テスト (3 言語)。
//
//   node --test src/lib/site-copy-docs-current-ui.test.js
//
//   - docs のどこにも「モデルファイル」の語を書かない (画面には出ない語)。
//   - 04-edit #edit-overview: ヘッダーの「マルチウィンドウ」・連動のスイッチのツールチップ・同時の操作がぶつかったときの知らせを書き、
//     複数のウィンドウの小見出しがある。
//   - 04-edit #edit-mosaic: 各タブの「モザイクを掛ける」の行と、クラス別の対象クラスの 4 つの選択肢を書く。
//   - 04-edit #edit-player: 「モザイクを掛ける」をオフにした枠のラベルの注記と、ホイールの向きの設定を書く。
//   - 04-edit #edit-sidebar: 「設定」の行は画面の項目の名前で書き、「配置」は「表示」の中の項目として書かない。
//   - 03-detect #detect-options: 「検出せずに取り込む」のスイッチの位置は「モザイク初期設定」の見出しのすぐ上。
//   - web #diff: 複数のウィンドウは Desktop 版だけで、英中のリンクは同じ言語の docs へ向く。
//
// 読み取りはこのファイル内で完結させる。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** `<section id="…">` から対応する `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const section = (file, id) => {
	const sec = sectionOf(read(file), id)
	assert.ok(sec, `${file} の #${id} 節が見つからない`)
	return sec
}

const ROW_RE =
	/<div class="kv-row(?: kv-alt)?">\s*<div class="kv-key">([\s\S]*?)<\/div>\s*<div class="kv-val">([\s\S]*?)<\/div>\s*<\/div>/g

/** Liquid の include を落とした kv-key の文字列。 */
const keyText = (html) => textOf(html.replace(/\{%[\s\S]*?%\}/g, ''))

/** `kv-key` の文字列が `key` の行の `kv-val` の HTML。無ければ null。 */
const kvRowHtml = (html, key) => [...html.matchAll(ROW_RE)].find((m) => keyText(m[1]) === key)?.[2] ?? null

const DOCS = { ja: '_includes/docs', en: '_includes/docs/en', 'zh-tw': '_includes/docs/zh-tw' }
const LANGS = Object.keys(DOCS)
const docFile = (lang, name) => `${DOCS[lang]}/${name}`

// ---- アプリの画面の文 ----
const MULTI_WINDOW = { ja: 'マルチウィンドウ', en: 'Multi-window', 'zh-tw': '多視窗' }
const FRAME_LINK_HINT = { ja: 'メインウィンドウと連動', en: 'Link with the main window', 'zh-tw': '與主視窗連動' }
const SYNC_CONFLICT = {
	ja: '別のウィンドウの変更と重なったため、直前の操作を取り消しました',
	en: 'Your last change was undone because it overlapped with a change in another window.',
	'zh-tw': '因與其他視窗的變更重疊，已復原上一個操作。',
}
const APPLY_MOSAIC = { ja: 'モザイクを掛ける', en: 'Apply mosaic', 'zh-tw': '套用馬賽克' }
const RESTORE_OFF = { ja: 'すべてオンに戻す', en: 'Turn all back on', 'zh-tw': '全部重新開啟' }
const TARGET_CLASSES = {
	ja: ['局部', '男性顔', '女性顔', '手動で追加したマスク'],
	en: ['Body areas', 'Male face', 'Female face', 'Manually added masks'],
	'zh-tw': ['身體部位', '男性臉部', '女性臉部', '手動新增的遮罩'],
}
const CHIP_MOSAIC_OFF = { ja: '[モザイクオフ]', en: '[mosaic off]', 'zh-tw': '[馬賽克關閉]' }
const WHEEL_DOWN_FORWARD = {
	ja: 'ホイールを下に回すと進む',
	en: 'Step forward when scrolling the wheel down',
	'zh-tw': '滾輪向下捲動時前進',
}
const HUD_LABEL = { ja: '検出オーバーレイを表示', en: 'Show detection overlay', 'zh-tw': '顯示偵測疊加層' }
const CHIP_LABEL = {
	ja: 'BBox のラベル (名前・ID・確率) を表示',
	en: 'Show BBox labels (name, ID, probability)',
	'zh-tw': '顯示 BBox 標籤（名稱、ID、機率）',
}

// ---- docs の行の名前と言い回し ----
const SETTINGS_KEY = { ja: '設定', en: 'Settings', 'zh-tw': '設定' }
const POSITION_KEY = { ja: '配置', en: 'Position', 'zh-tw': '位置' }
const POSITION_UNDER_DISPLAY = { ja: '「表示」の「配置」', en: 'under "Display"', 'zh-tw': '「顯示」中以「位置」' }
const IMPORT_ONLY_SWITCH = {
	ja: '「モザイク初期設定」の見出しのすぐ上のスイッチ',
	en: 'just above the "Default mosaic settings" heading',
	'zh-tw': '「馬賽克初始設定」標題正上方的開關',
}
const IMPORT_ONLY_SWITCH_OLD = {
	ja: '右のパネルの先頭のスイッチ',
	en: 'at the top of the right panel',
	'zh-tw': '右側面板最上方的開關',
}
const MULTI_WINDOWS_KEY = { ja: '複数のウィンドウ', en: 'Multiple windows', 'zh-tw': '多個視窗' }
const DOCS_PREFIX = { ja: '/docs/', en: '/en/docs/', 'zh-tw': '/zh-tw/docs/' }

test('docs のどこにも「モデルファイル」の語が無い (3 言語)', () => {
	// Arrange
	const files = LANGS.flatMap((lang) =>
		readdirSync(join(ROOT, DOCS[lang]))
			.filter((name) => name.endsWith('.html'))
			.map((name) => docFile(lang, name)),
	)
	assert.ok(files.length >= 24, `docs のファイルが少ない: ${files.length}`)

	// Act
	const hits = files.filter((file) => /モデルファイル|model files?|模型檔/i.test(read(file)))

	// Assert
	assert.deepEqual(hits, [])
})

for (const lang of LANGS) {
	test(`04-edit #edit-overview: マルチウィンドウ・連動のツールチップ・衝突の知らせと小見出しがある (${lang})`, () => {
		// Arrange
		const sec = section(docFile(lang, '04-edit.html'), 'edit-overview')

		// Act
		const text = textOf(sec)

		// Assert
		assert.ok(text.includes(MULTI_WINDOW[lang]), `「${MULTI_WINDOW[lang]}」が無い`)
		assert.ok(text.includes(FRAME_LINK_HINT[lang]), `「${FRAME_LINK_HINT[lang]}」が無い`)
		assert.ok(text.includes(SYNC_CONFLICT[lang]), `「${SYNC_CONFLICT[lang]}」が無い`)
		assert.match(sec, /<h3[ >]/, '小見出しが無い')
	})

	test(`04-edit #edit-mosaic: 「モザイクを掛ける」の行と対象クラスの 4 つがある (${lang})`, () => {
		// Arrange
		const sec = section(docFile(lang, '04-edit.html'), 'edit-mosaic')

		// Act
		const row = kvRowHtml(sec, APPLY_MOSAIC[lang])
		const text = textOf(sec)

		// Assert
		assert.ok(row, `kv-key「${APPLY_MOSAIC[lang]}」の行が無い`)
		assert.ok(textOf(row).includes(RESTORE_OFF[lang]), `「${RESTORE_OFF[lang]}」が無い`)
		for (const name of TARGET_CLASSES[lang]) assert.ok(text.includes(name), `対象クラス「${name}」が無い`)
	})

	test(`04-edit #edit-player: [モザイクオフ] とホイールの向きの設定がある (${lang})`, () => {
		// Arrange
		const sec = section(docFile(lang, '04-edit.html'), 'edit-player')

		// Act
		const text = textOf(sec)

		// Assert
		assert.ok(text.includes(CHIP_MOSAIC_OFF[lang]), `「${CHIP_MOSAIC_OFF[lang]}」が無い`)
		assert.ok(text.includes(WHEEL_DOWN_FORWARD[lang]), `「${WHEEL_DOWN_FORWARD[lang]}」が無い`)
	})

	test(`04-edit #edit-sidebar: 「設定」は画面の項目の名前で書き、「配置」を「表示」の中に書かない (${lang})`, () => {
		// Arrange
		const sec = section(docFile(lang, '04-edit.html'), 'edit-sidebar')

		// Act
		const settings = kvRowHtml(sec, SETTINGS_KEY[lang])
		const position = kvRowHtml(sec, POSITION_KEY[lang])

		// Assert
		assert.ok(settings, `kv-key「${SETTINGS_KEY[lang]}」の行が無い`)
		const settingsText = textOf(settings)
		for (const w of [HUD_LABEL[lang], CHIP_LABEL[lang], WHEEL_DOWN_FORWARD[lang]]) {
			assert.ok(settingsText.includes(w), `「設定」の行に「${w}」が無い`)
		}
		assert.doesNotMatch(settingsText, /HUD/)
		assert.ok(position, `kv-key「${POSITION_KEY[lang]}」の行が無い`)
		assert.ok(!textOf(position).includes(POSITION_UNDER_DISPLAY[lang]), `「配置」の行に「${POSITION_UNDER_DISPLAY[lang]}」がある`)
	})

	test(`03-detect #detect-options: 「検出せずに取り込む」のスイッチは「モザイク初期設定」の見出しのすぐ上 (${lang})`, () => {
		// Arrange
		const sec = section(docFile(lang, '03-detect.html'), 'detect-options')

		// Act
		const text = textOf(sec)

		// Assert
		assert.ok(text.includes(IMPORT_ONLY_SWITCH[lang]), `「${IMPORT_ONLY_SWITCH[lang]}」が無い`)
		assert.ok(!text.includes(IMPORT_ONLY_SWITCH_OLD[lang]), `古い書き方「${IMPORT_ONLY_SWITCH_OLD[lang]}」がある`)
	})

	test(`web #diff: 複数のウィンドウの行があり、リンクは同じ言語の docs へ向く (${lang})`, () => {
		// Arrange
		const sec = section(docFile(lang, 'web.html'), 'diff')

		// Act
		const row = kvRowHtml(sec, MULTI_WINDOWS_KEY[lang])

		// Assert
		assert.ok(row, `kv-key「${MULTI_WINDOWS_KEY[lang]}」の行が無い`)
		assert.ok(row.includes(`href="${DOCS_PREFIX[lang]}#edit-overview"`), `リンクが ${DOCS_PREFIX[lang]}#edit-overview でない: ${row}`)
		assert.ok(textOf(sec).includes(APPLY_MOSAIC[lang]), `「${APPLY_MOSAIC[lang]}」が無い`)
	})
}
