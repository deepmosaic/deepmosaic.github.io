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
//   (以上は T-2094 当時の履歴。)
//
// signin1113 (T-2115、2026-11-13) で 2.13 の新しいサインイン画面 (「サインイン」と「組織コードをお持ちの方（法人）」の 2 つ、
// パスワードの入口は案内しない) に合わせて書き直した。「ログイン」「ログアウト」は「サインイン」「サインアウト」に統一。
// 「組織コードをお持ちの方（法人）」を押すと「法人サインイン」の画面になり、「組織コード」欄に入力して「サインイン」を押す。
// 以前からのパスワードのアカウントも、同じメールアドレスでコードを入れると同じアカウントに連結される (T-2111 / T-2114)。
//   画面の文言の正本 (一字一句同じにする):
//     desktop src/lib/components/AuthDialog.svelte、web app/src/lib/components/LoginGate.svelte、サイトの join/index.html、
//     desktop src/lib/team/wording.ts (ORG_CODE_SHARE_WARNING / ENTERPRISE_ENTRY_LABEL)、
//     desktop src/lib/components/menu-model.ts (help.about = 「ライセンス」)。
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
const SIGN_IN_LABEL = 'サインイン'
/** 2.13 の画面から無くなったボタン名 (signin1113)。docs で引用しない */
const REMOVED_LABELS = [
	'メールアドレスではじめる',
	'パスワードで登録済みの方はこちら',
	'エンタープライズプランの方はこちら',
	'パスワードでログインする',
	'パスワードでログイン',
	'メールアドレスのコードではじめる',
]
const ENTERPRISE_LABEL = '組織コードをお持ちの方（法人）'
/** 法人の入口を押した後の面の題名 */
const ENTERPRISE_FACE_TITLE = '法人サインイン'
/** Web 版の LoginGate から外したボタン (最終レビュー、login1111)。docs に残さない */
const REMOVED_WEB_ORG_LOGIN_LABEL = '組織コードを添えてログイン'
const ORG_CODE_SHARE_WARNING = '組織コードを知っていれば誰でも参加できます。関係者以外には共有しないでください。'
/** サインインを受け付けられないときの案内 (desktop login_rejection.rs の guard_unavailable、signin1113) */
const MSG_GUARD_UNAVAILABLE = 'いまはサインインを受け付けられません。しばらくしてからもう一度お試しください。'
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
const loginBlock = afterHeading(license, 'サインインする') ?? ''
const troubleLogin = textOf(afterHeading(sectionOf(ops, 'trouble') ?? '', 'サインインとプラン') ?? '')
const teamSection = sectionOf(team, 'team') ?? ''

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(textOf('<h3>a</h3>{% comment %}x{% endcomment %}<p>y</p>'), 'ay')
	assert.equal(afterHeading('<h3 class="c">a</h3><p>x</p><h3>b</h3>', 'a'), '<p>x</p>')
	assert.equal(afterHeading('<h3>a</h3>', 'z'), null)
	assert.equal(kvValue('<div class="kv-key">k</div> <div class="kv-val">v<b>w</b></div>', 'k'), 'vw')
	assert.equal(kvValue('<div class="kv-key">k</div>', 'z'), null)
	assert.ok(docsFiles.length >= 8, `docs の章が読めていない: ${docsFiles}`)
})

// ── サインイン画面の 2 つの入口 ─────────────────────────────────────────────

test('#license の「サインインする」に 2 つの入口 (「サインイン」→「組織コードをお持ちの方（法人）」の順)', () => {
	assert.ok(loginBlock, '#license に「サインインする」の見出しが無い')
	const keys = [...loginBlock.matchAll(/<div class="kv-key">([\s\S]*?)<\/div>/g)].map((m) => m[1])
	assert.deepEqual(keys, [SIGN_IN_LABEL, ENTERPRISE_LABEL], `入口の行がアプリと違う: ${keys}`)
	for (const label of REMOVED_LABELS) assert.ok(!keys.includes(label), `廃止した入口「${label}」の行が残っている`)
})

test('「サインイン」はメールに届く 6 桁の確認コードでパスワード不要、初回のサインインでアカウントが作られる', () => {
	const code = kvValue(loginBlock, SIGN_IN_LABEL)
	assert.ok(code)
	assert.match(code, /6 桁の確認コード/)
	assert.match(code, /パスワードは要りません/)
	assert.match(code, /初回のサインインで無料のアカウントが自動で作成されます/)
	const enterprise = kvValue(loginBlock, ENTERPRISE_LABEL)
	assert.ok(enterprise)
	assert.ok(enterprise.includes(`「${ENTERPRISE_FACE_TITLE}」の画面`), enterprise)
	assert.ok(enterprise.includes('「組織コード」欄'), enterprise)
	assert.ok(enterprise.includes('「← 戻る」'), enterprise)
})

