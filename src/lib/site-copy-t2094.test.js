// T-2094 (login1111, 2026-11-12) docs を desktop / web 2.13 のログイン画面・法人の参加手順・「ライセンス」に合わせた回帰テスト。
//
//   node --test src/lib/site-copy-t2094.test.js
//
//   - ログイン画面は 3 つの入口だけ (「新規登録」「ログイン」の 2 択とメールアドレスの入力欄は廃止)。
//     コード方式 (メールに届く 6 桁の確認コード) は新しく登録する方の入口。切り替えは 2.13 から。
//     T-2111 (案 B、2026-11-12): 既存の方もメールアドレスの確認が済んでいればコードで入れる (同じアカウントに連結される)。
//     確認が済んでいない方はコードの入力後に MSG_EXISTING_PASSWORD_ACCOUNT が出る → パスワードでログインするか再設定。
//     「既存の利用者はパスワードのまま」「パスワードで登録したメールアドレスではコードでログインできない」は誤りになったので書かない。
//   - 法人: 案内メールのリンク →「アプリで開く」→ ログイン画面に組織コードが入った状態で開く → ログイン。管理者はコードを入れない。
//   - メニューバー「ヘルプ」の旧「このアプリについて」は「ライセンス」。一覧はソフト名の行だけで、押すと中身が開く。
//   - 公開文面の版の表記は「2.13」(help1111 のときに書いた 2.12 系の小版の表記を残さない)。
//   画面の文言の正本 (一字一句同じにする):
//     desktop src/lib/auth/login-entry.ts (authButtonsFor / switchOfferFor / CODE_METHOD_NOTE)、
//     desktop src/lib/team/wording.ts (ORG_CODE_SHARE_WARNING / ENTERPRISE_ENTRY_LABEL)、
//     desktop src/lib/components/menu-model.ts (help.about = 「ライセンス」)、web app/src/lib/components/LoginGate.svelte、
//     サイトの join/index.html (T-2090)。
//
// 読み取りはこのファイル内で完結させる (site-copy-help1111.test.js と同じ流儀)。

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

const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** `<h3 …>title</h3>` の直後から次の `<h3` までの HTML。無ければ null。 */
function afterHeading(html, title) {
	const marker = `>${title}</h3>`
	const at = html.indexOf(marker)
	if (at < 0) return null
	const start = at + marker.length
	const end = html.indexOf('<h3', start)
	return end < 0 ? html.slice(start) : html.slice(start, end)
}

/** `<div class="kv-key">ラベル</div>` に続く `kv-val` のテキスト。無ければ null。 */
function kvValue(html, label) {
	const re = new RegExp(`<div class="kv-key">${label}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`)
	const m = html.match(re)
	return m ? textOf(m[1]) : null
}

// 画面の文言 (正本は上の desktop / web のファイル)
const CODE_LABEL = 'メールアドレスではじめる'
const PASSWORD_LABEL = 'パスワードで登録済みの方はこちら'
const ENTERPRISE_LABEL = 'エンタープライズプランの方はこちら'
const SWITCH_TO_PASSWORD_LABEL = 'パスワードでログインする'
/** 前回の方式がパスワードの人の並び (desktop login-entry.ts の authButtonsFor('password')) */
const SWAPPED_PRIMARY_LABEL = 'パスワードでログイン'
const SWAPPED_SECONDARY_LABEL = 'メールアドレスのコードではじめる'
/** Web 版の LoginGate から外したボタン (最終レビュー、login1111)。docs に残さない */
const REMOVED_WEB_ORG_LOGIN_LABEL = '組織コードを添えてログイン'
const ORG_CODE_SHARE_WARNING = '組織コードを知っていれば誰でも参加できます。関係者以外には共有しないでください。'
/** 未確認の既存アカウントでコードを入れたときの案内 (desktop login_rejection.rs の MSG_EXISTING_PASSWORD_ACCOUNT、T-2111) */
const MSG_EXISTING_PASSWORD_ACCOUNT =
	'このメールアドレスはパスワードで登録済みです。パスワードでログインするか、パスワードを再設定してください。'
const OPEN_APP_LABEL = 'アプリで開く'
const LICENSES_LABEL = 'ライセンス'

const DOCS_DIR = '_includes/docs'
const docsFiles = readdirSync(join(ROOT, DOCS_DIR))
	.filter((f) => f.endsWith('.html'))
	.map((f) => `${DOCS_DIR}/${f}`)
