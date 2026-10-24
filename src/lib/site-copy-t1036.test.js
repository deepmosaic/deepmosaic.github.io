// T-1036 (2026-10-12) プライバシーポリシーの総点検の回帰テスト。
//
//   node --test src/lib/site-copy-t1036.test.js
//
//   - 実装の無い「位置情報」「広告の配信」「ターゲティング広告の情報収集モジュール」「SNS 連携」を消す。
//   - 実際に送っているもの (アプリの動作記録の常時送信 / エラー診断 / 認証・決済 / 外国の保存先) と
//     安全管理措置を 12〜16 項として「問い合わせ窓口」の前に新設する (窓口は 17 項、変更手続は 18 項)。
//   - 3-3 にアプリ内の同意 (使用許諾契約書・利用規約、版の記録) を書く。
//   - T-1061 (2026-10-11): 企業名・保存先の国の細部・保存期間・配布形態の区別を書かない方針に改めた。
//     不在の検査は `site-copy-t1061.test.js` が持つ。ここでは各項の存在する内容だけを見る。
//   - 3-1 の文言と 10・11 項の検査は `site-copy-t964.test.js` が持つ (ここでは再掲しない)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` / `site-copy-t964.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

/** YAML の `#` コメント行を落とす (公開されない文字列は検査対象外)。 */
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

const PRIVACY = 'company/privacy.html'
const privacy = () => read(PRIVACY)

test('sectionOf は無い番号で null、ある番号で本文を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange
	const html = '<h2 class="x">1.見出し</h2><p>本文</p><h2 class="x">2.次</h2>'

	// Act / Assert
	assert.equal(sectionOf(html, 3), null)
	assert.equal(sectionOf(html, 1), '1.見出し本文')
	assert.notEqual(sectionOf(privacy(), 1), null)
})

test('実装の無い取得・利用 (位置情報・広告・SNS 連携) を書かない', () => {
	// Act
	const text = textOf(privacy())

	// Assert
	for (const word of ['位置情報', '情報収集モジュール提供者', 'ターゲティング', '広告の配信', 'ソーシャルネットワーク']) {
		assert.ok(!text.includes(word), `残っている: ${word}`)
	}
})

test('項番は 1〜18 で、12〜18 項の見出しが新しい並びになっている', () => {
	// Act
	const nums = [...stripComments(privacy()).matchAll(/<h2[^>]*>(\d+)\./g)].map((m) => Number(m[1]))

	// Assert
	assert.deepEqual(
		nums,
		Array.from({ length: 18 }, (_, i) => i + 1),
	)
	const expected = {
		12: '動作記録',
		13: 'エラー診断',
		14: '認証',
		15: '外国',
		16: '安全管理措置',
		17: '問い合わせ窓口',
		18: '変更手続',
	}
	for (const [n, word] of Object.entries(expected)) {
		const heading = stripComments(privacy()).match(new RegExp(`<h2[^>]*>${n}\\.([^<]*)</h2>`))
		assert.ok(heading, `${n} 項の見出しが無い`)
		assert.ok(heading[1].includes(word), `${n} 項の見出しに「${word}」が無い: ${heading[1]}`)
	}
})

test('12 項: 動作記録は同意の有無にかかわらず送り、映像は送らず、保存期間は書かない (T-1061)', () => {
	// Act
	const s = sectionOf(privacy(), 12)

	// Assert
	assert.ok(s)
	assert.match(s, /同意の有無にかかわらず|常時/)
	assert.match(s, /映像/)
	assert.match(s, /送信しません|送信しない/)
	assert.doesNotMatch(s, /7日|90日/)
})

test('13 項: エラー診断は外部のエラー診断サービス (米国) に送り、ファイル名とパスは伏せる', () => {
	// Act
	const s = sectionOf(privacy(), 13)

	// Assert
	assert.ok(s)
	assert.match(s, /外部のエラー診断サービス（米国）/)
	assert.match(s, /ファイル名及びファイルのパスは伏せます/)
})

test('14 項: 認証は外部の認証サービス、決済は決済代行サービスで、パスワードとカード番号を当社は保持しない', () => {
	// Act
	const s = sectionOf(privacy(), 14)

	// Assert
	assert.ok(s)
	assert.match(s, /外部の認証サービス/)
	assert.match(s, /決済代行サービス/)
	assert.match(s, /パスワード/)
	assert.match(s, /カード[^。]*保持しません/)
})

test('15 項: 保存先のサービスの種類と所在国 (米国) を表で示す', () => {
	// Act
	const s = sectionOf(privacy(), 15)
	const raw = rawSectionOf(privacy(), 15)

	// Assert
	assert.ok(s)
	for (const word of ['米国', 'データベース', '認証', '決済', 'Google Analytics']) {
		assert.ok(s.includes(word), `15 項に「${word}」が無い`)
	}
	assert.match(raw, /<th/)
})

test('16 項: 安全管理措置を組織的・人的・物理的・技術的・外的環境の観点で書く', () => {
	// Act
	const s = sectionOf(privacy(), 16)

	// Assert
	assert.ok(s)
	for (const word of ['組織的', '人的', '物理的', '技術的', '外的環境']) {
		assert.ok(s.includes(word), `16 項に「${word}」が無い`)
	}
})

test('3 項: 3-3 にアプリ内の同意と版の記録を書き、3-1 のリストに端末情報が残る', () => {
	// Act
	const s = sectionOf(privacy(), 3)

	// Assert
	assert.ok(s)
	const s33 = s.match(/3-3 [^]*$/)
	assert.ok(s33, '3-3 が無い')
	assert.match(s33[0], /使用許諾契約書/)
	// 「デスクトップ版」「Web版」でも一致しないよう、同意した文書の版の記録に絞る
	assert.match(s33[0], /文書の版を記録/)
	assert.match(s, /3-1 [^]*端末情報[^]*3-2 /)
})

test('17 項: 窓口の所在地は _data/company.yml の参照のまま (T-1032)', () => {
	// Act
	const raw = rawSectionOf(privacy(), 17)

	// Assert
	assert.ok(raw)
	assert.match(raw, /site\.data\.company\.address/)
})

test('リンク: クッキーポリシーへ案内し、http の旧 Google Analytics リンクを残さない', () => {
	// Act
	const html = stripComments(privacy())

	// Assert
	assert.match(html, /href="\/company\/cookie"/)
	assert.ok(!html.includes('http://www.google.com/analytics/'))
})

test('最終更新日は 2026-10-12 以降、送信内容の一覧から「初回に同意をお伺いします」を消す', () => {
	// Act
	const date = lastUpdated(privacy())
	const disclosure = stripYamlComments(read('_data/disclosure.yml'))

	// Assert (T-1444 で §9 に 1 文を足して 2026-10-24 に進めた。以後は 2026-10-12 以降であればよい)
	assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
	assert.ok(date >= '2026-10-12', date)
	assert.ok(!disclosure.includes('初回に同意をお伺いします'))
	assert.match(disclosure, /使用許諾契約書・利用規約への同意時にご案内します/)
})
