// T-1917 (2026-11-11) ダウンロード導線を Microsoft Store へ。インストール / 更新 / アンインストール / データの節を MSIX に合わせる。
//
//   node --test src/lib/site-copy-t1917.test.js
//
//   - T-2303 (backlog1113, 2026-11-13) で DL の既定をインストーラに戻した (2.14 はサイト配布版と Store 版の両方)。
//     DL URL の単一管理点 `_data/lang/{ja,en,zh-tw}.json` の `app_download_link` は worker の DL 口
//     (`/download/latest/windows`)。`app_store_protocol_link`・`app_store_product_id` は Store のボタン (T-2304) 用に残す。
//   - DL ボタン / リンクはファイル DL なので `download` 属性を付ける (公開中の形。data-dl の計測は残す)。
//   - ヘッダー・フッター・ヒーロー・DL ボタンの既定の文に Store の掲載ページ・「Microsoft Store」を出さない。
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

const INSTALLER_DL = 'https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows'
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

/** DL ボタン / リンクを持つ部品とページ (`app_download_link` を href に使う所)。docs (01-intro) の #install は T-2305 が直す。 */
const DL_FILES = [
	'index.html',
	'en/index.html',
	'zh-tw/index.html',
	'_includes/header.html',
	'_includes/header-intl.html',
	'_includes/footer.html',
	'_includes/footer-intl.html',
	'_includes/download-button.html',
]

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'install'), null)
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
	assert.equal(textOf('<!-- x --><i>z</i>'), 'z')
})

test('lang/*.json: DL の単一管理点はインストーラ (worker の DL 口)、Store のリンクは別のキーに残す (3 言語)', () => {
	for (const lang of ['ja', 'en', 'zh-tw']) {
		const L = JSON.parse(read(`_data/lang/${lang}.json`))
		assert.equal(L.app_download_link, INSTALLER_DL, `${lang}.app_download_link`)
		assert.equal(L.app_store_protocol_link, STORE_PROTO, `${lang}.app_store_protocol_link`)
		assert.equal(L.app_store_product_id, '9PDKMKWHN9RW', `${lang}.app_store_product_id`)
	}
})

test('DL ボタン / リンクは app_download_link を使い、download 属性と data-dl を持つ', () => {
	for (const rel of DL_FILES) {
		const html = stripComments(read(rel))
		const tags = html.match(/<a\s[^>]*app_download_link[^>]*>/g) ?? []
		assert.ok(tags.length > 0, `${rel}: app_download_link を使う <a> が無い (陽性対照)`)
		for (const tag of tags) {
			assert.match(tag, /\sdownload(\s|>)/, `${rel}: download 属性が無い (値は付けない): ${tag}`)
			assert.match(tag, /data-dl=/, `${rel}: data-dl が無い (計測から漏れる): ${tag}`)
		}
	}
	// モバイルのドロワー (Svelte の data-links) の DL 項目は download: true (src/lib/download-attr.js で '' に写る)
	for (const rel of ['_includes/header.html', '_includes/header-intl.html']) {
		const links = read(rel).match(/data-links='([^']*)'/)?.[1]
		assert.ok(links, `${rel}: data-links が見つからない`)
		const items = JSON.parse(links.replace(/\{\{[^}]*\}\}/g, 'x'))
		const dl = items.find((l) => l.dl === 'mobile')
		assert.ok(dl, `${rel}: data-links に dl=mobile の項目が無い`)
		assert.equal(dl.download, true, `${rel}: data-links の DL 項目に download: true が無い`)
		for (const item of items.filter((l) => l !== dl)) assert.equal(item.download, undefined, `${rel}: ${item.href} に download`)
	}
})

test('ヘッダー・フッター・ヒーロー・DL ボタンに Store の掲載ページや「Microsoft Store」の文を出さない', () => {
	// 部品は全体、トップのページはヒーローの DL ボタンだけを見る (料金の節の文は T-2306 が直す)
	const PAGES = ['index.html', 'en/index.html', 'zh-tw/index.html']
	const targets = [...DL_FILES.filter((rel) => !PAGES.includes(rel)), '_includes/cta-download.html', '_data/l10n/en/nav.yml', '_data/l10n/zh-tw/nav.yml', '_data/l10n/en/parts.yml', '_data/l10n/zh-tw/parts.yml'].map((rel) => [rel, stripComments(read(rel))])
	for (const rel of PAGES) {
		const hero = stripComments(read(rel)).match(/<a\s[^>]*data-dl="hero"[^>]*>[\s\S]*?<\/a>/)?.[0]
		assert.ok(hero, `${rel}: ヒーローの DL ボタンが無い`)
		targets.push([`${rel} のヒーロー`, hero])
	}
	for (const [where, live] of targets) {
		assert.doesNotMatch(live, /apps\.microsoft\.com|9PDKMKWHN9RW/, `${where} に Store の掲載ページが残っている`)
		assert.doesNotMatch(live, /Microsoft Store|Store で入手|Store 取得/, `${where} に Store の文が残っている`)
	}
	// 陽性対照: 公開中の文に戻っている
	assert.match(read('_includes/download-button.html'), /無料でダウンロード/)
	assert.match(stripComments(read('index.html')), /data-dl="hero"[^>]*>\{% include icon\.html name="Download" class="h-5 w-5" %\}無料でダウンロード<\/a>/)
	assert.match(stripComments(read('en/index.html')), /data-dl="hero"[^>]*>\{% include icon\.html name="Download" class="h-5 w-5" %\}Download for free<\/a>/)
	assert.match(stripComments(read('zh-tw/index.html')), /data-dl="hero"[^>]*>\{% include icon\.html name="Download" class="h-5 w-5" %\}免費下載<\/a>/)
	assert.match(stripComments(read('_includes/footer.html')), /data-dl="footer"[^>]*>ダウンロード<\/a>/)
	assert.match(stripComments(read('_includes/footer-intl.html')), /data-dl="footer"[^>]*>\{\{ N\.download \}\}<\/a>/)
	assert.match(stripComments(read('_includes/header.html')), /<span><span class="hidden lg:inline">無料で<\/span>ダウンロード<\/span>/)
})

test('JSON-LD の downloadUrl はページの言語の app_download_link (= インストーラ)', () => {
	assert.match(read('_includes/schema/software-application.html'), /"downloadUrl": \{\{ L\.app_download_link \| jsonify \}\}/)
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

// T-1929 (desktop 2.13): GPU 高速化はスイッチを廃止し、NVIDIA 製 GPU 搭載機で自動取得 (site-copy-help1111.test.js)
test('#setup: 検出エンジンはアプリに含まれ、GPU 高速化は NVIDIA 製 GPU 搭載機で自動取得', () => {
	const setup = textOf(sectionOf(read('_includes/docs/01-intro.html'), 'setup') ?? '')
	assert.match(setup, /検出エンジンと軽量の検出モデルはアプリに含まれています/)
	assert.match(setup, /初回に高速化用のコンポーネント/)
	assert.doesNotMatch(setup, /自動では取得しません/)
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