const account = read(`${DOCS_DIR}/02-account.html`)
const intro = read(`${DOCS_DIR}/01-intro.html`)
const ops = read(`${DOCS_DIR}/06-ops.html`)
const team = read(`${DOCS_DIR}/07-team.html`)
const web = read(`${DOCS_DIR}/web.html`)
const joinPage = read('join/index.html')
const subscribePage = read('subscribe/index.html')
const subscribeData = read('_data/subscribe.yml')

const license = sectionOf(account, 'license') ?? ''
const loginBlock = afterHeading(license, 'ログインする') ?? ''
const troubleLogin = textOf(afterHeading(sectionOf(ops, 'trouble') ?? '', 'ログインとプラン') ?? '')
const teamSection = sectionOf(team, 'team') ?? ''

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(textOf('<h3>a</h3>{% comment %}x{% endcomment %}<p>y</p>'), 'ay')
	assert.equal(afterHeading('<h3 class="c">a</h3><p>x</p><h3>b</h3>', 'a'), '<p>x</p>')
	assert.equal(afterHeading('<h3>a</h3>', 'z'), null)
	assert.equal(kvValue('<div class="kv-key">k</div> <div class="kv-val">v<b>w</b></div>', 'k'), 'vw')
	assert.equal(kvValue('<div class="kv-key">k</div>', 'z'), null)
	assert.ok(docsFiles.length >= 8, `docs の章が読めていない: ${docsFiles}`)
})

// ── ログイン画面の 3 つの入口 ───────────────────────────────────────────────

test('#license の「ログインする」に 3 つの入口がアプリと同じ文言・同じ順で並ぶ', () => {
	assert.ok(loginBlock, '#license に「ログインする」の見出しが無い')
	const order = [CODE_LABEL, PASSWORD_LABEL, ENTERPRISE_LABEL].map((l) => loginBlock.indexOf(`<div class="kv-key">${l}</div>`))
	assert.ok(order.every((i) => i >= 0), `入口の行が欠けている: ${order}`)
	assert.deepEqual([...order].sort((a, b) => a - b), order, '入口の並びがアプリと違う')
})

test('コード方式は「メールに届く 6 桁の確認コード」でパスワード不要、新しく登録する方はここ', () => {
	const code = kvValue(loginBlock, CODE_LABEL)
	assert.ok(code)
	assert.match(code, /メールに届く 6 桁の確認コード/)
	assert.match(code, /パスワードは要りません/)
	assert.match(code, /初めての方（新しく登録する方）はこちら/)
	// T-2111: 既存の方もメールアドレスの確認が済んでいればここから入れる (同じアカウントのまま)
	assert.match(code, /パスワードで登録済みの方も、メールアドレスの確認が済んでいればこちらからログインできます/)
	const password = kvValue(loginBlock, PASSWORD_LABEL)
	assert.ok(password)
	assert.match(password, /以前からパスワードでお使いの方は、これまでどおり/)
	const enterprise = kvValue(loginBlock, ENTERPRISE_LABEL)
	assert.ok(enterprise)
	assert.match(enterprise, /「組織コード」欄/)
})

test('切り替えは 2.13 から、2 択とメール欄は廃止、既存の方はパスワードでもコードでも入れると書く (T-2111)', () => {
	const text = textOf(loginBlock)
	assert.match(text, /2\.13 から、ログイン画面の入口はこの 3 つになりました/)
	assert.match(text, /「新規登録」「ログイン」の 2 択とメールアドレスの入力欄は無くなり/)
	assert.match(text, /すでにパスワードで登録している方は、これまでどおりパスワードでログインできるほか、メールアドレスの確認が済んでいれば「メールアドレスではじめる」から確認コードでもログインできます/)
	assert.match(text, /今までと同じアカウントでログインします/)
	// 確認が済んでいない場合: アプリの案内文と同じ文、パスワードでのログインか再設定で解決する
	assert.ok(text.includes(`「${MSG_EXISTING_PASSWORD_ACCOUNT}」と表示されます`), `未確認の場合の案内文が無い: ${text}`)
	assert.match(text, /パスワードを再設定するとメールアドレスの確認も済むため、次からは確認コードでもログインできます/)
	// 拒否の直後の desktop は existing_password_account で並びが入れ替わり (login-entry.ts authButtonsFor('password'))、
	// 「パスワードで登録済みの方はこちら」は画面に出ない。画面にあるボタン名で案内する
	// (案内文はボタン名に依らない文なので、食い違いを補う括弧書きは要らない)
	assert.ok(
		text.includes(`このとき Desktop 版ではボタンの並びが入れ替わり、大きいボタンが「${SWAPPED_PRIMARY_LABEL}」になります。そこからパスワードでログインするか、`),
		`未確認の場合の入れ替わりの説明が無い: ${text}`,
	)
	assert.ok(!text.includes('この並びでは表示されません'), `不要になった括弧書きが残っている: ${text}`)
	assert.ok(!text.includes(`「${PASSWORD_LABEL}」からパスワードでログインしてください`), `表示されないボタン名で案内している: ${text}`)
	assert.match(text, /前回この PC でパスワードでログインした場合と、上の案内が表示された直後は、ボタンの並びが入れ替わり/)
})

