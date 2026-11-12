// T-2210 (i18n1112 I18N-712, 2026-11-12) サイトのお問い合わせ・導入相談・組織への参加・会社概要・404 の英中のページ (10 ファイル) と、
// W7 の完成の検査 (checks/complete.mjs) の仕様テスト。
//
//   node --test src/lib/i18n-site-support.test.js
//
//   - ja のページと英中のページの構造の一致 (scripts/i18n/parity.mjs の compareStructure が空。ja-link.html の追加だけ許す。
//     404 は ja の `data-lang-404` の行を除いて比べる)
//   - front matter: layout / lang / permalink / ja_url / source / source_hash / seo_title。join の英中は noindex・sitemap: false・no_tracking、
//     404 の英中は noindex・sitemap: false
//   - join の英中にインラインのスクリプトと meta refresh が無い (site-copy-t2090 の ja の規則を写す)
//   - 会社概要の英中に住所の直書きが無く、site.data.company.postal_code / address を参照する (site-copy-t1032 の規則を写す)
//   - ルートの 404.html の `data-lang-404` の要素が 1 つだけで `data-i18n-switch` を持つ
//   - check-site のモジュール scripts/i18n/checks/pages-support.mjs・complete.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { compareStructure } from '../../scripts/i18n/parity.mjs'
import { sourceHash } from '../../scripts/i18n/source-hash.mjs'
import { lintText } from '../../scripts/i18n/site-lint.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const has = (rel) => existsSync(join(ROOT, rel))

const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')

/** front matter の生の文 (`---` の間) と本文 */
function splitFrontMatter(src) {
	const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
	assert.ok(m, 'front matter が無い')
	return { fm: m[1], body: m[2] }
}

