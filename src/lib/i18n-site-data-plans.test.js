// T-2201 (i18n1112 I18N-703, 2026-11-12) サイトのデータの訳 1 (料金プラン・FAQ・申し込みの FAQ) の仕様テスト。
//
//   node --test src/lib/i18n-site-data-plans.test.js
//
//   - `_data/l10n/{en,zh-tw}/faq.yml`: items が ja の `_data/faq.yml` と同じ件数 (15)・同じプレースホルダの多重集合・空でない
//   - `_data/l10n/{en,zh-tw}/subscribe.yml`: faq が ja の `_data/subscribe.yml` の faq と同じ件数 (3)
//   - `_data/l10n/{en,zh-tw}/plans.yml`: tiers のキー = ja の tiers[].code、各 tier の文の欄が ja と対応する
//     (ja にある欄が無い / ja に無い欄がある → 失敗)、bullets / specs の件数が同じ、通貨の前後の文字が決めた値
//   - 全部の文の値が site-lint の lintValue を通る (除去の語も許さない)
//   - 6 ファイルとも `_source` を持ち、`_source_hash` が今の ja のファイルと一致する
//   - `_site` は読まない (CI では npm test がビルドの前に走る)
//
// yml は依存を足さずに読む (下の parseYaml)。対応するのはこのチケットの l10n と ja の 3 ファイルが使う形だけ
// (ブロックの対応表・配列、二重引用符 / 素の 1 行スカラー、行末のコメント)。非対応の記法は throw する。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { sourceHash } from '../../scripts/i18n/source-hash.mjs'
import { loadTiers, loadSpecs } from './plans-yml.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANGS = ['en', 'zh-tw']

// ---- 小さな yml の読み取り ----