test('2.13 から入口は 2 つ、以前からパスワードでお使いの方も「サインイン」から同じアカウントに', () => {
	const text = textOf(loginBlock)
	assert.match(text, /2\.13 から、サインイン画面の入口はこの 2 つになりました/)
	assert.match(
		text,
		/以前からパスワードでお使いの方も、「サインイン」から同じメールアドレスで確認コードを入力すれば、今までと同じアカウントでサインインできます/,
	)
	for (const label of REMOVED_LABELS) assert.ok(!text.includes(`「${label}」`), `廃止したボタン名「${label}」を引用している: ${text}`)
	assert.ok(!text.includes('このメールアドレスはパスワードで登録済みです'), `旧い案内文が残っている: ${text}`)
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
	assert.ok(textOf(account).includes('組織コードをお持ちの方（法人）'), '陽性対照: 02-account.html が読めていない')
})

test('廃止した入口 (「新規登録」ボタン・「別のアカウントでサインイン」・旧ダイアログの「ログイン」) を docs と申し込みページで案内しない', () => {
	const pages = [...docsFiles.map((f) => [f, read(f)]), ['subscribe/index.html', subscribePage]]
	for (const [file, source] of pages) {
		const text = textOf(source)
		assert.doesNotMatch(text, /「新規登録」/, `${file} に「新規登録」が残っている`)
		assert.doesNotMatch(text, /別のアカウントでサインイン/, `${file} に「別のアカウントでサインイン」が残っている`)
		assert.doesNotMatch(text, /ダイアログの「ログイン」を押/, `${file} に旧ダイアログの手順が残っている`)
		assert.doesNotMatch(text, /もう一度「ログイン」を押/, `${file} に旧ダイアログの手順が残っている`)
		for (const label of REMOVED_LABELS) assert.ok(!text.includes(`「${label}」`), `${file} に廃止したボタン名「${label}」が残っている`)
	}
	assert.doesNotMatch(subscribeData, /「新規登録」/, '_data/subscribe.yml に「新規登録」が残っている')
	assert.match(subscribeData, /サインイン画面の「サインイン」から作成できます/)
	assert.match(textOf(subscribePage), /アカウントが無い場合も、初めてのサインインで自動で作成されます/)
})

// ── トラブルシューティング ─────────────────────────────────────────────────

test('#trouble に「確認コードのメールが届かない場合」(迷惑メール・待って再送信、パスワードへは案内しない)', () => {
	assert.ok(troubleLogin, '#trouble の「サインインとプラン」が無い')
	const item = troubleLogin.slice(troubleLogin.indexOf('確認コードのメールが届かない場合'))
	assert.ok(troubleLogin.includes('確認コードのメールが届かない場合'), '項目が無い')
	const end = item.indexOf('以前からパスワードでお使いの方')
	assert.ok(end > 0, '陽性対照: 次の項目が見つからない')
	const one = item.slice(0, end)
	assert.match(one, /迷惑メールフォルダ/)
	assert.match(one, /数分/)
	assert.match(one, /再送信/)
	assert.doesNotMatch(one, /パスワード/, `確認コードの項目でパスワードへ案内している: ${one}`)
})

test('#trouble: 受け付けられない案内が出た場合は時間をおいてもう一度「サインイン」', () => {
	assert.ok(troubleLogin.includes(`「${MSG_GUARD_UNAVAILABLE}」と表示された場合`), `#trouble に受け付けられない場合の項目が無い: ${troubleLogin}`)
	assert.ok(troubleLogin.includes('もう一度「サインイン」を押してください'), troubleLogin)
})

test('#trouble: 移動中のまま・以前からパスワードでお使いの方', () => {
	assert.match(troubleLogin, /「認証画面に移動しています…」のままになる場合: 「キャンセル」で一度閉じ、もう一度「サインイン」を押してください/)
	assert.match(
		troubleLogin,
		/以前からパスワードでお使いの方: 「サインイン」から同じメールアドレスで確認コードを入力すると、今までと同じアカウントでサインインできます/,
	)
	assert.doesNotMatch(troubleLogin, /パスワードを忘れた場合/)
})

// ── 法人の参加手順 ───────────────────────────────────────────────────────────

