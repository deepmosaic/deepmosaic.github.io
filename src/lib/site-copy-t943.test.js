// T-943 (2026-10-03) の公開面の文言を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t943.test.js
//
//   - 特定商取引法に基づく表記 (`company/asct.html`) に「運営責任者」と、住所・電話番号を
//     「請求があれば遅滞なく開示」する旨の文と、最終更新日を載せる。住所・電話番号そのものは
//     印字しない (TICKET-SITE-21 / T-933 の方針)。
//   - 同名のオープンソース「DeepMosaics」(モザイクを取り除く用途で知られるツール) とは別製品で
//     あることを `/mosaic-removal/`・FAQ・`llms.txt` の 3 面に固有名で書く。文面の出所は
//     `_data/entity.yml` の `oss_distinction` (FAQ は YAML で Liquid を通らないので同じ趣旨を直書き)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t924.test.js` と同じ流儀)。

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

/** `<th>見出し</th>` に続く `<td>` の中身。見つからなければ null。 */
function rowValue(html, heading) {
	const m = stripComments(html).match(
		new RegExp(`<th[^>]*>\\s*${heading}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`),
	)
	return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null
}

/** `_data/entity.yml` の `<key>:` ブロック直下の `ja:` / `en:` の値。 */
function entityText(key, lang) {
	const yml = read('_data/entity.yml')
	const block = yml.match(new RegExp(`^${key}:\\n((?:  .*\\n)+)`, 'm'))
	if (!block) return null
	const line = block[1].match(new RegExp(`^  ${lang}: "(.*)"$`, 'm'))
	return line ? line[1] : null
}

/** `_data/faq.yml` の質問と回答の組 (先頭からの順)。 */
function faqItems() {
	const yml = read('_data/faq.yml')
	const items = []
	const re = /^- q: "(.*)"\n {2}a: "(.*)"$/gm
	let m
	while ((m = re.exec(yml)) !== null) items.push({ q: m[1], a: m[2] })
	return items
}

const OSS_NAME = 'DeepMosaics'

test('rowValue は無い見出しなら null を返す (検査のすり抜けを防ぐ)', () => {
	assert.equal(rowValue('<th>A</th><td>x</td>', 'B'), null)
})

test('特商法: 運営責任者の行がコメントアウトされずに表示される', () => {
	// Act
	const value = rowValue(read('company/asct.html'), '運営責任者')

	// Assert
	assert.equal(value, '高田茂臣')
})

test('特商法: 所在地・電話番号は請求があれば遅滞なく開示する旨の行がある', () => {
	// Act
	const value = rowValue(read('company/asct.html'), '所在地・電話番号')

	// Assert
	assert.ok(value, '所在地・電話番号の行が無い')
	assert.match(value, /請求があれば/)
	assert.match(value, /遅滞なく開示/)
})

test('特商法: 住所と電話番号そのものは印字しない', () => {
	// Act
	const text = textOf(read('company/asct.html'))

	// Assert
	assert.doesNotMatch(text, /〒/)
	assert.doesNotMatch(text, /\d{2,4}-\d{2,4}-\d{3,4}/, '電話番号らしき数字列がある')
	assert.doesNotMatch(text, /(都|道|府|県)\S{1,6}(市|区|町|村)/, '所在地らしき表記がある')
})

test('特商法: 最終更新日は ISO 形式で 2020-7-1 の古い日付ではない', () => {
	// Act
	const m = textOf(read('company/asct.html')).match(/最終更新日: ?(\S+)/)

	// Assert
	assert.ok(m, '最終更新日が無い')
	assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/)
	assert.ok(m[1] >= '2026-10-03', `最終更新日が古い: ${m[1]}`)
})

test('entity.yml: oss_distinction は日英とも DeepMosaics を固有名で挙げ、別製品と書く', () => {
	// Act
	const ja = entityText('oss_distinction', 'ja')
	const en = entityText('oss_distinction', 'en')

	// Assert
	assert.ok(ja && ja.includes(OSS_NAME) && ja.includes('別'), `ja: ${ja}`)
	assert.ok(en && en.includes(OSS_NAME) && /not|unrelated|separate/i.test(en), `en: ${en}`)
})

test('entity.yml: oss_distinction の日本語は「除去」を使わない (語彙ポリシー)', () => {
	assert.doesNotMatch(entityText('oss_distinction', 'ja') ?? '', /除去/)
})

test('/mosaic-removal/ と llms.txt は entity.yml の oss_distinction を表示する', () => {
	for (const rel of ['mosaic-removal.html', 'llms.txt']) {
		const body = stripComments(read(rel))
		assert.match(body, /E\.oss_distinction\.ja/, `${rel} に日本語の注記が無い`)
	}
	assert.match(stripComments(read('llms.txt')), /E\.oss_distinction\.en/, 'llms.txt に英語の注記が無い')
})

test('FAQ: DeepMosaics との違いの項目があり、質問文に「除去」を使わない', () => {
	// Act
	const items = faqItems()
	const hit = items.find((i) => i.q.includes(OSS_NAME))

	// Assert
	assert.ok(hit, 'FAQ に DeepMosaics の項目が無い')
	assert.match(hit.a, /別/)
	assert.doesNotMatch(hit.q, /除去/)
	assert.doesNotMatch(hit.a, /除去/)
	assert.doesNotMatch(hit.a, /https?:\/\//, '他社ツールへのリンクを張らない')
})

test('FAQ: 「除去」を含む質問文は 1 件だけ (語彙ポリシー)', () => {
	assert.equal(faqItems().filter((i) => i.q.includes('除去')).length, 1)
})
