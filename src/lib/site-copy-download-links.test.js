// ダウンロードの導線と、docs のインストール / 更新 / アンインストール / データの節の回帰テスト。
//
//   node --test src/lib/site-copy-download-links.test.js
//
//   - ダウンロードの導線は Microsoft Store だけ (公式のバッジ)。公式サイトからインストーラを配る導線
//     (インストーラの URL のキー `app_download_link`・切り替え `installer_enabled`・部品 `download-button.html`) は持たない。
//     `app_store_protocol_link`・`app_store_product_id` は Store のリンクが使う (バッジの行き先は `_includes/store-install-url.html` が組む
//     公式のバッジと同じ形の掲載ページ、JSON-LD の downloadUrl はクエリの無い掲載ページ)。
//   - Store へ向くリンクは `download` を付けず data-dl を付ける。ヘッダーはバッジ、フッターとドロワーは文字のリンク (バッジに書かれた文と同じ)。
//   - docs の #install・#update・#uninstall・#data の検査は site-copy-docs-install-update.test.js。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

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

/** 引用符の外の `>` で閉じる開始タグを返す (Liquid の `%}` の `>` で切らないよう、`{% %}` と `{{ }}` を飛ばす)。 */
function tagsOf(src) {
	const out = []
	for (const m of src.matchAll(/<a\s/g)) {
		let i = m.index + 2
		while (i < src.length) {
			const skip = src.startsWith('{%', i) ? src.indexOf('%}', i) + 2 : src.startsWith('{{', i) ? src.indexOf('}}', i) + 2 : src[i] === '"' ? src.indexOf('"', i + 1) + 1 : i + 1
			if (src[i] === '>' || skip <= i) break
			i = skip
		}
		out.push(src.slice(m.index, i + 1))
	}
	return out
}

/** Store へ向くリンクを持つ部品 (ヘッダー・フッター・バッジ) */
const DL_FILES = [
	'_includes/header.html',
	'_includes/header-intl.html',
	'_includes/footer.html',
	'_includes/footer-intl.html',
	'_includes/store-button.html',
]

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'install'), null)
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
	assert.equal(textOf('<!-- x --><i>z</i>'), 'z')
})

test('lang/*.json: インストーラの URL のキーは無く、Store のリンクのキーがある (3 言語)', () => {
	for (const lang of ['ja', 'en', 'zh-tw']) {
		const L = JSON.parse(read(`_data/lang/${lang}.json`))
		assert.equal('app_download_link' in L, false, `${lang}: app_download_link が残っている`)
		assert.doesNotMatch(JSON.stringify(L), /download\/latest/, `${lang}: インストーラの受け口が残っている`)
		assert.equal(L.app_store_protocol_link, STORE_PROTO, `${lang}.app_store_protocol_link`)
		assert.equal(L.app_store_product_id, '9PDKMKWHN9RW', `${lang}.app_store_product_id`)
	}
})

test('インストーラの導線 (URL のキー・切り替え・部品) はソースのどこにも無く、Store のリンクは download なし・data-dl 付き', () => {
	assert.equal(existsSync(join(ROOT, '_includes/download-button.html')), false, 'インストーラのボタンの部品が残っている')
	assert.doesNotMatch(read('_data/site.yml').replace(/#.*$/gm, ''), /installer_enabled/, 'site.yml に installer_enabled が残っている')
	for (const rel of [...DL_FILES, '_includes/schema/software-application.html', 'index.html', 'en/index.html', 'zh-tw/index.html', '_includes/cta-download.html', '_includes/pricing-cards.html', '_includes/docs/01-intro.html', '_includes/docs/en/01-intro.html', '_includes/docs/zh-tw/01-intro.html', 'join/index.html', 'en/join/index.html', 'zh-tw/join/index.html']) {
		assert.doesNotMatch(stripComments(read(rel)), /app_download_link|installer_enabled|download-button/, `${rel}: インストーラの導線が残っている`)
	}
	for (const rel of DL_FILES) {
		const tags = tagsOf(stripComments(read(rel))).filter((t) => t.includes('store-install-url.html'))
		assert.equal(tags.length, 1, `${rel}: Store へ向く <a> が 1 つでない`)
		assert.doesNotMatch(tags[0], /\sdownload(\s|>|=)/, `${rel}: download 属性 (ファイル DL ではない): ${tags[0]}`)
		assert.match(tags[0], /data-dl=/, `${rel}: data-dl が無い (計測から漏れる): ${tags[0]}`)
		assert.match(tags[0], /target="_blank" rel="noopener noreferrer"/, `${rel}: 別タブ・noopener でない`)
	}
	// モバイルのドロワー (Svelte の data-links) の DL 項目は Store のバッジの行き先を別タブで (download なし)。ほかの項目に download を付けない
	for (const rel of ['_includes/header.html', '_includes/header-intl.html']) {
		const src = read(rel)
		const links = src.match(/data-links='([^']*)'/)?.[1]
		assert.ok(links, `${rel}: data-links が見つからない`)
		const captures = src.match(/capture hd_mobile_dl -?%\}([\s\S]*?)\{%-?\s*endcapture/g) ?? []
		assert.equal(captures.length, 1, `${rel}: ドロワーの DL の項目が 1 つでない`)
		const first = captures[0].replace(/^capture hd_mobile_dl -?%\}/, '').replace(/\{%-?\s*endcapture$/, '').replace(/\{%[^%]*%\}|\{\{[^}]*\}\}/g, 'x')
		const items = JSON.parse(links.replace('{{ hd_mobile_dl }}', first).replace(/\{\{[^}]*\}\}/g, 'x'))
		const dl = items[0]
		assert.equal(dl.dl, 'mobile', `${rel}: data-links の先頭が DL の項目でない`)
		assert.ok(dl.target === '_blank' && dl.download === undefined, `${rel}: DL の項目の download / target: ${first}`)
		for (const item of items.slice(1)) assert.equal(item.download, undefined, `${rel}: ${item.href} に download`)
	}
})

