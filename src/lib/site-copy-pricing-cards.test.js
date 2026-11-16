// 料金カードの仕様テスト。
//
//   node --test src/lib/site-copy-pricing-cards.test.js
//
//   - Pro はカードに出さない。tier は `public: false` で残し (込み時間の突き合わせ・英中の欄のため)、金額の欄を持たない。
//   - Light は 1 アカウントあたり 2 本まで (`max_contracts: 2`)。主ボタンの配色の featured は Light だけ。
//   - Enterprise は「お見積り」のカードで、金額の欄を持たない。
//   - API の語は料金カードの囲み (`note_title` / `note`) だけに許す (ほかの検査は site-copy-enterprise-integration.test.js)。
//
// ビルド出力の検査は `e2e/enterprise-integration.spec.ts`。ここは plans.yml・l10n・include・CI のソースだけを読む。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadSpecs, loadTiers, PLANS_YML } from './plans-yml.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const QUOTE_LABEL = 'お見積り'
const QUOTE_NOTE = 'ご利用規模・運用形態に応じて個別にご案内します'
const NOTE_TITLE = 'API 利用・システム組み込み'
const NOTE = 'API 経由でのご利用や、御社のシステム・サービスへの組み込みをご希望の場合も、こちらからご相談ください。'
const ENTERPRISE_SPECS = [
	{ label: '込み時間', value: 'アカウント数 × 20 時間をプール共有' },
	{ label: '請求', value: 'ご利用月ごとに請求書を発行' },
	{ label: '支払方法', value: '請求書払い（銀行振込）' },
]
/** 仮名 (ひらがな・カタカナ・中黒・長音)。英中の文に出たら訳し漏れ。 */
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/

