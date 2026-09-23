// トップページ (index.html) の機能節と表記を固定する回帰テスト (T-512)。
//
//   node --test src/lib/top-page-features.test.js
//
// 2026-09-23 の改修要件:
//
//   - タイムライン編集 / ホーム画面のフォルダとタグ / 組織 (Enterprise) の機能節を足す
//   - RELIABILITY のアノテーションモード (T-246 で無効化済み) の記述を消す
//     (CLAUDE.md「未実装・無効の機能は書かない」)
//   - hero 画像はファイル名を変えない (T-496 の撮り直しが同じ名前で上書きする)
//   - 表記は「チーム」ではなく「組織」(T-484 のアプリ表記)
//
// 3 機能はどれも**配布中の desktop (v2.3.7) に無い** (次回の更新 v2.4 で入る)。トップは
// 「無料でダウンロード」の直後に読まれる面なので、docs の 01-intro と同じ版表記の注記を
// 機能節に添える (`_includes/desktop-next-note.html`)。desktop のリリース時 (T-515) に外す。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** YAML のコメント行 (`#` で始まる行) を落とす。 */
const stripYamlComments = (yaml) =>
	yaml
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('#'))
		.join('\n')

/** `<!-- NAME -->` の目印から、その節の `</section>` までの HTML。見つからなければ null。 */
function markedSection(html, name) {
	const start = html.indexOf(`<!-- ${name} -->`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** `<img …>` の属性。 */
const images = (html) =>
	[...html.matchAll(/<img\s([^>]*)>/g)].map((m) => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])))

/** 01-intro の先取り注記から「次回の版」と「配布中の版」を取り出す (T-509 が置いた文面)。 */
function prereleaseVersions(introHtml) {
	const next = introHtml.match(/次回のデスクトップ更新 \((v[\d.]+)\)/)
	const current = introHtml.match(/配布中の (v[\d.]+)/)
	return next === null || current === null ? null : { next: next[1], current: current[1] }
}

const index = read('index.html')
const indexShown = stripComments(index)

