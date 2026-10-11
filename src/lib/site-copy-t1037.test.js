// T-1037 (2026-10-12) 特定商取引法に基づく表示の残りと会社概要の最終更新日を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1037.test.js
//
//   - h1 を title / ja.json / フッターと同じ「特定商取引法に基づく表示」に揃える (旧: 「表記」)。
//   - 役務の提供の時期: ダウンロード又はログイン後ただちに、有料プランは決済完了後
//     (T-1061 で配布形態の区別をやめた)。旧文「登録後、ただちに利用が可能です」は実態と合わない。
//   - 解約条件: 実在しない「マイページ」をやめ、プロフィールメニューの「プラン管理」→ 決済ポータル
//     (`_includes/docs/02-account.html`)。「月の末日」で終わるのは法人の請求書払いだけで、個人向けは
//     支払済みの契約期間の末日まで有料プランのまま (docs の「解約の予約」)。
//   - 動作環境の行を足し、詳細は `/spec` (`_data/spec.yml`) を参照させる。
//   - 返品特約は「瑕疵」をやめ、使用許諾契約書・利用規約・(法人は) 見積書と取引条件書を参照させる。
//   - 会社概要に最終更新日を足す (T-1038 の横断テストが法務 6 ページの最終更新日を見る)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const ASCT = 'company/asct.html'
const ABOUT = 'company/about.html'
const UPDATED = '2026-10-12'

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<th>見出し</th>` に続く `<td>` の生 HTML。見つからなければ null。 */
function rowHtml(html, heading) {
	const m = stripComments(html).match(
		new RegExp(`<th[^>]*>\\s*${heading}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`),
	)
	return m ? m[1] : null
}

/** `<th>見出し</th>` に続く `<td>` の中身 (タグを落とした素の文字列)。見つからなければ null。 */
function rowValue(html, heading) {
	const inner = rowHtml(html, heading)
	return inner === null ? null : inner.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

/** 会社概要の表 (`<td>見出し</td><td>値</td>`) の値。見つからなければ null。 */
function aboutValue(html, heading) {
	const m = stripComments(html).match(
		new RegExp(`<td[^>]*>\\s*${heading}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`),
	)
	return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null
}

/** 表示される「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?(\d{4}-\d{2}-\d{2})/)
	return m ? m[1] : null
}

/** front matter の `title:` の値。 */
function frontTitle(source) {
	const m = source.match(/^---\r?\n[\s\S]*?^title: (.*?)\r?$/m)
	return m ? m[1].trim() : null
}

/** 表の `<th scope="row">` 見出しを出現順に。 */
function rowHeadings(html) {
	return [...stripComments(html).matchAll(/<th scope="row"[^>]*>\s*([^<]*?)\s*<\/th>/g)].map((m) => m[1])
}

test('rowValue / aboutValue は無い見出しなら null を返す (検査のすり抜けを防ぐ)', () => {
	assert.equal(rowValue('<th>A</th><td>x</td>', 'B'), null)
	assert.equal(aboutValue('<td>A</td><td>x</td>', 'B'), null)
	assert.equal(lastUpdated('<p>なし</p>'), null)
})

test('特商法: h1 と title は「特定商取引法に基づく表示」で、h1 に「表記」が無い', () => {
	// Arrange
	const src = read(ASCT)

	// Act
	const h1 = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)

	// Assert
	assert.ok(h1, 'h1 が無い')
	assert.equal(textOf(h1[1]).trim(), '特定商取引法に基づく表示')
	assert.equal(frontTitle(src), '特定商取引法に基づく表示')
	assert.doesNotMatch(h1[1], /表記/)
})

test('特商法: 役務の提供の時期はダウンロード又はログイン後 / 決済完了後で、旧文が無い', () => {
	// Act
	const value = rowValue(read(ASCT), '役務の提供の時期')

	// Assert
	assert.ok(value, '役務の提供の時期の行が無い')
	assert.match(value, /ダウンロード又はログイン後/)
	assert.match(value, /決済完了後/)
	assert.doesNotMatch(value, /登録後、ただちに利用が可能です/)
})

test('特商法: 解約条件はプロフィールメニューの決済ポータルで、月の末日は法人だけ', () => {
	// Act
	const value = rowValue(read(ASCT), '解約条件')

	// Assert
	assert.ok(value, '解約条件の行が無い')
	assert.doesNotMatch(value, /マイページ/)
	assert.match(value, /プロフィールメニュー/)
	assert.match(value, /決済ポータル/)
	// 「月の末日」で終わるのは法人の請求書払いの段落だけ (個人向けは支払済みの契約期間の末日まで)。
	const paragraphs = rowHtml(read(ASCT), '解約条件').split(/<br\s*\/?>/).map(textOf)
	const corporate = paragraphs.find((p) => p.includes('法人様'))
	const personal = paragraphs.find((p) => p.includes('個人向け'))
	assert.ok(corporate && personal, '個人向けと法人様の段落が無い')
	assert.match(corporate, /月の末日/)
	assert.doesNotMatch(personal, /月の末日/)
	assert.doesNotMatch(value, /個人向け[^。]*月の末日/)
})

test('特商法: 動作環境の行に Windows と /spec へのリンクがある', () => {
	// Arrange
	const src = read(ASCT)

	// Act
	const value = rowValue(src, '動作環境')
	const html = rowHtml(src, '動作環境')

	// Assert
	assert.ok(value, '動作環境の行が無い')
	assert.match(value, /Windows/)
	assert.match(html, /href="\/spec"/)
})

test('特商法: 返品特約は使用許諾契約書と取引条件書を参照し、瑕疵を使わない', () => {
	// Arrange
	const src = read(ASCT)

	// Act
	const value = rowValue(src, '返品・キャンセルに関する特約')
	const html = rowHtml(src, '返品・キャンセルに関する特約')

	// Assert
	assert.ok(value, '返品特約の行が無い')
	assert.match(value, /使用許諾契約書/)
	assert.match(value, /取引条件書/)
	assert.doesNotMatch(value, /瑕疵/)
	assert.match(html, /href="\/company\/eula"/)
})

test('特商法: 行の順序 (所在地 → 電話番号 → メールアドレス、動作環境は役務の提供の時期の直前)', () => {
	// Act
	const headings = rowHeadings(read(ASCT))
	const at = (h) => headings.indexOf(h)

	// Assert
	assert.ok(at('所在地') >= 0, `所在地が無い: ${headings}`)
	assert.equal(at('電話番号'), at('所在地') + 1)
	assert.equal(at('メールアドレス'), at('電話番号') + 1)
	assert.ok(at('動作環境') >= 0, `動作環境が無い: ${headings}`)
	assert.equal(at('役務の提供の時期'), at('動作環境') + 1)
})

test('最終更新日: 特商法と会社概要が 2026-10-12', () => {
	assert.equal(lastUpdated(read(ASCT)), UPDATED)
	assert.equal(lastUpdated(read(ABOUT)), UPDATED)
})

test('会社概要: 資本金は「百万円」のまま (T-1037 では変えない)', () => {
	// 値が未確認のため据え置く (計画 §7)。値が確定したら T-1037 以外のチケットで直し、このテストも更新する。
	assert.equal(aboutValue(read(ABOUT), '資本金'), '百万円')
})
