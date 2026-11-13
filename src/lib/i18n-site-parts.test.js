// T-2205 (i18n1112 I18N-707, 2026-11-12) サイトの共通 include とトップのアイランドの英中対応の仕様テスト。
//
//   node --test src/lib/i18n-site-parts.test.js
//
//   - 既存のテストが照合している ja の直書き・href・Liquid の式が include のソースに残っている (陽性対照)
//   - 対象の include (cta-download・download-button・pricing-cards・contract-quota・contract-limits・what-is・
//     can-cannot・disclosure-table) が `site.data.lang.ja.` を参照せず、英中の分岐 (`page.lang`) を持つ
//   - include が引く parts.yml のキーが en / zh-tw の両方にある。parts.yml (en / zh-tw) のキーの集合が同じ、
//     値が lintValue を通る (除去の語は許さない)、差し込みの印 (%DAYS% など) が en と zh-tw で同じ
//   - pricing.js: formatYenFor と planBreakdown(tier, h, lang)。ja の出力は今のまま
//   - RoiCalculator.svelte: 3 言語の表のキーの集合が同じ、ja の文が今の文字列のまま、英中に仮名が無い
//   - check-site のモジュール scripts/i18n/checks/parts.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import checkParts from '../../scripts/i18n/checks/parts.mjs'
import { formatYen, formatYenFor, planBreakdown } from './pricing.js'
import { loadTiers } from './plans-yml.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// CRLF の checkout (autocrlf=true の clone や Gitea runner) でも同じ結果になるよう、改行を LF にそろえて読む
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

const INCLUDES = [
	'cta-download',
	'download-button',
	'pricing-cards',
	'contract-quota',
	'contract-limits',
	'what-is',
	'can-cannot',
	'disclosure-table',
]
const SRC = Object.fromEntries(INCLUDES.map((n) => [n, read(`_includes/${n}.html`)]))

/** 仮名 (半角カナ・中黒を含む) */
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u

// ---- 小さな yml の読み取り (parts.yml の形 = 平らな `key: "value"` とコメント・空行だけ) ----

function parseFlatYaml(text, where) {
	const out = {}
	text.split(/\r?\n/).forEach((raw, i) => {
		if (/^\s*(#.*)?$/.test(raw)) return
		const m = raw.match(/^([a-z][a-z0-9_]*):\s*"((?:[^"\\]|\\.)*)"\s*(#.*)?$/)
		if (!m) throw new Error(`${where} の ${i + 1} 行目が読めない (平らな key: "value" だけ): ${raw}`)
		if (m[1] in out) throw new Error(`${where}: キーが重複: ${m[1]}`)
		out[m[1]] = JSON.parse(`"${m[2]}"`)
	})
	return out
}

const PARTS = {
	en: parseFlatYaml(read('_data/l10n/en/parts.yml'), 'en/parts.yml'),
	'zh-tw': parseFlatYaml(read('_data/l10n/zh-tw/parts.yml'), 'zh-tw/parts.yml'),
}

const placeholdersOf = (s) => [...s.matchAll(/%[A-Z]+%/g)].map((m) => m[0]).sort()

// ---- 1. 既存のテストの照合の対象がソースに残っている (陽性対照) ----

