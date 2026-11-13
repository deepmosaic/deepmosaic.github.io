// T-2215 (i18n1112 I18N-804, 2026-11-13) 公式サイトの英中のページのはみ出し・日本語の残り (漏れ) の判定の仕様テスト。
//
//   node --test src/lib/i18n-overflow.test.js
//
//   - ブラウザで採る部分 (OVERFLOW_PROBE_SOURCE / LEAK_PROBE_SOURCE) は e2e/i18n-layout.spec.ts が実ブラウザで動かす。
//     ここは採った項目の判定 (純関数) と、採取の式が式として読めることだけを見る。
//   - `_site` は読まない (CI では npm test がビルドの前に走る)。台帳 `_data/i18n_pages.yml` はソースなので読む。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
	LEAK_PROBE_SOURCE,
	OVERFLOW_PROBE_SOURCE,
	diffLeaks,
	diffOverflow,
	jaCounterpart,
	judgeLeak,
	listI18nPages,
	pageHasHorizontalScroll,
	pageSlug,
	parseAllow,
} from './i18n-overflow.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const CTX = { page: '/price/', lang: 'en', width: 'desktop' }
const item = (path, kinds, text = 'x') => ({ path, tag: 'a', text, kinds })
const allowOf = (entries) => ({ version: 1, entries })

// ---- diffOverflow -------------------------------------------------------------

test('diffOverflow: ja ではみ出さず en ではみ出す → エラー', () => {
	const ja = [item('body>main:nth-of-type(1)>a:nth-of-type(1)', [])]
	const en = [item('body>main:nth-of-type(1)>a:nth-of-type(1)', ['clipped'])]
	const r = diffOverflow(ja, en, null, CTX)
	assert.equal(r.errors.length, 1)
	assert.equal(r.errors[0].kind, 'clipped')
	assert.equal(r.errors[0].path, 'body>main:nth-of-type(1)>a:nth-of-type(1)')
	assert.deepEqual(r.warnings, [])
})

test('diffOverflow: ja と en の両方ではみ出す → 警告 preexisting', () => {
	const p = 'body>main:nth-of-type(1)>p:nth-of-type(2)'
	const r = diffOverflow([item(p, ['spill'])], [item(p, ['spill'])], null, CTX)
	assert.deepEqual(r.errors, [])
	assert.equal(r.warnings.length, 1)
	assert.equal(r.warnings[0].reason, 'preexisting')
	assert.equal(r.warnings[0].kind, 'spill')
})

test('diffOverflow: ja に同じ path があっても kind が違えばエラー', () => {
	const p = 'body>main:nth-of-type(1)>p:nth-of-type(2)'
	const r = diffOverflow([item(p, ['clipped'])], [item(p, ['clipped', 'offscreen'])], null, CTX)
	assert.deepEqual(r.errors.map((e) => e.kind), ['offscreen'])
	assert.deepEqual(r.warnings.map((w) => [w.kind, w.reason]), [['clipped', 'preexisting']])
})

test('diffOverflow: ja に path が無い clipped / clipped-y → 警告 no-counterpart', () => {
	const en = [item('body>header:nth-of-type(1)>a:nth-of-type(3)', ['clipped', 'clipped-y'])]
	const r = diffOverflow([], en, null, CTX)
	assert.deepEqual(r.errors, [])
	assert.deepEqual(r.warnings.map((w) => [w.kind, w.reason]), [
		['clipped', 'no-counterpart'],
		['clipped-y', 'no-counterpart'],
	])
})

test('diffOverflow: ja に path が無い offscreen / spill / no-name → エラー', () => {
	const en = [item('body>header:nth-of-type(1)>a:nth-of-type(3)', ['offscreen', 'spill', 'no-name'])]
	const r = diffOverflow([], en, null, CTX)
	assert.deepEqual(r.errors.map((e) => e.kind), ['offscreen', 'spill', 'no-name'])
	assert.deepEqual(r.warnings, [])
})

test('diffOverflow: ellipsis は ja の有無にかかわらず警告', () => {
	const p = 'body>main:nth-of-type(1)>span:nth-of-type(1)'
	const r = diffOverflow([item(p, [])], [item(p, ['ellipsis'])], null, CTX)
	assert.deepEqual(r.errors, [])
	assert.deepEqual(r.warnings.map((w) => [w.kind, w.reason]), [['ellipsis', 'ellipsis']])
})

test('diffOverflow: はみ出しの無い項目は何も出さない', () => {
	const r = diffOverflow([], [item('body>p:nth-of-type(1)', [])], null, CTX)
	assert.deepEqual(r, { errors: [], warnings: [] })
})

test('diffOverflow: allow に当たる (page 完全一致 + path 前方一致) → 警告 allowed', () => {
	const en = [item('body>header:nth-of-type(1)>a:nth-of-type(3)', ['offscreen'])]
	const allow = allowOf([{ page: '/price/', path: 'body>header:nth-of-type(1)', reason: '装飾' }])
	const r = diffOverflow([], en, allow, CTX)
	assert.deepEqual(r.errors, [])
	assert.deepEqual(r.warnings.map((w) => [w.kind, w.reason]), [['offscreen', 'allowed']])
})

