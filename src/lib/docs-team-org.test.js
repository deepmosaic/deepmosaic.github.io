// docs 第 7 章「組織（Enterprise）」の表記・参加経路・権限・請求書タブを desktop の実装に固定する
// 回帰テスト (T-510)。
//
//   node --test src/lib/docs-team-org.test.js
//
// 2026-09-23 の改修要件で desktop / web の表示が次のように変わった (docs は desktop の
// 次回更新 v2.4 を先取りして公開する — 01-intro の先取り注記、T-509):
//
//   - T-484: 表示文字列の「チーム」を「組織」に統一 (「組織の管理」)。docs も同じ語に揃える
//   - T-485: ログイン後のアカウントメニューから「組織コードで参加」を撤去。**参加の入口は
//     ログインダイアログの「組織コード」欄だけ** (ログイン済みならログアウトしてからやり直す)
//   - T-487: 招待と招待メールの再送は**管理者のみ** (メンバーには権限タブに案内が出る)。
//     アプリの権限名は「管理者」「メンバー」(`TeamMembersTab` の select)。「オーナー」は出てこない
//   - T-488: 「請求書」タブを追加し、過去の請求書をすべて一覧 (状態 5 種、「さらに読み込む」、
//     表示 / PDF)。一覧 API は owner のみなので、タブも管理者だけに出る
//
// 組織の機能は配布中の desktop (v2.3.7) に**まだ無い** (TeamWindow も組織コード欄も未収録)。
// T-338 の「対応版アプリの公開後にご利用いただけます（お見積書にも同じご案内…）」は、
// 見積書側の断り書きが T-398 で消えたので、01-intro の先取り注記と同じ版表記に揃える。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は表記の検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<h3>` 見出しが `heading` で始まる節の HTML。見つからなければ null。 */
function subsectionOf(html, heading) {
	const start = html.search(new RegExp(`<h3[^>]*>${heading}`))
	if (start < 0) return null
	const rest = html.slice(start)
	const next = rest.slice(1).search(/<h3[^>]*>/)
	return next < 0 ? rest : rest.slice(0, next + 1)
}

/** `<div class="kv-key">ラベル</div>` に続く `kv-val` の素の文字列。見つからなければ null。 */
function kvValue(html, label) {
	const re = new RegExp(`<div class="kv-key">${label}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`)
	const m = html.match(re)
	return m === null ? null : textOf(m[1])
}

/** 01-intro の先取り注記から「次回の版」と「配布中の版」を取り出す (T-509 が置いた文面)。 */
function prereleaseVersions(introHtml) {
	const next = introHtml.match(/次回のデスクトップ更新 \((v[\d.]+)\)/)
	const current = introHtml.match(/配布中の (v[\d.]+)/)
	return next === null || current === null ? null : { next: next[1], current: current[1] }
}

const rawDoc = read('_includes', 'docs', '07-team.html')
const doc = stripComments(rawDoc)
const docText = textOf(doc)

test('stripComments は Liquid / HTML のコメントだけを落とす', () => {
	// Arrange
	const source = 'A{%- comment -%}チーム{%- endcomment -%}B<!-- チーム -->C{% comment %}x{% endcomment %}D'

	// Act
	const stripped = stripComments(source)

	// Assert
	assert.equal(stripped, 'ABCD')
})

test('subsectionOf / kvValue / prereleaseVersions は見つからなければ null を返す (すり抜け防止)', () => {
	// Arrange / Act / Assert
	assert.equal(subsectionOf(doc, '存在しない見出し'), null)
	assert.equal(kvValue(doc, '存在しないラベル'), null)
	assert.equal(prereleaseVersions('<p>注記なし</p>'), null)
})

// ── T-484 / T-510: 「チーム」→「組織」 ───────────────────────────────────────

test('07-team の表示文字列に「チーム」が無く、「組織の管理」で案内している', () => {
	// Arrange / Act / Assert
	assert.ok(!docText.includes('チーム'), '表示文字列に「チーム」が残っている')
	assert.match(docText, /「組織の管理」/, 'アプリのメニュー名「組織の管理」で案内していない')
})

test('目次 (docs_toc.yml) と llms.txt の見出しも「組織」に揃っている', () => {
	// Arrange
	const toc = read('_data', 'docs_toc.yml')
	const tocBody = toc
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('#'))
		.join('\n')
	const llmsTeam = read('llms.txt')
		.split('\n')
		.find((line) => line.includes('/docs/#team'))

	// Act / Assert
	assert.ok(!tocBody.includes('チーム'), '目次に「チーム」が残っている')
	assert.match(tocBody, /id: team, label: 組織の管理（Enterprise）/)
	assert.ok(llmsTeam, 'llms.txt に /docs/#team の行が無い')
	assert.ok(!llmsTeam.includes('チーム'), `llms.txt の見出しに「チーム」が残っている: ${llmsTeam}`)
})

test('権限の名前はアプリと同じ「管理者」「メンバー」(「オーナー」はアプリに出てこない)', () => {
	// Arrange / Act / Assert
	assert.ok(!docText.includes('オーナー'), 'アプリに無い権限名「オーナー」が残っている')
	assert.ok(kvValue(doc, '管理者'), '権限の表に「管理者」の行が無い')
	assert.ok(kvValue(doc, 'メンバー'), '権限の表に「メンバー」の行が無い')
})

