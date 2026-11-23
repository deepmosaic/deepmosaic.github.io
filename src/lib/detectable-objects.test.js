// 検出対象の図 `_includes/detectable-objects.html` (ページに埋め込む SVG) の仕様テスト。
//
//   node --test src/lib/detectable-objects.test.js
//
//   - 部品のソース: <svg> が 1 つで viewBox / width / height / role / aria-labelledby と、その id の <title> を持つ。
//     背景 (#1C4587) と矢羽 (#1155CC、点は固定の座標) と白・太字・中央揃えの <text> が 6 本。
//     外部の参照・script・style・on* 属性・site.data.lang.ja. を持たない。
//   - <text> の座標: x は左 29〜469・右 480〜929 (矢羽の先より左 / 右の枠)、y は 0〜540 の中、右の 4 本は昇順 (3 言語の分岐とも)
//   - en だけの組み直し (矢羽の境目・文字の大きさ・見出しの 3 行目の tspan)。ja と zh-tw の図の SVG は
//     小さな描き手で描いて、ja-identity の基点の hero の SVG と sha256 が同じ
//   - parts.yml (en / zh-tw) の do_ キー: 7 つで集合が同じ、lintValue を通り仮名・禁止語が無い
//   - check-site のモジュール scripts/i18n/checks/detectable.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import checkDetectable, { JA_TEXTS, JA_TITLE } from '../../scripts/i18n/checks/detectable.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')

const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const SRC_RAW = read('_includes/detectable-objects.html')
const SRC = stripComments(SRC_RAW)

/** 平らな `key: "value"` の yml を読む (i18n-site-parts.test.js と同じ形)。 */
function parseFlatYaml(text) {
	const out = {}
	for (const raw of text.split('\n')) {
		if (/^\s*(#.*)?$/.test(raw)) continue
		const m = raw.match(/^([a-z][a-z0-9_]*):\s*"((?:[^"\\]|\\.)*)"\s*(#.*)?$/)
		if (!m) throw new Error(`読めない行: ${raw}`)
		out[m[1]] = JSON.parse(`"${m[2]}"`)
	}
	return out
}
const doKeys = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith('do_')))
const PARTS = {
	en: doKeys(parseFlatYaml(read('_data/l10n/en/parts.yml'))),
	'zh-tw': doKeys(parseFlatYaml(read('_data/l10n/zh-tw/parts.yml'))),
}

const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))

/**
 * 部品の `assign do_<name> = <数値>` を言語ごとに解いた表。先頭 (case の外) の assign が既定値 (= ja)、
 * `{% when 'en' %}` / `{% when 'zh-tw' %}` の中の assign がその言語の上書き。
 */
