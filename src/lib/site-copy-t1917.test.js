// T-1917 (2026-11-11) ダウンロード導線を Microsoft Store へ。インストール / 更新 / アンインストール / データの節を MSIX に合わせる。
//
//   node --test src/lib/site-copy-t1917.test.js
//
//   - 配布は Microsoft Store だけ (ユーザー決定 2026-11-11)。DL URL の単一管理点 `_data/lang/ja.json` の
//     `app_download_link` が Store の掲載ページ、`app_store_protocol_link` が Store アプリで開くリンク。
//   - DL ボタンはファイル DL ではなくなったので `download` 属性を付けない (data-dl の計測は残す)。
//   - サイト配布の worker の DL 口 (`/download/latest/windows`) をページから参照しない。
//   - docs の #install に「インストーラ (NSIS) は 2.11.1 で終了、Store 版へ (データはそのまま、アカウントに紐づく)」の案内。
//   - #update は Store の更新、#uninstall は Windows の設定から、#data は %LOCALAPPDATA%\deepmosaic の共有を書く。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const STORE_WEB = 'https://apps.microsoft.com/detail/9PDKMKWHN9RW'
const STORE_PROTO = 'ms-windows-store://pdp/?productid=9PDKMKWHN9RW'

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** DL ボタン / リンクを持つ部品とページ (`app_download_link` を href に使う所)。 */
const DL_FILES = [
	'index.html',
	'_includes/header.html',
	'_includes/footer.html',
	'_includes/download-button.html',
	'_includes/docs/01-intro.html',
]

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'install'), null)
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
	assert.equal(textOf('<!-- x --><i>z</i>'), 'z')
})

test('ja.json: DL の単一管理点が Microsoft Store の掲載ページ、Store アプリ用のリンクもある', () => {
	const lang = JSON.parse(read('_data/lang/ja.json'))
	assert.equal(lang.app_download_link, STORE_WEB)
	assert.equal(lang.app_store_protocol_link, STORE_PROTO)
	assert.equal(lang.app_store_product_id, '9PDKMKWHN9RW')
})

test('DL ボタン / リンクは app_download_link を使い、download 属性を付けず、data-dl は残す', () => {
	for (const rel of DL_FILES) {
		const html = stripComments(read(rel))
		const tags = html.match(/<a\s[^>]*app_download_link[^>]*>/g) ?? []
		assert.ok(tags.length > 0, `${rel}: app_download_link を使う <a> が無い (陽性対照)`)
		for (const tag of tags) {
			assert.doesNotMatch(tag, /\sdownload(\s|=|>)/, `${rel}: download 属性が残っている: ${tag}`)
			assert.match(tag, /data-dl=/, `${rel}: data-dl が無い (計測から漏れる): ${tag}`)
		}
	}
	// モバイルのドロワー (Svelte の data-links) も download を渡さない
	const header = read('_includes/header.html')
	const links = header.match(/data-links='([^']*)'/)?.[1]
	assert.ok(links, 'header の data-links が見つからない')
	const dl = JSON.parse(links.replace(/\{\{[^}]*\}\}/g, 'x')).find((l) => l.dl === 'mobile')
	assert.ok(dl, 'data-links に dl=mobile の項目が無い')
	assert.equal(dl.download, undefined, 'data-links の DL 項目に download が残っている')
})

test('サイト配布の DL 口 (worker の /download/latest/windows) をページ・データから参照しない', () => {
	for (const rel of [...DL_FILES, '_data/lang/ja.json', '_includes/cta-download.html', '_includes/pricing-cards.html']) {
		assert.doesNotMatch(stripComments(read(rel)), /download\/latest\/windows/, `${rel} に旧 DL 口が残っている`)
	}
})

test('#install: Store で入手する手順・2 つのリンク・インストーラ版 2.11.1 の終了と移行の案内', () => {
	const install = sectionOf(read('_includes/docs/01-intro.html'), 'install')
	assert.ok(install, '01-intro に #install が無い')
	const text = textOf(install)
	assert.match(install, /app_store_protocol_link/)
	assert.match(install, /download-button\.html/)
	assert.match(text, /Microsoft Store で配布/)
	assert.match(text, /2\.11\.1 で終了/)
	assert.match(text, /データはそのまま引き継がれます/)
	assert.match(text, /移行の作業は不要/)
	assert.match(text, /アカウントに紐づいて/)
	assert.match(text, /0\.1\.21/, 'Premiere 連携のプラグイン更新の版')
	assert.doesNotMatch(text, /ダウンロードしたインストーラ（Deepmosaic Setup）を実行/, '旧手順が残っている')
})

test('#setup: 検出エンジンはアプリに含まれ、GPU 高速化は利用者がオンにしたときだけ取得', () => {
	const setup = textOf(sectionOf(read('_includes/docs/01-intro.html'), 'setup') ?? '')
	assert.match(setup, /検出エンジンと軽量の検出モデルはアプリに含まれています/)
	assert.match(setup, /GPU 高速化 \(NVIDIA\) を有効にする/)
	assert.match(setup, /自動では取得しません/)
	assert.doesNotMatch(setup, /モデルデータと検出エンジンが自動でダウンロード/)
})

test('#update: 本体の更新は Microsoft Store、インストーラ版の更新ダイアログは過去の説明として区別する', () => {
	const update = textOf(sectionOf(read('_includes/docs/06-ops.html'), 'update') ?? '')
	assert.match(update, /Microsoft Store が配信/)
	assert.match(update, /インストーラ版（2\.11\.1 まで）/)
	assert.match(update, /Microsoft Store 版にはこのメニューはありません/)
})

test('#uninstall: Windows の設定から。Store 版で残るもの・インストーラ版のチェックの注意', () => {
	const un = textOf(sectionOf(read('_includes/docs/06-ops.html'), 'uninstall') ?? '')
	assert.match(un, /インストールされているアプリ/)
	assert.match(un, /%USERPROFILE%\\\.deepmosaic/)
	assert.match(un, /プロジェクトフォルダ/)
	assert.match(un, /インストーラ版から引き継いだ場合は残ります/)
	assert.match(un, /チェックを入れないでください/)
})

test('#data: %LOCALAPPDATA%\\deepmosaic はインストーラ版と Store 版で同じ場所を使う', () => {
	const data = textOf(sectionOf(read('_includes/docs/06-ops.html'), 'data') ?? '')
	assert.match(data, /%LOCALAPPDATA%\\deepmosaic/)
	assert.match(data, /この場所をそのまま使います/)
	assert.match(data, /検出エンジンと動画処理ツールはアプリに含まれています/)
})