test('陽性対照: 既存のテストが照合する ja の直書き・href・式が include のソースに残っている', () => {
	// site-copy-t1656
	assert.match(
		textOf(SRC['cta-download']),
		/初回起動から\{\{ free_plan\.free_window_days \}\}日間、累計\{\{ free_plan\.included_hours \}\}時間分の動画インポートが無料。クレジットカード不要。/,
	)
	// site-copy-t1444: Web 版の説明行は 1 行で、お試しの分数は site.yml から
	const line = stripComments(SRC['cta-download']).match(/<p[^>]*>[^\n]*data-dl="cta-webapp"[^\n]*<\/p>/)?.[0]
	assert.ok(line, 'cta-webapp の説明行が 1 行で無い')
	assert.match(line, /お試し用（1 本 \{\{\s*site\.data\.site\.web_app\.trial_minutes\s*\}\} 分まで）/)
	// site-copy-t942 / t1922 / t1941
	const cards = stripComments(SRC['pricing-cards'])
	assert.match(cards, /税込/)
	assert.match(cards, /plan\.price_incl_display/)
	const iSub = cards.indexOf('{%- if plan.subscribe %}')
	const iDl = cards.indexOf('{%- elsif plan.cta.kind == "download" %}')
	assert.ok(iSub >= 0 && iDl > iSub, 'subscribe の分岐が DL ボタンより先に無い')
	assert.match(cards.slice(iSub, iDl), /href="\/subscribe\/#plan-\{\{ plan\.code \}\}"/)
	assert.match(cards.slice(iSub, iDl), /\{\{ plan\.subscribe\.label \}\}/)
	assert.match(SRC['pricing-cards'], /\{%-? if plan\.note %\}/)
	assert.match(cards, /追加契約/)
	// site-copy-t1917: DL の <a> は app_download_link を使い data-dl を持つ
	const tags = stripComments(SRC['download-button']).match(/<a\s[^>]*app_download_link[^>]*>/g) ?? []
	assert.equal(tags.length, 1)
	assert.match(tags[0], /data-dl=/)
	// ja の直書きの文
	assert.match(SRC['cta-download'], /無料でご利用いただけます/)
	assert.match(SRC['download-button'], /無料でダウンロード/) // T-2303: 公開中の既定のラベルに戻した
	assert.doesNotMatch(SRC['download-button'], /Microsoft Store/)
	assert.match(SRC['contract-quota'], /最大 \{\{ cq_max \}\} 契約（月 \{\{ cq_hours \}\} 時間まで）/)
	assert.match(SRC['contract-limits'], /\{\{ t\.name \}\} は最大 \{\{ cl_max \}\} 契約/)
	assert.match(SRC['what-is'], /title="Deepmosaic とは"/)
	assert.match(SRC['what-is'], /\{\{ E\.name_origin\.ja \}\}/)
	assert.match(SRC['can-cannot'], /できること/)
	assert.match(SRC['can-cannot'], /できないこと/)
	assert.match(SRC['disclosure-table'], /送信するもの/)
	assert.match(SRC['disclosure-table'], /送信しないもの/)
})

// ---- 2. include の言語の分岐 ----

test('include: site.data.lang.ja. を参照せず、英中の分岐 (page.lang) を持つ', () => {
	for (const name of INCLUDES) {
		const src = stripComments(SRC[name])
		assert.doesNotMatch(src, /site\.data\.lang\.ja\./, `${name}: site.data.lang.ja. が残っている`)
		assert.match(src, /page\.lang/, `${name}: 英中の分岐 (page.lang) が無い`)
	}
	// 陰性対照
	assert.match('href="{{ site.data.lang.ja.app_download_link }}"', /site\.data\.lang\.ja\./)
})

test('include: 英中の文は parts.yml から引き、引くキーは en / zh-tw の両方にある', () => {
	let refs = 0
	for (const name of INCLUDES) {
		const src = stripComments(SRC[name])
		// parts を指す変数 (`<接頭辞>_P`) の名前を assign から拾う
		const vars = [...src.matchAll(/assign (\w+) = site\.data\.l10n\[page\.lang\]\.parts\b/g)].map((m) => m[1])
		for (const v of vars) {
			for (const m of src.matchAll(new RegExp(`\\b${v}\\.(\\w+)`, 'g'))) {
				refs += 1
				for (const lang of ['en', 'zh-tw']) {
					assert.ok(m[1] in PARTS[lang], `${name}: ${lang}/parts.yml に ${m[1]} が無い`)
				}
			}
		}
	}
	assert.ok(refs >= 20, `parts の参照が少なすぎる (${refs})`)
})

test('include: 英中の行き先に言語の接頭辞を付け、ja の href はソースに残す', () => {
	const cards = stripComments(SRC['pricing-cards'])
	assert.match(cards, /href="\{\{ pc_L\.url_prefix \}\}\/subscribe\/#plan-\{\{ plan\.code \}\}"/)
	assert.match(cards, /href="\{\{ plan\.cta\.href \}\}"/)
	assert.match(cards, /href="\{\{ pc_href_prefix \}\}\{\{ plan\.cta\.href \}\}"/)
})

