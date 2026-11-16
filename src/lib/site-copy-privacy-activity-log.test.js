// プライバシーポリシー 12・13・15 項とクッキーポリシー・通信内容の開示の回帰テスト。
//
//   node --test src/lib/site-copy-privacy-activity-log.test.js
//
//   - 12 項: 画面の移動と操作を固定の名前で記録する、利用中は継続して送信する、仮名の識別子、国コード、
//     当社が管理する端末での保管。動作記録に含めないもの (映像・ファイル名・パス・メールアドレス・プロジェクト名)。
//   - 13 項: 12 項と同じ仕組みで当社のサーバーへ送る。異常終了のときは部品の一覧とメモリの使用量も送る。
//     メモリの内容の写しは端末にのみ保存し送らない。以前のバージョンについての 1 文。
//   - 15 項: データベース・配信・実行基盤の用途と、表の後の当社が管理する端末の文。
//   - クッキー: 動作記録のクッキー (__Secure-dm_anon) の行と、タブごとの一時的な識別子 (セッションストレージ)。
//   - 通信内容の開示 (ja / en / zh-tw) の動作記録の行。
//   - 版 (legal.yml) と最終更新日 (privacy / cookie / asct)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-privacy-policy.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findNames, nameHash, LOG_SERVICE_NAMES } from './name-guard.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** YAML の `#` コメント行を落とす。 */
const stripYamlComments = (yml) => yml.replace(/^\s*#.*$/gm, '')

/** 本文の「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?([^\s（(]+)/)
	return m ? m[1] : null
}

/** `<h2 …>n.` から次の `<h2` までの生 HTML (コメント除去後)。無ければ null。 */
function rawSectionOf(html, n) {
	const src = stripComments(html)
	const start = src.search(new RegExp(`<h2[^>]*>${n}\\.`))
	if (start < 0) return null
	const next = src.indexOf('<h2', start + 1)
	return next < 0 ? src.slice(start) : src.slice(start, next)
}

/** `<h2 …>n.` から次の h2 までの素の文字列。無ければ null。 */
function sectionOf(html, n) {
	const raw = rawSectionOf(html, n)
	return raw === null ? null : textOf(raw)
}

/** 最初の `<tbody>` の行ごとのセルの素の文字列。表が無ければ null。 */
function tableRows(html) {
	const body = stripComments(html).match(/<tbody>([\s\S]*?)<\/tbody>/)
	if (!body) return null
	return [...body[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
		[...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => textOf(c[1]).trim()),
	)
}

/** YAML の `network.<key>` の配下の `- item:` の値の配列 (コメントを除く)。 */
function networkItems(yml, key) {
	const src = stripYamlComments(yml)
	const block = src.split(/^network:\s*$/m)[1]
	assert.ok(block, 'network: が無い')
	const part = block.split(new RegExp(`^  ${key}:\\s*$`, 'm'))[1]
	assert.ok(part, `network.${key} が無い`)
	const end = part.search(/^  [a-z_]+:\s*$|^[a-z_]+:/m)
	const body = end < 0 ? part : part.slice(0, end)
	return [...body.matchAll(/^    - item: "([^"]*)"/gm)].map((m) => m[1])
}

/** YAML の `- item:` の行と、続く `note:` の行 (あれば) を組で返す。 */
function networkRows(yml, key) {
	const src = stripYamlComments(yml)
	const block = src.split(/^network:\s*$/m)[1]
	const part = block.split(new RegExp(`^  ${key}:\\s*$`, 'm'))[1]
	const end = part.search(/^  [a-z_]+:\s*$|^[a-z_]+:/m)
	const body = end < 0 ? part : part.slice(0, end)
	return [...body.matchAll(/^    - item: "([^"]*)"(?:\s*\n\s+note: "([^"]*)")?/gm)].map((m) => ({
		item: m[1],
		note: m[2] ?? null,
	}))
}

const PRIVACY = 'company/privacy.html'
const COOKIE = 'company/cookie.html'
const LEGAL_PAGES = ['terms', 'privacy', 'cookie', 'eula', 'asct', 'about'].map((s) => `company/${s}.html`)
const DOC_PARTS = ['_includes/docs/06-ops.html', '_includes/docs/web.html']
/** 本文に書かない保存先・サービスの名前 (一覧は name-guard.js)。当たった語の配列を返す。 */
const internalNames = (text) => findNames(text, LOG_SERVICE_NAMES)

const privacy = () => read(PRIVACY)

// ── 12 項 ────────────────────────────────────────────────────────────

test('12 項: 画面の移動と操作を固定の名前で記録し、利用中は継続して送信し、仮名の識別子・国コード・当社が管理する端末を書く', () => {
	// Act
	const s = sectionOf(privacy(), 12)

	// Assert
	assert.ok(s, '12 項が無い')
	assert.match(s, /画面の移動[^。]*操作[^。]*固定の名前/)
	assert.ok(s.includes('画面に表示された文字及び入力欄に入力された文字は記録しません。'), '表示・入力の文字の文が無い')
	assert.ok(s.includes('アカウントから仮名の識別子を算出して動作記録を参照することがあります。'), '仮名の識別子を算出して参照する文が無い')
	assert.match(s, /動作記録は、本ソフトウェアをご利用いただく間、継続して送信されます。/)
	assert.match(s, /仮名の識別子/)
	assert.match(s, /個人情報として取り扱/)
	assert.match(s, /国コード[^。]*IPアドレス[^。]*保存しません/)
	assert.match(s, /当社が管理する端末/)
	assert.match(s, /診断用の識別子/)
	assert.match(s, /13項/)
})

test('12 項: 動作記録に含めないものに映像・音声・フレーム画像・ファイル名・パス・メールアドレス・プロジェクト名がそろう', () => {
	// Arrange
	const s = sectionOf(privacy(), 12)
	const sentence = s.match(/動作記録には、動画の映像[^。]*を含めません。/)

	// Assert
	assert.ok(sentence, '動作記録に含めないものの文が無い')
	for (const word of ['映像', '音声', 'フレーム画像', 'ファイル名', 'パス', 'メールアドレス', 'プロジェクト名']) {
		assert.ok(sentence[0].includes(word), `含めないものに「${word}」が無い: ${sentence[0]}`)
	}
})

test('12 項: 一覧に「画面の移動及び操作の記録」がある', () => {
	assert.match(sectionOf(privacy(), 12), /画面の移動及び操作の記録/)
})

// 12 項: 検出処理のログと保存の段落の文
test('12 項: 検出処理のログは「送信しません」、保存の段落はデータベースと配信・実行基盤に保存し、受信したデータを確認する', () => {
	const s = sectionOf(privacy(), 12)
	assert.match(s, /検出処理のログ（ファイルのパス、ユーザー名、メールアドレス等は送信しません）/)
	assert.ok(
		s.includes(
			'動作記録は、15項に定めるデータベース及び配信・実行基盤（ファイルの保管）に保存するほか、当社が管理する端末に取り込んで分析します。当社は、動作記録を、本サービスの提供、不具合の調査及び改善に必要な期間保存します。また、受信したデータにファイルのパス等が含まれていないことを確認し、確認の前のデータは、短期間のうちに自動的に削除します。',
		),
		'12 項の保存の段落の文が無い',
	)
})

// ── 13 項 ────────────────────────────────────────────────────────────

test('13 項: 見出しは「エラー診断レポート」、12 項と同じ仕組みで送り、ファイル名とパスは送信しない', () => {
	// Arrange
	const heading = stripComments(privacy()).match(/<h2[^>]*>13\.([^<]*)<\/h2>/)
	const s = sectionOf(privacy(), 13)

	// Assert
	assert.ok(heading, '13 項の見出しが無い')
	assert.match(heading[1], /エラー診断レポート/)
	assert.match(s, /12項に定める動作記録と同じ仕組みで当社のサーバーに送信します/)
	assert.match(s, /エラーまたは異常終了が起きたときに、エラーの種類及び内容、発生箇所の記録（スタックトレース）/)
	assert.match(s, /異常終了/)
	assert.match(s, /動画等のファイル名並びにフォルダ及びファイルのパスは送信しません。/)
})

test('docs 06-ops: エラー診断レポートの文は「ファイル名とパスは送信しません」', () => {
	assert.match(textOf(read('_includes/docs/06-ops.html')), /エラー診断レポートを送信します（ファイル名とパスは送信しません）/)
})

const LEGACY_SENTENCE = 'なお、以前のバージョンの本ソフトウェアは、上記の情報を外部のエラー診断サービス（米国）に送信する場合があります。'

test('13 項: 以前のバージョンについての文が 1 文としてあり、外部のエラー診断サービスはその 1 文にだけ出る', () => {
	// Arrange
	const s = sectionOf(privacy(), 13)
	const text = textOf(privacy())

	// Assert
	assert.ok(s.includes(LEGACY_SENTENCE), '13 項に以前のバージョンについての文が無い')
	assert.equal(text.split(LEGACY_SENTENCE).length, 2, '以前のバージョンについての文が 1 回だけではない')
	assert.doesNotMatch(text.replace(LEGACY_SENTENCE, ''), /外部のエラー診断サービス|以前のバージョン/)
	assert.doesNotMatch(sectionOf(privacy(), 12), /外部のエラー診断サービス/)
	assert.doesNotMatch(s.replace(LEGACY_SENTENCE, ''), /米国/)
	// 当社のサーバーへ送る文の後に置く
	assert.ok(s.indexOf('動画等のファイル名') < s.indexOf(LEGACY_SENTENCE), '以前のバージョンについての文が前にある')
})

test('13 項: 異常終了のときに送るものとして、読み込んでいたプログラムの部品の一覧とメモリの使用量が同じ文の中にある', () => {
	const s = sectionOf(privacy(), 13)
	assert.match(s, /異常終了のときは[^。]*読み込んでいたプログラムの部品の一覧[^。]*メモリの使用量[^。]*送信します。/)
})

test('13 項: 異常終了の詳しい記録 (メモリの内容の写し) は端末にのみ保存し送信しない文が、部品の一覧の文の後・ファイル名の文の前にある', () => {
	const s = sectionOf(privacy(), 13)
	const sentence = '異常終了の詳しい記録（メモリの内容の写し）は、お使いの端末にのみ保存し、当社のサーバーへは送信しません。'
	assert.ok(s.includes(sentence), '13 項にメモリの内容の写しの文が無い')
	assert.ok(s.indexOf('メモリの使用量を送信します。') < s.indexOf(sentence), '部品の一覧の文より前にある')
	assert.ok(s.indexOf(sentence) < s.indexOf('動画等のファイル名'), 'ファイル名の文より後にある')
})

// ── 15 項 ────────────────────────────────────────────────────────────

test('15 項: データベース・配信・実行基盤の用途、表の後の当社が管理する端末の文、表は 5 行', () => {
	// Arrange
	const raw = rawSectionOf(privacy(), 15)
	const rows = tableRows(raw)
	const database = rows.find((r) => r[0] === 'データベース')
	const delivery = rows.find((r) => r[0] === '配信・実行基盤')
	const afterTable = textOf(raw.split('</table>')[1])

	// Assert
	assert.equal(rows.length, 5)
	assert.ok(database, 'データベースの行が無い')
	assert.equal(database[1], '利用者情報及び動作記録の保存')
	assert.ok(delivery, '配信・実行基盤の行が無い')
	assert.equal(delivery[1], '配信、アプリケーションのサーバー、ファイルの保管（動作記録の受け付け及び保管を含みます）')
	assert.match(afterTable, /動作記録は、上記のほか、当社が管理する端末に保存し、分析します。/)
})

// ── 企業名・製品名 (失敗系) ───────────────────────────────────────────

test('検査器: コメントの中の語は数えず、本文の語は数える', () => {
	const rule = { words: [nameHash('X9')], parts: [nameHash('Example')] }
	assert.deepEqual(findNames(textOf('<!-- Example と X9 --><p>本文</p>'), rule), [])
	assert.deepEqual(findNames(textOf('<p>動作記録は Example に置きます</p>'), rule), ['Example'])
	assert.deepEqual(findNames(textOf('{% comment %}x{% endcomment %}<p>X9 に置く</p>'), rule), ['X9'])
	assert.deepEqual(findNames(textOf('<p>X90 に置く</p>'), rule), [])
	assert.equal(LOG_SERVICE_NAMES.words.length + LOG_SERVICE_NAMES.parts.length, 4)
})

test('企業名・製品名: 法務 6 頁と docs の 2 部品の本文に書かない', () => {
	// Act
	const hits = [...LEGAL_PAGES, ...DOC_PARTS]
		.map((rel) => [rel, internalNames(textOf(read(rel)))])
		.filter(([, m]) => m.length > 0)
		.map(([rel, m]) => `${rel}: ${m[0]}`)

	// Assert
	assert.deepEqual(hits, [])
})

// ── クッキー ─────────────────────────────────────────────────────────

test('クッキー: 表に動作記録のクッキー (__Secure-dm_anon) の行があり、HttpOnly と最長 400 日を書く', () => {
	// Arrange
	const rows = tableRows(read(COOKIE))
	const anon = rows.find((r) => r[1].includes('__Secure-dm_anon'))

	// Assert
	assert.equal(rows.length, 3)
	assert.ok(anon, '__Secure-dm_anon の行が無い')
	assert.equal(anon[0], '動作記録のクッキー')
	assert.match(anon[1], /読み取れない/)
	assert.match(anon[1], /400\s?日/)
	assert.match(anon[1], /サインインしていない/)
})

test('クッキー: ローカルストレージの段落にタブごとの一時的な識別子 (セッションストレージ) を書き、動画を送らない文がある', () => {
	// Arrange
	const html = stripComments(read(COOKIE))
	const section = html.split(/<h2[^>]*>ブラウザのローカルストレージ<\/h2>/)[1].split(/<h2/)[0]
	const text = textOf(section)

	// Assert
	assert.match(text, /セッションストレージ/)
	assert.match(text, /タブを閉じると消え/)
	assert.match(text, /読み込んだ動画と処理の結果は[^。]*当社のサーバーへは送信しません/)
})

// ── 通信内容の開示 ──────────────────────────────────────────────────

test('開示: ja・en・zh-tw の sent / not_sent の件数が同じ', () => {
	// Arrange
	const ja = read('_data/disclosure.yml')
	const copies = ['_data/l10n/en/disclosure.yml', '_data/l10n/zh-tw/disclosure.yml'].map(read)

	// Assert
	for (const key of ['sent', 'not_sent']) {
		const n = networkItems(ja, key).length
		assert.ok(n > 0, `ja の ${key} が空`)
		for (const c of copies) assert.equal(networkItems(c, key).length, n, key)
	}
	assert.equal(networkItems(ja, 'sent').length, 8)
	assert.equal(networkItems(ja, 'not_sent').length, 5)
})

test('開示: 動作記録の行に操作があり、note に入力した文字・ファイル名・パスを含まない旨と同意時の案内がある', () => {
	// Arrange
	const rows = networkRows(read('_data/disclosure.yml'), 'sent')
	const last = rows[rows.length - 1]

	// Assert
	assert.match(last.item, /動作記録/)
	assert.match(last.item, /操作/)
	assert.match(last.note, /入力した文字・ファイル名・パスは含みません/)
	assert.match(last.note, /使用許諾契約書・利用規約への同意時にご案内します/)
})

test('開示: en の行に operation、zh-tw の行に操作がある (同じ添字)', () => {
	const en = networkRows(read('_data/l10n/en/disclosure.yml'), 'sent')
	const zh = networkRows(read('_data/l10n/zh-tw/disclosure.yml'), 'sent')
	assert.match(en[en.length - 1].item, /operation/i)
	assert.match(zh[zh.length - 1].item, /操作/)
	assert.ok(en[en.length - 1].note && zh[zh.length - 1].note, '英中の note が欠けている')
})

// ── 版と最終更新日 ───────────────────────────────────────────────────

test('版: legal.yml の version は 2026-11-08', () => {
	assert.match(read('_data/legal.yml'), /^version: "2026-11-08"$/m)
})

test('最終更新日: privacy / cookie / asct は 2026-11-16', () => {
	assert.equal(lastUpdated(privacy()), '2026-11-16')
	assert.equal(lastUpdated(read(COOKIE)), '2026-11-16')
	assert.equal(lastUpdated(read('company/asct.html')), '2026-11-16')
})

// ── 参照の整合 ───────────────────────────────────────────────────────

test('参照: 配布の部品の「13項に定めるエラー診断レポート」と 13 項の見出しがそろう', () => {
	const part = read('_includes/legal-distribution.html')
	const heading = stripComments(privacy()).match(/<h2[^>]*>13\.([^<]*)<\/h2>/)
	assert.match(part, /13項に定めるエラー診断レポート/)
	assert.ok(heading && heading[1].includes('エラー診断レポート'))
})