function layoutFor(lang) {
	// 数値の assign は数値に、'…' の文字列の assign (do_poly) は文字列にする。フィルタ付きの assign は読まない
	const num = (body) =>
		Object.fromEntries(
			[...body.matchAll(/assign (do_\w+) = (?:(-?\d+(?:\.\d+)?)|'([^']*)')\s*-?%\}/g)].map((m) => [m[1], m[2] !== undefined ? Number(m[2]) : m[3]]),
		)
	const caseAt = SRC.search(/\{%-?\s*case page\.lang/)
	const base = num(caseAt >= 0 ? SRC.slice(0, caseAt) : SRC)
	if (lang === 'ja' || caseAt < 0) return base
	const branch = SRC.slice(caseAt).match(new RegExp(`\\{%-?\\s*when '${lang}'\\s*-?%\\}([\\s\\S]*?)\\{%-?\\s*(?:when|else|endcase)`))
	return { ...base, ...num(branch?.[1] ?? '') }
}

/** <text> の開始タグの x / y を数値にする (`{{ do_x }}` は layoutFor の表で解く)。 */
function textCoords(lang) {
	const table = layoutFor(lang)
	const val = (v) => {
		const ref = v.match(/^\{\{\s*(do_\w+)\s*\}\}$/)
		return ref ? table[ref[1]] : Number(v)
	}
	return [...SRC.matchAll(/<text\b[^>]*>/g)].map((m) => {
		const a = attrsOf(m[0])
		return { tag: m[0], x: val(a.x ?? ''), y: val(a.y ?? '') }
	})
}

// ---- 1. 部品のソース ----

test('部品: <svg> が 1 つで viewBox / width / height / role / aria-labelledby と、その id の <title> を持つ', () => {
	const svgs = SRC.match(/<svg\b[^>]*>/g) ?? []
	assert.equal(svgs.length, 1, '<svg> がちょうど 1 つでない')
	const a = attrsOf(svgs[0])
	assert.equal(a.viewBox, '0 0 960 540')
	assert.equal(a.width, '960')
	assert.equal(a.height, '540')
	assert.equal(a.role, 'img')
	assert.ok(a['aria-labelledby'], 'aria-labelledby が無い')
	assert.equal(a['aria-labelledby'], '{{ do_id }}-title')
	assert.match(SRC, /<title id="\{\{ do_id \}\}-title">/)
	// 接頭辞の既定は detectable、class の既定は今の hero の img と同じ見た目
	assert.match(SRC, /assign do_id = include\.id_prefix \| default: 'detectable'/)
	assert.match(SRC, /include\.class \| default: 'mx-auto block h-auto w-\[min\(288px,100%\)\] rounded-\[10px\] border border-edge'/)
	assert.equal(a.class, '{{ do_class }}')
	// 図はファーストビューに入る (lazy にしない・LCP は hero 動画のまま)
	assert.doesNotMatch(SRC, /loading=|fetchpriority/)
})

test('部品: 背景の rect (#1C4587) と矢羽の polygon (#1155CC、ja と zh-tw は固定の座標の点)', () => {
	const rect = SRC.match(/<rect\b[^>]*>/)?.[0] ?? ''
	assert.match(rect, /fill="#1c4587"/i)
	assert.match(rect, /\swidth="960"/)
	assert.match(rect, /\sheight="540"/)
	const poly = SRC.match(/<polygon\b[^>]*>/)?.[0] ?? ''
	assert.match(poly, /fill="#1155cc"/i)
	assert.equal(attrsOf(poly).points, '{{ do_poly }}')
	assert.equal(layoutFor('ja').do_poly, '0,0 411.2,0 514,270 411.2,540 0,540')
	assert.equal(layoutFor('zh-tw').do_poly, '0,0 411.2,0 514,270 411.2,540 0,540')
})

/** 矢羽の点の列 `0,0 X,0 T,270 X,540 0,540` を { x: X, tip: T } にする (形が違えば null)。 */
function arrowOf(points) {
	const p = points.split(' ').map((xy) => xy.split(',').map(Number))
	if (p.length !== 5) return null
	const [a, b, c, d, e] = p
	const ok = a[0] === 0 && a[1] === 0 && b[1] === 0 && c[1] === 270 && d[0] === b[0] && d[1] === 540 && e[0] === 0 && e[1] === 540
	return ok ? { x: b[0], tip: c[0] } : null
}

test('部品: en の矢羽は ja と同じ形 (先の三角の深さ 102.8) のまま境目だけ左へ寄せる', () => {
	const ja = arrowOf(layoutFor('ja').do_poly)
	const en = arrowOf(layoutFor('en').do_poly)
	assert.ok(ja && en, '矢羽の点の形が違う')
	assert.ok(Math.abs(en.tip - en.x - (ja.tip - ja.x)) < 1e-9, `先の三角の深さが ja と違う: ${en.tip - en.x}`)
	assert.ok(en.tip < ja.tip, '境目が左へ寄っていない')
	// 左の見出しの中心は矢羽の中、右の項目の中心は右の面の中
	assert.ok(layoutFor('en').do_xl > 0 && layoutFor('en').do_xl < en.x)
	assert.ok(layoutFor('en').do_xr > en.tip && layoutFor('en').do_xr < 960)
	// 陰性対照
	assert.equal(arrowOf('0,0 411.2,0 514,200 411.2,540 0,540'), null)
	assert.equal(arrowOf('0,0 411.2,0 514,270 0,540'), null)
})

test('部品: en の右の 4 項目は ja の 75 % 以上・288px 幅で 18px 以上・前 (42) より大きい、見出しも同じ大きさ', () => {
	const ja = layoutFor('ja')
	const en = layoutFor('en')
	assert.ok(en.do_fs_r >= ja.do_fs_r * 0.75, `en の項目の大きさ ${en.do_fs_r} が ja (${ja.do_fs_r}) の 75 % 未満`)
	assert.ok((en.do_fs_r * 288) / 960 >= 18, `288px 幅で 18px 未満: ${en.do_fs_r}`)
	assert.ok(en.do_fs_r > 42, '組み直す前の 42 より大きくない')
	assert.ok(en.do_fs_l >= en.do_fs_r, '見出しが項目より小さい')
	// 4 行の送りは ja と同じ (詰めない)
	const step = (t) => [t.do_r2 - t.do_r1, t.do_r3 - t.do_r2, t.do_r4 - t.do_r3]
	assert.deepEqual(step(en), step(ja))
})

test('部品: 見出しの 3 行目の <tspan> は en の分岐だけ、字間の圧縮・横の縮小をしない', () => {
	assert.match(SRC.slice(0, SRC.search(/\{%-?\s*case page\.lang/)), /assign do_head_split = false/)
	const en = SRC.match(/\{%-?\s*when 'en'\s*-?%\}([\s\S]*?)\{%-?\s*when/)?.[1] ?? ''
	assert.match(en, /assign do_head_split = true/)
	const zh = SRC.match(/\{%-?\s*when 'zh-tw'\s*-?%\}([\s\S]*?)\{%-?\s*endcase/)?.[1] ?? ''
	assert.doesNotMatch(zh, /do_head_split/)
	for (const re of [/letter-spacing/, /textLength/, /lengthAdjust/, /scale\(/, /transform=/]) assert.doesNotMatch(SRC, re, `${re} がある`)
	// 行の間の空白は幅 0 の tspan (textContent は parts.yml の値のまま)
	assert.match(SRC, /<\/tspan><tspan font-size="0"> <\/tspan><tspan /)
})

/**
 * 部品を ja / zh-tw について描く小さな描き手 (Liquid の全部ではなく、この部品が使う形だけ)。
 * `{{ do_x }}` を layoutFor の値に、`{% if do_head_split %}…{% elsif do_P %}A{% else %}B{% endif %}` と
 * `{% if do_P %}A{% else %}B{% endif %}` を、zh-tw は A (parts の値)・ja は B に置き換える。
 */
function renderSvg(lang) {
	const table = { ...layoutFor(lang), do_id: 'detectable', do_class: 'mx-auto block h-auto w-[min(288px,100%)] rounded-[10px] border border-edge' }
	const parts = lang === 'ja' ? null : PARTS[lang]
	const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
	const pick = (a, b) => (parts ? a : b)
	const svg = SRC.slice(SRC.indexOf('<svg '), SRC.indexOf('</svg>') + 6)
	return svg
		.replace(/\{% if do_head_split %\}[\s\S]*?\{% elsif do_P %\}([\s\S]*?)\{% else %\}([\s\S]*?)\{% endif %\}/g, (_, a, b) => pick(a, b))
		.replace(/\{% if do_P %\}([\s\S]*?)\{% else %\}([\s\S]*?)\{% endif %\}/g, (_, a, b) => pick(a, b))
		.replace(/\{\{ do_P\.(do_\w+) \| escape \}\}/g, (_, k) => esc(parts[k]))
		.replace(/\{\{ (do_\w+) \}\}/g, (_, k) => {
			assert.ok(k in table, `表に無い: ${k}`)
			return String(table[k])
		})
}

// ja-identity の基点の _site の hero の <svg>…</svg> の sha256。ja と zh-tw の図は 1 バイトも変えない
const BASE_SVG_SHA256 = {
	ja: '5138d75356f2edd080714c27f805b98497c7566550e825917de62b21fe258f09',
	'zh-tw': '3f1dec60dda9461f16a37370715858d2dfe758c31fff8918f71b465be07b6ed2',
}

for (const lang of ['ja', 'zh-tw']) {
	test(`部品: ${lang} の図の SVG は基点と同じ (sha256)`, () => {
		const out = renderSvg(lang)
		assert.doesNotMatch(out, /\{[{%]/, 'Liquid が残っている')
		assert.equal(createHash('sha256').update(out).digest('hex'), BASE_SVG_SHA256[lang])
	})
}

test('部品: 描き手の陰性対照 (en の値に変えると ja の hash と違う)', () => {
	const tampered = renderSvg('ja').replace('x="249"', 'x="174"')
	assert.notEqual(createHash('sha256').update(tampered).digest('hex'), BASE_SVG_SHA256.ja)
})

test('部品: <text> が 6 本で、全部 text-anchor="middle"・白・太字', () => {
	const texts = SRC.match(/<text\b[^>]*>/g) ?? []
	assert.equal(texts.length, 6)
	for (const t of texts) {
		assert.match(t, /text-anchor="middle"/, t)
		assert.match(t, /fill="#fff(?:fff)?"/i, t)
		assert.match(t, /font-weight="(?:700|bold)"/, t)
	}
})

test('部品: ja の直書きの 6 語と、読み上げ名の ja (男性の顔・女性の顔)', () => {
	for (const w of ['検出支援', 'できる物体', '男性器', '女性器', '男女の顔', 'モザイク']) assert.ok(SRC.includes(`{% else %}${w}{% endif %}`), `ja の直書きが無い: ${w}`)
	assert.ok(SRC.includes(`{% else %}${JA_TITLE}{% endif %}`), '読み上げ名の ja が無い')
	assert.match(JA_TITLE, /男性の顔/)
	assert.match(JA_TITLE, /女性の顔/)
	assert.deepEqual(JA_TEXTS, ['検出支援', 'できる物体', '男性器', '女性器', '男女の顔', 'モザイク'])
})

test('部品 (失敗系): 外部の参照・script・style・foreignObject・on* 属性・site.data.lang.ja. を持たない', () => {
	for (const re of [/<image/i, /<img/i, /href=/i, /url\(/i, /<script/i, /<foreignObject/i, /<style/i, /\son\w+=/i, /site\.data\.lang\.ja\./]) {
		assert.doesNotMatch(SRC, re, `${re} がある`)
	}
	assert.match(SRC, /page\.lang/)
	// 陰性対照
	assert.match('<svg><image href="x.png"/></svg>', /<image/i)
	assert.match('<text onclick="x()">', /\son\w+=/i)
})

test('部品 (境界値): ja の <text> の x は数値に解け、左の 2 本は 29〜469・右の 4 本は 480〜929 (en は矢羽の境目の左 / 右)', () => {
	const coords = textCoords('ja')
	for (const c of coords) assert.ok(Number.isFinite(c.x), `x が数値に解けない: ${c.tag}`)
	const en = textCoords('en')
	const tip = arrowOf(layoutFor('en').do_poly).tip
	en.slice(0, 2).forEach((c) => assert.ok(c.x > 0 && c.x < tip, `en の左の x が範囲外: ${c.x}`))
	en.slice(2).forEach((c) => assert.ok(c.x > tip && c.x < 960, `en の右の x が範囲外: ${c.x}`))
	coords.slice(0, 2).forEach((c) => assert.ok(c.x >= 29 && c.x <= 469, `左の x が範囲外: ${c.x}`))
	coords.slice(2).forEach((c) => assert.ok(c.x >= 480 && c.x <= 929, `右の x が範囲外: ${c.x}`))
})

for (const lang of ['ja', 'en', 'zh-tw']) {
	test(`部品 (境界値): ${lang} の <text> の y は 0 より大きく 540 未満で、左は 2 本・右は 4 本とも昇順`, () => {
		const coords = textCoords(lang)
		for (const c of coords) assert.ok(Number.isFinite(c.y) && c.y > 0 && c.y < 540, `y が範囲外: ${c.y} (${c.tag})`)
		assert.ok(coords[0].y < coords[1].y, '左の y が昇順でない')
		for (let i = 3; i < 6; i += 1) assert.ok(coords[i - 1].y < coords[i].y, '右の y が昇順でない')
	})
}

// ---- 2. parts.yml の do_ キー ----

const DO_KEYS = ['do_head_1', 'do_head_2', 'do_item_faces', 'do_item_female', 'do_item_male', 'do_item_mosaic', 'do_title']

/** 図の訳の値の判定 (lintValue + 仮名 + 言語ごとの禁止語)。エラーの文字列の配列。 */
function judge(lang, value) {
	const out = [...lintValue(lang, value)]
	if (KANA.test(value)) out.push('仮名')
	if (lang === 'en' && /private|genital/i.test(value)) out.push('en の禁止語')
	if (lang === 'zh-tw' && /敏感|私密|隱私/.test(value)) out.push('zh の禁止語')
	return out
}

test('parts.yml: en / zh-tw の do_ キーは 7 つちょうどで集合が同じ、部品が引くキーは全部ある', () => {
	assert.deepEqual(Object.keys(PARTS.en).sort(), DO_KEYS)
	assert.deepEqual(Object.keys(PARTS['zh-tw']).sort(), DO_KEYS)
	const refs = new Set([...SRC.matchAll(/\bdo_P\.(\w+)/g)].map((m) => m[1]))
	assert.deepEqual([...refs].sort(), DO_KEYS)
})

test('parts.yml: do_ の値は lintValue を通り、仮名・禁止語が無い (陰性対照つき)', () => {
	for (const lang of ['en', 'zh-tw']) {
		for (const [k, v] of Object.entries(PARTS[lang])) assert.deepEqual(judge(lang, v), [], `${lang}.${k}: ${v}`)
	}
	assert.match(PARTS.en.do_item_mosaic, /existing mosaic/i)
	assert.ok(PARTS['zh-tw'].do_item_mosaic.includes('既有馬賽克'))
	assert.match(PARTS.en.do_title, /male faces/)
	assert.match(PARTS.en.do_title, /female faces/)
	assert.ok(PARTS['zh-tw'].do_title.includes('男性臉部') && PARTS['zh-tw'].do_title.includes('女性臉部'))
	// 陰性対照
	assert.ok(judge('en', 'モザイク').length > 0)
	assert.ok(judge('en', 'Male private areas').length > 0)
	assert.ok(judge('zh-tw', '男性私密部位').length > 0)
})

// ---- 3. checks/detectable.mjs ----

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function svgOf(prefix, title, texts) {
	return (
		`<svg viewBox="0 0 960 540" width="960" height="540" role="img" aria-labelledby="${prefix}-title" class="x">` +
		`<title id="${prefix}-title">${escapeHtml(title)}</title><rect x="0" y="0" width="960" height="540" fill="#1C4587"/>` +
		texts.map((t) => `<text x="249" y="100" text-anchor="middle">${escapeHtml(t)}</text>`).join('') +
		'</svg>'
	)
}

const expected = (lang) => {
	if (lang === 'ja') return { title: JA_TITLE, texts: JA_TEXTS }
	const p = PARTS[lang]
	return { title: p.do_title, texts: [p.do_head_1, p.do_head_2, p.do_item_male, p.do_item_female, p.do_item_faces, p.do_item_mosaic] }
}

const HEAD = '<head><link rel="canonical" href="https://example.invalid/"></head>'
const heroPage = (svg) => `<html>${HEAD}<body><figure id="hero-detectable" class="m">${svg}<figcaption>c</figcaption></figure></body></html>`

const docsPage = (lang) => `<html>${HEAD}<body><details><summary>s</summary><div>${svgOf('docs-detectable', expected(lang).title, expected(lang).texts)}</div></details></body></html>`

function goodPages() {
	const page = (lang) => heroPage(svgOf('detectable', expected(lang).title, expected(lang).texts))
	return {
		'index.html': page('ja'),
		'en/index.html': page('en'),
		'zh-tw/index.html': page('zh-tw'),
		'docs/index.html': docsPage('ja'),
		'en/docs/index.html': docsPage('en'),
		'zh-tw/docs/index.html': docsPage('zh-tw'),
	}
}

function runCheck(pages) {
	const dir = mkdtempSync(join(tmpdir(), 'dm-detectable-'))
	try {
		for (const [rel, html] of Object.entries(pages)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), html)
		}
		return checkDetectable(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('checks/detectable: 正しい模型はエラー 0', () => {
	assert.deepEqual(runCheck(goodPages()), [])
})

test('checks/detectable: ページが無い模型・レイアウトを通っていない模型はエラー 0', () => {
	assert.deepEqual(runCheck({ 'other.html': '<p>x</p>' }), [])
	assert.deepEqual(runCheck({ 'index.html': '<html><body><p>x</p></body></html>', 'docs/index.html': '<p>x</p>' }), [])
})

const NEGATIVES = [
	[
		'en の <text> に仮名が残る',
		(p) => ({ ...p, 'en/index.html': heroPage(svgOf('detectable', expected('en').title, ['検出支援', ...expected('en').texts.slice(1)])) }),
	],
	['<text> が 5 本', (p) => ({ ...p, 'index.html': heroPage(svgOf('detectable', JA_TITLE, JA_TEXTS.slice(0, 5))) })],
	['<title> が無い', (p) => ({ ...p, 'zh-tw/index.html': p['zh-tw/index.html'].replace(/<title[^>]*>[^<]*<\/title>/, '') })],
	[
		'detectable-objects.webp の img が残る',
		(p) => ({ ...p, 'index.html': p['index.html'].replace('<figcaption>', '<img src="/assets/img/detectable-objects.webp" alt="x"><figcaption>') }),
	],
	['docs に svg が無い', (p) => ({ ...p, 'docs/index.html': `<html>${HEAD}<body><details><summary>s</summary></details></body></html>` })],
	['en の docs の図が日本語の文のまま', (p) => ({ ...p, 'en/docs/index.html': `<html>${HEAD}<body><details><summary>s</summary><div>${svgOf('docs-detectable', JA_TITLE, JA_TEXTS)}</div></details></body></html>` })],
	['hero に svg が 2 つ', (p) => ({ ...p, 'index.html': heroPage(svgOf('a', JA_TITLE, JA_TEXTS) + svgOf('b', JA_TITLE, JA_TEXTS)) })],
	['<text> の文が期待値と違う', (p) => ({ ...p, 'index.html': heroPage(svgOf('detectable', JA_TITLE, ['人間の顔', ...JA_TEXTS.slice(1)])) })],
]

for (const [name, mutate] of NEGATIVES) {
	test(`checks/detectable: ${name} → エラー`, () => {
		const errors = runCheck(mutate(goodPages()))
		assert.ok(errors.length > 0, `${name} を見逃した`)
	})
}
