// ja のページに言語の案内の帯を出さないことの仕様テスト。
//
//   node --test src/lib/i18n-site-no-suggest.test.js
//
//   - サイトの JS は帯を描かず、選んだ言語を localStorage に覚えない (英中のページへは言語の切り替えのリンクで行く)
//   - 帯の部品 (src/lib/lang-suggest*) を置かない
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const LIB_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(LIB_DIR, '..', '..')

test('main.js: 言語の案内の帯を描かず、選んだ言語を覚えない', () => {
	const src = readFileSync(join(ROOT, 'src', 'main.js'), 'utf8')
	for (const word of ['lang-suggest', 'mountLangSuggest', 'dm-site-lang']) {
		assert.ok(!src.includes(word), `main.js に ${word} が無い`)
	}
})

test('src/lib に帯の部品 (lang-suggest*) を置かない', () => {
	const files = readdirSync(LIB_DIR).filter((name) => name.startsWith('lang-suggest'))
	assert.deepEqual(files, [])
})

test('src の JS・Svelte・CSS (テストを除く) は帯の印 (.lang-suggest) と保存のキー (dm-site-lang) を使わない', () => {
	const hits = []
	const walk = (dir) => {
		for (const ent of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, ent.name)
			if (ent.isDirectory()) walk(p)
			else if (/\.(js|svelte|css)$/.test(ent.name) && !ent.name.endsWith('.test.js')) {
				const text = readFileSync(p, 'utf8')
				if (text.includes('lang-suggest') || text.includes('dm-site-lang')) hits.push(p)
			}
		}
	}
	walk(join(ROOT, 'src'))
	assert.deepEqual(hits, [])
})
