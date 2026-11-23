// 検索向けの文 (男性の顔・女性の顔、既存のモザイクを見つけて上からかけ直す) の回帰テスト。
//
//   node --test src/lib/site-copy-seo-faces.test.js
//
// 検索に使われる面 (seo_title・description・meta_desc・entity の definition / can / keywords・llms*.txt・
// トップの検出対象の h2) に、3 言語 (ja / en / zh-tw) で「男性の顔・女性の顔」と「かけ直す」を置く。
// あわせて「モザイク処理」の単独使用 (語彙ポリシー違反) と、古いコメント「英語ページ (/en/) は作らない」を消す。
// ビルド出力の検査 `scripts/i18n/checks/detect-terms.mjs` は一時ディレクトリの `_site` の模型で単体を確かめる
// (このファイルは `_site` を読まない。`npm test` はビルドの前に走るため)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import checkDetectTerms, { hasTerm } from '../../scripts/i18n/checks/detect-terms.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

/** Liquid の comment ブロックと HTML コメントを落とす (表示されない文字列は検査しない)。 */
const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
/** YAML のコメント行を落とす。 */
const stripYamlComments = (s) =>
	s
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n')

/** 全角を 1・半角 (ASCII と半角カナ) を 0.5 で数えた幅 (CLAUDE.md の seo_title の「全角 30 文字以内」)。 */
const titleWidth = (s) => [...s].reduce((w, ch) => w + (/[\x20-\x7e\uff61-\uff9f]/.test(ch) ? 0.5 : 1), 0)

/** front matter の 1 行の値 (引用符は外す)。 */
function fmValue(src, key) {
	const fm = src.split('\n---')[0]
	const line = fm.split('\n').find((l) => l.startsWith(`${key}:`)) ?? ''
	const v = line.slice(key.length + 1).trim()
	return v.startsWith('"') ? JSON.parse(v) : v
}

