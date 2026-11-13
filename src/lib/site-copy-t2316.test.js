// T-2316 (backlog1113) 日本語のページが、アプリのアカウントメニューの項目を「プラン管理」と書いていた。
//
//   node --test src/lib/site-copy-t2316.test.js
//
//   - アプリ (desktop / Web 版) のアカウントメニューに「プラン管理」という項目は無い。実際の項目は
//     有料プランのとき account_login.menu_portal_label = 「プラン・本数の変更 / 解約」、
//     無料プランのとき account_login.menu_change_plan_label = 「プランを変更する」、
//     Enterprise の組織に参加しているとき account_login.menu_team_label = 「組織」
//     (desktop `src/lib/i18n/messages/account_login.ts` の ja の値。ここでは定数で持つ)。
//   - 英語・繁体字のページは T-2232 (5001542) でアプリの名前に揃え済み。ja だけが食い違っていた。
//   - 直すのは項目の名前だけ。文の意味・手順・特定商取引法に基づく表記の解約の方法は変えない。
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
const MENU_PORTAL = 'プラン・本数の変更 / 解約'
const MENU_CHANGE_PLAN = 'プランを変更する'
const MENU_TEAM = '組織'
/** アプリに無い項目の名前。 */
const NOT_A_MENU_ITEM = 'プラン管理'

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^\s*#.*$/gm, '')
}
const textOf = (src) => stripComments(src).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

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

test('申し込みページの FAQ (変更・解約の場所) は有料プランの項目の名前を Web 版とアプリの 2 か所で使う', () => {
	const faq = read('_data/subscribe.yml')
	const answer = faq.split(/\r?\n/).find((l) => l.includes('お支払い方法の変更も同じ画面です'))
	assert.ok(answer, 'FAQ「プランの変更や解約はどこで行いますか？」の答えが無い')
	assert.equal(answer.split(`「${MENU_PORTAL}」`).length - 1, 2, answer)
})

test('特定商取引法に基づく表記の解約の方法は有料プランの項目の名前を使い、手続きの内容は変わらない', () => {
	const text = textOf(read('company/asct.html'))
	assert.match(text, new RegExp(`アプリのプロフィールメニューの「${MENU_PORTAL}」から開く決済ポータルで解約できます`))
	assert.match(text, /お支払い済みの契約期間の末日までは有料プランをご利用いただけ、以後の請求は停止します/)
	assert.match(text, /途中解約による返金は承っておりません/)
})

test('docs のプロフィールメニューの説明は無料・有料それぞれの実際の項目の名前を使う', () => {
	const intro = textOf(read('_includes/docs/01-intro.html'))
	assert.match(intro, new RegExp(`${MENU_CHANGE_PLAN}（無料プランのとき）または ${MENU_PORTAL}（有料プランのとき）`))

	const account = textOf(read('_includes/docs/02-account.html'))
	assert.match(account, new RegExp(`無料プランのときは「${MENU_CHANGE_PLAN}」でプランを選ぶ画面が開きます。有料プランのときは「${MENU_PORTAL}」を選ぶと`))
	assert.match(account, new RegExp(`Web 版の画面右上のプロフィールメニューの「${MENU_PORTAL}」からも行えます`))
	assert.match(account, new RegExp(`先に「${MENU_PORTAL}」から解約してください`))

	const team = textOf(read('_includes/docs/07-team.html'))
	assert.match(team, new RegExp(`「${MENU_CHANGE_PLAN}」（Free）または「${MENU_PORTAL}」（Light / Pro）が表示される位置に「${MENU_TEAM}」が表示されます`))
})
