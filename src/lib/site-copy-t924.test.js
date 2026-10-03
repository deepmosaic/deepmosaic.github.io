// T-924 (2026-10-03 ユーザー決定) の公開面の文言を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t924.test.js
//
//   - Enterprise の最低アカウント数 3 を撤廃した (1 アカウントから)。公開ページに「3 アカウント以上」
//     「最低 3 アカウント」が残ると、実在しない条件を広告することになる。
//   - お問い合わせフォームの「4000 文字まで」の補足は不要 (maxlength とエラー文は残す)。
//   - アプリの更新ダイアログは「今すぐ更新 / あとで」の 2 択 (「このバージョンをスキップ」は撤去、T-918)。
//   - Web 版の速度 (2.6.5 で WebGPU 対応の環境の検出は約 2.5 倍、精緻化は約 2 割短縮)。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadTiers } from './plans-yml.js'

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

/** `<section id="…">` から次の `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const m = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`))
	return m ? m[0] : null
}

/** 最低 3 アカウントを前提にした言い回し。 */
const MIN_THREE_WORDING = [/3 ?アカウント以上/, /最低 ?3 ?アカウント/, /3 ?アカウントから/, /3 ?アカウント未満/]

const PUBLIC_PAGES = [
	'contact/index.html',
	'enterprise/inquiry/index.html',
	'_includes/docs/07-team.html',
	'_data/plans.yml',
]

test('sectionOf は無い ID なら null を返す (検査のすり抜けを防ぐ)', () => {
	assert.equal(sectionOf('<section id="a"></section>', 'b'), null)
})

test('plans.yml の Enterprise は 1 アカウントから (min_seats = 1)', () => {
	// Arrange
	const enterprise = loadTiers().find((t) => t.code === 'enterprise')

	// Assert
	assert.ok(enterprise, 'plans.yml に enterprise が無い')
	assert.equal(enterprise.min_seats, 1)
})

for (const rel of PUBLIC_PAGES) {
	test(`${rel} に最低 3 アカウントの記述が残っていない`, () => {
		// Arrange
		const source = rel.endsWith('.yml')
			? read(rel)
					.split('\n')
					.filter((line) => !line.trimStart().startsWith('#'))
					.join('\n')
			: textOf(read(rel))

		// Act
		const found = MIN_THREE_WORDING.filter((re) => re.test(source)).map(String)

		// Assert
		assert.deepEqual(found, [], `${rel} に残っている: ${found.join(', ')}`)
	})
}

test('お問い合わせフォームに「N 文字まで」の補足が無く、本文欄の aria-describedby も補足を指さない', () => {
	// Arrange
	const form = read('src/islands/InquiryForm.svelte')

	// Assert
	assert.ok(!/文字まで/.test(form), '「文字まで」の補足が残っている')
	assert.ok(!/inq-message-help/.test(form), 'inq-message-help の参照が残っている')
	// 上限そのものは残す (入力の上限とエラー文は Worker と揃えたまま)
	assert.match(form, /maxlength=\{LIMITS\.message\}/)
	assert.match(form, /describedBy\('message', false\)/)
})

test('06-ops の更新ダイアログは「今すぐ更新」「あとで」の 2 択で、スキップの説明が無い', () => {
	// Arrange
	const update = sectionOf(read('_includes/docs/06-ops.html'), 'update')
	assert.ok(update, '06-ops に #update の節が無い')
	const text = textOf(update)

	// Assert
	assert.match(text, /「今すぐ更新」/)
	assert.match(text, /「あとで」/)
	assert.ok(!/スキップ/.test(text), `#update にスキップの記述が残っている: ${text}`)
})

test('01-intro のアップグレードは更新ダイアログの 2 択を案内し、スキップを書かない', () => {
	// Arrange
	const text = textOf(read('_includes/docs/01-intro.html'))

	// Assert
	assert.match(text, /「今すぐ更新」/)
	assert.match(text, /「あとで」/)
	assert.ok(!/スキップ/.test(text), '01-intro にスキップの記述が残っている')
})

test('Web 版の WebGPU の説明に 2.6.5 の速度 (検出 約 2.5 倍 / 精緻化 約 2 割短縮) と CPU 時の遅さがある', () => {
	// Arrange
	const text = textOf(read('_includes/docs/web.html'))

	// Assert
	assert.match(text, /約 2\.5 倍/)
	assert.match(text, /約 2 割/)
	assert.match(text, /CPU（WebAssembly）で動作しますが、数倍〜十数倍の時間がかかります/)
})
