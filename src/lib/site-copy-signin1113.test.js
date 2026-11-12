// T-2115 (signin1113, 2026-11-13) 公式サイトの「ログイン」「ログアウト」を「サインイン」「サインアウト」に統一し、
// 2.13 の新しいサインイン画面 (「サインイン」と「組織コードをお持ちの方（法人）」の 2 つ) の手順に合わせた回帰テスト。
//
//   node --test src/lib/site-copy-signin1113.test.js
//
//   - 見える文 (コメントを除く) に古い語・廃止したボタン名が残っていない。「サインイン中」「再サインイン」は使わない。
//   - パスワードの入口 (Shift の隠し入口・パスワードの再設定) はサイトのどこにも案内しない (Store の審査メモにだけ書く)。
//   - 法務 3 ページ (privacy / cookie / asct) は語の言い換えで最終更新日を 2026-11-13 に。legal.yml の版は変えない (再同意なし)。
//   - 英中のページはボタン名の引用だけを新しい名前の訳 (リーダーの決定 4 の値) にする。
//   語の対応の正本は D:/dm-scratch/signin1113/spec/COMMON.md §2 (リポの外)。
//
// 読み取りはこのファイル内で完結させる (site-copy-t2094.test.js と同じ流儀)。_site は読まない。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

/** YAML の `#` で始まる行 (先頭の空白を除いて) を落とす。 */
const stripYamlComments = (source) =>
	source
		.split(/\r?\n/)
		.filter((line) => !line.trimStart().startsWith('#'))
		.join('\n')

const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** ファイルの見える文 (コメントを落とした本文)。 */
const visibleOf = (rel) => (rel.endsWith('.yml') ? stripYamlComments(read(rel)) : textOf(read(rel)))

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** 一致した位置の前後 30 字 (失敗の文に出す)。 */
function around(text, re) {
	const m = text.match(re)
	if (!m) return ''
	return text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)
}

const OLD_WORDS = /ログイン|ログアウト|メールアドレスではじめる|メールアドレスのコードではじめる|パスワードで登録済み|エンタープライズプランの方はこちら|新規登録/
const BANNED_NEW = /サインイン中|再サインイン/ // COMMON §2 で使わない語
const VISIBLE_FILES = [
	...readdirSync(join(ROOT, '_includes/docs'))
		.filter((f) => f.endsWith('.html'))
		.map((f) => `_includes/docs/${f}`),
	'docs/index.html',
	'docs/web/index.html',
	'index.html',
	'join/index.html',
	'subscribe/index.html',
	'_data/subscribe.yml',
	'_data/disclosure.yml',
	'_data/docs_toc.yml',
	'_data/plans.yml',
	'_data/site.yml',
	'llms.txt',
	'llms-full.txt',
	'company/privacy.html',
	'company/cookie.html',
	'company/asct.html',
	'company/terms.html',
	'company/eula.html',
	'company/about.html',
]
const SIGN_IN = 'サインイン'
const ENTERPRISE = '組織コードをお持ちの方（法人）'
const ENTERPRISE_FACE = '法人サインイン'
const EN = { signIn: 'Sign in', enterprise: 'Have an organization code? (business)', face: 'Organization sign-in' }
const ZH = { signIn: '登入', enterprise: '持有組織代碼者（企業）', face: '組織登入' }
const OLD_QUOTES_EN = ['Start with email', 'Registered with a password', 'Enterprise plan users']
const OLD_QUOTES_ZH = ['以電子郵件開始', '已使用密碼註冊', 'Enterprise 方案使用者']

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(textOf('<p>a</p>{% comment %}ログイン{% endcomment %}<!-- ログアウト --><p>b</p>'), 'ab')
	assert.equal(textOf('{%- comment -%}x{%- endcomment -%}y'), 'y')
	assert.equal(stripYamlComments('a: 1\n  # ログイン\n# x\nb: 2'), 'a: 1\nb: 2')
	assert.match('ログインする', OLD_WORDS)
	assert.doesNotMatch('ログ（logs\\app.log）', OLD_WORDS)
	assert.doesNotMatch('お問い合わせダイアログ', OLD_WORDS)
	assert.doesNotMatch('検出ログ', OLD_WORDS)
	assert.match('サインイン中です', BANNED_NEW)
	assert.doesNotMatch('サインイン済みです', BANNED_NEW)
	assert.equal(around('xxログインyy', /ログイン/), 'xxログインyy')
	assert.ok(VISIBLE_FILES.length >= 25, `対象のファイルが読めていない: ${VISIBLE_FILES}`)
})

test('見える文に古い語 (ログイン・ログアウト・廃止したボタン名・新規登録) が 0 件', () => {
	for (const file of VISIBLE_FILES) {
		const text = visibleOf(file)
		assert.doesNotMatch(text, OLD_WORDS, `${file} に古い語が残っている: …${around(text, OLD_WORDS)}…`)
	}
	assert.ok(visibleOf('_includes/docs/02-account.html').includes(SIGN_IN), '陽性対照: 02-account.html に「サインイン」が無い')
})

test('見える文に「サインイン中」「再サインイン」が 0 件', () => {
	for (const file of VISIBLE_FILES) {
		const text = visibleOf(file)
		assert.doesNotMatch(text, BANNED_NEW, `${file} に使わない語がある: …${around(text, BANNED_NEW)}…`)
	}
})

