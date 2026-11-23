// ダウンロードの導線は Microsoft Store の公式のバッジだけ。
//
//   node --test src/lib/site-store-button.test.js
//
//   - `_data/site.yml` の `distribution.store_enabled` は true (false はダウンロードの導線が無くなるので検査がエラーにする)。
//     公式サイトからインストーラを配る導線 (切り替え・URL・部品) は持たない。
//   - バッジは `_includes/store-button.html` (置き場所と料金のカードの Free の帯) と、ヘッダーが `_includes/store-badge-img.html` で描く。
//     画像は `assets/img/store-badge/<ja|en|zh-tw>.svg` (Microsoft の配布元の画像をそのまま。README に出所と sha256)、
//     alt はバッジに書かれた文 (ja は直書き、英中は parts.yml の st_label)。
//   - 置き場所はヒーロー (hero-store)・DL の CTA (cta-store、トップ / 料金 / 動作環境)・docs の #install (docs-install-store)・
//     /join/ の「アプリをまだ入れていない方」(join-store)。料金のカード (Free の帯) とヘッダーもバッジ、フッターとドロワーは文字のリンク、
//     料金のカードのダウンロードのカード (HOBBY) は文字のボタン「アプリをダウンロード」。
//   - Store へ向くリンクの href は Microsoft Store のインストーラを直接ダウンロードする URL (`_includes/store-install-url.html` が組む。3 言語で同じ。
//     部品に ID や get.microsoft.com を直書きしない)。応答がファイルの保存なので target を付けない。クエリの無い掲載ページは JSON-LD の downloadUrl だけ。
//   - ビルド出力の検査は `scripts/i18n/checks/store.mjs` (check-site のモジュール)。ここではその検査の単体 (作った _site の模型で陽性対照と陰性対照) を見る。
//   - `_site` は読まない (CI では npm test がビルドの前に走る)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import check, {
	badgeSrc,
	CARD_LABELS,
	checkStore,
	expectedPlacements,
	langOfFile,
	LEGAL_STORE_MARKS,
	parseStoreEnabled,
	readStoreEnabled,
	SPEC_STORE_KEYS,
	STORE_LABELS,
	STORE_SOURCE,
	storeBadgeUrl,
	storeListingUrl,
	strayStoreInstallerCount,
	SUBSCRIBE_PAGES,
} from '../../scripts/i18n/checks/store.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Store へ向くリンクの行き先 (Microsoft Store のインストーラを直接ダウンロードする URL。3 言語で同じ。source はこのサイトのドメイン) */
const STORE_URL = 'https://get.microsoft.com/installer/download/9PDKMKWHN9RW?referrer=appbadge&source=www.deepmosaic.co.jp'
/** クエリの無い掲載ページ (JSON-LD の downloadUrl だけ) */
const LISTING_URL = 'https://apps.microsoft.com/detail/9PDKMKWHN9RW'
/** 部品の href (バッジの行き先を組む部品) */
const INSTALL_INC = '{% include store-install-url.html %}'
const INSTALL_INC_RE = /\{% include store-install-url\.html %\}/
const INSTALLER_URL = 'https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows'
const LANGS = ['ja', 'en', 'zh-tw']

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

/** 平らな `key: "value"` の YAML を読む (parts.yml の形)。 */
function flatYaml(src) {
	const out = {}
	for (const m of src.matchAll(/^([a-z_]+):\s*"((?:[^"\\]|\\.)*)"/gm)) out[m[1]] = m[2]
	return out
}

