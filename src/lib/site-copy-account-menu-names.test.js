// 日本語のページのアカウントメニューの項目の名前がアプリと同じであることの回帰テスト。
//
//   node --test src/lib/site-copy-account-menu-names.test.js
//
//   - アプリ (デスクトップ版 / Web 版) のアカウントメニューに「プラン管理」という項目は無い。実際の項目は
//     プランの項目 account_login.menu_plan_label = 「プランの契約と管理」(無料プランのときはプランを選ぶ画面、
//     有料プランのときは決済ポータルを開く。デスクトップ版と Web 版で同じ名前)、
//     Enterprise の組織に参加しているとき account_login.menu_team_label = 「組織」
//     (アプリの ja の文。ここでは定数で持つ)。
//   - 英語・繁体字のページもアプリの名前に揃える。
//   - 直すのは項目の名前だけ。文の意味・手順・特定商取引法に基づく表記の解約の方法は変えない。
//   - 日本語のページ・データで「」に入れたプランの画面の文は、アプリにある名前と文だけ (許可の一覧)。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** アプリの辞書の ja の値 (account_login.*)。 */
const MENU_PLAN = 'プランの契約と管理'
const MENU_TEAM = '組織'
/** アプリに無い項目の名前。 */
const NOT_A_MENU_ITEM = 'プラン管理'

/**
 * 日本語のページ・データで「」に入れてよい、プラン・解約の語を含む画面の文 (許可の一覧)。
 * メニューの項目の名前・ボタン・通知・案内の文で、どれもアプリの ja の文と同じ。
 */
const PLAN_QUOTES_ALLOWED = new Set([
	MENU_PLAN,
	'このプランにする',
	'プランを 〇〇 に変更しました',
	'プランの有効期限が切れました',
	'画面下の残り時間からプランを確認できます。',
	'残り … · プランを見る',
	'有効なプランの契約が残っています',
])

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^\s*#.*$/gm, '')
}
const textOf = (src) => stripComments(src).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** 「」に入れた語のうち、プラン・解約・本数を含むもの。 */
const planQuotesOf = (text) => [...text.matchAll(/「([^「」]*)」/g)].map((m) => m[1]).filter((q) => /プラン|解約|本数/.test(q))

/** 日本語のページ・データのうち、アカウントメニューの項目を引用する所。 */
const JA_SOURCES = [
	'_data/subscribe.yml',
	'company/asct.html',
	'_includes/docs/01-intro.html',
	'_includes/docs/02-account.html',
	'_includes/docs/07-team.html',
]

test('日本語のページ・データに「プラン管理」をメニューの項目として書いた文が残っていない', () => {
	for (const rel of JA_SOURCES) {
		assert.doesNotMatch(textOf(read(rel)), new RegExp(`「${NOT_A_MENU_ITEM}」|${NOT_A_MENU_ITEM}（`), rel)
	}
})

test('申し込みページの FAQ (変更・解約の場所) はプランの項目の名前を Web 版とアプリの 2 か所で使う', () => {
	const faq = read('_data/subscribe.yml')
	const answer = faq.split(/\r?\n/).find((l) => l.includes('お支払い方法の変更も同じ画面です'))
	assert.ok(answer, 'FAQ「プランの変更や解約はどこで行いますか？」の答えが無い')
	assert.equal(answer.split(`「${MENU_PLAN}」`).length - 1, 2, answer)
})

test('特定商取引法に基づく表記の解約の方法はプランの項目の名前を使い、手続きの内容は変わらない', () => {
	const text = textOf(read('company/asct.html'))
	assert.match(text, new RegExp(`アプリのプロフィールメニューの「${MENU_PLAN}」から開く決済ポータルで解約できます`))
	assert.match(text, /お支払い済みの契約期間の末日までは有料プランをご利用いただけ、以後の請求は停止します/)
	assert.match(text, /途中解約による返金は承っておりません/)
})

test('docs のプロフィールメニューの説明はプランの項目の名前 (無料・有料で共通) を使う', () => {
	const intro = textOf(read('_includes/docs/01-intro.html'))
	assert.match(intro, new RegExp(`${MENU_PLAN}（無料プランのときはプランを選ぶ画面、有料プランのときは決済ポータルが開きます）`))

	const account = textOf(read('_includes/docs/02-account.html'))
	assert.match(account, new RegExp(`「${MENU_PLAN}」を選ぶと、無料プランのときはプランを選ぶ画面が開き、有料プランのときはブラウザで決済ポータルが開きます`))
	assert.match(account, new RegExp(`Web 版の画面右上のプロフィールメニューの「${MENU_PLAN}」からも行えます`))
	assert.match(account, new RegExp(`先に「${MENU_PLAN}」から解約してください`))

	const team = textOf(read('_includes/docs/07-team.html'))
	assert.match(team, new RegExp(`「${MENU_PLAN}」が表示される位置に「${MENU_TEAM}」が表示されます`))
})

test('日本語のページ・データで「」に入れたプラン・解約の語は、許可の一覧の名前と文だけ', () => {
	// 陽性対照と陰性対照: 一覧に無い名前は拾い、プランを含まない語は数えない
	assert.deepEqual(planQuotesOf('「ヘルプ」「プランを変える」「解約する」'), ['プランを変える', '解約する'])
	assert.deepEqual(planQuotesOf('「組織」を選ぶ'), [])
	const seen = new Set()
	for (const rel of JA_SOURCES) {
		for (const q of planQuotesOf(textOf(read(rel)))) {
			seen.add(q)
			assert.ok(PLAN_QUOTES_ALLOWED.has(q), `${rel}: 「${q}」はアプリのプランの画面の名前・文の一覧に無い`)
		}
	}
	assert.ok(seen.has(MENU_PLAN), `陽性対照: 「${MENU_PLAN}」がどこにも無い`)
})