test('llms.txt / llms-full.txt に log in / login が無く、目次は「サインインとライセンス / Sign-in and license」', () => {
	for (const file of ['llms.txt', 'llms-full.txt']) {
		const text = stripComments(read(file)).replaceAll('deepmosaic://login', '').replaceAll('?login=', '')
		assert.doesNotMatch(text, /\blog ?in\b/i, `${file} に log in / login が残っている: …${around(text, /\blog ?in\b/i)}…`)
	}
	assert.ok(read('llms.txt').includes('サインインとライセンス / Sign-in and license'), 'llms.txt の目次が新しい名前になっていない')
})

test('docs の目次と見出し: id は license のまま、名前は「サインインとライセンス」', () => {
	const toc = read('_data/docs_toc.yml')
		.split(/\r?\n/)
		.find((line) => /id: license\b/.test(line))
	assert.ok(toc, '陽性対照: docs_toc.yml に id: license の行が無い')
	assert.match(toc, /label: サインインとライセンス/)
	assert.match(read('_includes/docs/02-account.html'), /docs-h2\.html kicker="アカウント" title="サインインとライセンス"/)
})

test('_data/lang/ja.json: login / signout の値はサインイン / サインアウト (キーはそのまま)', () => {
	const ja = JSON.parse(read('_data/lang/ja.json'))
	assert.equal(ja.login, 'サインイン')
	assert.equal(ja.signout, 'サインアウト')
	assert.equal(ja.my_lang, 'ja')
})

test('パスワードの入口 (Shift の隠し入口・パスワードでのサインイン・再設定) をサイトで案内しない', () => {
	const account = read('_includes/docs/02-account.html')
	const ops = read('_includes/docs/06-ops.html')
	const web = read('_includes/docs/web.html')
	const targets = [
		['02-account #license', textOf(sectionOf(account, 'license') ?? '')],
		['06-ops #trouble', textOf(sectionOf(ops, 'trouble') ?? '')],
		['web #start', textOf(sectionOf(web, 'start') ?? '')],
		['web #team', textOf(sectionOf(web, 'team') ?? '')],
		['join/index.html', visibleOf('join/index.html')],
		['subscribe/index.html', visibleOf('subscribe/index.html')],
		['_data/subscribe.yml', visibleOf('_data/subscribe.yml')],
	]
	for (const [name, text] of targets) {
		assert.ok(text.length > 0, `陽性対照: ${name} が読めていない`)
		for (const re of [/Shift/, /パスワードでサインイン/, /パスワードを再設定/, /「パスワード/]) {
			assert.doesNotMatch(text, re, `${name} にパスワードの入口の案内がある: …${around(text, re)}…`)
		}
	}
	assert.ok(targets[0][1].includes('パスワードは要りません'), '陽性対照: #license に「パスワードは要りません」が無い')
})

test('法務: privacy / cookie / asct は最終更新日 2026-11-13、legal.yml の版と terms / eula は据え置き', () => {
	assert.ok(read('company/privacy.html').includes('最終更新日: 2026-11-13（制定: 2019-06-01）'))
	assert.ok(read('company/cookie.html').includes('最終更新日: 2026-11-13'))
	assert.ok(read('company/asct.html').includes('最終更新日: 2026-11-13'))
	assert.match(read('_data/legal.yml'), /version: "2026-11-08"/)
	assert.ok(read('company/terms.html').includes('最終更新日: 2026-11-08'))
	assert.ok(read('company/eula.html').includes('最終更新日: 2026-11-08'))
})

test('英中のページ: 廃止したボタン名の引用が無く、新しいボタン名の訳を引用する', () => {
	for (const file of ['en/join/index.html', 'en/subscribe/index.html', '_data/l10n/en/subscribe.yml']) {
		const source = read(file)
		for (const old of OLD_QUOTES_EN) assert.ok(!source.includes(old), `${file} に旧い引用「${old}」が残っている`)
	}
	for (const file of ['zh-tw/join/index.html', 'zh-tw/subscribe/index.html', '_data/l10n/zh-tw/subscribe.yml']) {
		const source = read(file)
		for (const old of OLD_QUOTES_ZH) assert.ok(!source.includes(old), `${file} に旧い引用「${old}」が残っている`)
	}
	const en = read('en/join/index.html')
	for (const name of [EN.signIn, EN.enterprise, EN.face]) assert.ok(en.includes(`"${name}"`), `en/join に "${name}" が無い`)
	const zh = read('zh-tw/join/index.html')
	for (const name of [ZH.signIn, ZH.enterprise, ZH.face]) assert.ok(zh.includes(`「${name}」`), `zh-tw/join に「${name}」が無い`)
})

test('ja の /join/: コードの表示は新しいボタン名で、管理者の表示は「管理者としてサインインします。」', () => {
	const page = read('join/index.html')
	const codeAt = page.indexOf('data-join-view="code"')
	const adminAt = page.indexOf('data-join-view="admin"')
	assert.ok(codeAt >= 0 && adminAt > codeAt, '陽性対照: /join/ の表示の区切りが見つからない')
	const code = page.slice(codeAt, adminAt)
	for (const name of [ENTERPRISE_FACE, SIGN_IN, ENTERPRISE]) assert.ok(code.includes(`「${name}」`), `コードの表示に「${name}」が無い`)
	const admin = page.slice(adminAt, page.indexOf('data-join-view="invalid"'))
	assert.ok(textOf(`<div ${admin}`).includes('管理者としてサインインします。'), '管理者の表示の文が違う')
})
