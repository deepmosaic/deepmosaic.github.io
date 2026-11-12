// T-2206 (i18n1112 I18N-708, 2026-11-12) 問い合わせフォーム・組織への参加・404 の JS の英中対応の仕様テスト。
//
//   node --test src/lib/i18n-site-inquiry.test.js
//
//   - inquiry-validate.js: 言語の引数なし = 'ja' で今の結果のまま。英中でも規則 (どの欄が誤りか) は同じで、文に仮名が無い。
//     buildPayload は言語に依らない (言語を送らない)。describeFailure は英中で Worker の detail (日本語) を出さない
//   - InquiryForm.svelte・main.js: 3 言語の表のキーの集合が同じ、ja は今の文字列、英中は lintValue を通る
//   - _data/l10n/{en,zh-tw}/inquiry_form.yml: キーの集合が同じ、lintValue を通る
//   - lang-404.js: 404 の振り分けの行き先 (純関数)
//   - check-site のモジュール scripts/i18n/checks/inquiry.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { lintValue } from '../../scripts/i18n/site-lint.mjs'
import { makeContext } from '../../scripts/i18n/check-site.mjs'
import checkInquiry from '../../scripts/i18n/checks/inquiry.mjs'
import {
	FIELD_LABELS,
	LIMITS,
	buildPayload,
	describeFailure,
	labelsFor,
	validateInquiry,
} from './inquiry-validate.js'
import { lang404Target } from './lang-404.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// CRLF の checkout でも同じ結果になるよう、改行を LF にそろえて読む
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

/** 仮名 (半角カナ・中黒を含む) */
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u
const INTL = ['en', 'zh-tw']

/** 英中の文が lint を通り仮名を含まないことを確かめる */
function assertIntlText(lang, text, where) {
	assert.equal(typeof text, 'string', `${where}: 文字列でない`)
	assert.ok(text.length > 0, `${where}: 空`)
	assert.doesNotMatch(text, KANA, `${where}: 仮名がある: ${text}`)
	assert.deepEqual(lintValue(lang, text), [], `${where}: ${text}`)
}

// ---- 1. inquiry-validate.js ----

const LONG = (n) => 'a'.repeat(n)
const ENTERPRISE_CASES = [
	['必須の欄が空', {}],
	[
		'長すぎる',
		{
			company: LONG(LIMITS.company + 1),
			name: LONG(LIMITS.name + 1),
			email: `${LONG(LIMITS.email)}@example.com`,
			phone: '1'.repeat(LIMITS.phoneMax + 1),
			seats: LIMITS.seatsMax + 1,
			message: LONG(LIMITS.message + 1),
			companyUrl: `example.com/${LONG(LIMITS.companyUrl)}`,
		},
	],
	[
		'形式が違う',
		{ company: 'A', name: 'B', email: 'not-mail', phone: '03-1234-abcd', seats: 'x', message: '', companyUrl: 'javascript:alert(1)' },
	],
	['電話番号が短い', { company: 'A', name: 'B', email: 'a@example.com', phone: '123', seats: 1 }],
	[
		'使えない文字',
		{ company: 'A\u0001', name: 'B�', email: 'a@example.com', phone: '0312345678', seats: 1, message: 'x\u0007' },
	],
	['seats の下限', { company: 'A', name: 'B', email: 'a@example.com', phone: '0312345678', seats: 0 }],
	['seats の上限', { company: 'A', name: 'B', email: 'a@example.com', phone: '0312345678', seats: LIMITS.seatsMax + 1 }],
]
const GENERAL_CASES = [
	['必須の欄が空', {}],
	['長すぎる', { email: `${LONG(LIMITS.email)}@example.com`, message: LONG(LIMITS.message + 1) }],
	['形式が違う', { email: 'not-mail', message: 'x' }],
	['使えない文字', { email: 'a\u0001@example.com', message: 'x\u0007' }],
]

test('validateInquiry: 言語の引数なしと ja は同じ結果 (既存の期待値のまま)', () => {
	for (const [kind, cases] of [
		['enterprise', ENTERPRISE_CASES],
		['general', GENERAL_CASES],
	]) {
		for (const [label, input] of cases) {
			assert.deepEqual(validateInquiry(input, kind, 'ja'), validateInquiry(input, kind), `${kind}: ${label}`)
		}
	}
	// 既存のテスト (inquiry-validate.test.js) の文面と矛盾しない (陽性対照)
	assert.equal(validateInquiry({}, 'enterprise').errors.company, '会社名を入力してください')
	assert.equal(validateInquiry({}, 'general').errors.message, 'お問い合わせ内容を入力してください')
})