test('組織コードで参加する: 入口は「組織コードをお持ちの方（法人）」、注意書きはアプリと同じ文', () => {
	const join = textOf(afterHeading(teamSection, '組織コードで参加する') ?? '')
	assert.ok(join, '「組織コードで参加する」の節が無い')
	assert.ok(
		join.includes(`サインイン画面の「${ENTERPRISE_LABEL}」を押し、「組織コード」欄にそのコードを入力してから「サインイン」を押します`),
		`入口の名前が違う: ${join}`,
	)
	assert.ok(join.includes(ORG_CODE_SHARE_WARNING), '組織コードの注意書きが wording.ts の ORG_CODE_SHARE_WARNING と違う')
	assert.doesNotMatch(textOf(team), /社外に転送/, '旧い注意書きが残っている')
})

test('案内メールのリンクから参加する: リンク →「アプリで開く」→ 法人サインインの画面 → サインイン、管理者はコードを入れない', () => {
	const link = textOf(afterHeading(teamSection, '案内メールのリンクから参加する') ?? '')
	assert.ok(link, '「案内メールのリンクから参加する」の節が無い')
	assert.match(link, /2\.13 から/)
	const steps = [
		`「${OPEN_APP_LABEL}」を押します`,
		`「${ENTERPRISE_FACE_TITLE}」の画面に組織コードが入った状態で開きます`,
		`「${SIGN_IN_LABEL}」を押してサインインすると、組織に参加します`,
	]
	const at = steps.map((s) => link.indexOf(s))
	assert.ok(at.every((i) => i >= 0), `手順が欠けている: ${at}`)
	assert.deepEqual([...at].sort((a, b) => a - b), at, '手順の順が違う')
	assert.match(link, /管理者の方は組織コードを入力しません/)
	assert.match(link, /案内を受け取ったメールアドレスでサインイン/)
	// /join/ (T-2090) の画面と同じ語を使う
	assert.ok(joinPage.includes(`>${OPEN_APP_LABEL}</a>`), '陽性対照: /join/ に「アプリで開く」が無い')
	assert.ok(joinPage.includes(`「${ENTERPRISE_LABEL}」`), '陽性対照: /join/ に入口の名前が無い')
	assert.ok(joinPage.includes(`「${ENTERPRISE_FACE_TITLE}」`), '陽性対照: /join/ に法人の面の題名が無い')
	assert.ok(link.includes('「Deepmosaic を開く」'), '/join/ のページ名が無い')
	assert.ok(joinPage.includes('<h1') && joinPage.includes('Deepmosaic を開く</h1>'), '陽性対照: /join/ の見出しが違う')
})

test('導入の流れ: 管理者は組織コードを入力せず、他のメンバーは「組織コードをお持ちの方（法人）」から', () => {
	const flow = textOf(afterHeading(teamSection, '導入の流れ（お見積り・お支払い）') ?? '')
	assert.ok(flow)
	assert.match(flow, /管理者として参加します（管理者は組織コードを入力しません）/)
	assert.ok(flow.includes(`サインイン画面の「${ENTERPRISE_LABEL}」を押し、「組織コード」欄に`))
})

// ── Web 版 ───────────────────────────────────────────────────────────────────

test('Web 版の始め方と組織コードでの参加が LoginGate の文言と同じ', () => {
	const start = textOf(sectionOf(web, 'start') ?? '')
	assert.ok(start.includes(`「${SIGN_IN_LABEL}」を押し、メールに届く 6 桁の確認コード`), `始め方: ${start}`)
	assert.ok(
		start.includes('以前からパスワードでお使いの方も、同じメールアドレスで確認コードを入力すれば今までと同じアカウントでサインインできます'),
		`始め方: ${start}`,
	)
	assert.ok(start.includes(`「${SIGN_IN_LABEL}」と「${ENTERPRISE_LABEL}」の 2 つ`), `始め方: ${start}`)
	assert.doesNotMatch(start, /「ログイン」を押します/)
	const org = kvValue(sectionOf(web, 'team') ?? '', '組織コードでの参加')
	assert.ok(org)
	assert.ok(
		org.includes(`サインイン画面の「${ENTERPRISE_LABEL}」を押し、「組織コード」欄にコードを入力してから「サインイン」を押します`),
		`組織コードでの参加: ${org}`,
	)
	assert.ok(!org.includes('パスワード'), `組織コードでの参加でパスワードへ案内している: ${org}`)
	assert.ok(!textOf(web).includes(REMOVED_WEB_ORG_LOGIN_LABEL), `Web 版の docs に「${REMOVED_WEB_ORG_LOGIN_LABEL}」が残っている`)
})

test('ボタンの入れ替わりの説明が残っていない (2.13 の画面は前回の方式でボタンを入れ替えない)', () => {
	assert.ok(docsFiles.length >= 8, `陽性対照: docs の章が読めていない: ${docsFiles}`)
	for (const file of docsFiles) {
		assert.doesNotMatch(textOf(read(file)), /大きいボタンが/, `${file} にボタンの入れ替わりの説明が残っている`)
	}
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