/** 引用符の外の `>` で閉じる開始タグを返す (Liquid の `%}` の `>` で切らないよう、`{% %}` と `{{ }}` を飛ばす)。 */
function tagsOf(src, re) {
	const out = []
	for (const m of src.matchAll(re)) {
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

// ---- 1. 切り替え ----

test('site.yml: distribution は store_enabled: true だけ (インストーラの切り替えは無い)', () => {
	const yaml = read('_data/site.yml')
	assert.equal((yaml.match(/^\s*store_enabled:/gm) ?? []).length, 1, 'store_enabled が 2 か所以上ある (コメントは数えない)')
	assert.doesNotMatch(yaml.replace(/#.*$/gm, ''), /installer_enabled/)
	assert.equal(readStoreEnabled(ROOT), true)
})

test('parseStoreEnabled / readStoreEnabled: true・false・CRLF・無い・distribution の外 (陽性対照と陰性対照)', () => {
	assert.equal(parseStoreEnabled('distribution:\n  # x\n  store_enabled: true\n'), true)
	assert.equal(parseStoreEnabled('distribution:\r\n  store_enabled: true\r\n'), true, 'CRLF')
	assert.equal(parseStoreEnabled('distribution:\n  store_enabled: false\n'), false)
	assert.equal(parseStoreEnabled('web_app:\n  enabled: true\n'), false, '無ければ false')
	assert.equal(parseStoreEnabled('other:\n  store_enabled: true\ndistribution:\n  store_enabled: false\n'), false, 'distribution 以外は読まない')
	const dir = mkdtempSync(join(tmpdir(), 'store-flag-'))
	try {
		assert.equal(readStoreEnabled(dir), false, 'site.yml が無い')
		mkdirSync(join(dir, '_data'))
		writeFileSync(join(dir, '_data', 'site.yml'), 'web_app:\n  enabled: true\ndistribution:\n  store_enabled: true\n')
		assert.equal(readStoreEnabled(dir), true)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('切り替えを読むのは部品だけ (ページ・置き場所の部品に条件を書かない)、インストーラの切り替えはどこにも無い', () => {
	for (const rel of [
		'index.html',
		'en/index.html',
		'zh-tw/index.html',
		'join/index.html',
		'en/join/index.html',
		'zh-tw/join/index.html',
		'_includes/cta-download.html',
		'_includes/pricing-cards.html',
		'_includes/header.html',
		'_includes/header-intl.html',
		'_includes/footer.html',
		'_includes/footer-intl.html',
		'_includes/schema/software-application.html',
		'_includes/docs/01-intro.html',
		'_includes/docs/en/01-intro.html',
		'_includes/docs/zh-tw/01-intro.html',
		'_includes/docs/06-ops.html',
		'_includes/docs/07-team.html',
	]) {
		assert.doesNotMatch(stripComments(read(rel)), /store_enabled|installer_enabled/, `${rel} が切り替えを直接読んでいる`)
	}
	assert.equal(existsSync(join(ROOT, 'scripts/check-store-toggle.mjs')), false, '巻き戻しの形の検査が残っている')
	assert.doesNotMatch(read('.github/workflows/jekyll.yml'), /check-store-toggle|download\/latest\/windows/)
	// 読む所の一覧を検査の先頭のコメントに書く
	const head = read('scripts/i18n/checks/store.mjs').split('\nimport ')[0]
	for (const part of ['store-button.html', 'store-subscribe-note.html', 'faq.html', 'legal-distribution.html', 'spec/index.html']) {
		assert.ok(head.includes(part), `store.mjs の先頭のコメントに ${part} が無い`)
	}
	assert.doesNotMatch(head, /installer_enabled|巻き戻し/)
})

// ---- 2. 部品 ----

test('store-button.html: 全体が store_enabled の if の中にあり、false のときは何も出さない', () => {
	const src = stripComments(read('_includes/store-button.html'))
	const m = src.match(/^\s*\{%-?\s*if site\.data\.site\.distribution\.store_enabled\s*-?%\}([\s\S]*)\{%-?\s*endif\s*-?%\}\s*$/)
	assert.ok(m, 'if の外に出力がある (false のときに空の要素や空白以外が残る)')
	assert.equal((src.match(/\{%-?\s*(?:if|unless)\b/g) ?? []).length, (src.match(/\{%-?\s*end(?:if|unless)\b/g) ?? []).length)
})

test('store-install-url.html: インストーラを直接ダウンロードする URL を app_store_product_id から空白なしで組む (3 言語で同じ)', () => {
	const src = stripComments(read('_includes/store-install-url.html'))
	assert.match(src, /\{%- capture ([a-z_]+) -%\}https:\/\/get\.microsoft\.com\/installer\/download\/\{\{ site\.data\.lang\.ja\.app_store_product_id \}\}\?referrer=appbadge&source=www\.deepmosaic\.co\.jp\{%- endcapture -%\}\s*\{\{ \1 -\}\}\s*$/, '形がインストーラの直接のダウンロードと違う')
	assert.ok(src.includes(`source=${STORE_SOURCE}`), 'source はこのサイトのドメイン')
	assert.doesNotMatch(src, /page\.lang|hl=|gl=|mode=/, '言語・国・表示の指定は付けない (インストーラは言語で変わらない)')
	assert.doesNotMatch(src, /9PDKMKWHN9RW/, 'ID を直書きしている')
	assert.doesNotMatch(src, /apps\.microsoft\.com|cid=/, '掲載ページへ向けない')
	// 属性やドロワーの JSON の中に置くので、出力の前後に空白・改行を出さない (Liquid の空白の除去)
	assert.match(src, /^\s*\{%-/, '先頭の空白を除いていない')
	assert.match(src, /-\}\}\s*$/, '末尾の改行を除いていない')
	// 検査 (store.mjs) が期待する URL と同じ形
	assert.equal(storeBadgeUrl(ROOT), STORE_URL)
	assert.equal(storeListingUrl(ROOT), LISTING_URL)
})

test('Store へ向く部品は store-install-url.html を include し、掲載ページも ID の直書きも持たない', () => {
	for (const rel of ['_includes/store-button.html', '_includes/pricing-cards.html', '_includes/header.html', '_includes/header-intl.html', '_includes/footer.html', '_includes/footer-intl.html']) {
		const src = stripComments(read(rel))
		assert.match(src, INSTALL_INC_RE, `${rel}: バッジの行き先の部品を使っていない`)
		assert.doesNotMatch(src, /apps\.microsoft\.com|get\.microsoft\.com|9PDKMKWHN9RW|app_store_product_id/, `${rel}: URL か ID を直書きしている`)
	}
})

test('store-badge-img.html: ページの言語の画像・alt (ja は直書き、英中は st_label)・元の寸法・高さだけを決める class', () => {
	const src = stripComments(read('_includes/store-badge-img.html'))
	const tag = tagsOf(src, /<img\s/g)[0] ?? ''
	assert.ok(tag, '<img> が無い')
	assert.match(tag, /src="\/assets\/img\/store-badge\/\{\{ page\.lang \| default: 'ja' \}\}\.svg\?v=dark"/, '画像を替えたら ?v= の値も替える (古い画像のキャッシュを使わせない)')
	assert.match(tag, /width="161" height="44"/, '元の寸法 (縦横比を変えない)')
	assert.match(tag, /alt="\{% if sbi_P %\}\{\{ sbi_P\.st_label \}\}\{% else %\}Microsoft Store からダウンロード\{% endif %\}"/)
	assert.match(src, /assign sbi_P = site\.data\.l10n\[page\.lang\]\.parts/)
	assert.match(tag, /class="store-badge \{\{ include\.class \| default: 'h-\[38px\] w-auto' \}\}"/, '既定は普通のボタンの高さで、幅は縦横比のまま。目印 store-badge は常に付く')
	assert.match(read('src/app.css'), /\.rich-prose :where\(img:not\(\.store-badge\)\)/, '本文の img のスタイルをバッジに当てない')
	assert.match(read('src/app.css'), /\.store-badge-link \{\s*box-shadow: 0 0 0 1px rgb\(255 255 255 \/ 0\.7\);/, 'バッジのリンクの外側の縁は寸法を変えない box-shadow')
	assert.match(tag, /\{% if include\.lazy %\} loading="lazy" decoding="async"\{% endif %\}/)
})

test('store-button.html: href はバッジの行き先、ファイル DL の属性は付けない、中身はバッジの画像だけ、size と note', () => {
	const src = stripComments(read('_includes/store-button.html'))
	assert.doesNotMatch(src, /app_download_link|installer_enabled|btn-primary|btn-secondary/, 'インストーラの URL・切り替え・文字のボタンの class が残っている')
	const tag = tagsOf(src, /<a\s/g)[0] ?? ''
	assert.ok(tag, '<a> が無い')
	assert.ok(tag.includes(`href="${INSTALL_INC}"`), 'href がバッジの行き先の部品でない')
	assert.doesNotMatch(tag, /\sdownload(\s|>|=)/, 'download 属性 (ファイル DL ではない)')
	assert.match(tag, /data-store-button="\{\{ include\.dl \}\}"/, '目印 data-store-button')
	assert.match(tag, /class="store-badge-link /, '外側の明るい縁 (暗い地でバッジの形を見せる)')
	assert.doesNotMatch(tag, /\starget=/, 'インストーラのダウンロードは同じタブで開く (target を付けない)')
	assert.match(src, /page\.no_tracking/, '計測しないページでは data-dl を出さない')
	assert.match(src, /<\/a>/)
	const inner = src.slice(src.indexOf(tag) + tag.length, src.indexOf('</a>'))
	assert.equal(inner, '{% include store-badge-img.html class=st_img lazy=include.lazy %}', '中身はバッジの画像だけ')
	assert.match(src, /include\.size == 'hero'[\s\S]*'h-\[60px\] w-auto sm:h-\[72px\]'[\s\S]*\{%- else -%\}\{%- assign st_img = 'h-\[38px\] w-auto' -%\}/, 'hero はトップの冒頭とページ末尾の案内の大きさ、それ以外は普通のボタンと同じ高さ')
	assert.doesNotMatch(src, /include\.size == 'large'|h-\[50px\]/, '使わない大きさの分岐が残っている')
	assert.match(src, /\{% if include\.note %\}<p class="mt-2 text-sm text-ink-4">\{\{ include\.note \}\}<\/p>\{% endif %\}/)
})

test('バッジの画像: 3 言語の SVG が Microsoft の配布元の画像のまま (README の sha256 と一致・寸法 161 × 44・スクリプトなし)', () => {
	const readme = read('README.md')
	for (const lang of LANGS) {
		const rel = `assets/img/store-badge/${lang}.svg`
		assert.ok(existsSync(join(ROOT, rel)), `${rel} が無い`)
		assert.equal(badgeSrc(lang), `/${rel}?v=dark`)
		const buf = readFileSync(join(ROOT, rel))
		const svg = buf.toString('utf8')
		assert.match(svg, /^<svg width="161" height="44" viewBox="0 0 161 44"/)
		assert.doesNotMatch(svg, /<script|\son[a-z]+=|href=/i, `${rel}: スクリプトやリンクを含む`)
		// 配布元のバイトのまま (.gitattributes で改行を変換しない) で、sha256 が README の記録と一致する (形・色・文字を変えていない)
		const sha = createHash('sha256').update(buf).digest('hex')
		assert.ok(readme.includes(sha), `${rel}: README に sha256 ${sha} が無い (画像を変えたか、記録が古い)`)
	}
	// サイトの地が暗いので dark 版 (黒地に白い文字)
	assert.match(readme, /https:\/\/get\.microsoft\.com\/images\/ja%20dark\.svg/)
	assert.match(readme, /https:\/\/get\.microsoft\.com\/images\/en-us%20dark\.svg/)
	assert.match(readme, /https:\/\/get\.microsoft\.com\/images\/zh-tw%20dark\.svg/)
	for (const lang of LANGS) assert.match(read(`assets/img/store-badge/${lang}.svg`), /^<svg[^>]*>\s*<rect [^>]*fill="#202020"\/>/, `${lang}: dark 版の地の色でない`)
})

test('parts.yml: st_label の英中はバッジに書かれた文 (用語集の Microsoft Store は訳さない)', () => {
	const en = flatYaml(read('_data/l10n/en/parts.yml'))
	const zh = flatYaml(read('_data/l10n/zh-tw/parts.yml'))
	assert.equal(en.st_label, 'Download from the Microsoft Store')
	assert.equal(zh.st_label, '從 Microsoft Store 下載')
	assert.deepEqual(STORE_LABELS, { ja: 'Microsoft Store からダウンロード', en: en.st_label, 'zh-tw': zh.st_label })
	assert.equal('dl_label_default' in en || 'dl_label_default' in zh, false, 'インストーラのボタンの文が残っている')
})

// ---- 3. 置き場所 ----

/** `{% include <name> … dl="<id>" … %}` の数 */
const includesOf = (src, id, name = 'store-button') =>
	(stripComments(src).match(new RegExp(`\\{%-?\\s*include ${name}\\.html[^%]*\\bdl="${id}"[^%]*%\\}`, 'g')) ?? []).length

test('置き場所: ヒーロー (3 言語)・DL の CTA・docs の #install・/join/ (3 言語)。インストーラのボタンは無い', () => {
	for (const rel of ['index.html', 'en/index.html', 'zh-tw/index.html']) {
		const hero = stripComments(read(rel))
		assert.equal(includesOf(hero, 'hero-store'), 1, `${rel} のヒーロー`)
		assert.doesNotMatch(hero, /download-button|app_download_link/, `${rel}: インストーラのボタンが残っている`)
		const st = hero.search(/include store-button\.html[^%]*dl="hero-store"/)
		const web = hero.indexOf('data-dl="hero-webapp"')
		assert.ok(st > 0 && st < web, `${rel}: Store のバッジが Web 版の前に無い`)
	}
	const cta = stripComments(read('_includes/cta-download.html'))
	assert.equal(includesOf(cta, 'cta-store'), 1, 'cta-download.html')
	assert.doesNotMatch(cta, /download-button/)
	for (const rel of ['_includes/docs/01-intro.html', '_includes/docs/en/01-intro.html', '_includes/docs/zh-tw/01-intro.html']) {
		const install = read(rel)
		const sec = install.slice(install.indexOf('<section id="install"'), install.indexOf('</section>', install.indexOf('<section id="install"')))
		assert.equal(includesOf(sec, 'docs-install-store'), 1, `${rel} の #install`)
		assert.doesNotMatch(sec, /download-button/, `${rel}: #install にインストーラのボタンが残っている`)
		assert.match(sec, /include store-button\.html dl="docs-install-store"[^%]*note="/, `${rel}: Store のバッジに補足文`)
	}
	for (const rel of ['join/index.html', 'en/join/index.html', 'zh-tw/join/index.html']) {
		const src = stripComments(read(rel))
		const box = src.slice(src.indexOf('data-join-install'))
		assert.equal(includesOf(box, 'join-store'), 1, `${rel} の「アプリをまだ入れていない方」`)
		assert.equal(/data-dl\b/.test(src), false, `${rel}: data-dl`)
	}
	// 料金のカード: Free の帯はバッジの部品 (dl はプランの code)。ダウンロードのカードは文字のボタン (下のテスト)
	const cards = stripComments(read('_includes/pricing-cards.html'))
	assert.equal((cards.match(/\{% include store-button\.html dl=plan\.code [^%]*%\}/g) ?? []).length, 1)
})

test('ヘッダー・ドロワー・フッター・JSON-LD: ヘッダーはバッジ、ドロワーとフッターは文字のリンク、JSON-LD は掲載ページ', () => {
	for (const rel of ['_includes/header.html', '_includes/header-intl.html', '_includes/footer.html', '_includes/footer-intl.html']) {
		const src = stripComments(read(rel))
		assert.doesNotMatch(src, /store-button\.html/, rel)
		const dl = rel.includes('header') ? 'header' : 'footer'
		const tags = tagsOf(src, /<a\s/g).filter((t) => t.includes(`data-dl="${dl}"`))
		assert.equal(tags.length, 1, `${rel}: data-dl="${dl}" の <a> が 1 つでない`)
		const [store] = tags
		assert.ok(store.includes(`href="${INSTALL_INC}"`), `${rel}: href がバッジの行き先の部品でない`)
		assert.doesNotMatch(store, /\starget=/, `${rel}: インストーラのダウンロードは同じタブで開く`)
		assert.match(store, new RegExp(`data-store-button="${dl}"`))
		if (dl === 'header') assert.match(store, /class="store-badge-link /, `${rel}: バッジの外側の明るい縁 (store-button.html と同じ class)`)
		assert.doesNotMatch(store, /\sdownload(\s|>|=)/)
		const inner = src.slice(src.indexOf(store) + store.length, src.indexOf('</a>', src.indexOf(store)))
		if (dl === 'header') assert.equal(inner, '{% include store-badge-img.html %}', `${rel}: ヘッダーの中身はバッジの画像だけ`)
		else assert.equal(inner, rel.endsWith('-intl.html') ? '{{ site.data.l10n[page.lang].parts.st_label }}' : 'Microsoft Store からダウンロード', `${rel}: フッターの文`)
	}
	for (const rel of ['_includes/header.html', '_includes/header-intl.html']) {
		const src = stripComments(read(rel))
		const items = [...src.matchAll(/\{"label":"[^"]*","href":"([^"]*)","dl":"mobile"\}/g)].map((m) => m[0])
		assert.equal(items.length, 1, `${rel}: ドロワーの DL の項目が 1 つでない (target は付けない)`)
		assert.ok(items[0].includes(`"href":"${INSTALL_INC}","dl":"mobile"`), `${rel}: ドロワーの Store の項目がバッジの行き先の部品でない`)
		assert.match(src, /data-links='\[\{\{ hd_mobile_dl \}\},\{"label"/, `${rel}: ドロワーの先頭が DL の項目でない`)
	}
	const ld = stripComments(read('_includes/schema/software-application.html'))
	assert.doesNotMatch(ld, /installer_enabled|app_download_link/)
	assert.match(ld, /"downloadUrl": \{\{ sw_download \| jsonify \}\}/)
	assert.match(ld, /https:\/\/apps\.microsoft\.com\/detail\/\{\{ L\.app_store_product_id \}\}/)
})

test('料金のカード: ダウンロードのカードはインストーラを直接ダウンロードする文字のボタン (主ボタン・全幅・プランの code の目印)、申し込みのページへは向けない', () => {
	const src = stripComments(read('_includes/pricing-cards.html'))
	assert.doesNotMatch(src, /plan\.subscribe|\/subscribe\//, '料金のカードから申し込みのページへ向けない')
	const iDl = src.indexOf('{%- if plan.cta.kind == "download" %}')
	const iElse = src.indexOf('{%- else %}', iDl)
	assert.ok(iDl >= 0 && iElse > iDl, 'ダウンロードのカードの分岐が無い')
	const branch = src.slice(iDl, iElse)
	const tag = tagsOf(branch, /<a\s/g)[0] ?? ''
	assert.ok(tag.includes(`href="${INSTALL_INC}"`), 'href がバッジの行き先の部品でない')
	assert.match(tag, /class="\{% if plan\.cta\.variant == 'secondary' %\}btn-secondary\{% else %\}btn-primary\{% endif %\} w-full"/, '青い主ボタン (全幅) のまま')
	assert.match(tag, /data-store-button="\{\{ plan\.code \}\}"/)
	assert.match(tag, /\{% unless page\.no_tracking %\} data-dl="\{\{ plan\.code \}\}"\{% endunless %\}/)
	assert.doesNotMatch(tag, /\starget=|\sdownload(\s|>|=)/)
	assert.match(branch, /\{% if pc_PL %\}\{\{ pc_T\.cta_label \| default: plan\.cta\.label \}\}\{% else %\}\{\{ plan\.cta\.label \}\}\{% endif %\}<\/a>/)
	assert.doesNotMatch(branch, /include store-badge-img|include store-button/, 'バッジにしない')
	// 文 (3 言語)。検査 (store.mjs) の CARD_LABELS と同じ
	const ja = [...read('_data/plans.yml').matchAll(/^ {6}label: "([^"]*)"\s*\n {6}kind: "download"/gm)].map((m) => m[1])
	assert.deepEqual(ja, [CARD_LABELS.ja, CARD_LABELS.ja], 'HOBBY と Pro の cta.label')
	for (const lang of ['en', 'zh-tw']) {
		const l10n = [...read(`_data/l10n/${lang}/plans.yml`).matchAll(/^ {4}cta_label: "([^"]*)"/gm)].map((m) => m[1])
		assert.deepEqual(l10n.slice(0, 2), [CARD_LABELS[lang], CARD_LABELS[lang]], `${lang}: HOBBY と Pro の cta_label`)
	}
	assert.deepEqual(CARD_LABELS, { ja: 'アプリをダウンロード', en: 'Download the app', 'zh-tw': '下載應用程式' })
})

test('expectedPlacements: 4 か所 × 3 言語', () => {
	const list = expectedPlacements()
	const ids = (id) => list.filter((p) => p.id === id).map((p) => p.file).sort()
	assert.deepEqual(ids('hero-store'), ['en/index.html', 'index.html', 'zh-tw/index.html'])
	assert.deepEqual(ids('cta-store'), ['en/index.html', 'en/price/index.html', 'en/spec/index.html', 'index.html', 'price/index.html', 'spec/index.html', 'zh-tw/index.html', 'zh-tw/price/index.html', 'zh-tw/spec/index.html'])
	assert.deepEqual(ids('docs-install-store'), ['docs/index.html', 'en/docs/index.html', 'zh-tw/docs/index.html'])
	assert.deepEqual(ids('join-store'), ['en/join/index.html', 'join/index.html', 'zh-tw/join/index.html'])
	for (const p of list) assert.equal(p.tracked, p.id !== 'join-store', `${p.file} ${p.id}`)
	assert.equal(langOfFile('en/x.html'), 'en')
	assert.equal(langOfFile('zh-tw/x.html'), 'zh-tw')
	assert.equal(langOfFile('price/index.html'), 'ja')
})

// ---- 4. checks/store.mjs の単体 (作った _site の模型) ----

const img = (lang) => `<img src="${badgeSrc(lang)}" alt="${STORE_LABELS[lang]}" width="161" height="44" class="h-[38px] w-auto">`
const badge = (id, lang, { tracked = true, href = STORE_URL } = {}) =>
	`<a class="store-badge-link inline-flex shrink-0 rounded-[5px]" href="${href}" data-store-button="${id}"${tracked ? ` data-dl="${id}"` : ''}>${img(lang)}</a>`

/** 料金のカードのダウンロードのボタン (文字のボタン) */
const cardButton = (code, lang) => `<a href="${STORE_URL}" class="btn-primary w-full" data-store-button="${code}" data-dl="${code}">${CARD_LABELS[lang]}</a>`

/** ヘッダー (バッジ)・ドロワー・フッター (文字のリンク) */
function chrome(lang) {
	const item = `{"label":"${STORE_LABELS[lang]}","href":"${STORE_URL}","dl":"mobile"}`
	return {
		head: `<header><a href="${STORE_URL}" data-store-button="header" data-dl="header" class="hidden">${img(lang)}</a><div data-island="mobile-nav" data-links='[${item},{"label":"Home","href":"/"}]'></div></header>`,
		foot: `<footer><a href="${STORE_URL}" data-store-button="footer" data-dl="footer" class="x">${STORE_LABELS[lang]}</a></footer>`,
	}
}

/** 期待どおりの模型 */
function files() {
	const out = {}
	const page = (rel, inner) => {
		const { head, foot } = chrome(langOfFile(rel))
		out[rel] = `<html><head><link rel="canonical" href="https://www.deepmosaic.co.jp/x" /></head><body>${head}${inner}${foot}</body></html>`
	}
	const inner = {}
	const add = (rel, html) => {
		inner[rel] = (inner[rel] ?? '') + html
	}
	for (const p of expectedPlacements()) add(p.file, badge(p.id, p.lang, { tracked: p.tracked }))
	for (const rel of SUBSCRIBE_PAGES) add(rel, subscribeInner())
	for (const rel of ['spec/index.html', 'en/spec/index.html', 'zh-tw/spec/index.html']) add(rel, `<div class="kv-key">${SPEC_STORE_KEYS[langOfFile(rel)]}</div>`)
	// 料金のカード (ダウンロードのカードの文字のボタンと Free の帯のバッジ)
	for (const rel of ['price/index.html', 'en/price/index.html', 'zh-tw/price/index.html']) add(rel, cardButton('light', langOfFile(rel)) + badge('free', langOfFile(rel)))
	// JSON-LD の downloadUrl
	for (const rel of ['index.html', 'en/index.html', 'zh-tw/index.html']) {
		add(rel, `<script type="application/ld+json">{"@type": "SoftwareApplication", "downloadUrl": "${LISTING_URL}"}</script>`)
	}
	for (const [rel, html] of Object.entries(inner)) page(rel, html)
	for (const [rel, marks] of Object.entries(LEGAL_STORE_MARKS)) page(rel, `<p>x</p>${marks.map((m) => `<p>${m}</p>`).join('')}`)
	return out
}

/** 申し込みのページの中身 (Store 版の文と FAQ の項目がある) */
function subscribeInner() {
	const ld = '{"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": "a"}, {"@type": "Question", "name": "Microsoft Store x"}]}'
	return `<script type="application/ld+json">${ld}</script><p>x</p><p data-store-note="subscribe">Microsoft Store y</p><details>a</details><details>Microsoft Store x</details>`
}

function withSite(siteFiles, fn, { extra = {}, siteYml = 'distribution:\n  store_enabled: true\n' } = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'store-check-'))
	try {
		mkdirSync(join(dir, '_data', 'lang'), { recursive: true })
		writeFileSync(join(dir, '_data', 'lang', 'ja.json'), JSON.stringify({ app_store_product_id: '9PDKMKWHN9RW' }))
		writeFileSync(join(dir, '_data', 'site.yml'), siteYml)
		writeFileSync(join(dir, '_config.yml'), 'title: x\nurl: "https://www.deepmosaic.co.jp"\nbaseurl: ""\n')
		for (const [rel, body] of Object.entries({ ...siteFiles, ...extra })) {
			mkdirSync(dirname(join(dir, '_site', rel)), { recursive: true })
			writeFileSync(join(dir, '_site', rel), body)
		}
		return fn(makeContext(join(dir, '_site'), dir))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

/** 模型を edit で崩して、re に当たるエラーが出ることを確かめる */
function expectDetected(cases) {
	for (const [what, edit, re] of cases) {
		withSite(edit(files()), (ctx) => {
			const errors = checkStore(ctx, true)
			assert.ok(errors.length > 0, `${what}: 検出されない`)
			assert.ok(errors.some((e) => re.test(e)), `${what}: ${errors.join(' / ')}`)
		})
	}
}

test('check (store_enabled: false): ダウンロードの導線が無いのでエラー 1 件', () => {
	withSite(files(), (ctx) => {
		const errors = checkStore(ctx, false)
		assert.equal(errors.length, 1, errors.join(' / '))
		assert.match(errors[0], /store_enabled/)
	})
	withSite({ 'index.html': '<html><body><p>x</p></body></html>' }, (ctx) => assert.equal(check(ctx).length, 1, 'false は模型でもエラー'), { siteYml: 'distribution:\n  store_enabled: false\n' })
})

test('check: 4 か所 × 言語・ヘッダー・料金のカードにその言語のバッジ、フッターとドロワーに Store の文があれば 0 件', () => {
	withSite(files(), (ctx) => {
		assert.deepEqual(checkStore(ctx, true), [])
		assert.deepEqual(check(ctx), [], 'site.yml を読む')
	})
	// check-site から (default export): 実際のビルド (ja のトップがレイアウトを通っている) なら検査し、ほかの検査の模型では何もしない
	withSite({ ...files(), 'contact/index.html': badge('hero-store', 'ja') }, (ctx) => {
		assert.match(check(ctx).join(' / '), /contact\/index\.html.*hero-store/)
	})
	withSite({ 'index.html': '<html><body><p>x</p></body></html>' }, (ctx) => assert.deepEqual(check(ctx), [], '模型 (canonical なし)'))
})

test('check: 置き場所のバッジの欠け・URL・画像・alt・寸法・文字・計測と、申し込み・法務・動作環境の記述の欠けを検出', () => {
	const swapImg = (f, rel, id, to) => ({ ...f, [rel]: f[rel].replace(new RegExp(`(data-store-button="${id}"[^>]*>)<img[^>]*>`), `$1${to}`) })
	expectDetected([
		['バッジが欠ける', (f) => ({ ...f, 'zh-tw/spec/index.html': f['zh-tw/spec/index.html'].replace(/<a [^>]*data-store-button="cta-store"[^>]*><img[^>]*><\/a>/, '') }), /zh-tw\/spec\/index\.html.*cta-store/],
		['ページが無い', (f) => { const g = { ...f }; delete g['en/join/index.html']; return g }, /en\/join\/index\.html/],
		['2 つ出ている', (f) => ({ ...f, 'index.html': f['index.html'] + badge('hero-store', 'ja') }), /index\.html.*hero-store.*2/],
		['href がクエリの無い掲載ページ', (f) => ({ ...f, 'en/spec/index.html': f['en/spec/index.html'].replace(`href="${STORE_URL}" data-store-button="cta-store"`, `href="${LISTING_URL}" data-store-button="cta-store"`) }), /en\/spec\/index\.html.*cta-store の href.*バッジの行き先/],
		['href の source が別のドメイン', (f) => ({ ...f, 'zh-tw/price/index.html': f['zh-tw/price/index.html'].replace(`href="${STORE_URL}" data-store-button="cta-store"`, `href="${STORE_URL.replace(STORE_SOURCE, 'app.deepmosaic.co.jp')}" data-store-button="cta-store"`) }), /zh-tw\/price\/index\.html.*cta-store の href.*source=www\.deepmosaic\.co\.jp/],
		['href がサイト配布版のインストーラ', (f) => ({ ...f, 'price/index.html': f['price/index.html'].replace(`href="${STORE_URL}" data-store-button="cta-store"`, `href="${INSTALLER_URL}" data-store-button="cta-store"`) }), /price\/index\.html.*cta-store の href/],
		['置き場所のバッジが別タブ', (f) => ({ ...f, 'en/index.html': f['en/index.html'].replace('data-store-button="hero-store"', 'target="_blank" data-store-button="hero-store"') }), /en\/index\.html.*hero-store に target/],
		['画像が別の言語', (f) => swapImg(f, 'en/price/index.html', 'cta-store', img('ja').replace(`alt="${STORE_LABELS.ja}"`, `alt="${STORE_LABELS.en}"`)), /en\/price\/index\.html.*cta-store.*en の版/],
		['alt が別の言語', (f) => swapImg(f, 'zh-tw/index.html', 'hero-store', img('zh-tw').replace(`alt="${STORE_LABELS['zh-tw']}"`, `alt="${STORE_LABELS.ja}"`)), /zh-tw\/index\.html.*hero-store.*alt/],
		['alt が無い', (f) => swapImg(f, 'docs/index.html', 'docs-install-store', img('ja').replace(/ alt="[^"]*"/, '')), /docs\/index\.html.*docs-install-store.*alt/],
		['寸法が違う (縦横比を変えた)', (f) => swapImg(f, 'spec/index.html', 'cta-store', img('ja').replace('width="161"', 'width="200"')), /spec\/index\.html.*cta-store.*161 × 44/],
		['画像が無く文字のボタン', (f) => swapImg(f, 'index.html', 'hero-store', '無料でダウンロード'), /^index\.html.*hero-store.*(画像のほかの文|画像が 0 個)/],
		['計測しないページに data-dl', (f) => ({ ...f, 'join/index.html': f['join/index.html'].replace('data-store-button="join-store"', 'data-store-button="join-store" data-dl="join-store"') }), /join\/index\.html.*data-dl/],
		['計測するページに data-dl が無い', (f) => ({ ...f, 'docs/index.html': f['docs/index.html'].replace(' data-dl="docs-install-store"', '') }), /docs\/index\.html.*data-dl/],
		['download 属性', (f) => ({ ...f, 'spec/index.html': f['spec/index.html'].replace('data-store-button="cta-store"', 'download data-store-button="cta-store"') }), /spec\/index\.html.*download/],
		['置き場所でない所に置き場所のバッジ', (f) => ({ ...f, 'contact/index.html': badge('hero-store', 'ja') }), /contact\/index\.html.*hero-store/],
		['申し込みのページに Store 版の文が無い', (f) => ({ ...f, 'en/subscribe/index.html': f['en/subscribe/index.html'].replace(/<p data-store-note="subscribe">[^<]*<\/p>/, '') }), /en\/subscribe\/index\.html.*data-store-note/],
		['申し込みのページに Store 版の FAQ が無い', (f) => ({ ...f, 'zh-tw/subscribe/index.html': f['zh-tw/subscribe/index.html'].replace('<details>Microsoft Store x</details>', '') }), /zh-tw\/subscribe\/index\.html.*FAQ/],
		['JSON-LD に Store 版の FAQ が無い', (f) => ({ ...f, 'subscribe/index.html': f['subscribe/index.html'].replace(', {"@type": "Question", "name": "Microsoft Store x"}', '') }), /^subscribe\/index\.html.*JSON-LD/],
		['ほかのページに Store 版の文', (f) => ({ ...f, 'price/index.html': f['price/index.html'] + '<p data-store-note="subscribe">x</p>' }), /price\/index\.html.*data-store-note/],
		['privacy に 9-2 配信ストア版が無い', (f) => ({ ...f, 'company/privacy.html': f['company/privacy.html'].replace('<p>9-2 配信ストア版について</p>', '') }), /company\/privacy\.html.*9-2 配信ストア版について/],
		['privacy の文がコメントの中だけ', (f) => ({ ...f, 'company/privacy.html': f['company/privacy.html'].replace('<p>9-2 配信ストア版について</p>', '<!-- 9-2 配信ストア版について -->') }), /company\/privacy\.html.*9-2/],
		['cookie が無い', (f) => { const g = { ...f }; delete g['company/cookie.html']; return g }, /company\/cookie\.html/],
		['法務文書に置き場所のバッジ', (f) => ({ ...f, 'company/cookie.html': f['company/cookie.html'] + badge('cta-store', 'ja') }), /company\/cookie\.html.*cta-store/],
		['動作環境に Store 版の行が無い', (f) => ({ ...f, 'en/spec/index.html': f['en/spec/index.html'].replace(SPEC_STORE_KEYS.en, '') }), /en\/spec\/index\.html.*Microsoft Store edition/],
	])
})

test('check: ヘッダー・料金のカード (バッジ)・フッター・ドロワー (文)・JSON-LD の崩れと、出力のインストーラの受け口を検出', () => {
	expectDetected([
		['ヘッダーがインストーラ', (f) => ({ ...f, 'spec/index.html': f['spec/index.html'].replace(`<a href="${STORE_URL}" data-store-button="header"`, `<a href="${INSTALLER_URL}" data-store-button="header"`) }), /spec\/index\.html.*header のリンクの href/],
		['フッターのリンクが別タブ', (f) => ({ ...f, 'zh-tw/docs/index.html': f['zh-tw/docs/index.html'].replace('data-store-button="footer"', 'target="_blank" data-store-button="footer"') }), /zh-tw\/docs\/index\.html.*footer のリンクに target/],
		['ヘッダーのリンクに download', (f) => ({ ...f, 'price/index.html': f['price/index.html'].replace('data-store-button="header"', 'download data-store-button="header"') }), /price\/index\.html.*header.*download/],
		['ヘッダーのリンクの data-dl が違う', (f) => ({ ...f, 'en/index.html': f['en/index.html'].replace('data-store-button="header" data-dl="header"', 'data-store-button="header" data-dl="x"') }), /en\/index\.html.*header.*data-dl/],
		['ヘッダーが文字のボタン', (f) => ({ ...f, 'en/spec/index.html': f['en/spec/index.html'].replace(new RegExp(`(data-store-button="header"[^>]*>)<img[^>]*>`), '$1Download for free') }), /en\/spec\/index\.html.*header.*(画像のほかの文|画像が 0 個)/],
		['ヘッダーのバッジが別の言語', (f) => ({ ...f, 'zh-tw/price/index.html': f['zh-tw/price/index.html'].replace(new RegExp(`(data-store-button="header"[^>]*>)<img[^>]*>`), `$1${img('en')}`) }), /zh-tw\/price\/index\.html.*header.*zh-tw の版/],
		['フッターに目印が無い', (f) => ({ ...f, 'join/index.html': f['join/index.html'].replace(' data-store-button="footer"', '') }), /join\/index\.html.*footer/],
		['フッターの文が別の言語', (f) => ({ ...f, 'en/docs/index.html': f['en/docs/index.html'].replace(`data-dl="footer" class="x">${STORE_LABELS.en}</a>`, `data-dl="footer" class="x">Download</a>`) }), /en\/docs\/index\.html.*フッター.*文/],
		['ドロワーの先頭がインストーラ', (f) => ({ ...f, 'docs/index.html': f['docs/index.html'].replace(`"href":"${STORE_URL}","dl":"mobile"}`, `"href":"${INSTALLER_URL}","download":true,"dl":"mobile"}`) }), /docs\/index\.html.*ドロワー/],
		['ドロワーの先頭に download', (f) => ({ ...f, 'index.html': f['index.html'].replace('","dl":"mobile"', '","download":true,"dl":"mobile"') }), /^index\.html.*ドロワー/],
		['ドロワーの先頭が別タブ', (f) => ({ ...f, 'en/price/index.html': f['en/price/index.html'].replace('","dl":"mobile"', '","target":"_blank","dl":"mobile"') }), /en\/price\/index\.html.*ドロワー/],
		['ドロワーの先頭の文が「ダウンロード」', (f) => ({ ...f, 'spec/index.html': f['spec/index.html'].replace(`{"label":"${STORE_LABELS.ja}"`, '{"label":"ダウンロード"') }), /^spec\/index\.html.*ドロワー/],
		['ドロワーの先頭がクエリの無い掲載ページ', (f) => ({ ...f, 'spec/index.html': f['spec/index.html'].replace(`"href":"${STORE_URL}","dl"`, `"href":"${LISTING_URL}","dl"`) }), /^spec\/index\.html.*ドロワー/],
		['料金のカードのバッジに download', (f) => ({ ...f, 'zh-tw/price/index.html': f['zh-tw/price/index.html'].replace('data-store-button="free"', 'download data-store-button="free"') }), /zh-tw\/price\/index\.html.*free.*download/],
		['料金のカードがインストーラのボタン', (f) => ({ ...f, 'price/index.html': f['price/index.html'].replace(/<a [^>]*data-store-button="free"[^>]*><img[^>]*><\/a>/, `<a class="btn-secondary" download data-dl="free" href="/x">無料でダウンロード</a>`) }), /^price\/index\.html.*料金のカード/],
		['料金のカードの文字のボタンの文が別の言語', (f) => ({ ...f, 'en/price/index.html': f['en/price/index.html'].replace(`data-dl="light">${CARD_LABELS.en}</a>`, `data-dl="light">${CARD_LABELS.ja}</a>`) }), /en\/price\/index\.html.*light.*ダウンロードのボタンの文/],
		['料金のカードの文字のボタンが申し込みのページへ向く', (f) => ({ ...f, 'price/index.html': f['price/index.html'].replace(`<a href="${STORE_URL}" class="btn-primary w-full" data-store-button="light"`, '<a href="/subscribe/#plan-light" class="btn-primary w-full" data-store-button="light"') }), /^price\/index\.html.*light のリンクの href/],
		['料金のカードの文字のボタンが無い', (f) => ({ ...f, 'zh-tw/price/index.html': f['zh-tw/price/index.html'].replace(cardButton('light', 'zh-tw'), '') }), /zh-tw\/price\/index\.html.*ダウンロードのボタン \(文字のボタン\) が無い/],
		['料金のカードの文字のボタンが別タブ', (f) => ({ ...f, 'price/index.html': f['price/index.html'].replace('data-store-button="light"', 'target="_blank" data-store-button="light"') }), /^price\/index\.html.*light のリンクに target/],
		['JSON-LD の downloadUrl がインストーラ', (f) => ({ ...f, 'en/index.html': f['en/index.html'].replace(`"downloadUrl": "${LISTING_URL}"`, '"downloadUrl": "https://example.com/x"') }), /en\/index\.html.*downloadUrl/],
		['JSON-LD の downloadUrl がバッジの行き先', (f) => ({ ...f, 'zh-tw/index.html': f['zh-tw/index.html'].replace(`"downloadUrl": "${LISTING_URL}"`, `"downloadUrl": "${STORE_URL}"`) }), /zh-tw\/index\.html.*downloadUrl.*掲載ページ/],
	])
	// 出力のどこか (HTML・txt・JSON) にインストーラの受け口・配布物が 1 件でもあれば検出
	for (const [rel, body, mark] of [
		['company/about.html', `<a href="${INSTALLER_URL}">x</a>`, /download\/latest/],
		['llms.txt', `- DL: ${INSTALLER_URL}`, /download\/latest/],
		['llms-full.txt', 'x https://example.com/releases/latest/Deepmosaic_setup.exe', /releases\/latest|setup\.exe/],
		['data/x.json', '{"u": "https://example.com/latest.json"}', /latest\.json/],
	]) {
		withSite(files(), (ctx) => {
			const errors = checkStore(ctx, true)
			assert.ok(errors.some((e) => e.startsWith(`${rel}:`) && mark.test(e)), `${rel}: ${errors.join(' / ')}`)
		}, { extra: { [rel]: body } })
	}
	// Store のインストーラの URL が目印の外 (目印の無いリンク・txt・JSON・ドロワーの 2 件目以降) にあれば検出
	const drawerItem = `{"label":"${STORE_LABELS.ja}","href":"${STORE_URL}","dl":"mobile"}`
	for (const [rel, edit] of [
		['company/about.html', () => `<a href="${STORE_URL}">x</a>`],
		['llms.txt', () => `- DL: ${STORE_URL}`],
		['data/x.json', () => `{"u": "${STORE_URL}"}`],
		['index.html', (f) => f['index.html'].replace(`${drawerItem},{"label":"Home","href":"/"}`, `${drawerItem},{"label":"Home","href":"${STORE_URL}"}`)],
	]) {
		const f = files()
		withSite({ ...f, [rel]: edit(f) }, (ctx) => {
			const errors = checkStore(ctx, true)
			assert.ok(errors.some((e) => e.startsWith(`${rel}:`) && /目印/.test(e) && /Microsoft Store のインストーラの URL/.test(e)), `${rel}: ${errors.join(' / ')}`)
		})
	}
})

test('strayStoreInstallerCount: 目印の付いた <a> の開始タグとドロワーの先頭は数えず、その外は数える', () => {
	const tag = `<a class="x" href="${STORE_URL}" data-store-button="hero-store" data-dl="hero-store">`
	const drawer = (second) => `<div data-island="mobile-nav" data-links='[{"label":"a","href":"${STORE_URL}","dl":"mobile"},{"label":"b","href":"${second}"}]'></div>`
	assert.equal(strayStoreInstallerCount(''), 0)
	assert.equal(strayStoreInstallerCount(`${tag}x</a>${drawer('/')}`), 0)
	assert.equal(strayStoreInstallerCount(drawer(STORE_URL)), 1)
	assert.equal(strayStoreInstallerCount(`<a href="${STORE_URL}">x</a>`), 1)
	assert.equal(strayStoreInstallerCount(`${tag}x</a><p>${STORE_URL}</p> ${STORE_URL}`), 2)
})