/** front matter のトップレベルの scalar (`key: value`) */
function fmScalar(fm, key) {
	const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm'))
	if (!m) return undefined
	return m[1].replace(/^(["'])(.*)\1$/, '$2')
}

/** front matter の配列 (`key:` の次の `  - x` の行) */
function fmList(fm, key) {
	const lines = fm.split('\n')
	const i = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l))
	if (i === -1) return undefined
	const out = []
	for (const l of lines.slice(i + 1)) {
		const m = l.match(/^\s+-\s+(.+?)\s*$/)
		if (m) out.push(m[1])
		else break
	}
	return out
}

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const HAN = /\p{Script=Han}/u
const FULLWIDTH = /[　-〿＀-￯]/u

/** ルートの 404.html に足した 1 行 (W7-site.md §0-G) */
const LANG_404_LINE = '<div hidden data-i18n-switch data-lang-404></div>'
/** ja の 404 から振り分けの印の行を除く (英中と構造を比べるため) */
const dropLang404 = (src) =>
	src
		.split('\n')
		.filter((l) => l.trim() !== LANG_404_LINE)
		.join('\n')

/** 確認のメールと返答が日本語で届く旨の 1 文 (お問い合わせ・導入相談のフォームの上) */
const MAIL_JA_NOTE = { en: 'The confirmation email and our reply will be in Japanese.', 'zh-tw': '確認電子郵件與回覆將以日文寄送。' }

// 10 ページ = 5 つの ja × 2 言語
const PAGES = [
	{ key: 'contact', ja: 'contact/index.html', file: (l) => `${l}/contact/index.html`, url: (l) => `/${l}/contact/`, jaUrl: '/contact/', kind: 'general' },
	{
		key: 'inquiry',
		ja: 'enterprise/inquiry/index.html',
		file: (l) => `${l}/enterprise/inquiry/index.html`,
		url: (l) => `/${l}/enterprise/inquiry/`,
		jaUrl: '/enterprise/inquiry/',
		kind: 'enterprise',
	},
	{ key: 'join', ja: 'join/index.html', file: (l) => `${l}/join/index.html`, url: (l) => `/${l}/join/`, jaUrl: '/join/' },
	{ key: 'about', ja: 'company/about.html', file: (l) => `${l}/company/about.html`, url: (l) => `/${l}/company/about`, jaUrl: '/company/about' },
	{ key: '404', ja: '404.html', file: (l) => `${l}/404.html`, url: (l) => `/${l}/404.html`, jaUrl: '/404.html' },
]
const LANGS = [
	{ lang: 'en', l10n: 'site.data.l10n.en' },
	{ lang: 'zh-tw', l10n: 'ZH' },
]

/** 本文 (コメントの外) の HTML の href (Liquid のタグの引数は除く) */
const htmlHrefs = (body) => [...body.replace(/\{%[\s\S]*?%\}/g, '').matchAll(/\shref="([^"]*)"/g)].map((m) => m[1])
/** ja-link.html の行き先 */
const jaLinkHrefs = (body) => [...body.matchAll(/\{%-?\s*include ja-link\.html href="([^"]*)"/g)].map((m) => m[1])

/** `data-join-view="<kind>"` の要素の中身 (入れ子の div を数えて閉じ位置を探す。site-copy-t2090 と同じ) */
function viewBlock(html, kind) {
	const start = html.indexOf(`data-join-view="${kind}"`)
	assert.notEqual(start, -1, `data-join-view="${kind}" が無い`)
	const open = html.lastIndexOf('<div', start)
	let depth = 0
	const re = /<div\b|<\/div>/g
	re.lastIndex = open
	for (let m = re.exec(html); m !== null; m = re.exec(html)) {
		depth += m[0] === '</div>' ? -1 : 1
		if (depth === 0) return html.slice(open, m.index + m[0].length)
	}
	assert.fail(`data-join-view="${kind}" が閉じていない`)
}

// ---------------------------------------------------------------- 1. ソース (ページごと)

for (const page of PAGES) {
	for (const { lang, l10n } of LANGS) {
		const rel = page.file(lang)
		const src = () => read(rel)
		const body = () => stripComments(splitFrontMatter(src()).body)
		const fm = () => splitFrontMatter(src()).fm
		const jaFm = () => splitFrontMatter(read(page.ja)).fm

		test(`${rel}: ある`, () => {
			assert.ok(has(rel), `${rel} が無い`)
		})

		test(`${rel}: 構造が ja (${page.ja}) と同じ (ja-link.html の追加だけ許す)`, () => {
			assert.ok(has(rel))
			const ja = page.key === '404' ? dropLang404(read(page.ja)) : read(page.ja)
			assert.deepEqual(compareStructure(ja, src()), [])
		})

		test(`${rel}: front matter の lang / permalink / ja_url / source / source_hash / layout`, () => {
			assert.ok(has(rel))
			assert.equal(fmScalar(fm(), 'layout'), 'default')
			assert.equal(fmScalar(fm(), 'lang'), lang)
			assert.equal(fmScalar(fm(), 'permalink'), page.url(lang))
			assert.equal(fmScalar(fm(), 'ja_url'), page.jaUrl)
			assert.equal(fmScalar(fm(), 'source'), page.ja)
			assert.equal(fmScalar(fm(), 'source_hash'), sourceHash(join(ROOT, page.ja)), 'source_hash が古い (accept-site.mjs で書き直す)')
		})

		test(`${rel}: front matter の schemas・noindex・sitemap・no_tracking が ja と同じ`, () => {
			assert.ok(has(rel))
			assert.deepEqual(fmList(fm(), 'schemas'), fmList(jaFm(), 'schemas'))
			for (const key of ['noindex', 'sitemap', 'no_tracking', 'needs_video', 'faq_data']) {
				assert.equal(fmScalar(fm(), key), fmScalar(jaFm(), key), `${key} が ja と違う`)
			}
			if (page.key === 'join') {
				assert.equal(fmScalar(fm(), 'noindex'), 'true')
				assert.equal(fmScalar(fm(), 'sitemap'), 'false')
				assert.equal(fmScalar(fm(), 'no_tracking'), 'true')
			}
			if (page.key === '404') {
				assert.equal(fmScalar(fm(), 'noindex'), 'true')
				assert.equal(fmScalar(fm(), 'sitemap'), 'false')
			}
		})

		test(`${rel}: title・seo_title・description があり、言語の検査 (lintText) が 0 件`, () => {
			assert.ok(has(rel))
			for (const key of ['title', 'seo_title', 'description']) {
				const v = fmScalar(fm(), key)
				assert.ok(v && v.length > 0, `${key} が無い`)
				assert.ok(!KANA.test(v), `${key} に仮名: ${v}`)
				if (lang === 'en') assert.ok(!HAN.test(v) && !FULLWIDTH.test(v), `${key} に日本語の字: ${v}`)
				assert.deepEqual(lintText(lang, v), [], `${key}: ${v}`)
			}
			assert.ok(fmScalar(fm(), 'seo_title').includes('Deepmosaic'), 'seo_title に製品名が無い')
			if (page.key === 'about' && lang === 'en') assert.match(fmScalar(fm(), 'seo_title'), /^About us \| Deepmosaic/)
		})

		test(`${rel}: 本文 (コメントの外) に仮名が無く、lintText が 0 件${lang === 'en' ? ' (漢字・全角の記号も無い)' : ''}`, () => {
			assert.ok(has(rel))
			body()
				.split('\n')
				.forEach((line, i) => {
					// 日本語のまま残す要素 (正式な社名・住所) は data-ja-allowed の要素の中だけ。その要素を除いて見る
					const rest = line.replace(/<(\w+)\b[^>]*\sdata-ja-allowed\b[^>]*>[\s\S]*?<\/\1>/g, '')
					assert.ok(!KANA.test(rest), `本文 ${i + 1} 行目に仮名: ${line.trim()}`)
					if (lang === 'en') assert.ok(!HAN.test(rest) && !FULLWIDTH.test(rest), `本文 ${i + 1} 行目に日本語の字: ${line.trim()}`)
					// href の値 (deepmosaic://login などの URL) は文ではないので外して見る
					assert.deepEqual(lintText(lang, rest.replace(/\shref="[^"]*"/g, '')), [], `本文 ${i + 1} 行目: ${line.trim()}`)
				})
		})

		test(`${rel}: サイト内リンクは /${lang}/ の接頭辞、docs は ja-link.html`, () => {
			assert.ok(has(rel))
			const b = body()
			const hrefs = htmlHrefs(b)
			for (const h of hrefs) {
				if (h.startsWith('#') || h.startsWith('{{') || h.startsWith('deepmosaic:') || /^https?:/.test(h)) continue
				assert.ok(h.startsWith(`/${lang}/`), `接頭辞の無いサイト内リンク: ${h}`)
			}
			const want = {
				contact: [`/${lang}/`, `/${lang}/enterprise/inquiry/`],
				inquiry: [`/${lang}/`, `/${lang}/price/`],
				join: [],
				about: [],
				404: [`/${lang}/`, `/${lang}/price/`],
			}[page.key]
			for (const w of want) assert.ok(hrefs.includes(w), `${w} へのリンクが無い`)
			const jaWant = { contact: ['/docs'], inquiry: [], join: [], about: [], 404: ['/docs'] }[page.key]
			assert.deepEqual(jaLinkHrefs(b).sort(), jaWant)
			// 除去の語は /mosaic-removal/ だけ
			assert.ok(!/remove[sd]?\s+(existing\s+)?mosaic|decensor|uncensor|mosaic removal/i.test(src()), '除去の語がある')
			assert.ok(!/去馬賽克|去碼|移除馬賽克|去除馬賽克/.test(src()), '除去の語がある')
		})

		if (page.kind) {
			test(`${rel}: 問い合わせフォームは ja と同じ呼び方 (kind="${page.kind}")、確認メールが日本語の 1 文がフォームの上、一言は l10n`, () => {
				assert.ok(has(rel))
				const b = body()
				const calls = (s) => [...stripComments(s).matchAll(/\{%-?\s*include inquiry-form\.html([^%]*)-?%\}/g)].map((m) => m[1].trim())
				assert.deepEqual(calls(src()), calls(read(page.ja)))
				assert.deepEqual(calls(src()), [`kind="${page.kind}"`])
				const note = b.indexOf(MAIL_JA_NOTE[lang])
				assert.ok(note > -1, `確認メールの 1 文が無い: ${MAIL_JA_NOTE[lang]}`)
				assert.ok(note < b.indexOf('include inquiry-form.html'), '確認メールの 1 文がフォームより後にある')
				assert.ok(!b.includes('site.data.entity.'), 'site.data.entity を直に引いている')
				assert.ok(b.includes(`${l10n}.entity.one_liner`), `${l10n}.entity.one_liner を引いていない`)
				if (lang === 'zh-tw') assert.match(b, /\{%-?\s*assign ZH = site\.data\.l10n\['zh-tw'\]\s*-?%\}/)
				if (lang === 'en') assert.match(b, /within 3 business days \(Japan\)/)
				else assert.ok(b.includes('3 個工作天內（以日本的工作天計算）'), '営業日の訳が無い')
			})
		}

		if (page.key === 'join') {
			test(`${rel}: インラインのスクリプト・meta refresh・data-dl・JSON-LD を置かない (site-copy-t2090 と同じ)`, () => {
				assert.ok(has(rel))
				const b = body()
				assert.equal(/<script\b/i.test(b), false, 'インラインのスクリプトを置かない (src/main.js の initJoinPage が動く)')
				assert.equal(/http-equiv=["']?refresh/i.test(b), false)
				assert.equal(/data-dl\b/.test(b), false)
				assert.equal(fmScalar(fm(), 'schemas'), undefined)
			})

			test(`${rel}: 3 つの表示 (既定は hidden)・ボタン・手順の数・コピー・Store へのリンクが ja と同じ形`, () => {
				assert.ok(has(rel))
				const b = body()
				assert.match(b, /<div class="mx-auto w-\[92%\] max-w-\[720px\]" data-join>/)
				for (const kind of ['code', 'admin', 'invalid']) {
					const block = viewBlock(b, kind)
					assert.match(block.slice(0, block.indexOf('>') + 1), /\shidden[\s>]/, `${kind} は既定で hidden`)
				}
				const code = viewBlock(b, 'code')
				assert.match(code, /<strong[^>]*data-join-code[^>]*><\/strong>/, 'コードは JS が textContent で入れる (原稿は空)')
				const open = code.match(/<a\b[^>]*data-join-open-code[^>]*>([^<]*)<\/a>/)
				assert.ok(open, '「アプリで開く」が無い')
				assert.equal(/href=/.test(open[0]), false, '原稿の時点では href を持たない')
				assert.equal([...code.matchAll(/<li>/g)].length, 3)
				assert.match(code, /<button type="button"[^>]*data-join-copy[^>]*>[^<]+<\/button>/)
				assert.match(code, /data-join-copy-status/)
				const admin = viewBlock(b, 'admin')
				assert.match(admin, /<a href="deepmosaic:\/\/login"[^>]*data-join-open-admin[^>]*>[^<]+<\/a>/)
				assert.equal([...admin.matchAll(/<li>/g)].length, 2)
				assert.equal(/<a\b|<button\b/.test(viewBlock(b, 'invalid')), false)
				assert.match(b, /<noscript>[\s\S]*?<\/noscript>/)
				// Store の URL は ja と同じ式 (ja のデータの URL。言語で変えない)
				assert.match(src(), /assign store_url = site\.data\.lang\.ja\.app_download_link/)
				const store = b.match(/<a\b[^>]*data-join-store[^>]*>/)
				assert.ok(store, 'Store へのリンクが無い')
				assert.match(store[0], /href="\{\{ store_url \}\}"/)
				assert.match(store[0], /target="_blank"/)
				assert.match(store[0], /rel="noopener noreferrer"/)
			})

			test(`${rel}: アプリの画面のボタン名を引用している (en は "…"、zh-tw は「…」)`, () => {
				assert.ok(has(rel))
				const code = viewBlock(body(), 'code')
				const quoted = lang === 'en' ? [...code.matchAll(/"([^"<>]+)"/g)] : [...code.matchAll(/「([^」]+)」/g)]
				// 「アプリで開く」「法人サインイン」「組織コード」「サインイン」「組織コードをお持ちの方（法人）」
				const names = new Set(quoted.map((m) => m[1]).filter((t) => !/^[\w-]+$/.test(t) || t.includes(' ')))
				assert.ok(names.size >= 4, `引用したボタン名が 4 つ未満: ${[...names].join(' / ')}`)
			})
		}

		if (page.key === 'about') {
			test(`${rel}: 住所を直書きせず company.yml を参照し、正式な社名と住所は data-ja-allowed の要素`, () => {
				assert.ok(has(rel))
				const b = body()
				assert.equal(/上大崎|141-0021/.test(stripComments(src())), false, '住所の直書きがある')
				assert.match(b, /〒\s*\{\{\s*site\.data\.company\.postal_code\s*\}\}\s*\{\{\s*site\.data\.company\.address\s*\}\}/)
				const addr = b.match(/<(\w+)\b[^>]*\sdata-ja-allowed\b[^>]*>〒\{\{ site\.data\.company\.postal_code \}\}/)
				assert.ok(addr, '住所が data-ja-allowed の要素に入っていない')
				assert.match(b, /Deepmosaic LLC/)
				assert.match(b, /<(\w+)\b[^>]*\sdata-ja-allowed\b[^>]*>Deepmosaic合同会社<\/\1>/)
				// 日付は ja と同じ
				for (const d of ['2019-05-10', '2026-10-12']) assert.ok(b.includes(d), `${d} が無い`)
				// 法務のページへのリンクは無い (あれば ja-link.html)
				assert.equal(/href="\/company\/(terms|privacy|cookie|eula|asct)/.test(b), false)
			})
		}

		if (page.key === '404') {
			test(`${rel}: 振り分けの印 (data-lang-404) を置かない・画像の alt を訳す`, () => {
				assert.ok(has(rel))
				const b = body()
				assert.equal(/data-lang-404/.test(b), false)
				const alt = b.match(/<img\b[^>]*\salt="([^"]*)"/)?.[1] ?? ''
				assert.ok(alt.length > 0 && !KANA.test(alt), `alt が訳されていない: ${alt}`)
				assert.match(b, /<h1[^>]*>404 Not Found<\/h1>/)
			})
		}
	}
}

test('en と zh-tw の同じページの構造が同じ (ja-link.html の位置まで)', () => {
	for (const page of PAGES) {
		if (!has(page.file('en')) || !has(page.file('zh-tw'))) assert.fail(`${page.key} の英中のどちらかが無い`)
		assert.deepEqual(compareStructure(read(page.file('en')), read(page.file('zh-tw')), { allowExtraIncludes: [] }), [], page.key)
	}
})

test('ルートの 404.html: data-lang-404 の要素がちょうど 1 つで data-i18n-switch を持ち、header の include の次の行', () => {
	const src = read('404.html')
	const tags = [...src.matchAll(/<[a-zA-Z][^>]*\sdata-lang-404\b[^>]*>/g)].map((m) => m[0])
	assert.equal(tags.length, 1, `data-lang-404 の要素が 1 つでない: ${tags.join(' / ')}`)
	assert.match(tags[0], /\sdata-i18n-switch\b/)
	const lines = src.split('\n')
	const i = lines.findIndex((l) => l.trim() === '{% include header.html %}')
	assert.ok(i > -1, 'header の include が無い')
	assert.equal(lines[i + 1], LANG_404_LINE)
})

// ---------------------------------------------------------------- 2. checks/pages-support.mjs

const LAYOUT = '<link rel="canonical" href="https://www.deepmosaic.co.jp/x" />\n'
const html = (lang, head, body) => `<html lang="${lang}"><head>\n${LAYOUT}${head}</head><body>\n${body}\n</body></html>\n`
const HTML_LANG = { ja: 'ja', en: 'en', 'zh-tw': 'zh-Hant-TW' }
const ROBOTS = '<meta name="robots" content="noindex, nofollow">\n'
const REFERRER = '<meta name="referrer" content="no-referrer">\n'
const GTAG = '<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>\n'
const JOIN_BODY =
	'<div class="x" data-join><h1>t</h1><div data-join-view="code" hidden><strong data-join-code></strong><a data-join-open-code>o</a>' +
	'<code data-join-code></code><button type="button" data-join-copy>c</button><span data-join-copy-status></span></div>' +
	'<div data-join-view="admin" hidden><a href="deepmosaic://login" data-join-open-admin>o</a></div><div data-join-view="invalid" hidden><p>x</p></div>' +
	'<noscript><p>x</p></noscript><div data-join-install><a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW" data-join-store>s</a></div></div>'
const island = (kind, note) =>
	`${note ? `<p>${note}</p>` : ''}<div data-island="inquiry-form"\n     data-kind="${kind}"\n     data-endpoint="https://e.example/inquiry">\n  <noscript><p>js</p></noscript>\n</div>`

function supportSite() {
	const files = {}
	files['contact/index.html'] = html('ja', '', island('general'))
	files['enterprise/inquiry/index.html'] = html('ja', '', island('enterprise'))
	files['join/index.html'] = html('ja', ROBOTS + REFERRER, JOIN_BODY)
	files['company/about.html'] = html('ja', '', '<td>Deepmosaic合同会社</td>')
	files['404.html'] = html('ja', ROBOTS, `${LANG_404_LINE}<h1>404 Not Found</h1>`)
	for (const lang of ['en', 'zh-tw']) {
		const L = HTML_LANG[lang]
		files[`${lang}/contact/index.html`] = html(L, '', island('general', MAIL_JA_NOTE[lang]))
		files[`${lang}/enterprise/inquiry/index.html`] = html(L, '', island('enterprise', MAIL_JA_NOTE[lang]))
		files[`${lang}/join/index.html`] = html(L, ROBOTS + REFERRER, JOIN_BODY)
		files[`${lang}/company/about.html`] = html(L, '', '<td>Deepmosaic LLC (<span data-ja-allowed>Deepmosaic合同会社</span>)</td>')
		files[`${lang}/404.html`] = html(L, ROBOTS, '<h1>404 Not Found</h1>')
	}
	return files
}

async function runModule(name, files) {
	const dir = mkdtempSync(join(tmpdir(), `i18n-${name}-`))
	try {
		for (const [rel, text] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), text)
		}
		const { default: check } = await import(`../../scripts/i18n/checks/${name}.mjs`)
		return await check(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

const edit = (rel, fn) => (files) => ({ ...files, [rel]: fn(files[rel]) })
const drop = (rel) => (files) => Object.fromEntries(Object.entries(files).filter(([k]) => k !== rel))
// ウェーブ末尾の追い修正: complete の模型は自己参照の canonical を持つので、LAYOUT の固定の行でなく canonical の行を全部除く
const unbuilt = (files) => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replace(/<link rel="canonical"[^\n]*\n/g, '')]))

test('checks/pages-support: 正しい模型は 0 件 (陽性対照)', async () => {
	assert.deepEqual(await runModule('pages-support', supportSite()), [])
})

test('checks/pages-support: レイアウトを通っていない模型 (canonical が無い) では何もしない', async () => {
	assert.deepEqual(await runModule('pages-support', unbuilt(supportSite())), [])
	const jaOnly = Object.fromEntries(Object.entries(unbuilt(supportSite())).filter(([k]) => !/^(en|zh-tw)\//.test(k)))
	assert.deepEqual(await runModule('pages-support', jaOnly), [])
})

const SUPPORT_BAD = [
	['en のお問い合わせが無い', drop('en/contact/index.html'), 'en/contact/index.html'],
	['zh-tw の 404 が無い', drop('zh-tw/404.html'), 'zh-tw/404.html'],
	['zh-tw の会社概要が無い', drop('zh-tw/company/about.html'), 'zh-tw/company/about.html'],
	['html の lang が違う', edit('zh-tw/join/index.html', (s) => s.replace('lang="zh-Hant-TW"', 'lang="ja"')), 'lang'],
	['アイランドが無い', edit('en/contact/index.html', (s) => s.replace('data-island="inquiry-form"', 'data-island="x"')), 'inquiry-form'],
	['data-kind が ja と違う', edit('zh-tw/enterprise/inquiry/index.html', (s) => s.replace('data-kind="enterprise"', 'data-kind="general"')), 'data-kind'],
	['noscript が無い', edit('en/enterprise/inquiry/index.html', (s) => s.replace('<noscript><p>js</p></noscript>', '')), 'noscript'],
	['確認メールの 1 文が無い', edit('zh-tw/contact/index.html', (s) => s.replace(MAIL_JA_NOTE['zh-tw'], '')), '確認'],
	['join に noindex が無い', edit('en/join/index.html', (s) => s.replace(ROBOTS, '')), 'noindex'],
	['join に no-referrer が無い', edit('zh-tw/join/index.html', (s) => s.replace(REFERRER, '')), 'referrer'],
	['join に計測がある', edit('en/join/index.html', (s) => s.replace('</head>', `${GTAG}</head>`)), 'googletagmanager'],
	['join に cloudflareinsights がある', edit('en/join/index.html', (s) => s.replace('</head>', '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script></head>')), 'cloudflareinsights'],
	['join の data-join の構造が欠ける', edit('zh-tw/join/index.html', (s) => s.replace(' data-join-store', '')), 'data-join-store'],
	['英中の 404 に data-lang-404 がある', edit('en/404.html', (s) => s.replace('<h1>', `${LANG_404_LINE}<h1>`)), 'data-lang-404'],
	['ルートの 404 に data-lang-404 が無い', edit('404.html', (s) => s.replace(LANG_404_LINE, '')), 'data-lang-404'],
	['会社概要に Deepmosaic LLC が無い', edit('en/company/about.html', (s) => s.replace('Deepmosaic LLC', 'Deepmosaic')), 'Deepmosaic LLC'],
]

for (const [name, mutate, needle] of SUPPORT_BAD) {
	test(`checks/pages-support: ${name} → エラー`, async () => {
		const errs = await runModule('pages-support', mutate(supportSite()))
		assert.ok(errs.length > 0 && errs.some((e) => e.includes(needle)), `${name}: ${errs.join(' / ')}`)
	})
}

// ---------------------------------------------------------------- 3. checks/complete.mjs

const ORIGIN = 'https://www.deepmosaic.co.jp'
/** 台帳の鍵 (_data/i18n_pages.yml) */
const LEDGER_KEYS = [...read('_data/i18n_pages.yml').matchAll(/^"([^"]+)"\s*:/gm)].map((m) => m[1])
const PREFIX = { ja: '', en: '/en', 'zh-tw': '/zh-tw' }
const relOf = (lang, key) => {
	const p = `${PREFIX[lang]}${key}`.slice(1)
	if (p === '' || p.endsWith('/')) return `${p}index.html`
	return `${p}.html`
}
const hreflangs = (key) =>
	[
		['ja', `${ORIGIN}${key}`],
		['en', `${ORIGIN}/en${key}`],
		['zh-Hant-TW', `${ORIGIN}/zh-tw${key}`],
		['x-default', `${ORIGIN}/en${key}`],
	]
		.map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${h}" />\n`)
		.join('')

function completeSite() {
	const files = {}
	const sitemap = []
	for (const key of LEDGER_KEYS) {
		for (const lang of ['ja', 'en', 'zh-tw']) {
			// 自己参照の canonical (ウェーブ末尾の追い修正で complete が英中の canonical も見る)
			const self = `<link rel="canonical" href="${ORIGIN}${PREFIX[lang]}${key}" />\n`
			files[relOf(lang, key)] = html(HTML_LANG[lang], hreflangs(key), '<p>x</p>').replace(LAYOUT, self)
			if (key !== '/join/') sitemap.push(`<url><loc>${ORIGIN}${PREFIX[lang]}${key}</loc></url>`)
		}
	}
	files['404.html'] = html('ja', '', LANG_404_LINE)
	files['en/404.html'] = html('en', '', '<p>x</p>')
	files['zh-tw/404.html'] = html('zh-Hant-TW', '', '<p>x</p>')
	files['sitemap.xml'] = `<?xml version="1.0"?>\n<urlset>\n${sitemap.join('\n')}\n</urlset>\n`
	files['assets/dist/app.js'] = 'function a(){if(!document.querySelector("[data-lang-404]"))return!1}\n'
	return files
}

test('checks/complete: 台帳の鍵は 9 本 (アプリの 8 本 + 会社概要) で、join を含む (テストの前提)', () => {
	assert.equal(LEDGER_KEYS.length, 9)
	assert.ok(LEDGER_KEYS.includes('/join/') && LEDGER_KEYS.includes('/company/about'))
})

test('checks/complete: 正しい模型は 0 件 (陽性対照)', async () => {
	assert.deepEqual(await runModule('complete', completeSite()), [])
})

test('checks/complete: レイアウトを通っていない模型 (ja のトップに canonical が無い) では何もしない', async () => {
	assert.deepEqual(await runModule('complete', unbuilt(completeSite())), [])
	// ja-lang などほかの検査の模型 (ja と英中のトップだけ) でも何もしない
	assert.deepEqual(await runModule('complete', { 'index.html': '<html lang="ja"><head></head></html>\n', 'en/index.html': '<html lang="en"></html>\n' }), [])
})

const COMPLETE_BAD = [
	['台帳の en の版が無い', drop('en/company/about.html'), 'en/company/about.html'],
	['台帳の zh-tw の版が無い', drop('zh-tw/join/index.html'), 'zh-tw/join/index.html'],
	['hreflang が片方向 (en から zh-tw を指さない)', edit('en/contact/index.html', (s) => s.replace(/<link rel="alternate" hreflang="zh-Hant-TW"[^\n]*\n/, '')), 'zh-Hant-TW'],
	['hreflang の行き先が違う', edit('zh-tw/price/index.html', (s) => s.replace(`${ORIGIN}/en/price/" />`, `${ORIGIN}/en/" />`)), 'hreflang'],
	['x-default が無い', edit('index.html', (s) => s.replace(/<link rel="alternate" hreflang="x-default"[^\n]*\n/, '')), 'x-default'],
	['sitemap に英中の索引対象が無い', edit('sitemap.xml', (s) => s.replace(`<url><loc>${ORIGIN}/zh-tw/spec/</loc></url>`, '')), '/zh-tw/spec/'],
	['sitemap に英中の join がある', edit('sitemap.xml', (s) => s.replace('</urlset>', `<url><loc>${ORIGIN}/en/join/</loc></url>\n</urlset>`)), '/en/join/'],
	['sitemap に英中の 404 がある', edit('sitemap.xml', (s) => s.replace('</urlset>', `<url><loc>${ORIGIN}/zh-tw/404.html</loc></url>\n</urlset>`)), '404'],
	['sitemap が無い', drop('sitemap.xml'), 'sitemap.xml'],
	['英中に台帳に無いページ (probe の消し忘れ)', (f) => ({ ...f, 'en/probe/index.html': html('en', '', '<p>x</p>') }), 'en/probe/index.html'],
	['英中の 404 が無い', drop('en/404.html'), 'en/404.html'],
	['app.js に 404 の振り分けが無い', edit('assets/dist/app.js', () => 'function a(){}\n'), 'data-lang-404'],
	['app.js が無い', drop('assets/dist/app.js'), 'app.js'],
	// ウェーブ末尾の追い修正 (2026-11-12): 英中の canonical は自己参照、hreflang はちょうど 4 本
	['en の canonical が ja を指す', edit('en/price/index.html', (s) => s.replace(`canonical" href="${ORIGIN}/en/price/"`, `canonical" href="${ORIGIN}/price/"`)), 'canonical'],
	['zh-tw に canonical が無い', edit('zh-tw/company/about.html', (s) => s.replace(/<link rel="canonical"[^\n]*\n/, '')), 'canonical'],
	['en の canonical が 2 本', edit('en/join/index.html', (s) => s.replace('</head>', `<link rel="canonical" href="${ORIGIN}/en/join/" />\n</head>`)), 'canonical'],
	['hreflang が 5 本 (余計な 1 本)', edit('zh-tw/spec/index.html', (s) => s.replace('</head>', `<link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/zh-tw/spec/" />\n</head>`)), '4 本'],
]

for (const [name, mutate, needle] of COMPLETE_BAD) {
	test(`checks/complete: ${name} → エラー`, async () => {
		const errs = await runModule('complete', mutate(completeSite()))
		assert.ok(errs.length > 0 && errs.some((e) => e.includes(needle)), `${name}: ${errs.join(' / ')}`)
	})
}
