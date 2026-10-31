// T-1656 (2026-10-31) の公開面の文言を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1656.test.js
//
//   - Free プランに無料期間 (初めて起動した日から 7 日間) が付いた (req1031、desktop / web / SQL は
//     T-1639〜T-1655)。料金ページ・FAQ・docs・llms・トップ・CTA・送信内容の一覧・プライバシーポリシー
//     10 項に「7 日間」と「累計の上限と日数のどちらか早い方で終わる」旨を載せる。
//   - 日数の出所は `_data/plans.yml` の `free_window_days` (Supabase `plan_catalog.free_window_days` が正)。
//     Liquid で引けるところは引き、直書きは plans.yml の bullets・FAQ・料金ページの front matter だけ。
//   - 料金ページの description に残っていた古い「累計 5 時間」を消す。
//   - 利用規約・EULA・legal.yml は変えない (再同意を出さない、ユーザー決定)。
//     プライバシーポリシーは版を据え置き、最終更新日だけ進める。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t964.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadTiers } from './plans-yml.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Windows の作業ツリー (core.autocrlf=true) では CRLF になる。パーサーは `\n` 前提なので改行をそろえる
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** YAML の `#` コメント行を落とす (公開されない文字列は検査対象外)。 */
const stripYamlComments = (yml) => yml.replace(/^\s*#.*$/gm, '')

/** `_data/faq.yml` の q / a を素朴に読む (`- q: "..."` と `  a: "..."` の 1 行形式だけ)。 */
function faqItems() {
	const lines = stripYamlComments(read('_data/faq.yml')).split('\n')
	const items = []
	for (const line of lines) {
		const q = line.match(/^- q: "(.*)"$/)
		if (q) {
			items.push({ q: q[1], a: '' })
			continue
		}
		const a = line.match(/^ {2}a: "(.*)"$/)
		if (a && items.length > 0) items[items.length - 1].a = a[1]
	}
	return items
}

/** Liquid の日数の差し込み (`{{ free_plan.free_window_days }}` など、変数名は問わない)。 */
const WINDOW_TAG = /\{\{\s*\w+\.free_window_days\s*\}\}/

const freeTier = () => {
	const tier = loadTiers().find((t) => t.code === 'free')
	assert.ok(tier, 'plans.yml に free が無い')
	return tier
}

test('plans.yml: Free に free_window_days: 7 を持ち、累計 2 時間・cumulative は維持する', () => {
	const tier = freeTier()
	assert.equal(tier.free_window_days, 7)
	assert.equal(tier.included_hours, 2)
	assert.equal(tier.included_basis, 'cumulative')
})

test('plans.yml: Free の箇条書きに 7 日間と「どちらか早い方」と終了後の挙動を書く', () => {
	// plans-yml.js は文字列の配列を読まないので、t964 と同じく素の YAML を見る
	const yml = stripYamlComments(read('_data/plans.yml'))
	const expected = [
		'初めて起動した日から 7 日間、累計 2 時間分の動画インポートが無料（登録なしは 30 分）',
		'7 日間か累計 2 時間のどちらか早い方で無料期間は終わります',
		'1 台の PC では合計 2 時間まで（アカウントを作り直しても同じ）',
		'クレジットカードの登録は不要',
		'無料期間の終了後も、既存プロジェクトの編集・書き出しは続けてご利用いただけます',
	]
	for (const bullet of expected) {
		assert.ok(yml.includes(`      - "${bullet}"\n`), `箇条書きが無い: ${bullet}`)
	}
	assert.doesNotMatch(yml, /無料分の終了後も既存プロジェクト/)
})

test('FAQ: 「無料で使えますか？」に 7 日間・どちらか早い方・終了後も編集と書き出しができる旨を書く', () => {
	const item = faqItems().find((i) => i.q === '無料で使えますか？')
	assert.ok(item, '無料の FAQ が無い')
	assert.match(item.a, /初めて起動した日から 7 日間、累計 2 時間分までの動画インポートを無料でご利用いただけます/)
	assert.match(item.a, /7 日間か累計の上限のどちらか早い方で無料期間は終わります/)
	assert.match(item.a, /同じ PC では合計 2 時間まで/)
	assert.match(item.a, /無料期間が終了した後も、既存プロジェクトの編集と書き出しは続けてご利用いただけます/)
	// 無料期間ができたので「無料トライアル期間は設けていない」は矛盾する
	assert.doesNotMatch(item.a, /無料トライアル期間は設けていません/)
})

test('docs 02-account: 無料の節に日数 (plans.yml から差し込み) と「どちらか早い方」を書く', () => {
	const text = textOf(read('_includes/docs/02-account.html'))
	assert.match(text, /無料でご利用いただけるのは、初めて起動した日から \{\{ free_plan\.free_window_days \}\} 日間です。/)
	assert.match(text, /\{\{ free_plan\.free_window_days \}\} 日間か累計の上限のどちらか早い方で無料期間は終わります。/)
	assert.match(text, /無料: 初回起動から \{\{ free_plan\.free_window_days \}\} 日間・累計\{\{ free_plan\.included_hours \}\}時間分までの動画インポート/)
	assert.doesNotMatch(text, /無料トライアル期間は設けていません/)
})

test('docs 02-account: 上限到達に無料期間の終了を含め、残り日数の表示を書く', () => {
	const text = textOf(read('_includes/docs/02-account.html'))
	assert.match(text, /累計の上限に達したとき、または無料期間が終わったときは、検出を開始しようとするとプランの変更（未ログインの場合はログイン）を促すダイアログが表示されます。進行中の検出やエンコードは止まりません/)
	assert.match(text, /無料期間の表示 画面下の残り時間に、無料期間の残り日数も表示されます/)
})

test('docs 01-intro / 03-detect / 06-ops / web: 無料期間に触れる', () => {
	assert.match(textOf(read('_includes/docs/01-intro.html')), /無料プランでは残り日数も併記されます/)
	assert.match(textOf(read('_includes/docs/03-detect.html')), /ライセンスの期限切れ、使用量の上限超過、または無料期間の終了があると/)
	const ops = textOf(read('_includes/docs/06-ops.html'))
	assert.match(ops, /無料期間: 無料プランは、新しい版を初めて起動した日から \{\{ free_plan\.free_window_days \}\} 日間ご利用いただけます。累計の上限と日数のどちらか早い方で終わります/)
	assert.match(read('_includes/docs/06-ops.html'), /assign free_plan = site\.data\.plans\.tiers/)
	assert.match(textOf(read('_includes/docs/web.html')), /無料アカウントでは、初回起動から \{\{ free_plan\.free_window_days \}\} 日間・累計 \{\{ free_plan\.included_hours \}\} 時間分の動画を検出でき（Desktop 版と共通の無料期間です）/)
})

test('トップ / CTA / llms.txt: 日数を plans.yml から差し込む', () => {
	assert.match(textOf(read('index.html')), /初回起動から\{\{ free_plan\.free_window_days \}\}日間・\{\{ free_plan\.included_hours \}\}時間分まで無料/)
	assert.match(textOf(read('_includes/cta-download.html')), /初回起動から\{\{ free_plan\.free_window_days \}\}日間、累計\{\{ free_plan\.included_hours \}\}時間分の動画インポートが無料。クレジットカード不要。/)
	const llms = read('llms.txt')
	assert.match(llms, /無料枠（初めて起動した日から \{\{ free\.free_window_days \}\} 日間・累計 \{\{ free\.included_hours \}\} 時間・クレジットカード不要）/)
	assert.match(llms, /Free tier \(\{\{ free\.free_window_days \}\} days from first launch, up to \{\{ free\.included_hours \}\} hours cumulative\)/)
	for (const rel of ['index.html', '_includes/cta-download.html', 'llms.txt']) {
		assert.match(read(rel), WINDOW_TAG, rel)
	}
})

test('料金ページ: description は 7 日間・累計 2 時間で、古い「5 時間」を残さない', () => {
	const price = read('price/index.html')
	assert.match(price, /無料プランは初回起動から7日間・累計2時間分まで、クレジットカード不要。/)
	assert.doesNotMatch(price, /5 ?時間/)
})

test('送信内容の一覧: 無料枠の利用開始日時を載せる', () => {
	const disclosure = stripYamlComments(read('_data/disclosure.yml'))
	assert.match(
		disclosure,
		/- item: "無料枠の利用開始日時"\n\s+note: "無料期間（初めて起動した日からの日数）の管理のため。端末ごと・アカウントごとに記録します"/
	)
})

test('プライバシーポリシー 10 項: 利用開始日時を収集し、日数の計算に用いると書く。最終更新日は 2026-10-31', () => {
	const html = stripComments(read('company/privacy.html'))
	const start = html.indexOf('10.無料枠の管理')
	const end = html.indexOf('11.サンプルの動画', start)
	assert.ok(start >= 0 && end > start, '10 項が見つからない')
	const s10 = textOf(html.slice(start, end))
	assert.match(s10, /利用時間（検出した動画の再生時間の累計）及び無料枠の利用を開始した日時を収集・保存します。/)
	assert.match(s10, /無料枠の管理（端末ごと・アカウントごとの利用時間の累計及び利用開始からの日数の計算）/)
	assert.match(read('company/privacy.html'), /最終更新日: 2026-10-31（制定: 2019-06-01）/)
})

test('利用規約・同意の版は変えない (再同意を出さない)', () => {
	// 利用規約の既存文 (無料枠は累計で管理) がそのまま残っていること
	assert.match(textOf(read('company/terms.html')), /累計で管理し/)
	assert.match(stripYamlComments(read('_data/legal.yml')), /version:\s*"?2026-10-12"?/)
})