test('validateInquiry: 英中でも同じ欄に同じ数のエラーがあり、文に仮名が無い', () => {
	for (const [kind, cases] of [
		['enterprise', ENTERPRISE_CASES],
		['general', GENERAL_CASES],
	]) {
		for (const [label, input] of cases) {
			const ja = validateInquiry(input, kind)
			assert.equal(ja.ok, false, `${kind}: ${label} は ja で誤りになる前提`)
			for (const lang of INTL) {
				const it = validateInquiry(input, kind, lang)
				assert.equal(it.ok, false, `${lang} ${kind}: ${label}`)
				assert.deepEqual(Object.keys(it.errors).sort(), Object.keys(ja.errors).sort(), `${lang} ${kind}: ${label}`)
				for (const [field, msg] of Object.entries(it.errors)) {
					assertIntlText(lang, msg, `${lang} ${kind} ${label} ${field}`)
				}
			}
		}
	}
})

test('validateInquiry: 通る入力は言語に依らず同じ fields を返す', () => {
	const input = {
		company: ' 株式会社テスト ',
		companyUrl: 'example.co.jp',
		name: '山田',
		email: 'a@example.com',
		phone: '０３－１２３４－５６７８',
		seats: '１０',
		message: 'こんにちは\r\n',
		website: '',
	}
	for (const kind of ['enterprise', 'general']) {
		const ja = validateInquiry(input, kind)
		assert.equal(ja.ok, true)
		for (const lang of INTL) assert.deepEqual(validateInquiry(input, kind, lang), ja, `${lang} ${kind}`)
	}
})

test('buildPayload: 言語に依らず同じ JSON (言語の欄が無い)', () => {
	const input = { company: 'A', name: 'B', email: 'a@example.com', phone: '0312345678', seats: 3, message: 'x', website: '' }
	for (const kind of ['enterprise', 'general']) {
		const bodies = ['ja', ...INTL].map((lang) => {
			const r = validateInquiry(input, kind, lang)
			assert.equal(r.ok, true)
			return JSON.stringify(buildPayload(r.fields, 'tok', kind))
		})
		assert.equal(new Set(bodies).size, 1, kind)
		assert.doesNotMatch(bodies[0], /lang|locale/i)
	}
})

test('labelsFor: ja は既存の FIELD_LABELS と general の「お問い合わせ内容」、英中は同じキーで仮名が無い', () => {
	assert.deepEqual(labelsFor('enterprise'), FIELD_LABELS)
	assert.deepEqual(labelsFor('enterprise', 'ja'), FIELD_LABELS)
	assert.deepEqual(labelsFor('general'), { ...FIELD_LABELS, message: 'お問い合わせ内容' })
	for (const lang of INTL) {
		for (const kind of ['enterprise', 'general']) {
			const labels = labelsFor(kind, lang)
			assert.deepEqual(Object.keys(labels).sort(), Object.keys(FIELD_LABELS).sort(), `${lang} ${kind}`)
			for (const [k, v] of Object.entries(labels)) assertIntlText(lang, v, `${lang} ${kind} ${k}`)
		}
	}
	// spec の訳語
	assert.equal(labelsFor('enterprise', 'en').company, 'Company name')
	assert.equal(labelsFor('enterprise', 'en').email, 'Email address')
	assert.equal(labelsFor('enterprise', 'zh-tw').email, '電子郵件地址')
	assert.equal(labelsFor('enterprise', 'zh-tw').seats, '預計使用的帳號數')
	// 未知の言語は ja
	assert.deepEqual(labelsFor('enterprise', 'fr'), FIELD_LABELS)
})