test('T-2111: 誤りになった「既存の方はパスワードのまま」「コードではログインできない」を docs と /join/ に書かない', () => {
	const pages = [...docsFiles.map((f) => [f, read(f)]), ['join/index.html', joinPage], ['_data/subscribe.yml', subscribeData]]
	for (const [file, source] of pages) {
		const text = textOf(source)
		assert.doesNotMatch(text, /パスワードのまま/, `${file} に「パスワードのまま」が残っている`)
		assert.doesNotMatch(text, /「メールアドレスではじめる」からはログインできません/, `${file} に旧い制約が残っている`)
		assert.doesNotMatch(text, /パスワードでお使いの方には確認コードは届きません/, `${file} に旧い制約が残っている`)
		assert.doesNotMatch(text, /新しく登録する方のための方式/, `${file} に旧い説明が残っている`)
	}
	assert.ok(textOf(account).includes('メールアドレスではじめる'), '陽性対照: 02-account.html が読めていない')
})

test('廃止した入口 (「新規登録」ボタン・「別のアカウントでログイン」・ダイアログの「ログイン」) を docs と申し込みページで案内しない', () => {
	const pages = [...docsFiles.map((f) => [f, read(f)]), ['subscribe/index.html', subscribePage]]
	for (const [file, source] of pages) {
		const text = textOf(source)
		// 「「新規登録」「ログイン」の 2 択は無くなり」(廃止の説明) だけは許す
		assert.doesNotMatch(text, /「新規登録」(?!「ログイン」の 2 択)/, `${file} に「新規登録」が残っている`)
		assert.doesNotMatch(text, /別のアカウントでログイン/, `${file} に「別のアカウントでログイン」が残っている`)
		assert.doesNotMatch(text, /ダイアログの「ログイン」を押/, `${file} に旧ダイアログの手順が残っている`)
		assert.doesNotMatch(text, /もう一度「ログイン」を押/, `${file} に旧ダイアログの手順が残っている`)
		assert.doesNotMatch(text, /組織コードをお持ちの方/, `${file} に旧い入口の名前が残っている`)
	}
	assert.doesNotMatch(subscribeData, /「新規登録」/, '_data/subscribe.yml に「新規登録」が残っている')
	assert.match(subscribeData, /ログイン画面の「メールアドレスではじめる」から作成できます/)
	assert.match(textOf(subscribePage), /アカウントが無い場合は「メールアドレスではじめる」から登録/)
})

// ── トラブルシューティング ─────────────────────────────────────────────────

test('#trouble に「確認コードのメールが届かない場合」(迷惑メール・待って再送信・パスワードの方は別の入口)', () => {
	assert.ok(troubleLogin, '#trouble の「ログインとプラン」が無い')
	const item = troubleLogin.slice(troubleLogin.indexOf('確認コードのメールが届かない場合'))
	assert.ok(troubleLogin.includes('確認コードのメールが届かない場合'), '項目が無い')
	const end = item.indexOf('パスワードを忘れた場合')
	assert.ok(end > 0, '陽性対照: 次の項目が見つからない')
	const one = item.slice(0, end)
	assert.match(one, /迷惑メールフォルダ/)
	assert.match(one, /数分/)
	assert.match(one, /再送信/)
	assert.ok(one.includes(`「${PASSWORD_LABEL}」`), 'パスワードの入口へ案内していない')
	assert.ok(one.includes(`「${SWITCH_TO_PASSWORD_LABEL}」`), '待っている画面の切り替えボタンの名前が無い')
})

