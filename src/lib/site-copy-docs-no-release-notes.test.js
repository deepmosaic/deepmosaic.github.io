// docs に「更新内容」(リリースノート) の説明が無いことを確かめる回帰テスト。
//
//   node --test src/lib/site-copy-docs-no-release-notes.test.js
//
//   - アプリは更新後の初回起動にリリースノートを表示せず、アカウントメニューに「更新内容」も無い。
//   - docs (`_includes/docs/*.html` と docs のページ) に「更新内容」の節・メニュー項目の案内・スクリーンショットを残さない。
//   - スクリーンショット `release-notes.webp` は置かない (参照も無い)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-privacy-device-id.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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

const DOCS_DIR = '_includes/docs'
const docsFiles = readdirSync(join(ROOT, DOCS_DIR))
	.filter((name) => name.endsWith('.html'))
	.map((name) => `${DOCS_DIR}/${name}`)

test('docs の章に「更新内容」(リリースノート) の案内が無い', () => {
	for (const rel of [...docsFiles, 'docs/index.html']) {
		const text = stripComments(read(rel))
		assert.ok(!text.includes('更新内容'), `${rel} に「更新内容」が残っている`)
		assert.ok(!text.includes('リリースノート'), `${rel} に「リリースノート」が残っている`)
		assert.ok(!text.includes('release-notes'), `${rel} が release-notes のスクリーンショットを参照している`)
	}
})

test('「アップデート」の節は更新の確認 (手動) で終わり、データの保存場所の節が続く', () => {
	const ops = stripComments(read(`${DOCS_DIR}/06-ops.html`))
	assert.ok(ops.includes('手動で確認する'), '手動の確認の説明は残す')
	assert.ok(ops.includes('update-check.webp'), 'アップデートの確認のスクリーンショットは残す')
	assert.ok(!ops.includes('更新後に更新内容を確認する'), '「更新後に更新内容を確認する」の見出しがある')
})

test('スクリーンショット release-notes.webp は無い', () => {
	assert.equal(existsSync(join(ROOT, 'assets/img/screenshots/release-notes.webp')), false)
})