/** 1 行スカラーを値にする (行末の ` # …` を落とす)。 */
function parseScalar(raw, where) {
	const s = raw.trim()
	if (s.startsWith('"')) {
		let out = ''
		let i = 1
		for (; i < s.length; i += 1) {
			const c = s[i]
			if (c === '\\') {
				const n = s[i + 1]
				const map = { '"': '"', '\\': '\\', n: '\n', t: '\t', '/': '/' }
				if (!(n in map)) throw new Error(`${where}: 非対応のエスケープ \\${n}`)
				out += map[n]
				i += 1
			} else if (c === '"') break
			else out += c
		}
		if (i >= s.length) throw new Error(`${where}: 閉じていない二重引用符`)
		const rest = s.slice(i + 1).trim()
		if (rest !== '' && !rest.startsWith('#')) throw new Error(`${where}: 引用符の後に余計な文字 (${rest})`)
		return out
	}
	if (/^[|>[{'&*!]/.test(s)) throw new Error(`${where}: 非対応の記法 (${s})`)
	const v = s.replace(/\s+#.*$/, '').trim()
	if (v === 'null' || v === '~') return null
	if (v === 'true') return true
	if (v === 'false') return false
	if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
	return v
}

const KEY_RE = /^([A-Za-z_][\w-]*):(?:[ \t]+(.*))?$/

/** ブロックの yml を読む (このチケットのファイルが使う形だけ)。 */
export function parseYaml(text, name = 'yml') {
	const lines = []
	text.split(/\r?\n/).forEach((raw, idx) => {
		if (raw.trim() === '' || raw.trim().startsWith('#')) return
		if (/\t/.test(raw.match(/^\s*/)[0])) throw new Error(`${name}:${idx + 1}: インデントにタブ`)
		lines.push({ indent: raw.match(/^ */)[0].length, body: raw.trim(), no: idx + 1 })
	})
	let pos = 0

	function parseBlock(indent) {
		const first = lines[pos]
		if (!first || first.indent !== indent) throw new Error(`${name}: ブロックのインデントが合わない (行 ${first?.no})`)
		return first.body.startsWith('- ') || first.body === '-' ? parseSeq(indent) : parseMap(indent)
	}

	function parseValueAfterKey(rest, indent, where) {
		if (rest !== undefined && rest.trim() !== '' && !rest.trim().startsWith('#')) return parseScalar(rest, where)
		const next = lines[pos]
		if (next && next.indent > indent) return parseBlock(next.indent)
		if (next && next.indent === indent && next.body.startsWith('- ')) return parseSeq(indent)
		throw new Error(`${where}: 値が無い (暗黙の null は非対応。null と書く)`)
	}

	function parseMap(indent) {
		const out = {}
		while (pos < lines.length && lines[pos].indent === indent && !lines[pos].body.startsWith('- ')) {
			const { body, no } = lines[pos]
			const m = body.match(KEY_RE)
			if (!m) throw new Error(`${name}:${no}: key: value の形でない (${body})`)
			if (m[1] in out) throw new Error(`${name}:${no}: キーの重複 (${m[1]})`)
			pos += 1
			out[m[1]] = parseValueAfterKey(m[2], indent, `${name}:${no}`)
		}
		if (pos < lines.length && lines[pos].indent > indent) throw new Error(`${name}:${lines[pos].no}: 余計なインデント`)
		return out
	}

	function parseSeq(indent) {
		const out = []
		while (pos < lines.length && lines[pos].indent === indent && lines[pos].body.startsWith('- ')) {
			const { body, no } = lines[pos]
			const rest = body.slice(2)
			if (KEY_RE.test(rest)) {
				// `- key: value` は、`- ` の後ろの位置をインデントにした対応表として読む
				lines[pos] = { indent: indent + 2, body: rest, no }
				out.push(parseMap(indent + 2))
			} else {
				pos += 1
				out.push(parseScalar(rest, `${name}:${no}`))
			}
		}
		return out
	}

	if (lines.length === 0) return {}
	const result = parseBlock(lines[0].indent)
	if (pos !== lines.length) throw new Error(`${name}:${lines[pos].no}: 読み残し`)
	return result
}

const readText = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const readYml = (rel) => parseYaml(readText(rel), rel)

// ---- データ ----

const jaPlans = readYml('_data/plans.yml')
const jaFaq = readYml('_data/faq.yml')
const jaSubscribe = readYml('_data/subscribe.yml')

const l10n = Object.fromEntries(
	LANGS.map((lang) => [
		lang,
		{
			plans: readYml(`_data/l10n/${lang}/plans.yml`),
			faq: readYml(`_data/l10n/${lang}/faq.yml`),
			subscribe: readYml(`_data/l10n/${lang}/subscribe.yml`),
		},
	]),
)

/** ja の tier の文の欄 → l10n の欄の名前 (ja にある欄だけが l10n に要る) */
const TIER_TEXT_FIELDS = [
	['summary', (t) => t.summary],
	['price_unit', (t) => t.price_unit],
	['price_note', (t) => t.price_note],
	['bullets', (t) => t.bullets],
	['specs', (t) => t.specs],
	['cta_label', (t) => t.cta?.label],
	['subscribe_label', (t) => t.subscribe?.label],
	['secondary_cta_label', (t) => t.secondary_cta?.label],
	['note', (t) => t.note],
]

const CURRENCY = {
	en: { prefix: '¥', suffix: '' },
	'zh-tw': { prefix: '', suffix: ' 日圓' },
}

const PLACEHOLDER_RE = /%%[A-Z0-9_]+%%/g
const placeholders = (s) => (String(s).match(PLACEHOLDER_RE) ?? []).sort()

/** 値の木から文字列の葉を [パス, 値] で集める */
function stringLeaves(node, path = []) {
	if (typeof node === 'string') return [[path.join('.'), node]]
	if (Array.isArray(node)) return node.flatMap((v, i) => stringLeaves(v, [...path, i]))
	if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => stringLeaves(v, [...path, k]))
	return []
}

// ---- 読み取りの陽性対照 (自前の読み取りが ja を正しく読めていること) ----

test('読み取り: ja の plans.yml の tiers の code と specs が plans-yml.js と一致する', () => {
	const codes = loadTiers().map((t) => t.code)
	assert.deepEqual(
		jaPlans.tiers.map((t) => t.code),
		codes,
	)
	for (const code of codes) {
		const mine = jaPlans.tiers.find((t) => t.code === code).specs ?? []
		assert.deepEqual(
			mine.map((s) => ({ label: String(s.label), value: String(s.value) })),
			loadSpecs(code),
			code,
		)
	}
	assert.equal(jaPlans.tax_note, '税別')
	assert.equal(jaPlans.rollout_note, '')
})

test('読み取り: ja の faq は 15 件、subscribe の faq は 3 件 (陽性対照)', () => {
	assert.ok(Array.isArray(jaFaq))
	assert.equal(jaFaq.length, 15)
	assert.equal(jaFaq[1].q, 'モザイクを除去することはできますか？')
	assert.equal(jaSubscribe.faq.length, 3)
	assert.equal(jaSubscribe.checkout_query, 'checkout')
})

test('読み取り: 非対応の記法 (ブロックスカラー・暗黙 null・閉じない引用符) は throw する', () => {
	assert.throws(() => parseYaml('a: |\n  x\n'))
	assert.throws(() => parseYaml('a:\nb: "x"\n'))
	assert.throws(() => parseYaml('a: "x\n'))
	assert.deepEqual(parseYaml('a: "x \\"y\\" \\\\" # c\nb:\n  - "1"\n  - k: "v"\n    l: 2\n'), {
		a: 'x "y" \\',
		b: ['1', { k: 'v', l: 2 }],
	})
})

// ---- faq ----

for (const lang of LANGS) {
	test(`faq (${lang}): items が ja と同じ件数 (15)・同じプレースホルダ・空でない`, () => {
		const { faq } = l10n[lang]
		assert.ok(Array.isArray(faq.items), 'items: の下に配列')
		assert.equal(faq.items.length, jaFaq.length)
		assert.equal(faq.items.length, 15)
		faq.items.forEach((item, i) => {
			assert.deepEqual(Object.keys(item).sort(), ['a', 'q'], `items[${i}] の欄`)
			assert.equal(typeof item.q, 'string')
			assert.equal(typeof item.a, 'string')
			assert.ok(item.q.trim() !== '', `items[${i}].q が空`)
			assert.ok(item.a.trim() !== '', `items[${i}].a が空`)
			assert.deepEqual(placeholders(item.a), placeholders(jaFaq[i].a), `items[${i}].a のプレースホルダ`)
			assert.deepEqual(placeholders(item.q), placeholders(jaFaq[i].q), `items[${i}].q のプレースホルダ`)
		})
	})

	test(`faq (${lang}): ja のプレースホルダ 4 種が 10 件目の回答にそのまま残る (陽性対照)`, () => {
		const a = l10n[lang].faq.items[9].a
		for (const p of ['%%LIGHT_MAX%%', '%%LIGHT_TOTAL%%', '%%PRO_MAX%%', '%%PRO_TOTAL%%']) {
			assert.ok(a.includes(p), `${p} が無い`)
		}
	})

	test(`subscribe (${lang}): faq が ja と同じ件数 (3)・空でない・設定値を持たない`, () => {
		const { subscribe } = l10n[lang]
		assert.ok(Array.isArray(subscribe.faq), 'faq: の下に配列')
		assert.equal(subscribe.faq.length, jaSubscribe.faq.length)
		assert.equal(subscribe.faq.length, 3)
		subscribe.faq.forEach((item, i) => {
			assert.deepEqual(Object.keys(item).sort(), ['a', 'q'], `faq[${i}] の欄`)
			assert.ok(item.q.trim() !== '' && item.a.trim() !== '', `faq[${i}] が空`)
			assert.deepEqual(placeholders(item.a), placeholders(jaSubscribe.faq[i].a))
		})
		assert.deepEqual(Object.keys(subscribe).sort(), ['_source', '_source_hash', 'faq'])
	})
}

// ---- plans ----

for (const lang of LANGS) {
	test(`plans (${lang}): トップの欄と通貨の前後の文字`, () => {
		const p = l10n[lang].plans
		assert.deepEqual(Object.keys(p).sort(), [
			'_source',
			'_source_hash',
			'currency_prefix',
			'currency_suffix',
			'rollout_note',
			'tax_note',
			'tiers',
		])
		assert.equal(p.currency_prefix, CURRENCY[lang].prefix)
		assert.equal(p.currency_suffix, CURRENCY[lang].suffix)
		assert.equal(p.tax_note, lang === 'en' ? 'excl. tax' : '未稅')
		// ja の rollout_note が空なら空、空でなければ空でない
		assert.equal(p.rollout_note === '', jaPlans.rollout_note === '')
	})

	test(`plans (${lang}): tiers のキーが ja の tiers[].code と同じ`, () => {
		const tiers = l10n[lang].plans.tiers
		assert.ok(tiers && typeof tiers === 'object' && !Array.isArray(tiers), 'tiers は code をキーにした対応表')
		assert.deepEqual(Object.keys(tiers).sort(), jaPlans.tiers.map((t) => t.code).sort())
	})

	test(`plans (${lang}): 各 tier の文の欄が ja と対応し、bullets / specs の件数が同じ`, () => {
		const tiers = l10n[lang].plans.tiers
		for (const jaTier of jaPlans.tiers) {
			const tier = tiers[jaTier.code]
			const want = TIER_TEXT_FIELDS.filter(([, get]) => get(jaTier) !== undefined).map(([k]) => k)
			assert.deepEqual(Object.keys(tier).sort(), [...want].sort(), `${jaTier.code} の欄`)
			if (jaTier.bullets) {
				assert.ok(Array.isArray(tier.bullets))
				assert.equal(tier.bullets.length, jaTier.bullets.length, `${jaTier.code}.bullets の件数`)
			}
			if (jaTier.specs) {
				assert.ok(Array.isArray(tier.specs))
				assert.equal(tier.specs.length, jaTier.specs.length, `${jaTier.code}.specs の件数`)
				tier.specs.forEach((s, i) => assert.deepEqual(Object.keys(s).sort(), ['label', 'value'], `${jaTier.code}.specs[${i}]`))
			}
			for (const [path, v] of stringLeaves(tier)) {
				assert.ok(v.trim() !== '', `${jaTier.code}.${path} が空`)
			}
			// プラン名 (dnt) と数値は持たない
			for (const k of ['name', 'price', 'price_display', 'included_hours', 'max_contracts', 'href', 'code']) {
				assert.ok(!(k in tier), `${jaTier.code} に ${k} を持たない`)
			}
		}
	})

	test(`plans (${lang}): 文の欄の一覧が決めたとおり (I18N-707 が読む)`, () => {
		const tiers = l10n[lang].plans.tiers
		assert.deepEqual(Object.keys(tiers.free).sort(), ['bullets', 'cta_label', 'summary'])
		assert.deepEqual(Object.keys(tiers.light).sort(), ['cta_label', 'price_unit', 'specs', 'subscribe_label', 'summary'])
		assert.deepEqual(Object.keys(tiers.pro).sort(), ['cta_label', 'price_unit', 'specs', 'subscribe_label', 'summary'])
		assert.deepEqual(Object.keys(tiers.enterprise).sort(), ['cta_label', 'note', 'price_note', 'price_unit', 'specs', 'summary'])
	})

	test(`plans (${lang}): 込み時間の数字が ja の値と同じ (訳で数字を変えない)`, () => {
		const tiers = l10n[lang].plans.tiers
		for (const jaTier of jaPlans.tiers) {
			for (const [i, s] of (jaTier.specs ?? []).entries()) {
				const digits = (x) => (String(x).match(/\d+(?:\.\d+)?/g) ?? []).join(',')
				assert.equal(digits(tiers[jaTier.code].specs[i].value), digits(s.value), `${jaTier.code}.specs[${i}].value の数字`)
			}
			for (const [i, b] of (jaTier.bullets ?? []).entries()) {
				const nums = (x) => (String(x).match(/\d+/g) ?? []).sort().join(',')
				assert.equal(nums(tiers[jaTier.code].bullets[i]), nums(b), `${jaTier.code}.bullets[${i}] の数字`)
			}
		}
	})
}

// ---- 文の検査 (lintValue) ----

/** 検査の対象外 (文でない値) */
const NOT_TEXT = new Set(['_source', '_source_hash', 'currency_prefix', 'currency_suffix'])

for (const lang of LANGS) {
	test(`lint (${lang}): 全部の文が lintValue を通る (除去の語も許さない)`, () => {
		const errors = []
		for (const [name, data] of Object.entries(l10n[lang])) {
			for (const [path, v] of stringLeaves(data)) {
				if (NOT_TEXT.has(path)) continue
				for (const e of lintValue(lang, v)) errors.push(`${name}.${path}: ${e.rule} ${e.word} → ${e.use}`)
			}
		}
		assert.deepEqual(errors, [])
	})
}

test('lint: 陽性対照 (en の仮名・除去の語、zh-tw の簡体字・除去の語は違反になる)', () => {
	assert.ok(lintValue('en', 'モザイク').length > 0)
	assert.ok(lintValue('en', 'It can remove mosaic.').length > 0)
	assert.ok(lintValue('zh-tw', '视频').length > 0)
	assert.ok(lintValue('zh-tw', '去馬賽克').length > 0)
})

// ---- _source と hash ----

const FILES = LANGS.flatMap((lang) => ['plans', 'faq', 'subscribe'].map((n) => [`_data/l10n/${lang}/${n}.yml`, `_data/${n}.yml`]))

test('source: 6 ファイルとも _source を持ち、_source_hash が今の ja のファイルと一致する', () => {
	assert.equal(FILES.length, 6)
	for (const [rel, src] of FILES) {
		const data = readYml(rel)
		assert.equal(data._source, src, `${rel} の _source`)
		assert.match(String(data._source_hash), /^[0-9a-f]{64}$/, `${rel} の _source_hash の形`)
		assert.equal(data._source_hash, sourceHash(join(ROOT, src)), `${rel} の _source_hash (node scripts/i18n/accept-site.mjs ${rel})`)
	}
})