test('#trouble: 未確認の既存アカウントの案内が出た場合 (T-2111) は、パスワードでのログインか再設定で解決すると書く', () => {
	const at = troubleLogin.indexOf(`「${MSG_EXISTING_PASSWORD_ACCOUNT}」と表示された場合`)
	assert.ok(at >= 0, `#trouble に未確認の場合の項目が無い: ${troubleLogin}`)
	const item = troubleLogin.slice(at, troubleLogin.indexOf('「他の端末でログイン中です」', at))
	// 拒否の直後の desktop はボタンの並びが入れ替わり、「パスワードで登録済みの方はこちら」は表示されない
	assert.ok(item.includes(`このとき Desktop 版ではログイン画面のボタンの並びが入れ替わり、大きいボタンが「${SWAPPED_PRIMARY_LABEL}」になっています。そこからパスワードでログインするか、`), item)
	assert.ok(!item.includes('この並びでは表示されません'), `不要になった括弧書きが残っている: ${item}`)
	assert.ok(!item.includes(`「${PASSWORD_LABEL}」からパスワードでログインしてください`), `表示されないボタン名で案内している: ${item}`)
	assert.match(item, /パスワードを再設定すると、メールアドレスの確認も済み、次からは「メールアドレスではじめる」でもログインできます/)
})

test('#trouble: パスワード前提の説明は「パスワードで登録済みの方」向けと明記する', () => {
	assert.match(troubleLogin, /パスワードを忘れた場合（パスワードで登録済みの方）/)
	assert.match(troubleLogin, new RegExp(`ログイン中のままになる場合: ダイアログの「キャンセル」で一度閉じ、もう一度「${CODE_LABEL}」または「${PASSWORD_LABEL}」を押して`))
})

// ── 法人の参加手順 ───────────────────────────────────────────────────────────

test('組織コードで参加する: 入口は「エンタープライズプランの方はこちら」、注意書きはアプリと同じ文', () => {
	const join = textOf(afterHeading(teamSection, '組織コードで参加する') ?? '')
	assert.ok(join, '「組織コードで参加する」の節が無い')
	assert.ok(join.includes(`ログインダイアログの「${ENTERPRISE_LABEL}」を開き`), `入口の名前が違う: ${join}`)
	assert.ok(join.includes(ORG_CODE_SHARE_WARNING), '組織コードの注意書きが wording.ts の ORG_CODE_SHARE_WARNING と違う')
	assert.doesNotMatch(textOf(team), /社外に転送/, '旧い注意書きが残っている')
})

test('案内メールのリンクから参加する: リンク →「アプリで開く」→ コード入りのログイン画面 → ログイン、管理者はコードを入れない', () => {
	const link = textOf(afterHeading(teamSection, '案内メールのリンクから参加する') ?? '')
	assert.ok(link, '「案内メールのリンクから参加する」の節が無い')
	assert.match(link, /2\.13 から/)
	const steps = [`「${OPEN_APP_LABEL}」を押します`, `「${ENTERPRISE_LABEL}」に組織コードが入った状態で開きます`, `「${CODE_LABEL}」または「${PASSWORD_LABEL}」からログイン`]
	const at = steps.map((s) => link.indexOf(s))
	assert.ok(at.every((i) => i >= 0), `手順が欠けている: ${at}`)
	assert.deepEqual([...at].sort((a, b) => a - b), at, '手順の順が違う')
	assert.match(link, /管理者の方は組織コードを入力しません/)
	assert.match(link, /案内を受け取ったメールアドレスでログイン/)
	// /join/ (T-2090) の画面と同じ語を使う
	assert.ok(joinPage.includes(`>${OPEN_APP_LABEL}</a>`), '陽性対照: /join/ に「アプリで開く」が無い')
	assert.ok(joinPage.includes(`「${ENTERPRISE_LABEL}」`), '陽性対照: /join/ に入口の名前が無い')
	assert.ok(link.includes('「Deepmosaic を開く」'), '/join/ のページ名が無い')
	assert.ok(joinPage.includes('<h1') && joinPage.includes('Deepmosaic を開く</h1>'), '陽性対照: /join/ の見出しが違う')
})

test('導入の流れ: 管理者は組織コードを入力せず、他のメンバーは「エンタープライズプランの方はこちら」から', () => {
	const flow = textOf(afterHeading(teamSection, '導入の流れ（お見積り・お支払い）') ?? '')
	assert.ok(flow)
	assert.match(flow, /管理者として参加します（管理者は組織コードを入力しません）/)
	assert.ok(flow.includes(`ログインダイアログの「${ENTERPRISE_LABEL}」を開き、「組織コード」欄に`))
})

// ── Web 版 ───────────────────────────────────────────────────────────────────

