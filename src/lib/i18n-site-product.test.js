// T-2209 (i18n1112 I18N-711, 2026-11-12) サイトの料金・申し込み・動作環境・モザイク除去についての英中のページ (8 ファイル) の仕様テスト。
//
//   node --test src/lib/i18n-site-product.test.js
//
//   - ja のページと英中のページの構造の一致 (scripts/i18n/parity.mjs の compareStructure が空。ja-link.html の追加だけ許す)
//   - front matter: layout / lang / permalink / ja_url / source / source_hash / seo_title / schemas / faq_data (ja と同じ)
//   - 料金・申し込みの英中の description / seo_title の金額の数字が ja の description と同じで、_data/plans.yml の price_display にある
//   - ソースの文に仮名が無い (en は漢字・全角の記号も無い)。lintText (禁止語・簡体字・新字体・和製漢語) が 0 件
//   - 文のデータは l10n から引く (site.data.entity. / site.data.spec / site.data.subscribe.faq の直参照が無い)
//   - サイト内リンクは言語の接頭辞、docs は ja-link.html、申し込みのボタンは ja と同じ式 (Web 版の URL に言語を足さない)
//   - check-site のモジュール scripts/i18n/checks/pages-product.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { compareStructure } from '../../scripts/i18n/parity.mjs'
import { fmScalar } from './front-matter.js'
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

/** front matter の配列 (`key:` の次の `  - x` の行) */
function fmList(fm, key) {
	const lines = fm.split('\n')
	const i = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l))
	if (i === -1) return undefined
	const out = []
	for (const l of lines.slice(i + 1)) {
		const m = l.match(/^\s+-\s+(.+?)\s*$/)
		if (m) out.push(m[1])
		else if (/^\s*#/.test(l)) continue
		else break
	}
	return out
}

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const HAN = /\p{Script=Han}/u
const FULLWIDTH = /[　-〿＀-￯]/u
/** 金額 (桁区切りのある数字) の集合 */
const amounts = (s) => [...new Set((s ?? '').match(/\d{1,3}(?:,\d{3})+/g) ?? [])].sort()

/** _data/plans.yml の price_display の値 (0 を除く) */
const PRICE_DISPLAYS = [...read('_data/plans.yml').matchAll(/^\s+price_display:\s*"([^"]*)"/gm)].map((m) => m[1]).filter((v) => v !== '0')

// 8 ページ = 4 つの ja × 2 言語
const PAGES = [
	{ key: 'price', ja: 'price/index.html', file: (l) => `${l}/price/index.html`, url: (l) => `/${l}/price/`, jaUrl: '/price/', money: true },
	{ key: 'subscribe', ja: 'subscribe/index.html', file: (l) => `${l}/subscribe/index.html`, url: (l) => `/${l}/subscribe/`, jaUrl: '/subscribe/', money: true },
	{ key: 'spec', ja: 'spec/index.html', file: (l) => `${l}/spec/index.html`, url: (l) => `/${l}/spec/`, jaUrl: '/spec/' },
	{ key: 'mosaic-removal', ja: 'mosaic-removal.html', file: (l) => `${l}/mosaic-removal.html`, url: (l) => `/${l}/mosaic-removal/`, jaUrl: '/mosaic-removal/', removal: true },
]
const LANGS = [
	{ lang: 'en', l10n: 'site.data.l10n.en' },
	{ lang: 'zh-tw', l10n: 'ZH' },
]

