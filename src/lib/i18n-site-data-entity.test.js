// T-2202 (i18n1112 I18N-704, 2026-11-12) サイトのデータの訳 2 (動作環境・送信の開示・モザイクの設定・製品の説明) の仕様テスト。
//
//   node --test src/lib/i18n-site-data-entity.test.js
//
//   - `_data/l10n/{en,zh-tw}/{spec,disclosure,mosaic}.yml`: ja の `_data/<name>.yml` と同じ入れ子・同じ件数・同じ順
//     (文字列の葉のパスの並びが ja と同じ)。仮名・漢字を含まない ja の値 (機種名・形式の一覧・OS / GPU の見出し) はそのまま写す
//   - `performance` の val の数字 (倍率・分) が ja の同じ行と同じ多重集合、その他の文も数字の集合が ja と同じ
//   - HTML のタグ (`<br>`・`<strong>`) と `&gt;` の数が ja の同じ値と同じ
//   - `_data/l10n/{en,zh-tw}/entity.yml`: 画面と英中の JSON-LD に出る 11 欄だけを持つ (訳さない値を持たない)。
//     原文は各欄の `ja` (one_liner などの素の文字列はその値)。can 8 件・cannot 4 件・confusion_reasons 2 件
//   - 全部の文が site-lint の lintValue を通る。除去の語を許すのは entity の cannot・disambiguation・oss_distinction・
//     confusion_reasons だけで、それ以外の欄 (not_removal_note を含む) に除去の語 (remove 系・decensor 系・
//     去馬賽克 / 移除 / 去除 系) があれば失敗
//   - 8 ファイルとも `_source` を持ち、`_source_hash` が今の ja のファイルと一致する
//   - 住所 (上大崎・141-0021) と SAM の語が無い (既存の site-copy-t1032・top-page-features の規則の陽性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)
//
// yml は依存を足さずに読む (下の parseYaml。I18N-703 のテストと同じ形の読み取りだが、テストどうしの依存を作らないため
// このファイルの中に持つ)。対応するのは l10n と ja の 4 ファイルが使う形だけで、非対応の記法は throw する。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { sourceHash } from '../../scripts/i18n/source-hash.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANGS = ['en', 'zh-tw']
const NAMES = ['spec', 'disclosure', 'mosaic', 'entity']

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
function parseYaml(text, name = 'yml') {
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

const ja = Object.fromEntries(NAMES.map((n) => [n, readYml(`_data/${n}.yml`)]))
const l10n = Object.fromEntries(
	LANGS.map((lang) => [lang, Object.fromEntries(NAMES.map((n) => [n, readYml(`_data/l10n/${lang}/${n}.yml`)]))]),
)

/** 値の木から文字列の葉を [パス, 値] で集める */
function stringLeaves(node, path = []) {
	if (typeof node === 'string') return [[path.join('.'), node]]
	if (Array.isArray(node)) return node.flatMap((v, i) => stringLeaves(v, [...path, i]))
	if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => stringLeaves(v, [...path, k]))
	return []
}

/** ja の文 (仮名か漢字を含む) か */
const JA_TEXT = /[\u3040-\u30ff\p{Script=Han}]/u
/** 数字の並び (小数を含む) */
const numbers = (s) => String(s).match(/\d+(?:\.\d+)?/g) ?? []
/** 数字の集合 (語順で並びが変わる・同じ数が 2 回出る訳を許す) */
const numberSet = (s) => [...new Set(numbers(s))].sort()
/** HTML のタグと実体参照の多重集合 */
const markup = (s) => (String(s).match(/<\/?[a-z]+\s*\/?>|&[a-z]+;/gi) ?? []).map((x) => x.toLowerCase()).sort()

const META = new Set(['_source', '_source_hash'])
/** l10n の文の葉 (_source と _source_hash を除く) */
const textLeaves = (data) => stringLeaves(data).filter(([p]) => !META.has(p))