/** トップが `{% include X %}` で読む部品 (表記の検査対象)。 */
const indexIncludes = [...new Set([...index.matchAll(/\{%-?\s*include\s+([\w./-]+\.html)/g)].map((m) => m[1]))]

test('補助関数は見つからなければ null / 空を返す (すり抜け防止)', () => {
	// Arrange / Act / Assert
	assert.equal(markedSection(index, '存在しない節'), null)
	assert.equal(prereleaseVersions('<p>注記なし</p>'), null)
	assert.deepEqual(images('<p>画像なし</p>'), [])
	assert.equal(stripComments('A{% comment %}x{% endcomment %}B<!-- y -->C'), 'ABC')
	assert.equal(stripYamlComments('# a\nb: 1\n  # c'), 'b: 1')
})

// ── 機能節 ───────────────────────────────────────────────────────────────────

test('タイムライン編集の機能節がある (カット・素材・テキスト・音声・効果)', () => {
	// Arrange
	const section = markedSection(index, 'TIMELINE')
	assert.ok(section, 'index.html に <!-- TIMELINE --> の節が無い')
	const text = textOf(stripComments(section))
	const words = ['トリム', '分割', '並べ替え', '空白', '画像', 'テキスト', '透かし', 'BGM', 'フェード', 'トランジション']

	// Act
	const missing = words.filter((w) => !text.includes(w))

	// Assert
	assert.deepEqual(missing, [], `触れていない機能: ${missing.join(' / ')}`)
	assert.match(text, /モザイク/, `編集後もモザイクがどうなるかに触れていない: ${text}`)
})

test('ホーム画面のフォルダとタグ / 組織 (Enterprise) の機能節がある', () => {
	// Arrange
	const section = markedSection(index, 'MANAGE')
	assert.ok(section, 'index.html に <!-- MANAGE --> の節が無い')
	const text = textOf(stripComments(section))

	// Act
	const missing = ['フォルダ', 'タグ', '組織', 'Enterprise', '招待', '組織コード', '請求書'].filter((w) => !text.includes(w))

	// Assert
	assert.deepEqual(missing, [], `触れていない機能: ${missing.join(' / ')}`)
	assert.match(section, /href="\/docs\/#team"/, '組織の管理の使い方 (/docs/#team) へのリンクが無い')
	assert.match(section, /href="\/enterprise\/inquiry\/"/, '導入相談へのリンクが無い')
})

test('新しい機能節の画像は実在し、alt / width / height / lazy を持つ', () => {
	// Arrange
	const imgs = ['TIMELINE', 'MANAGE'].flatMap((name) => images(markedSection(index, name) ?? ''))
	assert.ok(imgs.length >= 1, '機能節に画像が 1 枚も無い')

	// Act / Assert
	for (const img of imgs) {
		assert.ok(existsSync(join(ROOT, img.src.replace(/^\//, ''))), `画像が無い: ${img.src}`)
		assert.ok(img.alt, `alt が無い: ${img.src}`)
		assert.match(img.width ?? '', /^\d+$/, `width が無い: ${img.src}`)
		assert.match(img.height ?? '', /^\d+$/, `height が無い: ${img.src}`)
		assert.equal(img.loading, 'lazy', `ヒーロー以外は lazy にする: ${img.src}`)
	}
})

test('機能節は desktop の次回更新で入ると、01-intro の先取り注記と同じ版で断ってある', () => {
	// Arrange
	const versions = prereleaseVersions(read('_includes', 'docs', '01-intro.html'))
	assert.ok(versions, '01-intro の先取り注記から版を取り出せない (T-509 の文面が変わった?)')
	const note = textOf(stripComments(read('_includes', 'desktop-next-note.html')))

	// Act / Assert
	assert.ok(note.includes(`次回の更新 (${versions.next})`), `注記の次の版が 01-intro と違う: ${note}`)
	assert.ok(note.includes(`配布中の ${versions.current}`), `注記の配布中の版が 01-intro と違う: ${note}`)
	for (const name of ['TIMELINE', 'MANAGE']) {
		assert.match(markedSection(index, name) ?? '', /\{%-?\s*include desktop-next-note\.html/, `${name} に注記が無い`)
	}
})

// ── RELIABILITY のアノテーションモード (T-246 で無効化) ───────────────────────

test('RELIABILITY の節からアノテーションモードの記述が消えている', () => {
	// Arrange
	const section = markedSection(index, 'RELIABILITY')
	assert.ok(section, 'index.html に <!-- RELIABILITY --> の節が無い')

	// Act / Assert
	assert.ok(!section.includes('アノテーション'), 'RELIABILITY にアノテーションモードの記述が残っている')
	assert.ok(!textOf(indexShown).includes('アノテーション'), 'トップの表示文字列にアノテーションが残っている')
})

// ── hero 画像 (T-496 が同じファイル名で撮り直す) ─────────────────────────────────

test('hero 画像はファイル名を変えず、LCP 用の fetchpriority="high" のまま', () => {
	// Arrange / Act
	const [hero] = images(index)

	// Assert
	assert.equal(hero.src, '/assets/img/screenshots/edit-player-mosaic.webp')
	assert.equal(hero.fetchpriority, 'high')
	assert.equal(hero.loading, undefined, 'hero を lazy にしてはいけない')
})

// ── 表記: 「チーム」→「組織」(T-484) ───────────────────────────────────────────

test('トップ (本文・部品・TRUST BAR・FAQ のデータ) と導入相談ページに「チーム」が無い', () => {
	// Arrange
	const sources = [
		['index.html', indexShown],
		...indexIncludes.map((name) => [`_includes/${name}`, stripComments(read('_includes', name))]),
		...['faq', 'site', 'entity', 'plans', 'disclosure', 'mosaic'].map((name) => [
			`_data/${name}.yml`,
			stripYamlComments(read('_data', `${name}.yml`)),
		]),
		['enterprise/inquiry/index.html', stripComments(read('enterprise', 'inquiry', 'index.html'))],
	]
	assert.ok(indexIncludes.includes('faq.html'), `トップの部品一覧が読めていない: ${indexIncludes.join(', ')}`)

	// Act
	const found = sources.filter(([, body]) => body.includes('チーム')).map(([name]) => name)

	// Assert
	assert.deepEqual(found, [], `「チーム」が残っている: ${found.join(' / ')}`)
})