test('cta-download: not_removal_note の <p> は英中のときだけ data-i18n-allow="mosaic_removal" を持つ', () => {
	const src = stripComments(SRC['cta-download'])
	const p = src.match(/<p [^\n]*not_removal_note[^\n]*<\/p>/)?.[0]
	assert.ok(p, 'not_removal_note の <p> が無い')
	assert.match(p, /\{% if cd_P %\} data-i18n-allow="mosaic_removal"\{% endif %\}/)
	assert.match(p, /\{\{ site\.data\.entity\.not_removal_note \}\}/)
	assert.match(p, /\{\{ cd_X\.entity\.not_removal_note \}\}/)
})

test('what-is: 英中は l10n の entity を出し、2 段落目の lang="en" は ja のときだけ', () => {
	const src = stripComments(SRC['what-is'])
	assert.match(src, /wi_X\.entity\.name_origin/)
	assert.match(src, /wi_X\.entity\.definition/)
	assert.match(src, /<p\{% unless wi_P %\} lang="en"\{% endunless %\} class=/)
	// 既存の en (禁止語を含む) を英中の分岐で出さない: E.definition.en は ja の分岐だけ
	const intl = src.match(/\{% if wi_P %\}\{\{ wi_X\.entity\.definition \}\}\{% else %\}\{\{ E\.definition\.en \}\}\{% endif %\}/)
	assert.ok(intl, 'definition の分岐の形が違う')
})

test('can-cannot / disclosure-table: 英中は l10n の同じ添字の文', () => {
	const cc = stripComments(SRC['can-cannot'])
	assert.match(cc, /cc_X\.entity\.can\[forloop\.index0\]/)
	assert.match(cc, /cc_X\.entity\.cannot\[forloop\.index0\]/)
	const dt = stripComments(SRC['disclosure-table'])
	assert.match(dt, /dt_X\.disclosure\.network\.sent\[forloop\.index0\]\.item/)
	assert.match(dt, /dt_X\.disclosure\.network\.sent\[forloop\.index0\]\.note/)
	assert.match(dt, /dt_X\.disclosure\.network\.not_sent\[forloop\.index0\]\.item/)
	assert.match(dt, /dt_X\.disclosure\.network\.not_sent\[forloop\.index0\]\.note/)
})

// ---- 3. parts.yml ----

test('parts.yml: en と zh-tw のキーの集合が同じで、値が空でない', () => {
	assert.deepEqual(Object.keys(PARTS['zh-tw']).sort(), Object.keys(PARTS.en).sort())
	assert.ok(Object.keys(PARTS.en).length >= 20)
	for (const lang of ['en', 'zh-tw']) {
		for (const [k, v] of Object.entries(PARTS[lang])) {
			assert.notEqual(v.trim(), '', `${lang}.${k} が空`)
		}
	}
})

test('parts.yml: 差し込みの印が en と zh-tw で同じ', () => {
	for (const k of Object.keys(PARTS.en)) {
		assert.deepEqual(placeholdersOf(PARTS['zh-tw'][k]), placeholdersOf(PARTS.en[k]), k)
	}
	// 数値を差し込む文には印がある
	assert.deepEqual(placeholdersOf(PARTS.en.cta_free_line), ['%DAYS%', '%HOURS%'])
	assert.deepEqual(placeholdersOf(PARTS.en.cta_webapp_after), ['%MINUTES%'])
	assert.deepEqual(placeholdersOf(PARTS.en.cq_text), ['%HOURS%', '%MAX%'])
	assert.deepEqual(placeholdersOf(PARTS.en.cl_item), ['%MAX%', '%NAME%'])
	assert.deepEqual(placeholdersOf(PARTS.en.pc_tax_incl), ['%PRICE%'])
})

test('parts.yml: 全部の値が lintValue を通る (除去の語も許さない)', () => {
	for (const lang of ['en', 'zh-tw']) {
		for (const [k, v] of Object.entries(PARTS[lang])) {
			// 印は数値に置き換わる前提で検査する
			const value = v.replace(/%[A-Z]+%/g, '7')
			assert.deepEqual(lintValue(lang, value), [], `${lang}.${k}: ${value}`)
		}
	}
	// 陽性対照
	assert.ok(lintValue('en', '無料').length > 0)
	assert.ok(lintValue('zh-tw', '無料でご利用').length > 0)
})