test('diffOverflow: allow の text は完全一致、page は完全一致', () => {
	const en = [item('body>p:nth-of-type(1)', ['offscreen'], 'Pricing')]
	const hit = diffOverflow([], en, allowOf([{ page: '/price/', text: 'Pricing', reason: 'r' }]), CTX)
	assert.equal(hit.errors.length, 0)
	const textMiss = diffOverflow([], en, allowOf([{ page: '/price/', text: 'Pric', reason: 'r' }]), CTX)
	assert.equal(textMiss.errors.length, 1)
	const pageMiss = diffOverflow([], en, allowOf([{ page: '/price', text: 'Pricing', reason: 'r' }]), CTX)
	assert.equal(pageMiss.errors.length, 1)
})

test('diffOverflow: allow の width / lang を限定したときの当たり外れ', () => {
	const en = [item('body>p:nth-of-type(1)', ['offscreen'])]
	const allow = allowOf([{ page: '/price/', path: 'body>p', width: 'mobile', lang: 'en', reason: 'r' }])
	assert.equal(diffOverflow([], en, allow, { ...CTX, width: 'mobile' }).errors.length, 0)
	assert.equal(diffOverflow([], en, allow, { ...CTX, width: 'desktop' }).errors.length, 1)
	assert.equal(diffOverflow([], en, allow, { ...CTX, width: 'mobile', lang: 'zh-tw' }).errors.length, 1)
})

test('diffOverflow: allow の reason 欠け・空 → Error', () => {
	const en = [item('body>p:nth-of-type(1)', ['offscreen'])]
	assert.throws(() => diffOverflow([], en, allowOf([{ page: '/price/', path: 'body' }]), CTX), /reason/)
	assert.throws(() => diffOverflow([], en, allowOf([{ page: '/price/', path: 'body', reason: '  ' }]), CTX), /reason/)
})

test('parseAllow: version が 1 でない・entries が配列でない・page が無い → Error、初版の空はそのまま', () => {
	assert.throws(() => parseAllow({ version: 2, entries: [] }), /version/)
	assert.throws(() => parseAllow({ version: 1 }), /entries/)
	assert.throws(() => parseAllow({ version: 1, entries: [{ path: 'body', reason: 'r' }] }), /page/)
	assert.throws(() => parseAllow({ version: 1, entries: [{ page: '/', reason: 'r' }] }), /path|text/)
	assert.throws(() => parseAllow({ version: 1, entries: [{ page: '/', text: 'a', width: 'tablet', reason: 'r' }] }), /width/)
	assert.deepEqual(parseAllow({ version: 1, entries: [] }), { version: 1, entries: [] })
	assert.deepEqual(parseAllow(JSON.parse(read('e2e/i18n-allow.json'))).version, 1)
})

// ---- judgeLeak / diffLeaks ----------------------------------------------------

test('judgeLeak (en): Deepmosaic・¥1,000・(JST) は漏れでない、料金・プラン・ひらがな は漏れ', () => {
	for (const ok of ['Deepmosaic', '¥1,000', '(JST)', 'Price — ¥1,000 / month', '']) {
		assert.equal(judgeLeak(ok, 'en'), false, ok)
	}
	for (const ng of ['料金', 'プラン', 'ください', 'Pricing 料金']) {
		assert.equal(judgeLeak(ng, 'en'), true, ng)
	}
})

test('judgeLeak (zh-tw): 方案・漢字は漏れでない、プラン・ください は漏れ', () => {
	for (const ok of ['方案', '持有組織代碼者（企業）', '登入', 'Deepmosaic']) {
		assert.equal(judgeLeak(ok, 'zh-tw'), false, ok)
	}
	for (const ng of ['プラン', 'ください', '方案の']) {
		assert.equal(judgeLeak(ng, 'zh-tw'), true, ng)
	}
})

test('judgeLeak: en / zh-tw 以外の lang → Error', () => {
	assert.throws(() => judgeLeak('a', 'ja'), /lang/)
	assert.throws(() => judgeLeak('a', 'zh-cn'), /lang/)
})

test('diffLeaks: attr:alt の項目も本文 (text) と同じ判定、allow の text で警告に', () => {
	const items = [
		{ path: 'body>img:nth-of-type(1)', kind: 'attr:alt', text: 'アプリの画面' },
		{ path: 'body>p:nth-of-type(1)', kind: 'text', text: 'アプリの画面' },
		{ path: 'body>p:nth-of-type(2)', kind: 'text', text: 'App screen' },
		{ path: 'body>img:nth-of-type(2)', kind: 'attr:alt', text: 'App screen' },
	]
	const r = diffLeaks(items, null, CTX)
	assert.deepEqual(r.errors.map((e) => e.kind), ['attr:alt', 'text'])
	assert.deepEqual(r.warnings, [])
	const allowed = diffLeaks(items, allowOf([{ page: '/price/', text: 'アプリの画面', reason: '誤検出' }]), CTX)
	assert.deepEqual(allowed.errors, [])
	assert.deepEqual(allowed.warnings.map((w) => w.reason), ['allowed', 'allowed'])
})