/** 平らな YAML の `key: "value"` の値。 */
function yamlTop(yaml, key) {
	const m = stripYamlComments(yaml).match(new RegExp(`^${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
	return m ? JSON.parse(`"${m[1]}"`) : ''
}

const entity = read('_data/entity.yml')
const entityBody = stripYamlComments(entity)
const definitionJa = entityBody.match(/^definition:\n\s+ja:\s*"([^"]*)"/m)?.[1] ?? ''
const can0Ja = entityBody.match(/^can:\n\s+- ja:\s*"([^"]*)"/m)?.[1] ?? ''
const keywordsJa = yamlTop(entity, 'keywords')
const l10n = (lang) => read(`_data/l10n/${lang}/entity.yml`)
const metaDesc = (lang) => JSON.parse(read(`_data/lang/${lang}.json`)).meta_desc ?? ''

const PAGES = { ja: 'index.html', en: 'en/index.html', 'zh-tw': 'zh-tw/index.html' }
const FACES = { ja: ['男性の顔', '女性の顔'], en: ['male faces', 'female faces'], 'zh-tw': ['男性臉部', '女性臉部'] }
const HUMAN = { ja: '人間の顔', en: 'human faces', 'zh-tw': '人的臉部' }
const REMOVAL_KW = ['除去', '解除', 'モザイク 検出', 'remov', '去除', '移除']

/** 面ごとの文字列。 */
function surfaces(lang) {
	if (lang === 'ja') {
		return [
			['index.html の description', fmValue(read(PAGES.ja), 'description')],
			['ja.json の meta_desc', metaDesc('ja')],
			['entity の definition.ja', definitionJa],
			['entity の can[0].ja', can0Ja],
			['entity の keywords', keywordsJa],
			['llms.txt', read('llms.txt')],
			['llms-full.txt', read('llms-full.txt')],
		]
	}
	return [
		[`${PAGES[lang]} の description`, fmValue(read(PAGES[lang]), 'description')],
		[`${lang}.json の meta_desc`, metaDesc(lang)],
		[`l10n/${lang} の definition`, yamlTop(l10n(lang), 'definition')],
		[`l10n/${lang} の keywords`, yamlTop(l10n(lang), 'keywords')],
	]
}

// ── seo_title ─────────────────────────────────────────────────────────────

test('幅の関数: ちょうど 30 は収まり、30.5 は超える (境界値)', () => {
	assert.equal(titleWidth('あ'.repeat(30)), 30)
	assert.equal(titleWidth('あ'.repeat(30) + 'a'), 30.5)
	assert.equal(titleWidth('ｱｲ'), 1)
})

test('seo_title: ja は 30 以内で 顔・モザイクをかける・Deepmosaic を含み、除去・モザイク検出を含まない', () => {
	const t = fmValue(read(PAGES.ja), 'seo_title')
	assert.ok(titleWidth(t) <= 30, `幅 ${titleWidth(t)}: ${t}`)
	for (const w of ['顔', 'モザイクをかける', 'Deepmosaic']) assert.ok(t.includes(w), `「${w}」が無い: ${t}`)
	for (const w of ['除去', 'モザイク検出']) assert.ok(!t.includes(w), `「${w}」がある: ${t}`)
})

test('seo_title: en は faces、zh-tw は 臉部 を含む', () => {
	assert.match(fmValue(read(PAGES.en), 'seo_title'), /faces/)
	assert.ok(fmValue(read(PAGES['zh-tw']), 'seo_title').includes('臉部'))
})

// ── 男女の顔・かけ直し ─────────────────────────────────────────────────────

for (const lang of ['ja', 'en', 'zh-tw']) {
	test(`男女の顔: ${lang} の検索の面に ${FACES[lang].join('・')} があり、${HUMAN[lang]} が無い`, () => {
		const missing = surfaces(lang).flatMap(([n, b]) => FACES[lang].filter((w) => !hasTerm(b, w)).map((w) => `${n}: ${w}`))
		const human = surfaces(lang).filter(([, b]) => hasTerm(b, HUMAN[lang])).map(([n]) => n)
		assert.deepEqual(missing, [])
		assert.deepEqual(human, [])
	})
}

test('かけ直し: 3 言語の description・meta_desc・definition にかけ直しの語、keywords にかけ直しの語があり除去の語が無い', () => {
	const REAPPLY = { ja: 'かけ直', en: 'over it again', 'zh-tw': '重新套用' }
	const KW = { ja: 'かけ直し', en: 're-apply', 'zh-tw': '重新套用' }
	for (const lang of ['ja', 'en', 'zh-tw']) {
		const s = surfaces(lang)
		for (const [n, b] of s.slice(0, 3)) assert.ok(b.includes(REAPPLY[lang]), `${n} に「${REAPPLY[lang]}」が無い`)
		const kw = lang === 'ja' ? keywordsJa : yamlTop(l10n(lang), 'keywords')
		assert.ok(kw.includes(KW[lang]), `${lang} の keywords に「${KW[lang]}」が無い: ${kw}`)
		for (const w of REMOVAL_KW) assert.ok(!kw.includes(w), `${lang} の keywords に「${w}」がある`)
	}
})

// ── トップの検出対象の h2 の節 ─────────────────────────────────────────────

const TITLE_TERMS = {
	ja: ['検出支援できる物体', '男性器', '女性器', '男性の顔', '女性の顔'],
	en: ['male body areas', 'female body areas', 'male faces', 'female faces'],
	'zh-tw': ['男性身體部位', '女性身體部位', '男性臉部', '女性臉部'],
}
const SECTION_REAPPLY = { ja: /かけ直/, en: /over it again|covered with new mosaic/, 'zh-tw': /重新套用/ }
const HEADING_REMOVAL = /除去|解除|モザイク検出|remov|去除|移除/i

for (const lang of ['ja', 'en', 'zh-tw']) {
	test(`検出対象の節: ${lang} のトップに #detect-targets が what-is の後・STATS の前にあり、見出しの語がそろう`, () => {
		const src = read(PAGES[lang])
		const count = src.split('<section id="detect-targets"').length - 1
		const at = src.indexOf('<section id="detect-targets"')
		const whatIs = src.indexOf('{% include what-is.html %}')
		const stats = src.indexOf('{% comment %} STATS {% endcomment %}')
		assert.equal(count, 1, '#detect-targets の節がちょうど 1 つでない')
		assert.ok(whatIs >= 0 && whatIs < at && at < stats, '節の位置が what-is の後・STATS の前でない')
		const section = stripComments(src.slice(at, src.indexOf('</section>', at)))
		const inc = section.match(/\{%\s*include section-title\.html([^%]*)%\}/)?.[1] ?? ''
		const title = inc.match(/title="([^"]*)"/)?.[1] ?? ''
		const kicker = inc.match(/kicker="([^"]*)"/)?.[1] ?? ''
		assert.equal(kicker, 'DETECTION TARGETS')
		for (const w of TITLE_TERMS[lang]) assert.ok(hasTerm(title, w), `title に「${w}」が無い: ${title}`)
		assert.doesNotMatch(title + kicker, HEADING_REMOVAL)
		assert.match(section, /href="#existing-mosaic"/)
		assert.match(section, SECTION_REAPPLY[lang])
	})
}

