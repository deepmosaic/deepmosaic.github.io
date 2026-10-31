// T-1572 (2026-10-28) プライバシーポリシー 10 項の改定を固定する仕様テスト。
//
//   node --test src/lib/site-copy-t1572.test.js
//
//   - ログインした状態で使った端末は、その端末を最後に使ったアカウントの識別子を端末の記録にあわせて保存する
//     (= アカウントと結び付く)。ログインしていない利用は結び付けない。
//   - 目的は無料枠の管理と、問い合わせ等に応じた利用時間の訂正 (初期化を含む) の対象の確認。目的外に使わない。
//   - 退会すると結び付けは消え、端末の記録 (端末識別子と利用時間) は残る。
//   - 3-1 の事前同意の例外 (利用開始時の同意で収集) の整理は維持する。
//   - 最終更新日は 2026-10-28、版 (`_data/legal.yml`) は 2026-10-12 のまま (再同意は求めない)。
//   - 送信内容の一覧 / docs の「端末や個人は特定できません」がログイン時の結び付けと矛盾しないこと。
//   - 内部の仕組みの固有名を公開面に書かない。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
const stripComments = (source) =>
	source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** YAML の `#` コメント行を落とす。 */
const stripYamlComments = (yml) => yml.replace(/^\s*#.*$/gm, '')

/** プライバシーポリシー 10 項の本文 (見出しから 11 項の見出しの手前まで)。 */
function section10() {
	const html = stripComments(read('company/privacy.html'))
	const start = html.indexOf('10.無料枠の管理')
	const end = html.indexOf('11.サンプルの動画', start)
	assert.ok(start >= 0 && end > start, '10 項が見つからない')
	return textOf(html.slice(start, end))
}

test('section10 は 10 項だけを切り出す (他の項の文で検査がすり抜けないこと)', () => {
	const s10 = section10()
	assert.match(s10, /^10\.無料枠の管理/)
	assert.doesNotMatch(s10, /ダウンロード経路|サンプルの動画/)
})

test('10 項: ログインした状態での利用では、端末を最後に使ったアカウントの識別子を記録にあわせて保存し結び付ける', () => {
	const s10 = section10()
	assert.match(
		s10,
		/ログインした状態で本ソフトウェアをご利用になった場合、当社は、その端末を最後に使用したアカウントの識別子及びその使用の日時を、端末識別子の記録にあわせて保存します。/
	)
	assert.match(s10, /端末の記録は、その端末を最後に使用したアカウントと結び付きます。/)
})

test('10 項: ログインしていない利用はアカウントと結び付けない', () => {
	assert.match(section10(), /ログインしていない状態でのご利用については、アカウントとの結び付けは行いません。/)
})

test('10 項: 退会すると結び付けは消去し、端末の記録は残る', () => {
	const s10 = section10()
	assert.match(
		s10,
		/アカウントを削除（退会）した場合、当社は端末の記録とそのアカウントとの結び付けを消去しますが、端末の記録（端末識別子及び利用時間）は退会後も保持されます。/
	)
	// 旧文の「アカウントには紐づけず」は新しい仕様と矛盾するので残さない
	assert.doesNotMatch(s10, /アカウントには紐づけず/)
})

test('10 項: 目的は無料枠の管理と利用時間の訂正への対応で、それ以外に用いず第三者に提供しない', () => {
	const s10 = section10()
	// T-1656 で「及び利用開始からの日数」を足した (無料期間 7 日)
	assert.match(s10, /無料枠の管理（端末ごと・アカウントごとの利用時間の累計(及び利用開始からの日数)?の計算）/)
	assert.match(s10, /お問い合わせ等に応じて当社が無料枠の利用時間を訂正（初期化を含みます。）する場合/)
	assert.match(s10, /端末識別子及びアカウントとの結び付けは、これらの目的にのみ用い、これらの情報の第三者への提供は行いません。/)
})

test('10 項: 端末識別子「そのもの」からは特定できないと書き、無条件の「識別子から特定できない」は残さない', () => {
	const s10 = section10()
	assert.match(s10, /識別子の元の値は当社サーバーへ送信せず、端末識別子そのものから端末や個人を特定することはできません。/)
	assert.doesNotMatch(s10, /。識別子から端末や個人を特定することはできません/)
})

test('10 項: 3-1 の事前同意の例外と、開示・訂正等の窓口の案内を維持する', () => {
	const s10 = section10()
	assert.match(s10, /3-1の同意取得の対象とせず、アプリケーションの利用開始時の利用規約および本ポリシーへの同意をもって収集し/)
	assert.match(s10, /6項および7項に定めるところに従い、下記の問い合わせ窓口にて承ります。/)
	assert.match(textOf(read('company/privacy.html')), /ただし、10項に定めるものを除きます/)
})

test('最終更新日は 2026-10-28 以降、版は 2026-10-12 のまま (再同意を求めない)', () => {
	// T-1656 (2026-10-31) で最終更新日だけ進めた。日付の固定は site-copy-t1656.test.js が持つ
	const date = read('company/privacy.html').match(/最終更新日: (\d{4}-\d{2}-\d{2})（制定: 2019-06-01）/)
	assert.ok(date, '最終更新日が無い')
	assert.ok(date[1] >= '2026-10-28', `最終更新日が古い: ${date[1]}`)
	assert.match(stripYamlComments(read('_data/legal.yml')), /version:\s*"?2026-10-12"?/)
})

test('docs / 送信内容の一覧: 退会で結び付けが消えること、ログイン中は結び付けることを書く (10 項と一致)', () => {
	const account = textOf(read('_includes/docs/02-account.html'))
	const ops = textOf(read('_includes/docs/06-ops.html'))
	const disclosure = stripYamlComments(read('_data/disclosure.yml'))

	assert.match(account, /端末とアカウントの結び付けは消え、端末の記録だけが退会後も残ります/)
	assert.doesNotMatch(account, /アカウントには紐づかず/)
	assert.match(ops, /識別子からは端末や個人を特定できません。ログイン中はアカウントと結び付けます/)
	assert.match(disclosure, /識別子からは端末や個人を特定できません（ログイン中はアカウントと結び付けます）/)
	assert.doesNotMatch(disclosure, /note: "無料枠の管理のため。端末や個人は特定できません"/)
})

test('公開面に内部の仕組みの固有名を書かない', () => {
	const files = [
		'company/privacy.html',
		'_includes/docs/02-account.html',
		'_includes/docs/06-ops.html',
		'_data/disclosure.yml',
	]
	for (const rel of files) {
		const raw = read(rel)
		const text = rel.endsWith('.yml') ? stripYamlComments(raw) : textOf(raw)
		assert.doesNotMatch(text, /Supabase|device_usage|auth_sub|device_key|sha256|PostgREST/i, rel)
	}
})