const OUTCOMES = [
	['network', { status: 0 }],
	['429', { status: 429, data: { ok: false, code: 'rate_limited' } }],
	['403', { status: 403, data: { ok: false, code: 'origin_not_allowed' } }],
	['400 turnstile', { status: 400, data: { ok: false, code: 'turnstile_failed' } }],
	['400 invalid 既知の欄', { status: 400, data: { ok: false, code: 'invalid_input', field: 'email', message: 'メールアドレスの形式が正しくありません' } }],
	['400 invalid 未知の欄', { status: 400, data: { ok: false, code: 'invalid_input', field: 'subject', message: '件名を入力してください' } }],
	['400 invalid 文面なし', { status: 400, data: { ok: false, code: 'invalid_input', field: 'name' } }],
	['502', { status: 502, data: { ok: false, code: 'delivery_failed' } }],
	['500', { status: 500, data: 'not json' }],
]

test('describeFailure: ja は Worker の detail を今どおり使い、言語の引数なしと同じ', () => {
	for (const [label, outcome] of OUTCOMES) {
		for (const supportEmail of ['', 'support@example.com']) {
			assert.deepEqual(
				describeFailure(outcome, { supportEmail, lang: 'ja' }),
				describeFailure(outcome, { supportEmail }),
				label,
			)
		}
	}
	assert.equal(describeFailure(OUTCOMES[4][1]).message, 'メールアドレスの形式が正しくありません')
})

test('describeFailure: 英中は各 outcome で文があり、仮名が無く、Worker の detail を含めない (kind・field は ja と同じ)', () => {
	for (const [label, outcome] of OUTCOMES) {
		const ja = describeFailure(outcome, { supportEmail: 'support@example.com' })
		for (const lang of INTL) {
			const it = describeFailure(outcome, { supportEmail: 'support@example.com', lang })
			assert.equal(it.kind, ja.kind, `${lang} ${label}`)
			assert.equal(it.field, ja.field, `${lang} ${label}`)
			assertIntlText(lang, it.message, `${lang} ${label}`)
			const detail = outcome.data?.message
			if (detail) assert.ok(!it.message.includes(detail), `${lang} ${label}: detail を出している`)
		}
	}
})

test('describeFailure: 英中の 502・その他は support の宛先を差し込む (無ければ宛先なしの文)', () => {
	for (const lang of INTL) {
		for (const outcome of [{ status: 502 }, { status: 500 }]) {
			assert.ok(describeFailure(outcome, { supportEmail: 'support@example.com', lang }).message.includes('support@example.com'))
			assertIntlText(lang, describeFailure(outcome, { lang }).message, `${lang} ${outcome.status} 宛先なし`)
		}
	}
})

// ---- 2. ソースの 3 言語の表 ----

/** `const NAME = {` から対応する `}` までのオブジェクトリテラルの文字列 (文字列の中の波括弧は対になっている前提) */
function objectLiteral(src, name) {
	const head = `const ${name} = {`
	const start = src.indexOf(head)
	assert.ok(start >= 0, `${name} の表が無い`)
	let depth = 0
	for (let i = start + head.length - 1; i < src.length; i++) {
		if (src[i] === '{') depth++
		else if (src[i] === '}') {
			depth--
			if (depth === 0) return src.slice(start + head.length - 1, i + 1)
		}
	}
	throw new Error(`${name} の表が閉じていない`)
}

/** 表を評価する (自分のリポのソース。参照する定数は引数で渡す) */
function evalTable(src, name, env = {}) {
	const names = Object.keys(env)
	return new Function(...names, `return (${objectLiteral(src, name)})`)(...names.map((n) => env[n]))
}

/** 値 (文字列か関数) を文字列にする。関数は例の引数で呼ぶ */
const render = (v) => (typeof v === 'function' ? v(1, 'support@example.com') : v)

function assertTable(table, where, jaExpected) {
	assert.deepEqual(Object.keys(table).sort(), ['en', 'ja', 'zh-tw'], `${where}: 言語`)
	const jaKeys = Object.keys(table.ja).sort()
	for (const lang of INTL) {
		assert.deepEqual(Object.keys(table[lang]).sort(), jaKeys, `${where}: ${lang} のキーの集合が ja と違う`)
		for (const [k, v] of Object.entries(table[lang])) {
			if (k === 'turnstileLanguage') continue
			assertIntlText(lang, render(v), `${where} ${lang}.${k}`)
		}
	}
	for (const [k, v] of Object.entries(jaExpected)) assert.equal(render(table.ja[k]), v, `${where} ja.${k} は今の文字列のまま`)
}

