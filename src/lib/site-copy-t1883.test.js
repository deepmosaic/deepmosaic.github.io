// T-1883 (2026-11-08) 18 歳未満の者が写る性的な映像の禁止を明記した改定を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1883.test.js
//
//   - 利用規約 第7条: 18 歳未満の者が写る性的な映像その他児童の権利を侵害する映像の処理・制作・頒布を禁止する号がある。
//     公序良俗に反する映像の号の直後に置く。
//   - 使用許諾契約書 第3条: 法令または公序良俗に反する目的の括弧に、18 歳未満の者が写る性的な映像を含める。
//   - 版: legal.yml の version と eula / terms の最終更新日がそろって 2026-11-08。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t1061.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const TERMS = 'company/terms.html'
const EULA = 'company/eula.html'
const VERSION = '2026-11-08'

/** HTML コメントを落とす (表示されない文字列は検査対象外)。 */
const stripComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '')

/** 見出し `label` (「（」まで含める) の h2 から次の h2 までの生 HTML (コメントは除く)。無ければ null。 */
function articleHtml(html, label) {
	const body = stripComments(html)
	const h2s = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
	const i = h2s.findIndex((m) => m[1].startsWith(label))
	if (i < 0) return null
	const end = i + 1 < h2s.length ? h2s[i + 1].index : body.length
	return body.slice(h2s[i].index, end)
}

/** 条の中の `<li>` の素の文字列 (タグを落とし空白を潰したもの) の一覧。 */
function itemsOf(html, label) {
	const raw = articleHtml(html, label)
	if (raw === null) return null
	return [...raw.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
}

const MINOR_RE = /18 ?歳未満の者が写る性的な映像/

test('利用規約 第7条: 18 歳未満の者が写る性的な映像の処理・制作・頒布を禁止する号がある', () => {
	// Act
	const items = itemsOf(read(TERMS), '第7条（')

	// Assert
	assert.ok(items, '第7条が無い')
	const hits = items.filter((t) => MINOR_RE.test(t))
	assert.equal(hits.length, 1, '18 歳未満の号はちょうど 1 つ')
	for (const re of [/児童の権利を侵害する映像/, /処理/, /制作/, /頒布/]) assert.match(hits[0], re)
})

test('利用規約 第7条: 18 歳未満の号は公序良俗に反する映像の号の直後にある', () => {
	// Act
	const items = itemsOf(read(TERMS), '第7条（')
	const i = items.findIndex((t) => /公序良俗に反する映像の制作または頒布/.test(t))

	// Assert
	assert.ok(i >= 0, '公序良俗に反する映像の号が無い')
	assert.match(items[i + 1], MINOR_RE)
})

test('使用許諾契約書 第3条: 法令または公序良俗に反する目的の括弧に 18 歳未満の者が写る性的な映像を含む', () => {
	// Act
	const items = itemsOf(read(EULA), '第3条（')
	const hit = items?.find((t) => /法令または公序良俗に反する目的/.test(t))

	// Assert
	assert.ok(hit, '法令または公序良俗に反する目的の号が無い')
	assert.match(hit, MINOR_RE)
	assert.match(hit, /違法な映像/)
})

test('版: legal.yml と eula / terms の最終更新日がそろって 2026-11-08', () => {
	assert.match(read('_data/legal.yml'), new RegExp(`^version: "${VERSION}"$`, 'm'))
	for (const rel of [TERMS, EULA]) {
		assert.match(stripComments(read(rel)), new RegExp(`最終更新日: ${VERSION}<`), rel)
	}
})
