// ドキュメントの「同梱する第三者ソフトとライセンス」(#licenses) を固定する回帰テスト。
//
//   node --test src/lib/site-copy-docs-third-party-licenses.test.js
//
//   - Desktop 版のインストーラに ffmpeg (GPL ビルド) / ONNX Runtime / Visual C++ 再頒布可能パッケージを同梱するので、
//     ドキュメントに一覧・ライセンス・ソースの入手先を書く (正本はアプリのライセンスの一覧)。
//   - ffmpeg は GPL v3、libx264 / libx265 (GPL)、ビルドの提供元と版、ソースの URL を書く
//     (BtbN の shared 版 8.1.3 = exe 2 本 + DLL 7 本と、当社の対応ソースの配布)。
//   - 目次 (_data/docs_toc.yml の desktop「運用」) に licenses があり、本文の section id と揃う。
//   - Premiere 連携には触れない (Store の開示事項と同じ方針)。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const ops = read('_includes/docs/06-ops.html')
const licenses = sectionOf(ops, 'licenses')

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'licenses'), null)
	assert.equal(sectionOf('<section id="a">b</section>', 'a'), '<section id="a">b')
})

test('#licenses の節が運用の章にある', () => {
	assert.ok(licenses, '_includes/docs/06-ops.html に <section id="licenses"> が無い')
	assert.match(licenses, /同梱する第三者ソフトとライセンス/)
})

test('ffmpeg: GPL v3・libx264 / libx265・提供元と版・ソースの入手先', () => {
	assert.match(licenses, /FFmpeg/)
	assert.match(licenses, /GPL v3|GNU General Public License version 3/)
	assert.match(licenses, /libx264/)
	assert.match(licenses, /libx265/)
	// ビルドは BtbN の GPL ビルド (8.1.3)、対応ソースは当社の配信元 (GPL v3 第 6 条)。アプリの画面の記載と同じ
	assert.match(licenses, /BtbN\/FFmpeg-Builds/)
	assert.match(licenses, /autobuild-2026-10-31-12-59/)
	assert.match(licenses, /8\.1\.3/)
	assert.match(
		licenses,
		/https:\/\/deepmosaic-r2-proxy\.deepmosaic\.workers\.dev\/third-party\/ffmpeg\/autobuild-2026-10-31-12-59\/README-win64-gpl-shared-8\.1\.txt/,
	)
	// 同梱するのは shared 版 (exe 2 本 + DLL 7 本)。GPL のライブラリは DLL に静的にリンクされている
	assert.match(licenses, /FFmpeg 8\.1\.3（ffmpeg\.exe \/ ffprobe\.exe と DLL 7 本）/)
	for (const dll of ['avcodec-62.dll', 'avdevice-62.dll', 'avfilter-11.dll', 'avformat-62.dll', 'avutil-60.dll', 'swresample-6.dll', 'swscale-9.dll']) {
		assert.ok(licenses.includes(dll), `DLL ${dll} が無い`)
	}
	assert.match(licenses, /これらの DLL に静的にリンクされています/)
	// ビルドの名前と対応ソースの URL は許可の一覧のとおり (同梱するビルドのものだけ)
	assert.deepEqual([...new Set(licenses.match(/win64-gpl(?:-shared)?-\d+\.\d+/g))], ['win64-gpl-shared-8.1'])
	assert.deepEqual(
		[...new Set(licenses.match(/https:\/\/[^\s"<]*\/third-party\/ffmpeg\/[^\s"<]*/g))],
		['https://deepmosaic-r2-proxy.deepmosaic.workers.dev/third-party/ffmpeg/autobuild-2026-10-31-12-59/README-win64-gpl-shared-8.1.txt'],
	)
	assert.match(licenses, /第 6 条/)
	assert.doesNotMatch(licenses, /gyan\.dev|8\.1\.1/, '同梱していないビルドの記述がある')
	assert.match(licenses, /https:\/\/www\.gnu\.org\/licenses\/gpl-3\.0/)
})

test('ONNX Runtime (MIT) と Visual C++ 再頒布可能パッケージ (Microsoft) を書く', () => {
	assert.match(licenses, /ONNX Runtime/)
	assert.match(licenses, /MIT/)
	assert.match(licenses, /Visual C\+\+/)
	assert.match(licenses, /Microsoft/)
})

// 任意取得 → NVIDIA 製 GPU 搭載機で初回に自動取得。詳細は site-copy-docs-help-menu.test.js
test('GPU 高速化の NVIDIA コンポーネントは初回に取得する第三者ソフトとして書く', () => {
	assert.match(licenses, /NVIDIA/)
	assert.match(licenses, /約 2\.4 GB/)
	assert.match(licenses, /初回に取得する第三者ソフト/)
})

test('Premiere 連携には触れない', () => {
	assert.doesNotMatch(licenses, /Premiere/)
})

test('目次: Desktop 版の目次の「運用」に licenses があり、web の後ろ', () => {
	const toc = read('_data/docs_toc.yml')
	const web = toc.indexOf('{ id: web, label: Web 版について }')
	const item = toc.indexOf('{ id: licenses, label: 同梱ソフトのライセンス }')
	assert.ok(web > 0, '陽性対照: web の項目が見つからない')
	assert.ok(item > web, 'licenses の項目が web の後ろに無い')
})