test('ヘッダーはバッジ、フッターとドロワーは「Microsoft Store からダウンロード」の文 (英中は parts.yml の st_label)', () => {
	assert.match(stripComments(read('_includes/header.html')), /data-dl="header"[^>]*>\{% include store-badge-img\.html %\}<\/a>/)
	assert.match(stripComments(read('_includes/header-intl.html')), /data-dl="header"[^>]*>\{% include store-badge-img\.html %\}<\/a>/)
	assert.match(stripComments(read('_includes/footer.html')), /data-dl="footer"[^>]*>Microsoft Store からダウンロード<\/a>/)
	assert.match(stripComments(read('_includes/footer-intl.html')), /data-dl="footer"[^>]*>\{\{ site\.data\.l10n\[page\.lang\]\.parts\.st_label \}\}<\/a>/)
	assert.match(stripComments(read('_includes/header.html')), /"label":"Microsoft Store からダウンロード"/)
	assert.match(stripComments(read('_includes/header-intl.html')), /"label":"\{\{ site\.data\.l10n\[page\.lang\]\.parts\.st_label \}\}"/)
	// 「無料でダウンロード」の文のボタンは残っていない
	for (const rel of [...DL_FILES, '_includes/cta-download.html', '_includes/pricing-cards.html', '_data/l10n/en/nav.yml', '_data/l10n/zh-tw/nav.yml', '_data/l10n/en/parts.yml', '_data/l10n/zh-tw/parts.yml']) {
		assert.doesNotMatch(stripComments(read(rel)).replace(/#.*$/gm, ''), /無料でダウンロード|Download for free|免費下載/, `${rel}: 「無料でダウンロード」の文が残っている`)
	}
})

test('JSON-LD の downloadUrl: Store の掲載ページ (切り替えなし)', () => {
	const src = stripComments(read('_includes/schema/software-application.html'))
	assert.doesNotMatch(src, /installer_enabled|app_download_link/)
	assert.match(src, /capture sw_download -%\}https:\/\/apps\.microsoft\.com\/detail\/\{\{ L\.app_store_product_id \}\}\{%- endcapture/)
	assert.match(src, /"downloadUrl": \{\{ sw_download \| jsonify \}\}/)
})

// GPU 高速化はスイッチを持たず、NVIDIA 製 GPU 搭載機で自動取得 (site-copy-docs-help-menu.test.js)
test('#setup: 検出エンジンはアプリに含まれ、GPU 高速化は NVIDIA 製 GPU 搭載機で自動取得', () => {
	const setup = textOf(sectionOf(read('_includes/docs/01-intro.html'), 'setup') ?? '')
	assert.match(setup, /検出エンジンと軽量の検出モデルはアプリに含まれています/)
	assert.match(setup, /初回に高速化用のコンポーネント/)
	assert.doesNotMatch(setup, /自動では取得しません/)
	assert.doesNotMatch(setup, /モデルデータと検出エンジンが自動でダウンロード/)
})