/** entity の欄 → ja の原文の取り出し方 (原文は各欄の ja、素の文字列はその値) */
const ENTITY_FIELDS = {
	one_liner: (e) => e.one_liner,
	not_removal_note: (e) => e.not_removal_note,
	definition: (e) => e.definition.ja,
	disambiguation: (e) => e.disambiguation.ja,
	can: (e) => e.can.map((x) => x.ja),
	cannot: (e) => e.cannot.map((x) => x.ja),
	name_origin: (e) => e.name_origin.ja,
	oss_distinction: (e) => e.oss_distinction.ja,
	confusion_reasons: (e) => e.confusion_reasons,
	software_requirements: (e) => e.software_requirements,
	keywords: (e) => e.keywords,
}
/** 除去の語を許す entity の欄 (/mosaic-removal/ と can-cannot.html でだけ出る)。not_removal_note は入れない (除去の語を使わない) */
const REMOVAL_ALLOWED = new Set(['cannot', 'disambiguation', 'oss_distinction', 'confusion_reasons'])

/** entity の ja の原文を l10n と同じ形 (欄 → 文字列 / 文字列の配列) にする */
const jaEntity = Object.fromEntries(Object.entries(ENTITY_FIELDS).map(([k, get]) => [k, get(ja.entity)]))

/** ja の側を l10n と同じ形にしたもの (spec / disclosure / mosaic はそのまま、entity は jaEntity) */
const jaShaped = { spec: ja.spec, disclosure: ja.disclosure, mosaic: ja.mosaic, entity: jaEntity }

/** 除去の語 (lintValue の禁止語より広く、言い換えも拾う) */
const REMOVAL_RE = {
	en: /remov|decensor|uncensor|unblur|de-?pixelat/i,
	'zh-tw': /去馬賽克|去碼|移除|去除|除去|消除/,
}

/**
 * 身体・検閲の語の言い換え (lintValue の禁止語は単語の境界で当てるので genitalia・censoring・pixelation を拾わない。
 * 既存の entity.yml の en が使っている語の形も含めて、語幹で当てる)。全部の欄で使わない
 */
const BODY_WORDS_RE = {
	en: /genital|censor|pixelat|\bprivate\b|\bnud(?:e|ity)\b|\bexplicit\b|\bintimate\b|\bnsfw\b/i,
	'zh-tw': /敏感部位|私密部位|隱私部位|生殖器|私處/,
}

/** performance の val から (倍率 r, 10 分の動画での分 m) を抜く。書式が違えば null。 */
const PERF_PAIR_RE = {
	ja: /動画長の約 ([\d.]+) 倍（10 分の動画で約 (\d+) 分）/,
	en: /About ([\d.]+)× the video length \(about (\d+) min for a 10-min video\)/,
	'zh-tw': /約影片長度的 ([\d.]+) 倍（10 分鐘的影片約 (\d+) 分鐘）/,
}
const perfPair = (lang, val) => {
	const m = PERF_PAIR_RE[lang].exec(String(val))
	return m ? { r: Number(m[1]), m: Number(m[2]) } : null
}

// ---- 読み取りと検査の部品の陽性対照 ----

test('読み取り: ja の 4 ファイルの件数と値 (陽性対照)', () => {
	assert.equal(ja.spec.windows.length, 5)
	assert.equal(ja.spec.macos.planned.length, 3)
	assert.equal(ja.spec.performance.length, 28)
	assert.equal(ja.spec.performance[0].key, 'NVIDIA GeForce RTX 5090')
	assert.equal(ja.spec.network.length, 3)
	assert.equal(ja.spec.formats.length, 2)
	assert.equal(ja.disclosure.network.sent.length, 8)
	assert.equal(ja.disclosure.network.not_sent.length, 5)
	assert.equal(ja.disclosure.weaknesses.length, 5)
	assert.equal(ja.mosaic.scopes.length, 4)
	assert.equal(ja.mosaic.controls.length, 7)
	assert.equal(jaEntity.can.length, 8)
	assert.equal(jaEntity.cannot.length, 4)
	assert.equal(jaEntity.confusion_reasons.length, 2)
	assert.match(jaEntity.definition, /^Deepmosaic は、動画に映った対象/)
	assert.match(ja.entity.name_origin.en, /"applying mosaic with deep learning"/)
})

test('読み取り: 非対応の記法 (ブロックスカラー・暗黙 null・閉じない引用符) は throw する', () => {
	assert.throws(() => parseYaml('a: |\n  x\n'))
	assert.throws(() => parseYaml('a:\nb: "x"\n'))
	assert.throws(() => parseYaml('a: "x\n'))
})