// ---- jaCounterpart ------------------------------------------------------------

test('jaCounterpart: 英中の URL → ja のパス', () => {
	const cases = [
		['/en/', '/'],
		['/en', '/'],
		['/zh-tw/', '/'],
		['/zh-tw/price/', '/price/'],
		['/en/mosaic-removal/', '/mosaic-removal/'],
		['/en/company/about', '/company/about'],
		['/zh-tw/join/', '/join/'],
	]
	for (const [input, want] of cases) assert.equal(jaCounterpart(input), want, input)
})

test('jaCounterpart: 接頭辞の無いパス・en で始まる ja のディレクトリ → Error', () => {
	for (const bad of ['/price/', '/', '/enterprise/inquiry/', '/english/', '/zh-twx/', 'en/', '']) {
		assert.throws(() => jaCounterpart(bad), /接頭辞/, bad)
	}
})

// ---- pageHasHorizontalScroll --------------------------------------------------

test('pageHasHorizontalScroll: 差 1px は許す、2px は横スクロール', () => {
	assert.equal(pageHasHorizontalScroll({ scrollWidth: 412, innerWidth: 412 }), false)
	assert.equal(pageHasHorizontalScroll({ scrollWidth: 413, innerWidth: 412 }), false)
	assert.equal(pageHasHorizontalScroll({ scrollWidth: 414, innerWidth: 412 }), true)
	assert.equal(pageHasHorizontalScroll({ scrollWidth: 300, innerWidth: 412 }), false)
})

// ---- listI18nPages / pageSlug -------------------------------------------------

test('listI18nPages: 今の _data/i18n_pages.yml は 9 本で、全部が [en, zh-tw]', () => {
	const pages = listI18nPages(read('_data/i18n_pages.yml'))
	assert.deepEqual(pages.map((p) => p.jaPath), [
		'/',
		'/price/',
		'/spec/',
		'/subscribe/',
		'/join/',
		'/contact/',
		'/enterprise/inquiry/',
		'/mosaic-removal/',
		'/company/about',
	])
	for (const p of pages) assert.deepEqual(p.langs, ['en', 'zh-tw'], p.jaPath)
})

test('listI18nPages: 空の文字列・鍵 0 本 → Error、en / zh-tw 以外の言語 → Error', () => {
	assert.throws(() => listI18nPages(''), /0 本/)
	assert.throws(() => listI18nPages('# コメントだけ\n'), /0 本/)
	assert.throws(() => listI18nPages('"/": [en, zh-tw]\n"/price/": [en, fr]\n'), /fr/)
})

test('listI18nPages: 読めない行 (引用符なし・単一引用符・ブロック形式) は黙って捨てずに Error、行末のコメントは許す', () => {
	assert.throws(() => listI18nPages('"/": [en, zh-tw]\n/price/: [en, zh-tw]\n'), /2 行目/)
	assert.throws(() => listI18nPages("\"/\": [en, zh-tw]\n'/price/': [en, zh-tw]\n"), /2 行目/)
	assert.throws(() => listI18nPages('"/": [en, zh-tw]\n"/price/":\n  - en\n  - zh-tw\n'), /2 行目/)
	assert.deepEqual(listI18nPages('# 見出し\n\n"/": [en, zh-tw]  # 行末のコメント\r\n'), [{ jaPath: '/', langs: ['en', 'zh-tw'] }])
})

test('pageSlug: ja のパスの / を - に、トップは top', () => {
	assert.equal(pageSlug('/'), 'top')
	assert.equal(pageSlug('/price/'), 'price')
	assert.equal(pageSlug('/enterprise/inquiry/'), 'enterprise-inquiry')
	assert.equal(pageSlug('/company/about'), 'company-about')
})

// ---- 採取の式 -----------------------------------------------------------------

test('OVERFLOW_PROBE_SOURCE / LEAK_PROBE_SOURCE: 式として読め、除外の印を含む', () => {
	for (const src of [OVERFLOW_PROBE_SOURCE, LEAK_PROBE_SOURCE]) {
		assert.equal(typeof src, 'string')
		assert.doesNotThrow(() => new Function(`return (${src})`), src.slice(0, 60))
		// 部分文字列 (script ⊂ noscript) で空振りしないよう、EXCLUDE のセレクタの一覧を取り出して要素で比べる
		const m = /EXCLUDE\s*=\s*'([^']*)'/.exec(src)
		assert.ok(m, 'EXCLUDE の定義が見つからない')
		const excluded = m[1].split(',').map((s) => s.trim())
		for (const sel of ['script', 'style', 'noscript', 'template', '[lang="ja"]', '[data-ja-allowed]', '[data-i18n-switch]', '[hidden]']) {
			assert.ok(excluded.includes(sel), `${sel} を除外していない`)
		}
	}
})