/** 本文 (コメントの外) の HTML の href (Liquid のタグの引数は除く) */
const htmlHrefs = (body) => [...body.replace(/\{%[\s\S]*?%\}/g, '').matchAll(/\shref="([^"]*)"/g)].map((m) => m[1])
/** ja-link.html の行き先 */
const jaLinkHrefs = (body) => [...body.matchAll(/\{%-?\s*include ja-link\.html href="([^"]*)"/g)].map((m) => m[1])

// ---------------------------------------------------------------- 1. ソース (ページごと)

for (const page of PAGES) {
	for (const { lang, l10n } of LANGS) {
		const rel = page.file(lang)
		const name = `${rel}`
		const src = () => read(rel)
		const body = () => stripComments(splitFrontMatter(src()).body)
		const fm = () => splitFrontMatter(src()).fm
		const jaFm = () => splitFrontMatter(read(page.ja)).fm

		test(`${name}: ある`, () => {
			assert.ok(has(rel), `${rel} が無い`)
		})

		test(`${name}: 構造が ja (${page.ja}) と同じ (ja-link.html の追加だけ許す)`, () => {
			assert.ok(has(rel))
			assert.deepEqual(compareStructure(read(page.ja), src()), [])
		})

		test(`${name}: front matter の lang / permalink / ja_url / source / source_hash / layout`, () => {
			assert.ok(has(rel))
			assert.equal(fmScalar(fm(), 'layout'), 'default')
			assert.equal(fmScalar(fm(), 'lang'), lang)
			assert.equal(fmScalar(fm(), 'permalink'), page.url(lang))
			assert.equal(fmScalar(fm(), 'ja_url'), page.jaUrl)
			assert.equal(fmScalar(fm(), 'source'), page.ja)
			assert.equal(fmScalar(fm(), 'source_hash'), sourceHash(join(ROOT, page.ja)), 'source_hash が古い (accept-site.mjs で書き直す)')
		})

		test(`${name}: front matter の schemas・faq_data・noindex などが ja と同じ`, () => {
			assert.ok(has(rel))
			assert.deepEqual(fmList(fm(), 'schemas'), fmList(jaFm(), 'schemas'))
			for (const key of ['faq_data', 'noindex', 'sitemap', 'no_tracking', 'needs_video']) {
				assert.equal(fmScalar(fm(), key), fmScalar(jaFm(), key), `${key} が ja と違う`)
			}
		})

		test(`${name}: title・seo_title・description があり、言語の検査 (lintText) が 0 件`, () => {
			assert.ok(has(rel))
			for (const key of ['title', 'seo_title', 'description']) {
				const v = fmScalar(fm(), key)
				assert.ok(v && v.length > 0, `${key} が無い`)
				assert.ok(!KANA.test(v), `${key} に仮名: ${v}`)
				if (lang === 'en') assert.ok(!HAN.test(v) && !FULLWIDTH.test(v), `${key} に日本語の字: ${v}`)
				assert.deepEqual(lintText(lang, v, { allowRemoval: page.removal === true }), [], `${key}: ${v}`)
			}
			assert.ok(fmScalar(fm(), 'seo_title').includes('Deepmosaic'), 'seo_title に製品名が無い')
		})

		if (page.money) {
			test(`${name}: description / seo_title の金額が ja の description と同じで、_data/plans.yml の price_display にある`, () => {
				assert.ok(has(rel))
				const jaAmounts = amounts(fmScalar(jaFm(), 'description'))
				assert.ok(jaAmounts.length > 0, 'ja の description に金額が無い (テストの前提)')
				for (const a of jaAmounts) assert.ok(PRICE_DISPLAYS.includes(a), `ja の description の ${a} が plans.yml に無い (ja の二重管理の注記)`)
				assert.deepEqual(amounts(fmScalar(fm(), 'description')), jaAmounts, 'description の金額が ja と違う')
				for (const a of amounts(fmScalar(fm(), 'seo_title'))) assert.ok(PRICE_DISPLAYS.includes(a), `seo_title の ${a} が plans.yml に無い`)
				const desc = fmScalar(fm(), 'description')
				if (lang === 'en') assert.ok(/excl\. tax/.test(desc), `description に excl. tax が無い: ${desc}`)
				else assert.ok(desc.includes('未稅') && desc.includes('日圓') && !/[¥￥]/.test(desc), `description の税・通貨: ${desc}`)
			})
		}

		test(`${name}: 本文 (コメントの外) に仮名が無く、lintText が 0 件${lang === 'en' ? ' (漢字・全角の記号も無い)' : ''}`, () => {
			assert.ok(has(rel))
			body()
				.split('\n')
				.forEach((line, i) => {
					if (/data-ja-allowed/.test(line)) return
					assert.ok(!KANA.test(line), `本文 ${i + 1} 行目に仮名: ${line.trim()}`)
					if (lang === 'en') assert.ok(!HAN.test(line) && !FULLWIDTH.test(line), `本文 ${i + 1} 行目に日本語の字: ${line.trim()}`)
					assert.deepEqual(lintText(lang, line, { allowRemoval: page.removal === true }), [], `本文 ${i + 1} 行目: ${line.trim()}`)
				})
		})

		test(`${name}: 文のデータは l10n から (ja のデータの文を直に引かない)`, () => {
			assert.ok(has(rel))
			const b = body()
			for (const ref of ['site.data.entity.', 'site.data.entity ', 'site.data.subscribe.faq', 'site.data.plans.tax_note', 'site.data.faq']) {
				assert.ok(!b.includes(ref), `${ref} を直に引いている`)
			}
			assert.ok(!/site\.data\.spec\b/.test(b), 'site.data.spec を直に引いている')
			for (const ref of ['plan.summary', 'plan.price_unit', 'plan.subscribe.label', 's.label', 's.value', '.ja }}', '.en }}']) {
				assert.ok(!b.includes(ref), `ja のデータの文 (${ref}) を出している`)
			}
			if (lang === 'zh-tw') assert.match(b, /\{%-?\s*assign ZH = site\.data\.l10n\['zh-tw'\]\s*-?%\}/, "assign ZH = site.data.l10n['zh-tw'] が無い")
			// include の引数に添字は書けない (Jekyll の構文。I18N-710 の notes)
			assert.ok(!/\{%-?\s*include [^%]*\[/.test(b), 'include の引数に添字がある')
			const refs = {
				price: [`${l10n}.entity.one_liner`],
				subscribe: [`${l10n}.plans`, `${l10n}.parts`],
				spec: [`${l10n}.spec`, `${l10n}.entity.one_liner`],
				'mosaic-removal': [`${l10n}.entity`],
			}[page.key]
			for (const ref of refs) assert.ok(b.includes(ref), `${ref} を引いていない`)
		})

		test(`${name}: サイト内リンクは /${lang}/ の接頭辞、docs は ja-link.html`, () => {
			assert.ok(has(rel))
			const b = body()
			const hrefs = htmlHrefs(b)
			for (const h of hrefs) {
				if (h.startsWith('#') || h.startsWith('{{')) continue
				assert.ok(h.startsWith(`/${lang}/`), `接頭辞の無いサイト内リンク: ${h}`)
			}
			const want = {
				price: [`/${lang}/`, `/${lang}/subscribe/`, `/${lang}/contact/`],
				subscribe: [`/${lang}/`, `/${lang}/price/`, `/${lang}/enterprise/inquiry/`],
				spec: [`/${lang}/`, `/${lang}/#privacy`],
				'mosaic-removal': [`/${lang}/`, `/${lang}/spec/`, `/${lang}/price/`, `/${lang}/#faq`],
			}[page.key]
			for (const w of want) assert.ok(hrefs.includes(w), `${w} へのリンクが無い`)
			const jaWant = {
				price: ['/docs', '/docs#plan', '/docs#usage'],
				subscribe: ['/docs#usage'],
				spec: ['/docs#trouble'],
				'mosaic-removal': ['/docs'],
			}[page.key]
			assert.deepEqual(jaLinkHrefs(b).sort(), jaWant)
			// cta-download の副ボタンは docs (ja) のまま、ラベルに日本語のページの印を文で含める
			if (page.key === 'price' || page.key === 'spec') {
				const m = b.match(/\{%\s*include cta-download\.html([^%]*)%\}/)
				assert.ok(m, 'cta-download.html が無い')
				assert.match(m[1], /secondary_href="\/docs"/)
				const label = m[1].match(/secondary_label="([^"]*)"/)?.[1] ?? ''
				assert.ok(lang === 'en' ? label.endsWith('(Japanese)') : label.endsWith('（日文）'), `secondary_label に印が無い: ${label}`)
			}
		})

		if (page.key === 'subscribe') {
			test(`${name}: 申し込みのボタンの href と data-dl は ja と同じ式、FAQ は l10n の subscribe.faq`, () => {
				assert.ok(has(rel))
				const b = body()
				assert.ok(b.includes('<a href="{{ app_base }}?{{ q }}={{ plan.code }}" data-dl="subscribe-{{ plan.code }}-webapp"'), 'ボタンの href / data-dl が ja と違う')
				for (const a of ['assign app_base = site.data.site.web_app.url', 'assign q = site.data.subscribe.checkout_query']) {
					assert.ok(b.includes(a), `${a} が無い`)
				}
				const faqRef = lang === 'en' ? 'site.data.l10n.en.subscribe.faq' : 'ZH.subscribe.faq'
				assert.match(b, new RegExp(`\\{%\\s*include faq\\.html items=${faqRef.replace(/\./g, '\\.')}\\s*%\\}`))
				// 金額は ja のデータの数値に、通貨の前後を l10n から付ける
				assert.ok(b.includes('{{ PL.currency_prefix }}{{ plan.price_display }}{{ PL.currency_suffix }}'))
				assert.ok(b.includes('{{ ent.min_seats }}'), '「n アカウントから」の数値を ja と同じ式で出していない')
			})
		}

		if (page.key === 'spec') {
			test(`${name}: kv-table の欄が ja と同じ順で、l10n の spec を引く`, () => {
				assert.ok(has(rel))
				const rows = (s) => [...stripComments(s).matchAll(/include kv-table\.html rows=SPEC\.([\w.]+)/g)].map((m) => m[1])
				assert.deepEqual(rows(src()), rows(read(page.ja)))
				for (const ref of ['SPEC.performance_note', 'SPEC.performance_footnote', 'SPEC.macos.note', 'SPEC.macos.status']) {
					assert.ok(body().includes(ref), `${ref} が無い`)
				}
				const m = body().match(/\{%\s*include cta-download\.html([^%]*)%\}/)
				const title = m?.[1].match(/title="([^"]*)"/)?.[1] ?? ''
				assert.ok(title.length > 0 && !KANA.test(title), `cta-download の title が訳されていない: ${title}`)
			})
		}

		if (page.removal) {
			test(`${name}: 付けるソフトで除去はできないことを書き、ja の lang="en" の段落を持たない`, () => {
				assert.ok(has(rel))
				const b = body()
				if (lang === 'en') {
					assert.ok(/adds mosaic/.test(b), 'adds mosaic が無い')
					assert.ok(/cannot remove/.test(b), 'cannot remove が無い')
				} else {
					assert.ok(b.includes('加上馬賽克'), '加上馬賽克 が無い')
					assert.ok(/無法去除|無法移除/.test(b), '無法去除 が無い')
				}
				assert.ok(!/\slang="/.test(b), '本文に lang 属性がある (英中では disambiguation を地の文で出す)')
				// can-cannot.html が include の中で E (ja の entity) を assign し、include は呼び出し側と変数を共有する。
				// ページの変数を E にすると include の後の E.* が ja の文になる (実際に起きた) ので、E を使わない。
				assert.ok(!/\{\{-?\s*E\.|\sin E\.|assign E\s*=/.test(b), 'ページの変数に E を使っている (can-cannot.html の E と衝突する)')
				for (const ref of ['EL.definition }}', 'EL.disambiguation }}', 'EL.name_origin }}', 'EL.oss_distinction }}', 'EL.confusion_reasons']) {
					assert.ok(b.includes(ref), `${ref} が無い`)
				}
			})
		} else {
			test(`${name}: 除去の語を使わない (除去の語は /mosaic-removal/ だけ)`, () => {
				assert.ok(has(rel))
				const s = src()
				assert.ok(!/remove[sd]?\s+(existing\s+)?mosaic|decensor|uncensor|unblur|mosaic removal/i.test(s), '除去の語がある')
				assert.ok(!/去馬賽克|去碼|移除馬賽克|去除馬賽克/.test(s), '除去の語がある')
			})
		}

		if (lang === 'zh-tw') {
			test(`${name}: ¥ を使わない (日圓)`, () => {
				assert.ok(has(rel))
				assert.ok(!/[¥￥]|&yen;|&#165;/.test(src()), '¥ がある')
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

// ---------------------------------------------------------------- 2. checks/pages-product.mjs

const LAYOUT = '<link rel="canonical" href="https://www.deepmosaic.co.jp/x" />\n'
const page = (lang, head, body) => `<html lang="${lang}"><head>\n${LAYOUT}${head}</head><body>\n${body}\n</body></html>\n`
const HTML_LANG = { ja: 'ja', en: 'en', 'zh-tw': 'zh-Hant-TW' }

/** l10n の値 (テストの模型にも実際の訳を入れる) */
function yamlScalar(rel, key) {
	const m = read(rel).match(new RegExp(`^\\s*${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
	return m ? m[1].replace(/\\"/g, '"') : ''
}
function yamlList(rel, key) {
	const lines = read(rel).split('\n')
	const i = lines.findIndex((l) => l === `${key}:`)
	const out = []
	for (const l of lines.slice(i + 1)) {
		const m = l.match(/^\s+-\s+"((?:[^"\\]|\\.)*)"\s*$/)
		if (!m) break
		out.push(m[1].replace(/\\"/g, '"'))
	}
	return out
}

function model(lang) {
	const L = lang === 'ja' ? null : lang
	const priceNote = L ? yamlScalar(`_data/l10n/${L}/plans.yml`, 'price_note') : '+ 維持管理費用 / 月'
	const yen = lang === 'zh-tw' ? '2,980 日圓' : '¥2,980'
	const pre = L ? `/${L}` : ''
	const kv = '<div class="kv-row"><div class="kv-key">a</div></div><div class="kv-row kv-alt"><div class="kv-key">b</div></div>'
	const can = L ? yamlList(`_data/l10n/${L}/entity.yml`, 'can') : ['c']
	const cannot = L ? yamlList(`_data/l10n/${L}/entity.yml`, 'cannot') : ['d']
	const titles = L
		? [yamlScalar(`_data/l10n/${L}/parts.yml`, 'cc_can_title'), yamlScalar(`_data/l10n/${L}/parts.yml`, 'cc_cannot_title')]
		: ['できること', 'できないこと']
	const word = { ja: 'かける', en: 'Deepmosaic is software that adds mosaic', 'zh-tw': 'Deepmosaic 是加上馬賽克的軟體' }[lang]
	const ld = '<script type="application/ld+json">{"@type": "FAQPage", "mainEntity": [{"@type": "Question"}, {"@type": "Question"}]}</script>\n'
	return {
		price: page(HTML_LANG[lang], '', `<p>${yen}</p><p>${priceNote}</p><a href="${pre}/enterprise/inquiry/">x</a><a href="https://apps.microsoft.com/detail/9PDKMKWHN9RW" data-dl="pricing-free">d</a><a data-dl="cta">c</a>`),
		spec: page(HTML_LANG[lang], '', `${kv}<a data-dl="cta">c</a>`),
		subscribe: page(
			HTML_LANG[lang],
			ld,
			'<a href="https://app.deepmosaic.co.jp/?checkout=light" data-dl="subscribe-light-webapp">l</a><a href="https://app.deepmosaic.co.jp/?checkout=pro" data-dl="subscribe-pro-webapp">p</a><details>a</details><details>b</details>',
		),
		removal: page(
			HTML_LANG[lang],
			'',
			`<h1>${word}</h1><h3>${titles[0]}</h3><ul>${can.map((c) => `<li><span>${c}</span></li>`).join('')}</ul><h3>${titles[1]}</h3><ul>${cannot.map((c) => `<li><span>${c}</span></li>`).join('')}</ul>`,
		),
	}
}

function goodSite() {
	const files = {}
	const ja = model('ja')
	files['price/index.html'] = ja.price
	files['spec/index.html'] = ja.spec
	files['subscribe/index.html'] = ja.subscribe
	files['mosaic-removal/index.html'] = ja.removal
	for (const lang of ['en', 'zh-tw']) {
		const m = model(lang)
		files[`${lang}/price/index.html`] = m.price
		files[`${lang}/spec/index.html`] = m.spec
		files[`${lang}/subscribe/index.html`] = m.subscribe
		files[`${lang}/mosaic-removal/index.html`] = m.removal
	}
	return files
}

async function runCheck(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-product-'))
	try {
		for (const [rel, text] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), text)
		}
		const { default: check } = await import('../../scripts/i18n/checks/pages-product.mjs')
		return await check(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('checks/pages-product: 正しい模型は 0 件 (陽性対照)', async () => {
	assert.deepEqual(await runCheck(goodSite()), [])
})

test('checks/pages-product: レイアウトを通っていない模型 (canonical が無い) では何もしない', async () => {
	const files = Object.fromEntries(Object.entries(goodSite()).map(([k, v]) => [k, v.replace(LAYOUT, '')]))
	assert.deepEqual(await runCheck(files), [])
	// ja だけ (英中が無い) でもレイアウトが無ければ何もしない
	const jaOnly = Object.fromEntries(Object.entries(files).filter(([k]) => !/^(en|zh-tw)\//.test(k)))
	assert.deepEqual(await runCheck(jaOnly), [])
})

// [名前, 変更 (files を受けて書き換える), needle]
const edit = (rel, fn) => (files) => ({ ...files, [rel]: fn(files[rel]) })
const drop = (rel) => (files) => Object.fromEntries(Object.entries(files).filter(([k]) => k !== rel))
const BAD_CASES = [
	['en の料金のページが無い', drop('en/price/index.html'), 'en/price/index.html'],
	['zh-tw のモザイク除去のページが無い', drop('zh-tw/mosaic-removal/index.html'), 'zh-tw/mosaic-removal/index.html'],
	['html の lang が違う', edit('zh-tw/spec/index.html', (s) => s.replace('lang="zh-Hant-TW"', 'lang="ja"')), 'lang'],
	['料金の data-dl の集合が ja と違う', edit('en/price/index.html', (s) => s.replace('data-dl="pricing-free"', 'data-dl="pricing-x"')), 'data-dl'],
	['料金の導入相談の導線が無い', edit('en/price/index.html', (s) => s.replace('/en/enterprise/inquiry/', '/enterprise/inquiry/')), 'enterprise/inquiry'],
	['料金の維持管理費用の注記が無い', edit('zh-tw/price/index.html', (s) => s.replace(yamlScalar('_data/l10n/zh-tw/plans.yml', 'price_note'), '')), 'price_note'],
	['zh-tw の料金に ¥', edit('zh-tw/price/index.html', (s) => s.replace('2,980 日圓', '¥2,980')), '¥'],
	['zh-tw の料金に &yen;', edit('zh-tw/price/index.html', (s) => s.replace('2,980 日圓', '&yen;2,980 日圓')), '¥'],
	['動作環境の data-dl が無い', edit('en/spec/index.html', (s) => s.replace(' data-dl="cta"', '')), 'data-dl'],
	['動作環境の kv-table の行の数が ja と違う', edit('zh-tw/spec/index.html', (s) => s.replace('<div class="kv-row kv-alt"><div class="kv-key">b</div></div>', '')), 'kv-row'],
	['申し込みのボタンの行き先が ja と違う', edit('en/subscribe/index.html', (s) => s.replace('?checkout=pro', '?checkout=pro&lang=en')), 'checkout'],
	['申し込みの FAQ の表示と Question の数が違う', edit('en/subscribe/index.html', (s) => s.replace('<details>b</details>', '')), 'Question'],
	[
		'申し込みの FAQ の件数が ja と違う',
		edit('zh-tw/subscribe/index.html', (s) => s.replace('<details>b</details>', '').replace(', {"@type": "Question"}', '')),
		'ja',
	],
	['モザイク除去の できないこと の項目が欠ける', edit('en/mosaic-removal/index.html', (s) => s.replace(/<li><span>[^<]*<\/span><\/li><\/ul>$/m, '</ul>')), 'cannot'],
	['モザイク除去の見出しが無い', edit('zh-tw/mosaic-removal/index.html', (s) => s.replace(yamlScalar('_data/l10n/zh-tw/parts.yml', 'cc_can_title'), 'x')), 'cc_can_title'],
	['モザイク除去に adds mosaic が無い', edit('en/mosaic-removal/index.html', (s) => s.replace('adds mosaic', 'handles video')), 'adds mosaic'],
	['モザイク除去に 加上馬賽克 が無い', edit('zh-tw/mosaic-removal/index.html', (s) => s.replace('加上馬賽克', '處理影片')), '加上馬賽克'],
	['プレースホルダが残る', edit('en/subscribe/index.html', (s) => s.replace('<details>a</details>', '<details>%%LIGHT_MAX%%</details>')), 'プレースホルダ'],
]

for (const [name, mutate, needle] of BAD_CASES) {
	test(`checks/pages-product: ${name} → エラー`, async () => {
		const errs = await runCheck(mutate(goodSite()))
		assert.ok(errs.length > 0 && errs.some((e) => e.includes(needle)), `${name}: ${errs.join(' / ')}`)
	})
}