const FORM = read('src/islands/InquiryForm.svelte')

test('InquiryForm: 3 言語の表のキーの集合が同じで、ja は今の文字列のまま、英中は lint を通る', () => {
	const TEXT = evalTable(FORM, 'TEXT')
	assertTable(TEXT, 'InquiryForm', {
		requiredNote: 'は必須項目です。',
		optional: '（任意）',
		emailHelp: '受付確認と返答はこのアドレス宛に届きます。',
		phoneHelp: '全角で入力しても送信時に半角へ変換します。',
		seatsHelp: 'Enterprise は 1 アカウント以上',
		generalMessagePh: '発生した操作、画面に出たメッセージ、お困りの内容などをご記入ください',
		turnstileFailed:
			'認証部品 (Cloudflare Turnstile) を読み込めませんでした。広告ブロッカー等を一時的に無効にして、ページを再読み込みしてください。',
		checkInput: '入力内容をご確認ください。',
		turnstileLoadFailed: '認証部品を読み込めませんでした。ページを再読み込みしてもう一度お試しください。',
		turnstileWait: '認証の完了をお待ちください。表示されている認証が終わってから、もう一度「送信する」を押してください。',
		sendingLive: '送信しています。',
		receivedLive: 'お問い合わせを受け付けました。',
		doneTitle: '送信完了',
		doneBody: 'お問い合わせを受け付けました。3 営業日以内に担当者よりご返答いたします。',
		doneMailSent: 'ご入力のメールアドレス宛に受付確認メールをお送りしました。届かない場合は迷惑メールフォルダをご確認ください。',
		close: '閉じる',
		sending: '送信しています…',
		submit: '送信する',
		usageNote: '送信内容は担当者からの連絡と返答のためにのみ使用します。',
		turnstileLanguage: 'ja',
	})
	// ja には足さない (表の ja は null で、画面に要素を出さない)
	assert.equal(TEXT.ja.mailJaNote, null)
	assert.equal(TEXT.en.turnstileLanguage, 'en')
	assert.equal(TEXT['zh-tw'].turnstileLanguage, 'zh-tw')
	// 英中だけ「確認のメールは日本語で届きます」を足す (設計書 §10.4 の contact_mail_ja_note)
	assert.equal(TEXT.en.mailJaNote, 'The confirmation email is in Japanese.')
	assert.equal(TEXT['zh-tw'].mailJaNote, '確認電子郵件為日文。')
	// 「3 営業日以内」は日本の営業日と分かる形 (W7-site.md §6)
	assert.match(TEXT.en.doneBody, /within 3 business days \(Japan\)/)
	assert.match(TEXT['zh-tw'].doneBody, /3 個工作天內（以日本的工作天計算）/)
	// ja の placeholder は既存のテスト (t1941) が見る属性の literal と同じ
	const literal = FORM.match(/placeholder=\{isGeneral\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\}/)
	assert.ok(literal, 'placeholder の literal が無い')
	assert.equal(literal[1], TEXT.ja.generalMessagePh)
	assert.equal(literal[2], TEXT.ja.enterpriseMessagePh)
})