test('parts.yml: 英中の文の形 (en は全角の括弧・中黒を使わない、zh-tw は全角の括弧)', () => {
	for (const v of Object.values(PARTS.en)) assert.doesNotMatch(v, /[（）／・]/u, v)
	assert.equal(PARTS['zh-tw'].pc_strip_open, '（')
	assert.equal(PARTS['zh-tw'].pc_strip_close, '）')
	assert.equal(PARTS.en.pc_strip_open, ' (')
})

// ---- 4. pricing.js ----

const TIERS = loadTiers()
const byCode = (code) => TIERS.find((t) => t.code === code)

test('pricing.js: formatYenFor は ja / en が ¥1,000、zh-tw が 1,000 日圓 (桁区切りは ja-JP)', () => {
	assert.equal(formatYenFor('ja', 2980), formatYen(2980))
	assert.equal(formatYenFor('en', 2980), '¥2,980')
	assert.equal(formatYenFor('zh-tw', 2980), '2,980 日圓')
	assert.equal(formatYenFor('zh-tw', 1234567.4), '1,234,567 日圓')
	assert.equal(formatYenFor('en', 0), '¥0')
	// 知らない言語は ja と同じ
	assert.equal(formatYenFor('fr', 2980), formatYen(2980))
	assert.equal(formatYenFor(undefined, 2980), formatYen(2980))
})

test('pricing.js: planBreakdown の言語の引数を省くと今の ja の文字列のまま', () => {
	for (const [code, h] of [['pro', 12], ['light', 12], ['pro', 21], ['enterprise', 12], ['enterprise', 73], ['free', 1]]) {
		assert.equal(planBreakdown(byCode(code), h), planBreakdown(byCode(code), h, 'ja'), `${code} ${h}`)
	}
	assert.equal(planBreakdown(byCode('light'), 12), '3 契約（月 15 時間込み）')
	assert.equal(planBreakdown(byCode('enterprise'), 12), '1 アカウント（20 時間をプール共有）')
})

test('pricing.js: planBreakdown の英中は数値が同じで仮名が無く、lintValue を通る', () => {
	const cases = [['pro', 12], ['light', 12], ['pro', 21], ['enterprise', 12], ['enterprise', 73], ['free', 1]]
	const digits = (s) => (s.match(/\d+/g) ?? []).sort()
	for (const lang of ['en', 'zh-tw']) {
		for (const [code, h] of cases) {
			const ja = planBreakdown(byCode(code), h)
			const s = planBreakdown(byCode(code), h, lang)
			assert.doesNotMatch(s, KANA, `${lang} ${code} ${h}: ${s}`)
			assert.deepEqual(digits(s), digits(ja), `${lang} ${code} ${h}: ${s}`)
			assert.deepEqual(lintValue(lang, s), [], `${lang} ${code} ${h}: ${s}`)
		}
	}
	assert.equal(planBreakdown(byCode('light'), 12, 'en'), '3 subscriptions (15 hours / month included)')
	assert.equal(planBreakdown(byCode('pro'), 12, 'en'), '20 hours / month included')
	assert.equal(planBreakdown(byCode('enterprise'), 12, 'en'), '1 account (20 hours shared as a pool)')
	assert.equal(planBreakdown(byCode('enterprise'), 73, 'en'), '4 accounts (80 hours shared as a pool)')
	assert.equal(planBreakdown(byCode('light'), 12, 'zh-tw'), '3 份訂閱（每月含 15 小時）')
	assert.equal(planBreakdown(byCode('enterprise'), 12, 'zh-tw'), '1 個帳號（20 小時以額度池共用）')
})