test('Web 版の始め方と組織コードでの参加が LoginGate の文言と同じ', () => {
	const start = textOf(sectionOf(web, 'start') ?? '')
	assert.ok(start.includes(`「${CODE_LABEL}」を押し、メールに届く 6 桁の確認コード`), `始め方: ${start}`)
	assert.ok(start.includes(`「${PASSWORD_LABEL}」を押します`))
	// T-2111: 既存の方もメールアドレスの確認が済んでいればコードで入れる
	assert.ok(start.includes(`メールアドレスの確認が済んでいれば「${CODE_LABEL}」からもログインできます`), `始め方: ${start}`)
	assert.ok(start.includes(`「${ENTERPRISE_LABEL}」の 3 つ`))
	assert.doesNotMatch(start, /「ログイン」を押します/)
	const org = kvValue(sectionOf(web, 'team') ?? '', '組織コードでの参加')
	assert.ok(org)
	assert.ok(org.includes(`ログイン画面の「${ENTERPRISE_LABEL}」を開き`))
	// 最終レビュー (login1111): Web 版も Desktop 版と同じ形。コードを入れてから上の 2 つのどちらかでログインする
	// (「組織コードを添えてログイン」のボタンは無くなった。初めての人ではコード方式になり、パスワードの人が止まるため)
	assert.ok(org.includes(`上の「${CODE_LABEL}」または「${PASSWORD_LABEL}」でログインします`), `組織コードでの参加: ${org}`)
	// T-2111: 既存の方は確認が済んでいればどちらでもよい。済んでいなければパスワードの方を選ぶ
	assert.ok(org.includes(`メールアドレスの確認が済んでいない場合は「${PASSWORD_LABEL}」を選んでください`), `組織コードでの参加: ${org}`)
	assert.ok(!textOf(web).includes(REMOVED_WEB_ORG_LOGIN_LABEL), `Web 版の docs に「${REMOVED_WEB_ORG_LOGIN_LABEL}」が残っている`)
})

test('前回パスワードでログインした PC ではボタンが入れ替わる (大きいボタンが「パスワードでログイン」) と書く', () => {
	const text = textOf(loginBlock)
	assert.ok(
		text.includes(`大きいボタンが「${SWAPPED_PRIMARY_LABEL}」、小さいボタンが「${SWAPPED_SECONDARY_LABEL}」になります`),
		`#license に入れ替わりの説明が無い: ${text}`,
	)
	assert.ok(troubleLogin.includes(`ログイン画面の大きいボタンが「${SWAPPED_PRIMARY_LABEL}」になっています`), '#trouble に入れ替わりの説明が無い')
})

// ── 「ライセンス」(旧「このアプリについて」) ────────────────────────────────

test('メニューバー「ヘルプ」の項目は「ライセンス」、一覧は行を押すと開く', () => {
	const help = afterHeading(sectionOf(intro, 'layout') ?? '', 'メニューバー「ヘルプ」') ?? ''
	const value = kvValue(help, LICENSES_LABEL)
	assert.ok(value, '「ヘルプ」の表に「ライセンス」の行が無い')
	assert.match(value, /ソフト名の行だけが並び、行を押すと中身が開きます/)
	const licenses = textOf(sectionOf(ops, 'licenses') ?? '')
	assert.match(licenses, /メニューバーの「ヘルプ ▸ ライセンス」から同じ一覧と各ライセンスの全文/)
	assert.match(licenses, /一覧にはソフト名の行だけが並び、行を押すと/)
})

test('旧名「このアプリについて」が docs (コメントを含む) に残っていない', () => {
	for (const file of docsFiles) {
		assert.ok(!read(file).includes('このアプリについて'), `${file} に「このアプリについて」が残っている`)
	}
	assert.ok(read('docs/index.html').length > 0, '陽性対照: docs/index.html が読めない')
	assert.ok(!read('docs/index.html').includes('このアプリについて'))
	assert.ok(!read('docs/web/index.html').includes('このアプリについて'))
})

// ── 版の表記 ─────────────────────────────────────────────────────────────────

test('公開文面・データ・テストに旧い版の表記 (2.12 の 1) が残っていない', () => {
	const stale = ['2', '12', '1'].join('.')
	const files = [
		...docsFiles,
		'docs/index.html',
		'docs/web/index.html',
		'_data/spec.yml',
		'_data/subscribe.yml',
		'subscribe/index.html',
		'llms.txt',
		'llms-full.txt',
		...readdirSync(join(ROOT, 'src/lib'))
			.filter((f) => f.endsWith('.js'))
			.map((f) => `src/lib/${f}`),
	]
	for (const file of files) {
		assert.ok(!read(file).includes(stale), `${file} に ${stale} が残っている`)
	}
	assert.match(textOf(intro), /2\.13 より前の版では、この 2 つはプロフィールメニューにありました/)
})
