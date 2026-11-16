// 公開リポの決まり (CLAUDE.md「公開リポの決まり」) の仕様テスト。
//
//   node --test src/lib/public-repo.test.js
//
//   - ページのソース (Jekyll が出力するファイル) に HTML コメントが無い。説明は出力に出ない Liquid のコメントに書く。
//   - 追跡しているファイルに docs_draft/ が無い (作業の記録をこのリポに置かない)。
//   - 出力 (_site) の検査は scripts/i18n/checks/public.mjs (check-site)。ここでは純ロジック findHtmlComments を見る。
//   - `_site` は読まない (CI では npm test がビルドの前に走る)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { findHtmlComments } from '../../scripts/i18n/checks/public.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 追跡しているファイルの一覧 (区切りは `/`)。git が使えなければ null。 */
function trackedFiles() {
	try {
		return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
			.split('\0')
			.filter(Boolean)
	} catch {
		return null
	}
}

/** Jekyll が出力しないパス (`_config.yml` の exclude と同じもの + Jekyll の対象外の拡張子)。 */
const NOT_PUBLISHED = /^(src|e2e|scripts|node_modules|vendor|docs_draft|_plugins|\.github|\.claude|\.serena)\/|^(README\.md|CLAUDE\.md|LICENSE|package(-lock)?\.json|vite\.config\.js|playwright\.config\.ts|Gemfile(\.lock)?)$/

/** ページのソース (出力に出るテキストのファイル)。 */
const isPageSource = (f) => !NOT_PUBLISHED.test(f) && /\.(html|md|txt|xml)$/.test(f)

test('findHtmlComments: HTML コメントを見つけ、条件付きコメントは許す (陽性対照・陰性対照)', () => {
	assert.equal(findHtmlComments('<p>a</p><!-- x --><p>b</p>').length, 1)
	assert.equal(findHtmlComments('<!--\n複数行\n-->').length, 1)
	assert.equal(findHtmlComments('<p>閉じていない <!-- x').length, 1)
	assert.deepEqual(findHtmlComments('<!--[if IE]><p>x</p><![endif]-->'), [])
	assert.deepEqual(findHtmlComments('<p>コメントなし</p>{% comment %}x{% endcomment %}'), [])
	assert.equal(findHtmlComments('<!-- a --><!-- b -->')[1].text, '<!-- b -->')
})

test('ページのソースに HTML コメントが無い', (t) => {
	const files = trackedFiles()
	if (!files) return t.skip('git が使えない')
	const sources = files.filter(isPageSource)
	assert.ok(sources.includes('index.html') && sources.includes('_layouts/default.html'), '陽性対照: ページのソースが読めていない')
	const hits = []
	for (const f of sources) {
		for (const c of findHtmlComments(readFileSync(join(ROOT, f), 'utf8'))) hits.push(`${f}: ${c.text.replace(/\s+/g, ' ').slice(0, 60)}`)
	}
	assert.deepEqual(hits, [])
})

test('isPageSource: 公開しないフォルダとファイルを外す', () => {
	assert.ok(isPageSource('index.html'))
	assert.ok(isPageSource('_includes/header.html'))
	assert.ok(isPageSource('llms.txt'))
	for (const f of ['src/lib/a.test.js', 'scripts/x.mjs', 'e2e/a.spec.ts', 'README.md', 'CLAUDE.md', 'docs_draft/notes.md']) {
		assert.ok(!isPageSource(f), f)
	}
})

test('追跡しているファイルに docs_draft/ が無い', (t) => {
	const files = trackedFiles()
	if (!files) return t.skip('git が使えない')
	assert.ok(files.length > 0, '陽性対照: 追跡しているファイルが読めていない')
	assert.deepEqual(files.filter((f) => /^docs_draft\//.test(f)), [])
})