test('pricing.js: planBreakdown は未知の言語やプロトタイプの名前を ja に戻す', () => {
	const tier = byCode('light')
	const ja = planBreakdown(tier, 12)
	for (const lang of ['fr', 'constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, undefined]) {
		assert.equal(planBreakdown(tier, 12, lang), ja, String(lang))
	}
})

test('pricing.js: planBreakdown の英中の試用・累計・無制限の文', () => {
	const tier = { code: 'x', included_hours: 5, included_basis: 'monthly', price: 1, trial_days: 7, max_contracts: 1 }
	assert.equal(planBreakdown(tier, 1), '月 5 時間込み ・ 7 日間無料トライアルあり')
	assert.equal(planBreakdown(tier, 1, 'en'), '5 hours / month included · 7-day free trial available')
	assert.equal(planBreakdown(tier, 1, 'zh-tw'), '每月含 5 小時，提供 7 天免費試用')
	const cum = { ...tier, included_basis: 'cumulative', trial_days: 0, included_hours: 1 }
	assert.equal(planBreakdown(cum, 1, 'en'), '1 hour in total')
	assert.equal(planBreakdown(cum, 1, 'zh-tw'), '累計 1 小時')
	const unl = { ...tier, included_basis: 'unlimited', trial_days: 0 }
	assert.equal(planBreakdown(unl, 1), '無制限')
	assert.equal(planBreakdown(unl, 1, 'en'), 'Unlimited')
	assert.equal(planBreakdown(unl, 1, 'zh-tw'), '無限制')
})

test('pricing.js: RangeError の message は今のまま (内部の文)', () => {
	const src = read('src/lib/pricing.js')
	assert.match(src, /new RangeError\(`不正な金額: \$\{price\}`\)/)
	assert.match(src, /new RangeError\(`不正な税率: \$\{ratePercent\}`\)/)
	assert.match(src, /export const formatYen = \(n\) => '¥' \+ Math\.round\(n\)\.toLocaleString\('ja-JP'\);/)
})

// ---- 5. RoiCalculator.svelte ----

const ROI = read('src/islands/RoiCalculator.svelte')
const ROI_TEXT = ROI.match(/const TEXT = \{\n([\s\S]*?)\n {2}\};/)?.[1] ?? ''

/** TEXT の言語の塊 (`  ja: {` から対応する `  },` まで) */
function roiBlock(lang) {
	const head = `    ${lang}: {\n`
	const start = ROI_TEXT.indexOf(head)
	assert.ok(start >= 0, `TEXT に ${lang} が無い`)
	const end = ROI_TEXT.indexOf('\n    },', start)
	assert.ok(end > start, `TEXT の ${lang} が閉じていない`)
	return ROI_TEXT.slice(start + head.length, end)
}
const roiKeys = (lang) => [...roiBlock(lang).matchAll(/^ {6}(\w+):/gm)].map((m) => m[1]).sort()

test('RoiCalculator: 3 言語の表のキーの集合が同じ', () => {
	assert.ok(ROI_TEXT, 'TEXT の表が無い')
	assert.ok(roiKeys('ja').length >= 15, `キーが少ない: ${roiKeys('ja')}`)
	assert.deepEqual(roiKeys('en'), roiKeys('ja'))
	assert.deepEqual(roiKeys("'zh-tw'"), roiKeys('ja'))
	assert.match(ROI, /from '\.\.\/lib\/site-lang\.js'/)
	assert.match(ROI, /pick\(TEXT, lang\)/)
	assert.match(ROI, /formatYenFor/)
})

test('RoiCalculator: ja の文は今の文字列のまま表の ja にある', () => {
	const ja = roiBlock('ja')
	for (const s of [
		'月間の本数',
		' 本',
		'1 本の完成尺',
		' 時間',
		'現状の 1 本あたりコスト',
		'社内で行う場合は「作業時間 × 時給」、外注の場合は発注単価を入れてください。',
		'月間の消費時間',
		'適合プラン',
		' / 月',
		'時間を超える運用は複数人での利用が想定されるため、Enterprise もご検討ください。',
		'現状の年間コスト',
		'Deepmosaic の年間費用',
		'年間の差額',
		'この作業量では現状のコストの方が低くなります。',
		'手作業の想定',
		'Deepmosaic は処理中の操作が不要で、完了後の確認作業のみです。',
	]) {
		assert.ok(ja.includes(s), `ja に「${s}」が無い`)
	}
	// マークアップに日本語の直書きが残っていない (表から描く)
	const markup = ROI.slice(ROI.indexOf('</script>'))
	assert.doesNotMatch(stripComments(markup), /[぀-ヿ一-龯]/u)
})

test('RoiCalculator: 英中の表に仮名が無く、文字列が lintValue を通る', () => {
	for (const [lang, key] of [['en', 'en'], ['zh-tw', "'zh-tw'"]]) {
		const body = roiBlock(key)
		assert.doesNotMatch(body, KANA, lang)
		const strings = [...body.matchAll(/'([^']*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '7'))
		assert.ok(strings.length >= 15, `${lang} の文字列が少ない`)
		for (const s of strings) assert.deepEqual(lintValue(lang, s), [], `${lang}: ${s}`)
	}
})

