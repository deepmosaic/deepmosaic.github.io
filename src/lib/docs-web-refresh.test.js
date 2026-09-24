// docs「Web 版の使い方」(/docs/web/) に、web に入ったタイムライン編集 / HOME の分類 / 組織の管理を
// 書き足したことを固定する回帰テスト (T-511)。
//
//   node --test src/lib/docs-web-refresh.test.js
//
// 根拠は web リポの実装と `app/docs/desktop-parity.md` (Desktop との差分の台帳):
//
//   - タイムライン編集 (T-308 / T-439): 空白 (T-440) / 取り込んだ素材 / テキスト / 音声 (T-273) は
//     desktop と同じ操作。素材は OPFS に置き、プレビューは **Blob URL** で読む (T-437)。
//     画像クリップ (desktop T-493) は web の書き出しが T-498 で対応済み (2026-09-24 本番反映、
//     desktop は 2.4.0 で公開)。T-515 で「今後の更新で対応」「次回の更新で追加」の断り書きを外した。
//     透過 PNG は web では黒地に合成して書き出す (desktop-parity.md の既知の差)
//   - HOME の分類 (T-383 / T-410 / T-411 / T-443): フォルダとタグは OPFS の `library.json`。
//     タブ間のロックが無いので、複数タブで同時に分類を変えると最後に保存したタブが残る
//   - 組織の管理 (T-262 / T-443): 同じモーダル。参加はログイン画面の組織コード欄 (T-485 で
//     メニューの項目は撤去)。請求書は新しいタブで開く
//
// 節を足したら目次 (`_data/docs_toc.yml` の web) にも書く。`scripts/check-docs.mjs` は
// 「目次の ID が本文にあるか」しか見ないので、**本文だけ足して目次に無い**はここで止める。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseTocIds } from './docs-check.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Liquid の `{% comment %}` を落とす (表示されない文字列は検査対象外)。 */
const stripComments = (source) => source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<section id="…">` から対応する `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** `<div class="kv-key">ラベル</div>` に続く `kv-val` の素の文字列。見つからなければ null。 */
function kvValue(html, label) {
	const re = new RegExp(`<div class="kv-key">${label}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`)
	const m = html.match(re)
	return m === null ? null : textOf(m[1])
}

const web = stripComments(read('_includes', 'docs', 'web.html'))
const webToc = parseTocIds(read('_data', 'docs_toc.yml')).web ?? []

/** T-511 で足した節。ID は /docs/web/#… の深いリンクになるので、変えるときは参照元も直す。 */
const NEW_SECTIONS = ['home', 'timeline', 'team']

test('sectionOf / kvValue は見つからなければ null を返す (すり抜け防止)', () => {
	// Arrange / Act / Assert
	assert.equal(sectionOf(web, '存在しない'), null)
	assert.equal(kvValue(web, '存在しないラベル'), null)
})

test('web の目次が読める (空の目次で緑になるのを防ぐ)', () => {
	assert.ok(webToc.includes('about') && webToc.includes('diff'), `web の目次: ${webToc.join(', ')}`)
})

for (const id of NEW_SECTIONS) {
	test(`#${id} の節が本文と目次の両方にある`, () => {
		// Arrange / Act / Assert
		assert.ok(sectionOf(web, id), `web.html に <section id="${id}"> が無い`)
		assert.ok(webToc.includes(id), `docs_toc.yml の web に ${id} が無い`)
	})
}

test('タイムライン編集の節は 空白・素材・テキスト・音声 と、素材の Blob URL に触れている', () => {
	// Arrange
	const section = sectionOf(web, 'timeline')
	assert.ok(section, '#timeline が無い')
	const text = textOf(section)

	// Act
	const missing = ['空白', '素材', 'テキスト', '音声'].filter((w) => !text.includes(w))

	// Assert
	assert.deepEqual(missing, [], `触れていない機能: ${missing.join(' / ')}`)
	assert.match(text, /Blob URL/, `素材のプレビューが Blob URL であることが書かれていない: ${text}`)
})

test('画像クリップは Web 版でも同じように書き出せると書いてあり、未対応の断り書きが無い (T-498 / T-515)', () => {
	// Arrange
	const image = kvValue(sectionOf(web, 'timeline') ?? '', '画像クリップ')

	// Act / Assert
	assert.ok(image, '#timeline に「画像クリップ」の行が無い')
	assert.match(image, /^同じ。/, `Desktop 版と同じだと書かれていない: ${image}`)
	assert.match(image, /書き出し/, `書き出しに入ることが書かれていない: ${image}`)
	for (const stale of ['今後の更新', '次回の更新', 'それまでは']) {
		assert.ok(!image.includes(stale), `未対応だった頃の断り書き「${stale}」が残っている: ${image}`)
	}
})

test('HOME の分類の節は フォルダ・タグ・他のフォルダ と、ブラウザ内に保存されることに触れている', () => {
	// Arrange
	const section = sectionOf(web, 'home')
	assert.ok(section, '#home が無い')
	const text = textOf(section)

	// Act / Assert
	for (const word of ['フォルダ', 'タグ', '「他のフォルダ」']) {
		assert.ok(text.includes(word), `「${word}」に触れていない`)
	}
	assert.match(text, /Desktop 版とは共有されません/, `分類が Desktop 版と共有されないことが書かれていない: ${text}`)
	assert.match(text, /最後に保存したタブ/, `複数タブで分類を変えたときの挙動が書かれていない: ${text}`)
})

test('組織の管理の節はログイン画面の組織コード欄と Desktop 版の章 (/docs/#team) を案内している', () => {
	// Arrange
	const section = sectionOf(web, 'team')
	assert.ok(section, '#team が無い')
	const text = textOf(section)

	// Act / Assert
	assert.match(section, /href="\/docs\/#team"/, 'Desktop 版の「組織の管理」へのリンクが無い')
	assert.match(text, /「組織コード」欄/, `参加の入口が書かれていない: ${text}`)
	assert.match(text, /ログアウト/, `ログイン済みのときのやり直し方が書かれていない: ${text}`)
	assert.match(text, /新しいタブ/, `請求書が新しいタブで開くことが書かれていない: ${text}`)
})

test('Desktop 版との違いの表に タイムライン編集・ホーム画面の分類・組織の管理 がある', () => {
	// Arrange
	const diff = sectionOf(web, 'diff')
	assert.ok(diff, '#diff が無い')

	// Act
	const edit = kvValue(diff, '編集ページ')
	const home = kvValue(diff, 'ホーム画面の分類')
	const team = kvValue(diff, '組織の管理（Enterprise）')

	// Assert
	assert.match(edit ?? '', /タイムライン編集/, `編集ページの行にタイムライン編集が無い: ${edit}`)
	assert.ok(home, '「ホーム画面の分類」の行が無い')
	assert.ok(team, '「組織の管理（Enterprise）」の行が無い')
})

test('データの保存の節に、取り込んだ素材とホーム画面の分類も含めてある', () => {
	// Arrange
	const text = textOf(sectionOf(web, 'storage') ?? '')

	// Act / Assert
	assert.match(text, /素材/, `タイムラインの素材の保存先に触れていない: ${text}`)
	assert.match(text, /分類/, `ホーム画面の分類の保存先に触れていない: ${text}`)
})

test('Web 版のページも「チーム」ではなく「組織」で書いている (T-484 と同じ表記)', () => {
	// Arrange / Act / Assert
	assert.ok(!textOf(web).includes('チーム'), 'web.html に「チーム」が残っている')
})
