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
// 3 機能は desktop 2.3.7 には無く、docs の先行公開中は機能節に「次回の更新 (v2.4) から」の注記
// (`_includes/desktop-next-note.html`) を添えていた。desktop 2.4.0 の公開で配布版に入ったので、
// T-515 で注記の部品と呼び出しを外した (再登場させない)。同じく T-515 で、フェードとトランジションの
// カードに「効果」のパレットからのドラッグとクリップごとのフェード (desktop T-536 / T-539、docs T-544) を足した。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
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

/** `<div class="card …">` のうち、`<h3>` の見出しが `heading` のカードの HTML。見つからなければ null。 */
function cardOf(html, heading) {
	const at = html.search(new RegExp(`<h3[^>]*>${heading}</h3>`))
	if (at < 0) return null
	const start = html.lastIndexOf('<div class="card', at)
	const end = html.indexOf('<div class="card', at)
	return start < 0 ? null : html.slice(start, end < 0 ? undefined : end)
}

const index = read('index.html')
const indexShown = stripComments(index)

/** トップが `{% include X %}` で読む部品 (表記の検査対象)。 */
const indexIncludes = [...new Set([...index.matchAll(/\{%-?\s*include\s+([\w./-]+\.html)/g)].map((m) => m[1]))]

test('補助関数は見つからなければ null / 空を返す (すり抜け防止)', () => {
	// Arrange / Act / Assert
	assert.equal(markedSection(index, '存在しない節'), null)
	assert.equal(cardOf(index, '存在しない見出し'), null)
	assert.match(cardOf('<div class="card p-5"><h3 class="x">A</h3><p>本文</p></div>', 'A') ?? '', /本文/)
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

test('フェードとトランジションのカードは、はさみからの選択とクリップごとのフェードに触れ、撤去したパレットを書いていない', () => {
	// Arrange
	const card = cardOf(markedSection(index, 'TIMELINE') ?? '', 'フェードとトランジション')
	assert.ok(card, 'TIMELINE に「フェードとトランジション」のカードが無い')
	const text = textOf(stripComments(card))

	// Act
	const missing = ['はさみ', 'フェード', 'つなぎ', 'クリップごと'].filter((w) => !text.includes(w))
	const leftovers = ['「効果」', 'チップ'].filter((w) => text.includes(w))

	// Assert — 語は docs 04-edit の #edit-fade / #edit-transition (T-637) と揃える
	assert.deepEqual(missing, [], `触れていない語: ${missing.join(' / ')} (${text})`)
	assert.deepEqual(leftovers, [], `撤去した「効果」のパレットの語が残っている: ${leftovers.join(' / ')} (${text})`)
})

// ── 先取りの注記の撤去 (desktop 2.4.0 の公開、T-515) ─────────────────────────

test('desktop-next-note の部品は無く、トップのどこからも読まれていない', () => {
	// Arrange / Act
	const includers = ['index.html', ...indexIncludes.map((name) => `_includes/${name}`)]
		.filter((path) => existsSync(join(ROOT, ...path.split('/'))))
		.filter((path) => /\{%-?\s*include\s+desktop-next-note\.html/.test(read(...path.split('/'))))

	// Assert
	assert.ok(!existsSync(join(ROOT, '_includes', 'desktop-next-note.html')), '_includes/desktop-next-note.html が残っている')
	assert.deepEqual(includers, [], `desktop-next-note.html を読んでいる: ${includers.join(' / ')}`)
})

test('トップ (本文と読み込む部品) の表示文字列に desktop の次回更新・配布中の旧版の断り書きが無い', () => {
	// Arrange
	const sources = [
		['index.html', indexShown],
		...indexIncludes
			.filter((name) => existsSync(join(ROOT, '_includes', name)))
			.map((name) => [`_includes/${name}`, stripComments(read('_includes', name))]),
	]
	const wording = [/次回の更新 \(v[\d.]+\)/, /配布中の v\d/, /Desktop 版では次回の更新/, /次回のデスクトップ更新/]

	// Act
	const found = sources.flatMap(([name, body]) =>
		wording.filter((re) => re.test(textOf(body))).map((re) => `${name}: ${re}`),
	)

	// Assert
	assert.deepEqual(found, [], `先取りの断り書きが残っている: ${found.join(' / ')}`)
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

// ── hero の動画と SAM の比較画像 (T-710) ──────────────────────────────────────

const assetPath = (src) => join(ROOT, src.replace(/^\//, ''))

test('hero は形に沿ったモザイクのループ動画 (autoplay / muted / loop / playsinline、poster は WebP、source は 3 MB 以下の WebM、フォールバック img と素材の表記)', () => {
	// Arrange
	const section = markedSection(index, 'HERO')
	assert.ok(section, 'index.html に <!-- HERO --> の節が無い')
	const video = section.match(/<video\s([^>]*)>([\s\S]*?)<\/video>/)
	assert.ok(video, 'HERO に <video> が無い')
	const [, attrs, inner] = video

	// Act
	const missing = ['autoplay', 'muted', 'loop', 'playsinline'].filter((a) => !new RegExp(`(^|\\s)${a}(\\s|>|$)`).test(attrs))
	const poster = attrs.match(/poster="([^"]+)"/)?.[1] ?? ''
	const source = inner.match(/<source\s[^>]*src="([^"]+)"/)?.[1] ?? ''

	// Assert
	assert.deepEqual(missing, [], `hero の video に無い属性: ${missing.join(' / ')}`)
	assert.match(attrs, /\swidth="\d+"/, 'video に width が無い (CLS)')
	assert.match(attrs, /\sheight="\d+"/, 'video に height が無い (CLS)')
	assert.ok(poster.endsWith('.webp') && existsSync(assetPath(poster)), `poster が WebP で実在しない: ${poster}`)
	assert.ok(source.endsWith('.webm') && existsSync(assetPath(source)), `source が WebM で実在しない: ${source}`)
	assert.ok(statSync(assetPath(source)).size <= 3 * 1024 * 1024, `hero の WebM は 3 MB 以下にする: ${statSync(assetPath(source)).size} bytes`)
	assert.match(inner, /<img\s[^>]*edit-player-mosaic\.webp/, 'video 非対応環境のフォールバック img (従来の hero 画像) が無い')
	assert.match(textOf(stripComments(section)), /Pexels/, '素材 (Pexels) の表記が無い')
})

test('MOSAIC 節に四角い枠と SAM の比較画像が対で並び、実在して alt / width / height / lazy を持つ', () => {
	// Arrange
	const section = markedSection(index, 'MOSAIC')
	assert.ok(section, 'index.html に <!-- MOSAIC --> の節が無い')
	const imgs = images(stripComments(section)).filter((img) => (img.src ?? '').includes('/assets/img/samples/sam-compare-'))

	// Act
	const rects = imgs.filter((img) => img.src.endsWith('-rect.webp'))
	const sams = imgs.filter((img) => img.src.endsWith('-sam.webp'))

	// Assert
	assert.ok(rects.length >= 1 && rects.length === sams.length, `四角 (${rects.length}) と SAM (${sams.length}) が同数で 1 組以上ではない`)
	for (const img of imgs) {
		assert.ok(existsSync(assetPath(img.src)), `画像が無い: ${img.src}`)
		assert.ok(img.alt, `alt が無い: ${img.src}`)
		assert.match(img.width ?? '', /^\d+$/, `width が無い: ${img.src}`)
		assert.match(img.height ?? '', /^\d+$/, `height が無い: ${img.src}`)
		assert.equal(img.loading, 'lazy', `hero 以外は lazy にする: ${img.src}`)
	}
	const text = textOf(stripComments(section))
	assert.match(text, /SAM/, 'MOSAIC 節が SAM に触れていない')
	assert.match(text, /Pexels/, '素材 (Pexels) の表記が無い')
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