// ── T-485: 参加の入口はログインダイアログの組織コード欄だけ ──────────────────────

test('組織コードでの参加はログインダイアログの「組織コード」欄から (ログイン済みならログアウトしてから)', () => {
	// Arrange
	const join = subsectionOf(doc, '組織コードで参加する')
	assert.ok(join, '「組織コードで参加する」の節が無い')

	// Act
	const text = textOf(join)

	// Assert
	assert.match(text, /ログインダイアログ/, `参加の入口が書かれていない: ${text}`)
	assert.match(text, /「組織コード」欄/, `入力欄の名前が書かれていない: ${text}`)
	assert.match(text, /ログアウト/, `ログイン済みのときのやり直し方が書かれていない: ${text}`)
})

test('撤去したアカウントメニューの「組織コードで参加」を案内していない (T-485)', () => {
	// Arrange / Act / Assert
	assert.ok(!docText.includes('「組織コードで参加」'), '撤去済みのメニュー項目名が残っている')
	assert.doesNotMatch(docText, /(アカウント|プロフィール)メニューの?「組織コード/, 'メニューからの参加を案内している')
})

// ── T-487: 招待は管理者のみ ──────────────────────────────────────────────────

test('招待と招待メールの再送は管理者だけができると書いてある', () => {
	// Arrange
	const invite = subsectionOf(doc, 'メンバーを招待する')
	assert.ok(invite, '「メンバーを招待する」の節が無い')
	const member = kvValue(doc, 'メンバー')

	// Act
	const text = textOf(invite)

	// Assert
	assert.match(text, /管理者だけ/, `招待が管理者だけの操作だと書かれていない: ${text}`)
	assert.match(text, /再送/, `招待メールの再送に触れていない: ${text}`)
	assert.match(member, /招待/, `メンバーの行で招待できないことに触れていない: ${member}`)
})

// ── T-488: 請求書タブ ────────────────────────────────────────────────────────

test('ダイアログのタブに「請求書」があり、管理者だけに表示されると書いてある', () => {
	// Arrange
	const tabs = docText.match(/管理者には[^。]*の 4 つ/)

	// Act / Assert
	assert.ok(tabs, `管理者に表示されるタブの説明が無い: ${docText.slice(0, 400)}`)
	assert.match(tabs[0], /権限[\s\S]*請求[\s\S]*請求書[\s\S]*利用量/, `タブの並びが違う: ${tabs[0]}`)
})

test('「請求書」の節に一覧の列・状態 5 種・さらに読み込む・表示 / PDF がある', () => {
	// Arrange
	const invoices = subsectionOf(doc, '請求書')
	assert.ok(invoices, '「請求書」の節が無い')
	const text = textOf(invoices)
	const statuses = ['下書き', '未払い', '支払済み', '無効', '回収不能']

	// Act
	const missing = statuses.filter((s) => !text.includes(`「${s}」`))

	// Assert
	assert.match(text, /管理者だけ/, `管理者だけのタブだと書かれていない: ${text}`)
	for (const column of ['請求日', '請求書番号', '期間', '金額', '状態']) {
		assert.ok(text.includes(column), `列「${column}」の説明が無い`)
	}
	assert.deepEqual(missing, [], `状態の表記が足りない: ${missing.join(' / ')}`)
	assert.match(text, /「さらに読み込む」/, `古い請求書の読み込み方が書かれていない: ${text}`)
	assert.match(text, /「表示」/, `ブラウザで開く操作が書かれていない: ${text}`)
	assert.match(text, /「PDF」/, `PDF の操作が書かれていない: ${text}`)
})

test('請求書の一覧を「請求」タブの中にあるように書いていない (T-488 で別タブに移った)', () => {
	// Arrange / Act / Assert
	assert.ok(!docText.includes('「請求」の請求書一覧'), '請求書の一覧が「請求」タブにあるように読める')
})

// ── 先取り注記との整合 (T-509 / T-510) ───────────────────────────────────────

test('組織の機能は次回のデスクトップ更新からだと、01-intro の先取り注記と同じ版で断ってある', () => {
	// Arrange
	const versions = prereleaseVersions(read('_includes', 'docs', '01-intro.html'))
	assert.ok(versions, '01-intro の先取り注記から版を取り出せない (T-509 の文面が変わった?)')
	const caveat = [...doc.matchAll(/<p>([\s\S]*?)<\/p>/g)]
		.map((m) => textOf(m[1]))
		.find((p) => p.includes(`次回のデスクトップ更新 (${versions.next})`))

	// Act / Assert
	assert.ok(caveat, `07-team に「次回のデスクトップ更新 (${versions.next})」の断り書きが無い`)
	assert.match(caveat, new RegExp(`配布中の ${versions.current.replace(/\./g, '\\.')}`), caveat)
	assert.match(caveat, /組織コード/, `組織コードでの参加に触れていない: ${caveat}`)
})

test('「対応版アプリの公開後」の旧い断り書きが残っていない (先取り注記に統一)', () => {
	// Arrange / Act / Assert
	assert.ok(!docText.includes('対応版アプリの公開後'), '版を示さない旧い断り書きが残っている')
	assert.ok(!docText.includes('対応版から'), '版を示さない旧い断り書きが残っている')
})