// ── 「モザイク処理」の単独使用 ─────────────────────────────────────────────

/** 見える文字列 (コメントを除く) に語があれば true。 */
const hasVisible = (src, word) => stripComments(src).includes(word)

test('判定の関数: 見える文字列のモザイク処理は NG、コメントの中だけなら OK (陰性対照)', () => {
	assert.equal(hasVisible('<p>モザイク処理を自動化</p>', 'モザイク処理'), true)
	assert.equal(hasVisible('<!-- 旧 モザイク処理 --><p>モザイクをかける</p>', 'モザイク処理'), false)
	assert.equal(hasVisible('{%- comment -%}モザイク処理{%- endcomment -%}<p>x</p>', 'モザイク処理'), false)
})

test('「モザイク処理」「馬賽克處理」が ja / zh の公開面に無い', () => {
	const faqAnswers = stripYamlComments(read('_data/faq.yml'))
		.split('\n')
		.filter((l) => /^\s+a:/.test(l))
		.join('\n')
	// front matter の YAML コメントは出力されないので除く
	const ja = [
		['index.html', stripComments(read('index.html').replace(/^\s*#.*$/gm, ''))],
		['ja.json の meta_desc', metaDesc('ja')],
		['faq.yml の回答', faqAnswers],
		['docs/01-intro.html', stripComments(read('_includes/docs/01-intro.html'))],
	]
	const zh = [
		['zh-tw/index.html', stripComments(read('zh-tw/index.html'))],
		['zh-tw.json の meta_desc', metaDesc('zh-tw')],
	]
	assert.deepEqual(ja.filter(([, b]) => b.includes('モザイク処理')).map(([n]) => n), [])
	assert.deepEqual(zh.filter(([, b]) => b.includes('馬賽克處理')).map(([n]) => n), [])
})

// ── 古いコメント・ja.json ─────────────────────────────────────────────────

test('古いコメント「英語ページ (/en/) は作らない」が残っていない', () => {
	for (const f of ['_data/entity.yml', '_includes/what-is.html']) assert.ok(!read(f).includes('/en/) は作らない'), f)
})

test('ja.json: キーの数は 35 (インストーラの URL のキーを消した後)、meta_desc 以外の代表値は変わらない', () => {
	const ja = JSON.parse(read('_data/lang/ja.json'))
	assert.equal(Object.keys(ja).length, 35)
	assert.ok(ja.find_desc.startsWith('男性と女性の局部を自動的に検出し'), ja.find_desc)
	assert.ok(ja.deep_learning_desc.startsWith('局部の自動検出には'), ja.deep_learning_desc)
})

// ── ビルド出力の検査 checks/detect-terms.mjs の単体 ────────────────────────

const MODEL = {
	ja: { title: '男女の顔や局部に自動でモザイクをかけるAIソフト｜Deepmosaic', desc: '検出対象は男性器・女性器・男性の顔・女性の顔', features: ['動画内の局部・男性の顔・女性の顔を AI が自動検出'], h2: '検出支援できる物体: 男性器・女性器・男性の顔・女性の顔' },
	en: { title: 'AI that adds mosaic to faces and body areas in videos | Deepmosaic', desc: 'detects male faces, and female faces', features: ['Detect body areas, male faces, and female faces'], h2: 'Objects it can help detect: male faces, and female faces' },
	'zh-tw': { title: 'AI 偵測臉部與身體部位｜Deepmosaic', desc: '男性臉部、女性臉部', features: ['偵測男性臉部、女性臉部'], h2: '可協助偵測的物體：男性臉部、女性臉部' },
}

function pageHtml(m, { section = true } = {}) {
	const ld = JSON.stringify({ '@type': 'SoftwareApplication', featureList: m.features })
	const sec = section ? `<section id="detect-targets" class="x"><div><div class="kicker">DETECTION TARGETS</div><h2 class="t">${m.h2}</h2></div></section>` : ''
	return `<html><head><link rel="canonical" href="https://www.deepmosaic.co.jp/"><title>${m.title}</title><meta name="description" content="${m.desc}"><script type="application/ld+json">${ld}</script></head><body>${sec}</body></html>`
}

function withSite(mutate, fn) {
	const dir = mkdtempSync(join(tmpdir(), 'dm-t2458-'))
	try {
		const model = structuredClone(MODEL)
		const opts = { ja: {}, en: {}, 'zh-tw': {} }
		mutate?.(model, opts)
		for (const [lang, rel] of Object.entries(PAGES)) {
			if (opts[lang].skip) continue
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), pageHtml(model[lang], opts[lang]))
		}
		return fn(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('hasTerm: female faces の中の male faces は数えない (境界値)', () => {
	assert.equal(hasTerm('female faces', 'male faces'), false)
	assert.equal(hasTerm('Male faces / female faces', 'male faces'), true)
	assert.equal(hasTerm('局部・男性の顔', '男性の顔'), true)
})

test('detect-terms: 正しい模型ならエラー 0 (陽性対照)', () => {
	assert.deepEqual(withSite(null, checkDetectTerms), [])
})

test('detect-terms: ページが無ければ何もしない', () => {
	const errors = withSite((_, o) => {
		for (const l of Object.keys(o)) o[l].skip = true
	}, checkDetectTerms)
	assert.deepEqual(errors, [])
})

test('detect-terms: レイアウトを通っていない (canonical の無い) ページは見ない', () => {
	const dir = mkdtempSync(join(tmpdir(), 'dm-t2458-'))
	try {
		writeFileSync(join(dir, 'index.html'), '<html lang="ja"><head></head></html>')
		assert.deepEqual(checkDetectTerms(makeContext(dir, ROOT)), [])
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

const NEGATIVES = [
	['en の featureList から male faces を消す', (m) => (m.en.features = ['Detect body areas, and female faces'])],
	['zh の description に 人的臉部 を入れる', (m) => (m['zh-tw'].desc += '、人的臉部')],
	['ja の h2 に 除去 を入れる', (m) => (m.ja.h2 += '（除去）')],
	['#detect-targets が無い', (_, o) => (o.en.section = false)],
	['ja の title から 顔 を消す', (m) => (m.ja.title = '動画にモザイクを自動でかけるAIソフト｜Deepmosaic')],
]

for (const [name, mutate] of NEGATIVES) {
	test(`detect-terms: ${name} とエラーになる (陰性対照)`, () => {
		const errors = withSite(mutate, checkDetectTerms)
		assert.ok(errors.length >= 1, `エラーにならない: ${name}`)
	})
}