test('InquiryForm: 言語を <html lang> から選び、検証・失敗の文と Turnstile に渡す', () => {
	assert.match(FORM, /import \{ pageLang, pick \} from '\.\.\/lib\/site-lang\.js';/)
	assert.match(FORM, /pick\(TEXT, lang\)/)
	assert.match(FORM, /validateInquiry\(fields, formKind, lang\)/)
	assert.match(FORM, /describeFailure\(outcome, \{ supportEmail, lang \}\)/)
	assert.match(FORM, /labelsFor\(formKind, lang\)/)
	assert.match(FORM, /language: T\.turnstileLanguage/)
	assert.doesNotMatch(FORM, /language: 'ja'/)
	assert.doesNotMatch(FORM, /innerHTML|\{@html/)
	// 送る内容は言語で変えない
	assert.match(FORM, /buildPayload\(result\.fields, turnstileToken, formKind\)/)
})

test('InquiryForm: 画面の日本語の直書きがコメントと表の外に残っていない', () => {
	const noComments = FORM.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/^\s*\/\/.*$/gm, '')
	const withoutTable = noComments.replace(objectLiteral(noComments, 'TEXT'), '{}')
	const lines = withoutTable
		.split('\n')
		.filter((l) => /[぀-ヿ一-鿿]/u.test(l))
		// t1941 が照合する placeholder の literal (ja だけが使い、英中は spread で上書きする)
		.filter((l) => !/placeholder=\{isGeneral/.test(l) && !/^\s*: '導入時期/.test(l) && !/^\s*\? '発生した操作/.test(l))
	assert.deepEqual(lines, [])
})

const MAIN = read('src/main.js')

test('main.js: /join/ のコピーの文は 3 言語の表で、ja の定数は今の値のまま', () => {
	const COPY_DONE = MAIN.match(/const COPY_DONE = '([^']*)';/)?.[1]
	const COPY_FAILED = MAIN.match(/const COPY_FAILED = '([^']*)';/)?.[1]
	assert.equal(COPY_DONE, 'コピーしました。')
	assert.equal(COPY_FAILED, 'コピーできませんでした。組織コードを選択してコピーしてください。')
	const table = evalTable(MAIN, 'COPY_TEXT', { COPY_DONE, COPY_FAILED })
	assertTable(table, 'main.js COPY_TEXT', { done: COPY_DONE, failed: COPY_FAILED })
	assert.match(MAIN, /pick\(COPY_TEXT, pageLang\(\)\)/)
})