test('検査の部品: 数字・マークアップ・除去の語の抜き出し (陽性対照)', () => {
	assert.deepEqual(numbers('動画長の約 0.6 倍（10 分の動画で約 6 分）'), ['0.6', '10', '6'])
	assert.deepEqual(markup('a<br>b <strong>c</strong> 1 &gt; 2'), ['&gt;', '</strong>', '<br>', '<strong>'].sort())
	assert.ok(REMOVAL_RE.en.test('It cannot remove existing mosaic.'))
	assert.ok(REMOVAL_RE.en.test('a decensor tool'))
	assert.ok(!REMOVAL_RE.en.test('It applies mosaic.'))
	assert.ok(REMOVAL_RE['zh-tw'].test('移除既有的馬賽克'))
	assert.ok(!REMOVAL_RE['zh-tw'].test('套用馬賽克'))
	assert.ok(BODY_WORDS_RE.en.test('find genitalia and apply censoring'))
	assert.ok(BODY_WORDS_RE.en.test('private body areas'))
	assert.ok(BODY_WORDS_RE.en.test('NSFW'))
	assert.ok(BODY_WORDS_RE.en.test('nude'))
	assert.ok(!BODY_WORDS_RE.en.test('body areas and faces'))
	assert.ok(BODY_WORDS_RE['zh-tw'].test('私密部位'))
})

test('lint: 陽性対照 (en の仮名・censor 系、zh-tw の簡体字・除去の語は違反になる)', () => {
	assert.ok(lintValue('en', 'モザイク').length > 0)
	assert.ok(lintValue('en', 'censorship standards').length > 0)
	assert.ok(lintValue('zh-tw', '视频').length > 0)
	assert.ok(lintValue('zh-tw', '去馬賽克').length > 0)
	assert.equal(lintValue('zh-tw', '去馬賽克', { allowRemoval: true }).length, 0)
})

