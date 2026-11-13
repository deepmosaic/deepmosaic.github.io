// T-2304 (backlog1113, 2026-11-13) Microsoft Store のボタンを切り替え 1 か所 (`_data/site.yml` の `distribution.store_enabled`) で出す。
//
//   node --test src/lib/site-store-button-t2304.test.js
//
//   - 2.14 はサイト配布版 (インストーラ) と Store 版の両方。ダウンロードの既定はインストーラ (T-2303)。
//   - Store のボタンは `_includes/store-button.html` だけが描く。`store_enabled` が false の間は何も出さない (空の要素も残さない)。
//   - 置き場所はヒーロー (hero-store)・DL の CTA (cta-store、トップ / 料金 / 動作環境)・docs の #install (docs-install-store、ja だけ)・
//     /join/ の「アプリをまだ入れていない方」(join-store)。英中のページも同じ位置。ヘッダーとドロワーには置かない。
//   - /join/ は計測しないページ (`no_tracking: true`) なので、部品は data-dl を出さず目印 (data-store-button) だけを出す。
//   - ビルド出力の検査は `scripts/i18n/checks/store.mjs` (check-site のモジュール)。true の出力は `scripts/check-store-toggle.mjs` が
//     切り替えを true にした写しのデータでビルドして確かめる。ここではその検査の単体 (作った _site の模型で陽性対照と陰性対照) を見る。
//   - `_site` は読まない (CI では npm test がビルドの前に走る)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import check, { checkStore, expectedPlacements, readStoreEnabled, STORE_LABELS, SUBSCRIBE_PAGES } from '../../scripts/i18n/checks/store.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const STORE_URL = 'https://apps.microsoft.com/detail/9PDKMKWHN9RW'

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

// ---- 1. 切り替え ----