/** plans.yml の文字列を一時ファイル経由で `loadTiers` に読ませる (陽性・陰性対照用)。 */
function tiersFromText(text) {
	const dir = mkdtempSync(join(tmpdir(), 't2444-'))
	try {
		const path = join(dir, 'plans.yml')
		writeFileSync(path, text)
		return loadTiers(path)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

/** 公開の tier と Pro の public: false・featured の決まりを検査する。 */
function assertPublicTiers(tiers) {
	const publicCodes = tiers.filter((t) => t.public === true).map((t) => t.code)
	assert.deepEqual(publicCodes, ['free', 'light', 'enterprise'], '公開の tier')
	const pro = tiers.find((t) => t.code === 'pro')
	assert.ok(pro, 'pro の tier が消えた (public: false にするだけで消さない)')
	assert.equal(pro.public, false, 'pro は public: false')
	const featured = tiers.filter((t) => t.featured === true).map((t) => t.code)
	assert.deepEqual(featured, ['light'], 'featured は Light だけ')
}

/** plans.yml の 1 tier のブロック (`  - code: <code>` から次の tier の手前まで) */
function tierBlock(yml, code) {
	const start = yml.indexOf(`  - code: ${code}`)
	assert.ok(start >= 0, `plans.yml に ${code} が無い`)
	const next = yml.indexOf('\n  - code: ', start + 1)
	return yml.slice(start, next < 0 ? undefined : next)
}

/** Light の CTA が副ボタンの配色 (`variant: "secondary"`) を持たないこと。 */
function assertLightPrimary(yml) {
	assert.doesNotMatch(tierBlock(yml, 'light'), /variant:\s*"secondary"/, 'Light の CTA が副ボタンの配色のまま')
}

const PLANS_TEXT = readFileSync(PLANS_YML, 'utf8')
const TIERS = loadTiers()
const byCode = (code) => TIERS.find((t) => t.code === code)

test('公開の tier は free / light / enterprise。pro は tier として残り public: false', () => {
	assertPublicTiers(TIERS)
	const pro = byCode('pro')
	for (const k of ['price', 'price_display', 'price_incl_display', 'price_unit']) assert.ok(!(k in pro), `pro.${k} が残っている`)
	assert.equal(pro.max_contracts, 2)
	assert.equal(pro.included_hours, 20)
})

test('陰性対照: pro の public を true にした plans.yml は落ちる', () => {
	const proBlock = tierBlock(PLANS_TEXT, 'pro')
	// 改行は CRLF でも LF でもよいように \r?\n で見る
	assert.match(proBlock, /\r?\n {4}public: false\r?\n/)
	const proPublic = PLANS_TEXT.replace(proBlock, proBlock.replace(/(\r?\n) {4}public: false(\r?\n)/, '$1    public: true$2'))
	assert.throws(() => assertPublicTiers(tiersFromText(proPublic)))
	// 陽性対照: 写しそのものは通る
	assertPublicTiers(tiersFromText(PLANS_TEXT))
})

test('featured は Light だけで、Light の max_contracts は 2', () => {
	assert.equal(byCode('light').featured, true)
	assert.equal(byCode('light').max_contracts, 2)
	for (const t of TIERS.filter((x) => x.code !== 'light')) assert.equal(t.featured, false, `${t.code} が featured`)
})

test('Light の CTA は主ボタンの配色 (variant: "secondary" を持たない)', () => {
	assertLightPrimary(PLANS_TEXT)
	const light = tierBlock(PLANS_TEXT, 'light')
	const broken = PLANS_TEXT.replace(light, light.replace('kind: "download"', 'kind: "download"\n      variant: "secondary"'))
	assert.throws(() => assertLightPrimary(broken), '陰性対照: secondary を足すと落ちる')
})

test('Enterprise: お見積りの表示・囲みの見出しと本文がデザインと同じで、price_note を持たない', () => {
	const ent = byCode('enterprise')
	assert.equal(ent.quote_label, QUOTE_LABEL)
	assert.equal(ent.quote_note, QUOTE_NOTE)
	assert.equal(ent.note_title, NOTE_TITLE)
	assert.equal(ent.note, NOTE)
	assert.equal(ent.price_note, undefined, 'price_note が残っている')
	for (const k of ['price', 'price_display', 'price_incl_display', 'price_unit']) assert.ok(!(k in ent), `enterprise.${k} が残っている`)
	assert.equal(ent.min_seats, 1)
	assert.deepEqual(loadSpecs('enterprise'), ENTERPRISE_SPECS)
})

test('pricing-cards.html: quote_label の分岐では金額・単位・税と summary を出さない', () => {
	const src = read('_includes/pricing-cards.html')
	const start = src.indexOf('{%- if plan.quote_label %}')
	assert.ok(start >= 0, 'quote_label の分岐が無い')
	const elseAt = src.indexOf('{%- else %}', start)
	assert.ok(elseAt > start, 'quote_label の分岐に else が無い')
	const quoteBranch = src.slice(start, elseAt)
	assert.match(quoteBranch, /plan\.quote_label/)
	assert.match(quoteBranch, /plan\.quote_note/)
	for (const re of [/plan\.price_display/, /price_unit/, /tax_note/, /plan\.summary/, /price_note/]) {
		assert.doesNotMatch(quoteBranch, re, `お見積りの分岐に ${re} がある`)
	}
	// 英中は l10n から引く
	assert.match(quoteBranch, /pc_T\.quote_label \| default: plan\.quote_label/)
	assert.match(quoteBranch, /pc_T\.quote_note \| default: plan\.quote_note/)
	// note の汎用の分岐は残り、囲み (note_title) は l10n から引く
	assert.match(src, /\{%-? if plan\.note %\}/)
	assert.match(src, /pc_T\.note_title \| default: plan\.note_title/)
	// デザインの直書きの色を持ち込まない
	assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, 'pricing-cards.html に直書きの色がある')
})

for (const [lang, quoteRe] of [['en', /quote/i], ['zh-tw', /報價/]]) {
	test(`l10n (${lang}): enterprise の quote_label は用語集の語を含み、price_note を持たない`, () => {
		const yml = read(`_data/l10n/${lang}/plans.yml`)
		const block = yml.slice(yml.indexOf('  enterprise:'))
		const field = (k) => (block.match(new RegExp(`^ {4}${k}: "(.*)"$`, 'm')) ?? [])[1]
		assert.match(field('quote_label') ?? '', quoteRe)
		for (const k of ['quote_note', 'note_title', 'note']) {
			const v = field(k) ?? ''
			assert.ok(v.trim() !== '', `${k} が空`)
			assert.doesNotMatch(v, KANA, `${k} に仮名: ${v}`)
		}
		assert.doesNotMatch(block, /^ {4}price_note:/m, 'price_note が残っている')
	})
}

test('jekyll.yml: お見積りと quote_note の grep と相談導線の grep がある', () => {
	const ci = read('.github/workflows/jekyll.yml')
	assert.doesNotMatch(ci, /grep -q '維持管理費用'/)
	assert.ok(ci.includes(`grep -q '${QUOTE_LABEL}' _site/price/index.html`), 'お見積りの grep が無い')
	assert.ok(ci.includes(`grep -q '${QUOTE_NOTE}' _site/price/index.html`), 'quote_note の grep が無い')
	assert.ok(ci.includes(`grep -q 'href="/enterprise/inquiry/"' _site/price/index.html`), '相談導線の grep が消えた')
})

test('境界値: 追加契約の合計時間は included_hours × max_contracts = 10 で、手書きの契約の本数と込み時間に無い時間が無い', () => {
	const light = byCode('light')
	assert.equal(light.included_hours * light.max_contracts, 10)
	const hours = new Set(['light', 'free', 'enterprise', 'pro'].map((c) => String(byCode(c).included_hours)))
	for (const rel of ['_data/plans.yml', '_includes/pricing-cards.html']) {
		const src = read(rel)
		assert.doesNotMatch(src, /[0-9０-９]\s?契約/, `${rel} に契約の本数の手書き`)
		const odd = [...src.matchAll(/月\s?(\d+)\s?時間/g)].filter((m) => !hours.has(m[1])).map((m) => m[0])
		assert.deepEqual(odd, [], `${rel} に込み時間に無い「月 N 時間」の手書き`)
	}
})