for (const lang of LANGS) {
	// ---- 構造 (spec / disclosure / mosaic は ja と同じ入れ子・同じ件数・同じ順) ----

	for (const name of ['spec', 'disclosure', 'mosaic']) {
		test(`${name} (${lang}): 文字列の葉のパスが ja と同じ (同じ入れ子・同じ件数・同じ順・note の有無)`, () => {
			const want = stringLeaves(ja[name]).map(([p]) => p)
			const got = textLeaves(l10n[lang][name]).map(([p]) => p)
			assert.deepEqual(got, want)
		})
	}

	test(`spec (${lang}): windows・macos.planned・performance・network・formats の件数が ja と同じ`, () => {
		const s = l10n[lang].spec
		for (const k of ['windows', 'performance', 'network', 'formats']) {
			assert.ok(Array.isArray(s[k]), `${k} は配列`)
			assert.equal(s[k].length, ja.spec[k].length, `${k} の件数`)
		}
		assert.equal(s.macos.planned.length, ja.spec.macos.planned.length)
	})

	test(`spec (${lang}): performance の key の機種名は ja と同じ文字列、日本語を含む key だけ訳す`, () => {
		const s = l10n[lang].spec
		ja.spec.performance.forEach((row, i) => {
			const got = s.performance[i].key
			if (JA_TEXT.test(row.key)) assert.notEqual(got, row.key, `performance[${i}].key を訳す`)
			else assert.equal(got, row.key, `performance[${i}].key (機種名) をそのまま写す`)
		})
		// 訳す key は 2 件 (GTX 10 / 16 シリーズと GPU なし)
		assert.equal(ja.spec.performance.filter((r) => JA_TEXT.test(r.key)).length, 2)
	})

	test(`spec (${lang}): performance の val の数字 (倍率・分) が ja の同じ行と同じ`, () => {
		const s = l10n[lang].spec
		ja.spec.performance.forEach((row, i) => {
			assert.deepEqual([...numbers(s.performance[i].val)].sort(), [...numbers(row.val)].sort(), `performance[${i}].val`)
		})
	})

	test(`spec (${lang}): performance の倍率と「10 分の動画で何分」の組が ja の同じ行と同じ (分と長さの入れ替えを捕まえる)`, () => {
		const s = l10n[lang].spec
		let pairs = 0
		ja.spec.performance.forEach((row, i) => {
			const want = perfPair('ja', row.val)
			const got = perfPair(lang, s.performance[i].val)
			assert.deepEqual(got, want, `performance[${i}].val の (倍率, 分)`)
			if (want) {
				pairs += 1
				// 分は丸めた倍率 × 10 (_data/spec.yml のコメント)
				assert.equal(want.m, Math.round(want.r * 10), `performance[${i}] の ja の分が倍率 × 10`)
			}
		})
		// 「10〜25 倍」の 1 行 (GPU なし) だけが組を持たない
		assert.equal(pairs, ja.spec.performance.length - 1)
	})

	test(`spec (${lang}): performance の「実測」「推定」を取り違えない`, () => {
		const words = lang === 'en' ? { 実測: /\bmeasured\b/, 推定: /\bestimated\b/ } : { 実測: /實測/, 推定: /推估/ }
		ja.spec.performance.forEach((row, i) => {
			const got = l10n[lang].spec.performance[i].val
			for (const [jw, re] of Object.entries(words)) {
				assert.equal(re.test(got), row.val.includes(jw), `performance[${i}].val の ${jw}`)
			}
		})
	})

	test(`disclosure / mosaic (${lang}): 配列の件数と note の有無が ja と同じ、priority_note の &gt; の数が同じ`, () => {
		const d = l10n[lang].disclosure
		for (const k of ['sent', 'not_sent']) {
			assert.equal(d.network[k].length, ja.disclosure.network[k].length, `network.${k} の件数`)
			d.network[k].forEach((row, i) => {
				assert.equal('note' in row, 'note' in ja.disclosure.network[k][i], `network.${k}[${i}] の note の有無`)
			})
		}
		assert.equal(d.offline_steps.length, ja.disclosure.offline_steps.length)
		assert.equal(d.weaknesses.length, ja.disclosure.weaknesses.length)
		const m = l10n[lang].mosaic
		assert.equal(m.scopes.length, ja.mosaic.scopes.length)
		assert.equal(m.controls.length, ja.mosaic.controls.length)
		const gt = (s) => (s.match(/&gt;/g) ?? []).length
		assert.equal(gt(m.priority_note), gt(ja.mosaic.priority_note))
		assert.equal(gt(m.priority_note), 3)
	})

	// ---- entity ----

	test(`entity (${lang}): 画面と JSON-LD に出る 11 欄だけを持ち、件数が ja と同じ`, () => {
		const e = l10n[lang].entity
		assert.deepEqual(Object.keys(e).sort(), ['_source', '_source_hash', ...Object.keys(ENTITY_FIELDS)].sort())
		for (const k of ['name', 'product_name', 'alternate_names', 'os', 'category', 'subcategory', 'screenshot']) {
			assert.ok(!(k in e), `${k} を持たない (訳さない値)`)
		}
		for (const [k, v] of Object.entries(jaEntity)) {
			if (Array.isArray(v)) {
				assert.ok(Array.isArray(e[k]), `${k} は配列`)
				assert.equal(e[k].length, v.length, `${k} の件数`)
				e[k].forEach((x, i) => assert.equal(typeof x, 'string', `${k}[${i}] は文字列`))
			} else assert.equal(typeof e[k], 'string', `${k} は文字列`)
		}
		assert.equal(e.can.length, 8)
		assert.equal(e.cannot.length, 4)
		assert.equal(e.confusion_reasons.length, 2)
	})

	if (lang === 'en') {
		test('entity (en): 用語集の禁止語を含む既存の en の値を写していない', () => {
			const e = l10n.en.entity
			// 既存の en (llms.txt / ja の JSON-LD 用) のうち lintValue に当たる値を [欄, 既存の en, 今の値] で集める
			const pairs = [
				['definition', ja.entity.definition.en, e.definition],
				['disambiguation', ja.entity.disambiguation.en, e.disambiguation],
				['name_origin', ja.entity.name_origin.en, e.name_origin],
				['oss_distinction', ja.entity.oss_distinction.en, e.oss_distinction],
				...ja.entity.can.map((x, i) => [`can.${i}`, x.en, e.can[i]]),
				...ja.entity.cannot.map((x, i) => [`cannot.${i}`, x.en, e.cannot[i]]),
			].filter(([, old]) => lintValue('en', old).length > 0)
			// 陽性対照: 既存の en には禁止語 (genitalia の言い換え・censoring・decensor など) を含む値がある
			assert.ok(pairs.length >= 3, `禁止語を含む既存の en が ${pairs.length} 件`)
			for (const [k, old, now] of pairs) assert.notEqual(now, old, `${k} が既存の en のまま`)
		})
	}

	// ---- 値の対応 (ja と同じ形にした原文と、パスごとに比べる) ----

	test(`値 (${lang}): 空でない・日本語を含まない ja の値はそのまま写す・数字の集合とマークアップが ja と同じ`, () => {
		for (const name of NAMES) {
			const want = new Map(stringLeaves(jaShaped[name]))
			for (const [path, v] of textLeaves(l10n[lang][name])) {
				const where = `${name}.${path}`
				assert.ok(want.has(path), `${where} が ja に無い`)
				const src = want.get(path)
				assert.ok(v.trim() !== '', `${where} が空`)
				if (!JA_TEXT.test(src)) assert.equal(v, src, `${where} (日本語を含まない値はそのまま写す)`)
				else assert.notEqual(v, src, `${where} が訳されていない`)
				assert.deepEqual(numberSet(v), numberSet(src), `${where} の数字`)
				assert.deepEqual(markup(v), markup(src), `${where} のタグ・実体参照`)
			}
		}
	})

	// ---- 文の検査 ----

	test(`lint (${lang}): 全部の文が lintValue を通り、除去の語は許した 4 欄にしか無い`, () => {
		const errors = []
		for (const name of NAMES) {
			for (const [path, v] of textLeaves(l10n[lang][name])) {
				const field = path.split('.')[0]
				const allowRemoval = name === 'entity' && REMOVAL_ALLOWED.has(field)
				for (const e of lintValue(lang, v, { allowRemoval })) errors.push(`${name}.${path}: ${e.rule} ${e.word} → ${e.use}`)
				if (!allowRemoval && REMOVAL_RE[lang].test(v)) errors.push(`${name}.${path}: 除去の語 (${v.match(REMOVAL_RE[lang])[0]})`)
				if (BODY_WORDS_RE[lang].test(v)) errors.push(`${name}.${path}: 使わない語 (${v.match(BODY_WORDS_RE[lang])[0]})`)
			}
		}
		assert.deepEqual(errors, [])
	})

	test(`誤認の訂正 (${lang}): 製品の説明の欄はモザイクを「付ける」側の語を持つ`, () => {
		const e = l10n[lang].entity
		const apply =
			lang === 'en'
				? /\b(apply|applies|applying|add|adds|adding)\b[^.]*\bmosaic\b/i
				: /(套用|加上).{0,5}馬賽克|馬賽克.{0,6}(套用|加上)/
		for (const k of ['one_liner', 'not_removal_note', 'definition', 'disambiguation']) {
			assert.match(e[k], apply, `${k} がモザイクを付けるソフトだと言っていない`)
		}
	})
}

// ---- _source と hash ----

const FILES = LANGS.flatMap((lang) => NAMES.map((n) => [`_data/l10n/${lang}/${n}.yml`, `_data/${n}.yml`]))

test('source: 8 ファイルとも _source を持ち、_source_hash が今の ja のファイルと一致する', () => {
	assert.equal(FILES.length, 8)
	for (const [rel, src] of FILES) {
		const data = readYml(rel)
		assert.equal(data._source, src, `${rel} の _source`)
		assert.match(String(data._source_hash), /^[0-9a-f]{64}$/, `${rel} の _source_hash の形`)
		assert.equal(data._source_hash, sourceHash(join(ROOT, src)), `${rel} の _source_hash (node scripts/i18n/accept-site.mjs ${rel})`)
	}
})

// ---- 既存の規則 (住所の直書き・SAM) の陽性対照 ----

test('既存の規則: 8 ファイルに住所 (上大崎・141-0021) と SAM の語が無い', () => {
	const hits = FILES.filter(([rel]) => /上大崎|141-0021|\bSAM\b|\bSAM ?2|Segment Anything/i.test(readText(rel))).map(([rel]) => rel)
	assert.equal(FILES.length, 8)
	assert.deepEqual(hits, [])
})