// ---- 6. check-site の parts モジュール ----

const jaCard = (name, price, incl) =>
	`<div class="relative flex flex-col plan-card"><h3 class="x">${name.toUpperCase()}</h3><div class="flex flex-wrap items-baseline gap-x-1.5"><span class="text-[36px] font-bold">¥${price}</span><span class="text-[13px]">/ 月（税別・税込 ¥${incl}）</span></div><a data-dl="${name}">x</a></div>`
const card = (name, priceHtml, unitHtml, dl = name) =>
	`<div class="relative flex flex-col plan-card"><h3 class="x">${name.toUpperCase()}</h3><div class="flex flex-wrap items-baseline gap-x-1.5"><span class="text-[36px] font-bold">${priceHtml}</span><span class="text-[13px]">${unitHtml}</span></div><a data-dl="${dl}">x</a></div>`
const cta = (attr) =>
	`<section><a data-dl="cta">x</a><p class="mx-auto mt-1.5 max-w-[560px] text-[12.5px] leading-[1.8] text-ink-4"${attr}>note</p></section>`

function runParts(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-parts-'))
	try {
		for (const [rel, body] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), body)
		}
		return checkParts(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

const JA_PAGE = `<html>${jaCard('light', '2,980', '3,278')}${cta('')}</html>`
const EN_OK = `<html>${card('light', '¥2,980', '/ month (excl. tax, ¥3,278 incl. tax)')}${cta(' data-i18n-allow="mosaic_removal"')}</html>`
const ZH_OK = `<html>${card('light', '2,980 日圓', '/ 月（未稅，含稅 3,278 日圓）')}${cta(' data-i18n-allow="mosaic_removal"')}</html>`

test('checks/parts: 英中のページが無ければ何も言わない', () => {
	assert.deepEqual(runParts({ 'index.html': JA_PAGE }), [])
})

test('checks/parts: 価格・通貨・data-dl・not_removal_note の印が合っていれば合格 (陽性対照)', () => {
	assert.deepEqual(runParts({ 'index.html': JA_PAGE, 'en/index.html': EN_OK, 'zh-tw/index.html': ZH_OK }), [])
})

test('checks/parts: 価格の数値の違い・zh-tw の ¥・日圓の欠け・data-dl の違い・印の欠けを捕まえる (陰性対照)', () => {
	const price = runParts({
		'index.html': JA_PAGE,
		'en/index.html': EN_OK.replace('¥2,980', '¥2,990'),
	})
	assert.ok(price.some((e) => /価格/.test(e)), price.join('\n'))

	const yen = runParts({ 'index.html': JA_PAGE, 'zh-tw/index.html': ZH_OK.replace('2,980 日圓', '¥2,980') })
	assert.ok(yen.some((e) => /¥/.test(e)), yen.join('\n'))

	const noSuffix = runParts({
		'index.html': JA_PAGE,
		'zh-tw/index.html': ZH_OK.replace('2,980 日圓', '2,980').replace('含稅 3,278 日圓', '含稅 3,278'),
	})
	assert.ok(noSuffix.some((e) => /日圓/.test(e)), noSuffix.join('\n'))

	const dl = runParts({ 'index.html': JA_PAGE, 'en/index.html': EN_OK.replace('data-dl="light"', 'data-dl="lite"') })
	assert.ok(dl.some((e) => /data-dl/.test(e)), dl.join('\n'))

	const allow = runParts({ 'index.html': JA_PAGE, 'en/index.html': EN_OK.replace(' data-i18n-allow="mosaic_removal"', '') })
	assert.ok(allow.some((e) => /mosaic_removal/.test(e)), allow.join('\n'))

	const missing = runParts({ 'index.html': JA_PAGE, 'en/index.html': `<html>${cta(' data-i18n-allow="mosaic_removal"')}</html>` })
	assert.ok(missing.some((e) => /料金カード/.test(e)), missing.join('\n'))
})
