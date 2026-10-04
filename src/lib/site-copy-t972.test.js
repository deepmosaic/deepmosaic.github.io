// T-972 (2026-10-04) docs のチュートリアル動画の埋め込みを固定する回帰テスト。
//
//   node --test src/lib/site-copy-t972.test.js
//
//   - docs の最初の節 (`_includes/docs/01-intro.html` の `#about`) に、Desktop 版 / Web 版の
//     チュートリアル動画 2 本を `<video controls preload="none" poster>` で埋め込む。
//   - 動画と poster の URL は固定 (R2 の公開プロキシ `media/tutorial/`、実体は 2.7.1 のリリース時に置く)。
//   - 自動再生しない (autoplay / muted / loop を付けない)。
//   - `<video>` の中にフォールバックの `<img>` を書かない (`check-docs.mjs` が `<img>` の実在と寸法を
//     検査するため、remote の poster を `<img>` にすると落ちる)。
//   - 節 ID は外部参照の契約なので新しい section を足さず `#about` の中に置く。
//   - `llms.txt` / `llms-full.txt` に動画 2 本の URL を 1 行ずつ載せる。
//   - 公開面にモデルの固有名を書かない。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t964.test.js` と同じ流儀)。

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

const BASE = 'https://deepmosaic-r2-proxy.deepmosaic.workers.dev/media/tutorial'
const VIDEOS = [
	{ label: 'Desktop 版', mp4: `${BASE}/tutorial-desktop-basic.mp4`, png: `${BASE}/tutorial-desktop-basic.png` },
	{ label: 'Web 版', mp4: `${BASE}/tutorial-web-basic.mp4`, png: `${BASE}/tutorial-web-basic.png` },
]
const HEADING = '動画で見る基本の使い方'
const MODEL_NAMES = /yolo|\bSAM\b|sam2|EfficientSAM|TransNet|RetinaFace|InsightFace|genderage|SCRFD|OSNet|SeqTrack|HaGRID/i

/** 01-intro.html の `#about` 節 (表示される部分だけ)。 */
function aboutSection() {
	const html = stripComments(read('_includes/docs/01-intro.html'))
	const m = html.match(/<section id="about"[\s\S]*?<\/section>/)
	assert.ok(m, '#about 節が見つからない')
	return m[0]
}

/** 節の中の `<video ...>...</video>` (開始タグの属性と中身)。 */
function videosOf(section) {
	return [...section.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)].map((m) => ({ attrs: m[1], body: m[2] }))
}

test('#about に見出し「動画で見る基本の使い方」があり「作業の流れ」より前にある', () => {
	const text = textOf(aboutSection())
	const h = text.indexOf(HEADING)
	assert.ok(h >= 0, `見出し「${HEADING}」が無い`)
	assert.ok(h < text.indexOf('作業の流れ'), '動画は「作業の流れ」より前に置く')
})

test('#about に動画が Desktop 版 → Web 版の順で 2 本ある', () => {
	const section = aboutSection()
	const videos = videosOf(section)
	assert.equal(videos.length, 2)
	VIDEOS.forEach((v, i) => {
		assert.ok(videos[i].body.includes(`src="${v.mp4}"`), `${v.label} の mp4 の URL`)
		assert.ok(videos[i].attrs.includes(`poster="${v.png}"`), `${v.label} の poster の URL`)
	})
	const text = textOf(section)
	assert.ok(text.indexOf('Desktop 版') < text.indexOf('Web 版', text.indexOf(HEADING)))
})

test('動画は controls / preload="none" / playsinline / 寸法つきで、自動再生しない', () => {
	for (const { attrs } of videosOf(aboutSection())) {
		assert.match(attrs, /\bcontrols\b/)
		assert.match(attrs, /\bpreload="none"/)
		assert.match(attrs, /\bplaysinline\b/)
		assert.match(attrs, /\bwidth="960"/)
		assert.match(attrs, /\bheight="540"/)
		assert.doesNotMatch(attrs, /\b(autoplay|muted|loop)\b/)
	}
})

test('<video> の中にフォールバックの <img> を書かず、mp4 への文字リンクを置く', () => {
	VIDEOS.forEach((v, i) => {
		const { body } = videosOf(aboutSection())[i]
		assert.doesNotMatch(body, /<img\b/)
		assert.match(body, /type="video\/mp4"/)
		assert.ok(body.includes(`<a href="${v.mp4}">`), `${v.label} のフォールバックのリンク`)
	})
})

test('各動画に figcaption の説明が 1 つずつある', () => {
	const figures = [...aboutSection().matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map((m) => m[0])
	const withVideo = figures.filter((f) => f.includes('<video'))
	assert.equal(withVideo.length, 2)
	for (const f of withVideo) assert.equal((f.match(/<figcaption\b/g) ?? []).length, 1)
})

test('llms.txt / llms-full.txt に動画 2 本の URL と「字幕のみ」の 1 行がある', () => {
	for (const file of ['llms.txt', 'llms-full.txt']) {
		const lines = read(file).split('\n').filter((l) => l.includes(VIDEOS[0].mp4))
		assert.equal(lines.length, 1, `${file} の動画の行は 1 行`)
		assert.ok(lines[0].includes(VIDEOS[1].mp4), `${file} に Web 版の URL`)
		assert.match(lines[0], /字幕のみ/)
	}
})

test('追加した文言にモデルの固有名を書かない', () => {
	assert.doesNotMatch(textOf(aboutSection()), MODEL_NAMES)
	for (const file of ['llms.txt', 'llms-full.txt']) {
		const line = read(file).split('\n').find((l) => l.includes(VIDEOS[0].mp4)) ?? ''
		assert.doesNotMatch(line, MODEL_NAMES)
	}
})