test('site.yml: distribution.store_enabled が 1 か所にあり、既定は false', () => {
	const yaml = read('_data/site.yml')
	assert.match(yaml, /^distribution:\r?\n(?:[ \t]*#.*\r?\n)*[ \t]+store_enabled:[ \t]*false\s*$/m)
	assert.equal((yaml.match(/^\s*store_enabled:/gm) ?? []).length, 1, 'store_enabled が 2 か所以上ある (コメントは数えない)')
	assert.equal(readStoreEnabled(ROOT), false)
	// 切り替えを読むのは部品だけ (ページや他の部品に同じ条件を散らさない)
	for (const rel of ['index.html', 'en/index.html', 'zh-tw/index.html', '_includes/cta-download.html', '_includes/docs/01-intro.html', 'join/index.html', 'en/join/index.html', 'zh-tw/join/index.html']) {
		assert.doesNotMatch(stripComments(read(rel)), /store_enabled/, `${rel} が切り替えを直接読んでいる`)
	}
})

test('readStoreEnabled: true / false / 無い (陽性対照と陰性対照)', () => {
	const dir = mkdtempSync(join(tmpdir(), 'store-flag-'))
	try {
		mkdirSync(join(dir, '_data'))
		const write = (s) => writeFileSync(join(dir, '_data', 'site.yml'), s)
		write('web_app:\n  enabled: true\ndistribution:\n  # コメント\n  store_enabled: true\n')
		assert.equal(readStoreEnabled(dir), true)
		write('web_app:\n  enabled: true\ndistribution:\n  store_enabled: false\n')
		assert.equal(readStoreEnabled(dir), false)
		write('web_app:\r\n  enabled: true\r\ndistribution:\r\n  store_enabled: true\r\n')
		assert.equal(readStoreEnabled(dir), true, 'CRLF (Windows の作業ツリー)')
		write('web_app:\n  enabled: true\n')
		assert.equal(readStoreEnabled(dir), false, '無ければ false (出さない側)')
		write('other:\n  store_enabled: true\n')
		assert.equal(readStoreEnabled(dir), false, 'distribution 以外の store_enabled は読まない')
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

// ---- 2. 部品 ----

test('store-button.html: 全体が store_enabled の if の中にあり、false のときは何も出さない', () => {
	const src = stripComments(read('_includes/store-button.html'))
	const m = src.match(/^\s*\{%-?\s*if site\.data\.site\.distribution\.store_enabled\s*-?%\}([\s\S]*)\{%-?\s*endif\s*-?%\}\s*$/)
	assert.ok(m, 'if の外に出力がある (false のときに空の要素や空白以外が残る)')
	assert.equal((src.match(/\{%-?\s*if\b/g) ?? []).length, (src.match(/\{%-?\s*endif\b/g) ?? []).length)
})

test('store-button.html: href は app_store_product_id から作る掲載ページ、ファイル DL ではない', () => {
	const src = stripComments(read('_includes/store-button.html'))
	assert.match(src, /https:\/\/apps\.microsoft\.com\/detail\/\{\{ [A-Za-z_]+\.app_store_product_id \}\}/)
	assert.doesNotMatch(src, /9PDKMKWHN9RW/, 'ID を直書きしている (lang/*.json の app_store_product_id を使う)')
	assert.doesNotMatch(src, /app_download_link/, 'インストーラの URL を使っている')
	const tag = src.match(/<a\s[^>]*>/)?.[0] ?? ''
	assert.ok(tag, '<a> が無い')
	assert.doesNotMatch(tag, /\sdownload(\s|>|=)/, 'download 属性 (ファイル DL ではない)')
	assert.match(tag, /data-store-button="\{\{ include\.dl \}\}"/, '目印 data-store-button')
	assert.match(tag, /btn-secondary/, '副ボタン')
	assert.match(src, /page\.no_tracking/, '計測しないページでは data-dl を出さない')
	// ラベル: ja は直書き、英中は parts の l10n
	assert.match(src, /Microsoft Store で入手/)
	assert.match(src, /\.st_label\b/)
})

test('parts.yml: st_label の英中 (用語集の Microsoft Store は訳さない)', () => {
	const en = flatYaml(read('_data/l10n/en/parts.yml'))
	const zh = flatYaml(read('_data/l10n/zh-tw/parts.yml'))
	assert.equal(en.st_label, 'Get it from Microsoft Store')
	assert.equal(zh.st_label, '從 Microsoft Store 取得')
	assert.deepEqual(STORE_LABELS, { ja: 'Microsoft Store で入手', en: en.st_label, 'zh-tw': zh.st_label })
})

// ---- 3. 置き場所 ----

/** `{% include store-button.html … dl="<id>" … %}` の数 */
const includesOf = (src, id) => (stripComments(src).match(new RegExp(`\\{%-?\\s*include store-button\\.html[^%]*\\bdl="${id}"[^%]*%\\}`, 'g')) ?? []).length

test('置き場所: ヒーロー (3 言語)・DL の CTA・docs の #install・/join/ (3 言語)', () => {
	for (const rel of ['index.html', 'en/index.html', 'zh-tw/index.html']) {
		assert.equal(includesOf(read(rel), 'hero-store'), 1, `${rel} のヒーロー`)
		// ヒーローの DL ボタンの直後 (副ボタン)
		const hero = stripComments(read(rel))
		const dl = hero.indexOf('data-dl="hero"')
		const st = hero.search(/include store-button\.html[^%]*dl="hero-store"/)
		const web = hero.indexOf('data-dl="hero-webapp"')
		assert.ok(dl > 0 && st > dl && st < web, `${rel}: Store のボタンが DL ボタンと Web 版の間に無い`)
	}
	assert.equal(includesOf(read('_includes/cta-download.html'), 'cta-store'), 1, 'cta-download.html')
	const install = read('_includes/docs/01-intro.html')
	const sec = install.slice(install.indexOf('<section id="install"'), install.indexOf('</section>', install.indexOf('<section id="install"')))
	assert.equal(includesOf(sec, 'docs-install-store'), 1, 'docs の #install')
	for (const rel of ['join/index.html', 'en/join/index.html', 'zh-tw/join/index.html']) {
		const src = stripComments(read(rel))
		const box = src.slice(src.indexOf('data-join-install'))
		assert.equal(includesOf(box, 'join-store'), 1, `${rel} の「アプリをまだ入れていない方」`)
		// 計測しないページ: ソースに data-dl を書かない (site-copy-t2090 と同じ)
		assert.equal(/data-dl\b/.test(src), false, `${rel}: data-dl`)
	}
})

test('ヘッダー・ドロワー・フッターには Store のボタンを置かない', () => {
	for (const rel of ['_includes/header.html', '_includes/header-intl.html', '_includes/footer.html', '_includes/footer-intl.html']) {
		assert.doesNotMatch(read(rel), /store-button\.html/, rel)
	}
})

test('expectedPlacements: 4 か所 (docs は ja だけ)', () => {
	const list = expectedPlacements()
	const ids = (id) => list.filter((p) => p.id === id).map((p) => p.file).sort()
	assert.deepEqual(ids('hero-store'), ['en/index.html', 'index.html', 'zh-tw/index.html'])
	assert.deepEqual(ids('cta-store'), ['en/index.html', 'en/price/index.html', 'en/spec/index.html', 'index.html', 'price/index.html', 'spec/index.html', 'zh-tw/index.html', 'zh-tw/price/index.html', 'zh-tw/spec/index.html'])
	assert.deepEqual(ids('docs-install-store'), ['docs/index.html'])
	assert.deepEqual(ids('join-store'), ['en/join/index.html', 'join/index.html', 'zh-tw/join/index.html'])
	for (const p of list) assert.equal(p.tracked, p.id !== 'join-store', `${p.file} ${p.id}`)
})

// ---- 4. checks/store.mjs の単体 (作った _site の模型) ----

const btn = (id, lang, { tracked = true, href = STORE_URL, label } = {}) =>
	`<a class="btn-secondary btn-lg" href="${href}" target="_blank" rel="noopener noreferrer" data-store-button="${id}"${tracked ? ` data-dl="${id}"` : ''}>${label ?? STORE_LABELS[lang]}</a>`

const langOf = (file) => (file.startsWith('en/') ? 'en' : file.startsWith('zh-tw/') ? 'zh-tw' : 'ja')

/** 期待どおり (enabled) の模型。ファイルごとに置き場所のボタンを並べる。 */
function enabledFiles() {
	const files = {}
	for (const p of expectedPlacements()) {
		files[p.file] = (files[p.file] ?? '<html><body>') + btn(p.id, langOf(p.file), { tracked: p.tracked })
	}
	// T-2306: 申し込みのページの Store 版の文と FAQ (true のときだけ)
	for (const rel of SUBSCRIBE_PAGES) files[rel] = subscribePage(true)
	return files
}

/** 申し込みのページの模型 (store = true なら Store 版の文と FAQ の項目がある) */
function subscribePage(store) {
	const ld = store ? '{"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": "a"}, {"@type": "Question", "name": "Microsoft Store x"}]}' : '{"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": "a"}]}'
	return `<html><head><script type="application/ld+json">${ld}</script></head><body><p>x</p>${store ? '<p data-store-note="subscribe">Microsoft Store y</p>' : ''}<details>a</details>${store ? '<details>Microsoft Store x</details>' : ''}</body></html>`
}

function withSite(files, fn) {
	const dir = mkdtempSync(join(tmpdir(), 'store-check-'))
	try {
		mkdirSync(join(dir, '_data', 'lang'), { recursive: true })
		writeFileSync(join(dir, '_data', 'lang', 'ja.json'), JSON.stringify({ app_store_product_id: '9PDKMKWHN9RW' }))
		writeFileSync(join(dir, '_data', 'site.yml'), 'distribution:\n  store_enabled: false\n')
		for (const [rel, html] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, '_site', rel)), { recursive: true })
			writeFileSync(join(dir, '_site', rel), html)
		}
		return fn(makeContext(join(dir, '_site'), dir))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('check (false): 何も出ていなければ 0 件、Store のボタンや掲載ページへのリンクが 1 つでもあれば検出', () => {
	const clean = { 'index.html': '<a href="https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows" download data-dl="hero">x</a>', 'join/index.html': '<p>x</p>' }
	withSite(clean, (ctx) => {
		assert.deepEqual(checkStore(ctx, false), [])
		assert.deepEqual(check(ctx), [], 'site.yml の false を読む')
	})
	for (const [what, html] of [
		['ボタン', btn('cta-store', 'ja')],
		['掲載ページへのリンク', '<a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW">x</a>'],
		['目印だけ', '<span data-store-button="hero-store"></span>'],
	]) {
		withSite({ ...clean, 'price/index.html': html }, (ctx) => {
			const errors = checkStore(ctx, false)
			assert.equal(errors.length, 1, `${what}: ${errors.join(' / ')}`)
			assert.match(errors[0], /price\/index\.html/)
		})
	}
	// T-2306: 申し込みのページ (3 言語) に Store 版の文・FAQ が出ていれば検出
	withSite({ ...clean, ...Object.fromEntries(SUBSCRIBE_PAGES.map((r) => [r, subscribePage(false)])) }, (ctx) => assert.deepEqual(checkStore(ctx, false), []))
	for (const rel of SUBSCRIBE_PAGES) {
		withSite({ ...clean, [rel]: subscribePage(true) }, (ctx) => {
			const errors = checkStore(ctx, false)
			assert.ok(errors.length > 0 && errors.every((e) => e.startsWith(`${rel}:`)), `${rel}: ${errors.join(' / ')}`)
		})
	}
	withSite({ ...clean, 'price/index.html': '<p data-store-note="subscribe">x</p>' }, (ctx) => {
		assert.match(checkStore(ctx, false).join(' / '), /price\/index\.html.*data-store-note/)
	})
	// 法務文書の本文は対象外 (T-1921 で別に扱う)
	withSite({ ...clean, 'company/privacy/index.html': '<a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW">x</a>', 'en/company/cookie/index.html': '<a href="https://apps.microsoft.com/">x</a>' }, (ctx) => {
		assert.deepEqual(checkStore(ctx, false), [])
	})
})

test('check (true): 4 か所 × 言語に正しいボタンがあれば 0 件、欠け・URL・文・計測の違いを検出', () => {
	withSite(enabledFiles(), (ctx) => assert.deepEqual(checkStore(ctx, true), []))
	const cases = [
		['ボタンが欠ける', (f) => ({ ...f, 'zh-tw/spec/index.html': '<html></html>' }), /zh-tw\/spec\/index\.html.*cta-store/],
		['ページが無い', (f) => { const g = { ...f }; delete g['en/join/index.html']; return g }, /en\/join\/index\.html/],
		['2 つ出ている', (f) => ({ ...f, 'index.html': f['index.html'] + btn('hero-store', 'ja') }), /index\.html.*hero-store.*2/],
		['URL が違う', (f) => ({ ...f, 'price/index.html': btn('cta-store', 'ja', { href: 'ms-windows-store://pdp/?productid=9PDKMKWHN9RW' }) }), /price\/index\.html.*href/],
		['文が言語と違う', (f) => ({ ...f, 'en/price/index.html': btn('cta-store', 'en', { label: STORE_LABELS.ja }) }), /en\/price\/index\.html.*文/],
		['計測しないページに data-dl', (f) => ({ ...f, 'join/index.html': btn('join-store', 'ja', { tracked: true }) }), /join\/index\.html.*data-dl/],
		['計測するページに data-dl が無い', (f) => ({ ...f, 'docs/index.html': btn('docs-install-store', 'ja', { tracked: false }) }), /docs\/index\.html.*data-dl/],
		['download 属性', (f) => ({ ...f, 'spec/index.html': btn('cta-store', 'ja').replace('<a ', '<a download ') }), /spec\/index\.html.*download/],
		['ヘッダーにも出ている', (f) => ({ ...f, 'contact/index.html': btn('header-store', 'ja') }), /contact\/index\.html/],
		// T-2306: 申し込みのページの Store 版の文と FAQ
		['申し込みのページに Store 版の文が無い', (f) => ({ ...f, 'en/subscribe/index.html': f['en/subscribe/index.html'].replace(/<p data-store-note="subscribe">[^<]*<\/p>/, '') }), /en\/subscribe\/index\.html.*data-store-note/],
		['申し込みのページに Store 版の FAQ が無い', (f) => ({ ...f, 'zh-tw/subscribe/index.html': f['zh-tw/subscribe/index.html'].replace('<details>Microsoft Store x</details>', '') }), /zh-tw\/subscribe\/index\.html.*FAQ/],
		['JSON-LD に Store 版の FAQ が無い', (f) => ({ ...f, 'subscribe/index.html': f['subscribe/index.html'].replace(', {"@type": "Question", "name": "Microsoft Store x"}', '') }), /^subscribe\/index\.html.*JSON-LD/],
		['申し込みのページが無い', (f) => { const g = { ...f }; delete g['subscribe/index.html']; return g }, /^subscribe\/index\.html/],
		['ほかのページに Store 版の文', (f) => ({ ...f, 'price/index.html': f['price/index.html'] + '<p data-store-note="subscribe">x</p>' }), /price\/index\.html.*data-store-note/],
	]
	for (const [what, edit, re] of cases) {
		withSite(edit(enabledFiles()), (ctx) => {
			const errors = checkStore(ctx, true)
			assert.ok(errors.length > 0, `${what}: 検出されない`)
			assert.ok(errors.some((e) => re.test(e)), `${what}: ${errors.join(' / ')}`)
		})
	}
})

// ---- 5. scripts/check-store-toggle.mjs の書き換え ----

test('enableStore: 写しの site.yml の store_enabled だけを true にする (無ければ例外)', async () => {
	const { enableStore } = await import('../../scripts/check-store-toggle.mjs')
	const yaml = read('_data/site.yml')
	const on = enableStore(yaml)
	assert.match(on, /^\s+store_enabled:\s*true\s*$/m)
	assert.equal(on.length, yaml.length + 'true'.length - 'false'.length, 'ほかの行を変えていない')
	assert.throws(() => enableStore('web_app:\n  enabled: false\n'), /store_enabled/)
})