test('main.js: 404 の振り分けは [data-lang-404] があるときだけ lang404Target で location.replace する', () => {
	assert.match(MAIN, /import \{ lang404Target \} from '\.\/lib\/lang-404\.js';/)
	assert.match(MAIN, /querySelector\('\[data-lang-404\]'\)/)
	assert.match(MAIN, /lang404Target\(location\.pathname\)/)
	assert.match(MAIN, /location\.replace\(/)
	// I18N-713 が言語の案内を足す区切り
	assert.match(MAIN, /\/\/ -+ i18n の初期化/)
})

// ---- 3. inquiry_form.yml ----

/** inquiry_form.yml の形 (平らな `key: "value"` と、`key:` + `  - "value"` の配列) だけを読む */
function parseInquiryYaml(text, where) {
	const out = {}
	let list = null
	text.split(/\r?\n/).forEach((raw, i) => {
		if (/^\s*(#.*)?$/.test(raw)) return
		const item = raw.match(/^ {2}- "((?:[^"\\]|\\.)*)"\s*(#.*)?$/)
		if (item && list) {
			list.push(JSON.parse(`"${item[1]}"`))
			return
		}
		const kv = raw.match(/^([a-z][a-z0-9_]*):\s*"((?:[^"\\]|\\.)*)"\s*(#.*)?$/)
		if (kv) {
			if (kv[1] in out) throw new Error(`${where}: キーが重複: ${kv[1]}`)
			out[kv[1]] = JSON.parse(`"${kv[2]}"`)
			list = null
			return
		}
		const head = raw.match(/^([a-z][a-z0-9_]*):\s*(#.*)?$/)
		if (head) {
			if (head[1] in out) throw new Error(`${where}: キーが重複: ${head[1]}`)
			list = out[head[1]] = []
			return
		}
		throw new Error(`${where} の ${i + 1} 行目が読めない: ${raw}`)
	})
	return out
}

const YML = Object.fromEntries(
	INTL.map((lang) => [lang, parseInquiryYaml(read(`_data/l10n/${lang}/inquiry_form.yml`), `${lang}/inquiry_form.yml`)]),
)

test('inquiry_form.yml: en / zh-tw のキーの集合が同じで、値が lint を通る', () => {
	assert.deepEqual(Object.keys(YML.en).sort(), Object.keys(YML['zh-tw']).sort())
	for (const lang of INTL) {
		for (const [k, v] of Object.entries(YML[lang])) {
			const values = Array.isArray(v) ? v : [v]
			values.forEach((s, i) => assertIntlText(lang, s, `${lang} ${k}[${i}]`))
		}
	}
})

test('inquiry_form.yml: 項目の一覧は ja の noscript と同じ数で、件名は英語', () => {
	const src = read('_includes/inquiry-form.html')
	// ja の noscript の一覧 (ソースにそのまま残す)
	const jaGeneral = ['メールアドレス', 'お問い合わせ内容']
	const jaEnterprise = ['会社名', '会社の Web ページ（任意）', '氏名', 'メールアドレス', '電話番号', '利用アカウント予定数（1 以上）', 'ご相談内容']
	for (const li of [...jaGeneral, ...jaEnterprise]) assert.ok(src.includes(`<li>${li}</li>`), `ja の <li>${li}</li> が無い`)
	for (const lang of INTL) {
		assert.equal(YML[lang].general_items.length, jaGeneral.length, `${lang} general_items`)
		assert.equal(YML[lang].enterprise_items.length, jaEnterprise.length, `${lang} enterprise_items`)
		assert.match(YML[lang].general_subject, /^[ -~]+$/, `${lang} general_subject は英語`)
		assert.match(YML[lang].enterprise_subject, /^[ -~]+$/, `${lang} enterprise_subject は英語`)
	}
	assert.equal(YML.en.general_subject, 'Inquiry')
	assert.equal(YML.en.enterprise_subject, 'Enterprise inquiry')
})

test('inquiry-form.html: ja の文と mailto の件名はそのまま、data-* の配線は変えない、英中は l10n から引く', () => {
	const src = read('_includes/inquiry-form.html')
	assert.ok(src.includes('?subject=%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B'))
	assert.ok(src.includes('?subject=Enterprise%20%E5%B0%8E%E5%85%A5%E7%9B%B8%E8%AB%87'))
	assert.equal((src.match(/このフォームの送信には JavaScript が必要です。/g) ?? []).length, 2)
	assert.match(src, /data-kind="\{\{ inquiry_kind \}\}"/)
	assert.match(src, /data-endpoint="\{\{ inquiry_endpoint \}\}"/)
	assert.match(src, /data-turnstile-site-key="\{\{ site\.data\.inquiry\.turnstile_site_key \}\}"/)
	assert.match(src, /data-support-email="\{\{ site\.data\.inquiry\.support_email \}\}"/)
	assert.match(src, /site\.data\.l10n\[page\.lang\]\.inquiry_form/)
	assert.doesNotMatch(src, /<div data-island="inquiry-form"[^>]*data-lang/)
})

// ---- 4. lang-404.js ----

test('lang404Target: /en/・/zh-tw/ の下だけ英中の 404 へ、行き先自身とそれ以外は null', () => {
	const cases = [
		['/en/foo', '/en/404.html'],
		['/en/', '/en/404.html'],
		['/en/price/old/', '/en/404.html'],
		['/zh-tw/', '/zh-tw/404.html'],
		['/zh-tw/foo/bar.html', '/zh-tw/404.html'],
		['/en/404.html', null],
		['/zh-tw/404.html', null],
		['/foo', null],
		['/', null],
		['/english/', null],
		['/en', null],
		['/zh-tw', null],
		['/zh-twx/', null],
		['/EN/foo', null],
		['', null],
		[undefined, null],
		[null, null],
	]
	for (const [path, want] of cases) assert.equal(lang404Target(path), want, String(path))
})

// ---- 5. checks/inquiry.mjs ----

const island = (kind, noscript, endpoint = 'https://w.example/inquiry') =>
	`<div data-island="inquiry-form"\n     data-kind="${kind}"\n     data-endpoint="${endpoint}"\n     data-turnstile-site-key=""\n     data-support-email="s@example.com">\n  <noscript>${noscript}</noscript>\n</div>`
const page = (kind, noscript, endpoint) => `<html><body>${island(kind, noscript, endpoint)}</body></html>`

function runInquiry(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-inquiry-'))
	try {
		for (const [rel, body] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), body)
		}
		return checkInquiry(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

const JA_NOSCRIPT = '<p>このフォームの送信には JavaScript が必要です。</p>'
const JA = {
	'contact/index.html': page('general', JA_NOSCRIPT),
	'enterprise/inquiry/index.html': page('enterprise', JA_NOSCRIPT),
	'404.html': '<html><div hidden data-i18n-switch data-lang-404></div></html>',
}
const EN_NOSCRIPT = '<p>This form requires JavaScript.</p>'
const ZH_NOSCRIPT = '<p>此表單需要 JavaScript 才能送出。</p>'
const INTL_OK = {
	'en/contact/index.html': page('general', EN_NOSCRIPT),
	'en/enterprise/inquiry/index.html': page('enterprise', EN_NOSCRIPT),
	'zh-tw/contact/index.html': page('general', ZH_NOSCRIPT),
	'zh-tw/enterprise/inquiry/index.html': page('enterprise', ZH_NOSCRIPT),
	'en/404.html': '<html>en</html>',
	'zh-tw/404.html': '<html>zh</html>',
}

test('checks/inquiry: 英中のページも 404 の印も無ければ何も言わない', () => {
	assert.deepEqual(runInquiry({ 'contact/index.html': JA['contact/index.html'], '404.html': '<html></html>' }), [])
})

test('checks/inquiry: アイランド・data-kind・data-endpoint・noscript が揃い、英中の 404 があれば合格 (陽性対照)', () => {
	assert.deepEqual(runInquiry({ ...JA, ...INTL_OK }), [])
})

test('checks/inquiry: 欠けた島・違う data-kind・違う endpoint・noscript の欠け・仮名・英中の 404 の欠けを捕まえる (陰性対照)', () => {
	const noIsland = runInquiry({ ...JA, ...INTL_OK, 'en/contact/index.html': '<html><p>x</p></html>' })
	assert.ok(noIsland.some((e) => /inquiry-form/.test(e)), noIsland.join('\n'))

	const kind = runInquiry({ ...JA, ...INTL_OK, 'en/contact/index.html': page('enterprise', EN_NOSCRIPT) })
	assert.ok(kind.some((e) => /data-kind/.test(e)), kind.join('\n'))

	const endpoint = runInquiry({ ...JA, ...INTL_OK, 'zh-tw/contact/index.html': page('general', ZH_NOSCRIPT, 'https://evil.example/') })
	assert.ok(endpoint.some((e) => /data-endpoint/.test(e)), endpoint.join('\n'))

	const noscript = runInquiry({
		...JA,
		...INTL_OK,
		'en/enterprise/inquiry/index.html': INTL_OK['en/enterprise/inquiry/index.html'].replace(/<noscript>[\s\S]*<\/noscript>/, ''),
	})
	assert.ok(noscript.some((e) => /noscript/.test(e)), noscript.join('\n'))

	// 英中の実際のページはヘッダー (モバイルナビ) にも <noscript> がある。それがあっても
	// アイランドの noscript の欠けと仮名を捕まえ、ヘッダーの noscript は検査の対象にしない
	const withHeader = (html, text = '<style>.nav{display:block}</style>') =>
		html.replace('<body>', `<body><header><noscript>${text}</noscript></header>`)
	const headerOk = runInquiry({
		...JA,
		...Object.fromEntries(Object.entries(INTL_OK).map(([k, v]) => [k, k.endsWith('404.html') ? v : withHeader(v)])),
	})
	assert.deepEqual(headerOk, [])

	const headerOnly = runInquiry({
		...JA,
		...INTL_OK,
		'en/contact/index.html': withHeader(INTL_OK['en/contact/index.html'].replace(/<noscript>[\s\S]*<\/noscript>/, '')),
	})
	assert.ok(headerOnly.some((e) => /^en\/contact\/index\.html: .*noscript/.test(e)), headerOnly.join('\n'))

	const headerKana = runInquiry({ ...JA, ...INTL_OK, 'zh-tw/contact/index.html': withHeader(page('general', ZH_NOSCRIPT), 'メニュー') })
	assert.deepEqual(headerKana, [], 'ヘッダーの noscript の仮名は対象外')

	const islandKana = runInquiry({ ...JA, ...INTL_OK, 'zh-tw/contact/index.html': withHeader(page('general', JA_NOSCRIPT)) })
	assert.ok(islandKana.some((e) => /仮名/.test(e)), islandKana.join('\n'))

	const kana = runInquiry({ ...JA, ...INTL_OK, 'zh-tw/contact/index.html': page('general', JA_NOSCRIPT) })
	assert.ok(kana.some((e) => /仮名/.test(e)), kana.join('\n'))

	const files = { ...JA, ...INTL_OK }
	delete files['zh-tw/404.html']
	const missing404 = runInquiry(files)
	assert.ok(missing404.some((e) => /zh-tw\/404\.html/.test(e)), missing404.join('\n'))
})
