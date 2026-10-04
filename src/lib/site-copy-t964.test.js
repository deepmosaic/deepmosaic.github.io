// T-964 (2026-10-04) の公開面の文言を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t964.test.js
//
//   - 無料枠の抜け穴を塞ぐ変更 (desktop T-963 / SQL T-962) に合わせ、プライバシーポリシー
//     (`company/privacy.html`) に「端末を識別するハードウェア由来の識別子をハッシュ化した値」と
//     「ログインしていない状態での利用時間」を無料枠の管理のために収集・保存する旨と、
//     「サンプルの動画 (顔の検出のみ) を自動で追加することがある」旨を載せる。
//   - 利用規約 (`company/terms.html`) に、無料枠は端末ごと・アカウントごとの累計で、別の
//     アカウントで登録し直しても同じ端末では合計 2 時間までである旨と、サンプルの提供を載せる。
//   - 端末の上限は 4 時間 → 2 時間 (ユーザー決定 2026-10-04)。docs / FAQ / plans.yml に書く。
//   - 送信内容の一覧 (disclosure.yml / docs の #usage / 料金ページ) の「のみ」が嘘にならないよう
//     端末識別子のハッシュ値を足す。
//   - 内部の固有名 (Windows のレジストリ値の名前など) は公開面に書かない。
//   - 最終更新日は ISO 形式の固定文字列 (公開日にリーダーが直してよい)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` と同じ流儀)。

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

/** `_data/faq.yml` の質問と回答の組 (先頭からの順)。 */
function faqItems() {
	const yml = read('_data/faq.yml')
	const items = []
	const re = /^- q: "(.*)"\n {2}a: "(.*)"$/gm
	let m
	while ((m = re.exec(yml)) !== null) items.push({ q: m[1], a: m[2] })
	return items
}

/** 本文の「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?([^\s（(]+)/)
	return m ? m[1] : null
}

const MIN_DATE = '2026-10-04'
const PUBLIC_FILES = [
	'company/privacy.html',
	'company/terms.html',
	'_includes/docs/02-account.html',
	'_includes/docs/06-ops.html',
	'_data/faq.yml',
	'_data/plans.yml',
	'_data/disclosure.yml',
	'price/index.html',
]

test('lastUpdated は日付が無ければ null を返す (検査のすり抜けを防ぐ)', () => {
	assert.equal(lastUpdated('<p>本文</p>'), null)
	assert.equal(lastUpdated('<p>最終更新日: 2026-10-04（制定: 2019-06-01）</p>'), '2026-10-04')
})

test('faqItems は q/a の組を読み取る (空の一覧で検査がすり抜けないこと)', () => {
	assert.ok(faqItems().length > 0)
})

test('プライバシー: 端末識別子はハッシュ化した値で、無料枠の管理のために収集・保存すると書く', () => {
	// Act
	const text = textOf(read('company/privacy.html'))

	// Assert
	assert.match(text, /ハードウェア由来の識別子/)
	assert.match(text, /ハッシュ化した値/)
	assert.match(text, /無料枠の管理/)
	assert.match(text, /端末や個人を特定することはできません/)
})

test('プライバシー: ログインしていない状態での利用時間を収集・保存すると書く', () => {
	// Act
	const text = textOf(read('company/privacy.html'))

	// Assert
	assert.match(text, /ログインしていない状態での利用時間/)
	assert.match(text, /検出した動画の再生時間の累計/)
})

test('プライバシー: 10 項の記録は 3-1 の事前同意の例外で、利用開始時の同意をもって収集すると書く', () => {
	// Act
	const text = textOf(read('company/privacy.html'))

	// Assert: 3-1 の「端末情報は収集前に同意を得る」と食い違わないこと
	assert.match(text, /3-1 [^0-9]*?同意を得るものとします。ただし、10項に定めるものを除きます/)
	assert.match(text, /3-1の同意取得の対象とせず/)
	assert.match(text, /アカウントには紐づけず/)
})

test('docs: 退会しても端末単位の匿名の利用時間は残ると書く (プライバシー 10 項と一致)', () => {
	// Act
	const text = textOf(read('_includes/docs/02-account.html'))

	// Assert
	assert.match(text, /端末単位の匿名の利用時間[^/]*退会後も残ります/)
})

test('プライバシー: サンプルの権利帰属を断定しない (spec に無い法的な断定を書かない)', () => {
	// Act
	const text = textOf(read('company/privacy.html'))

	// Assert
	assert.doesNotMatch(text, /当社が権利を有する素材/)
})

test('プライバシー: サンプルの動画 (顔の検出のみ) を自動で追加することがあると書く', () => {
	// Act
	const text = textOf(read('company/privacy.html'))

	// Assert
	assert.match(text, /サンプルの動画（顔の検出のみ）を自動で追加することがあります/)
})

test('プライバシー: 節の番号が 1 から欠番なく並び、問い合わせ窓口への参照が残る', () => {
	// Act
	const nums = [...stripComments(read('company/privacy.html')).matchAll(/<h2[^>]*>(\d+)\./g)].map(
		(m) => Number(m[1]),
	)

	// Assert
	assert.deepEqual(
		nums,
		nums.map((_, i) => i + 1),
	)
	assert.match(textOf(read('company/privacy.html')), /\d+\.問い合わせ窓口/)
})

test('利用規約: 無料枠は端末ごと・アカウントごとの累計で、同じ端末では合計 2 時間まで', () => {
	// Act
	const text = textOf(read('company/terms.html'))

	// Assert
	assert.match(text, /端末ごと・アカウントごとの累計/)
	assert.match(text, /別のアカウントで登録し直しても同じ端末では合計2時間まで/)
})

test('利用規約: サンプルの提供を書く', () => {
	// Act
	const text = textOf(read('company/terms.html'))

	// Assert
	assert.match(text, /サンプル/)
	assert.match(text, /顔の検出のみ/)
})

test('最終更新日: プライバシーと利用規約は ISO 形式で 2026-10-04 以降', () => {
	for (const rel of ['company/privacy.html', 'company/terms.html']) {
		// Act
		const date = lastUpdated(read(rel))

		// Assert
		assert.ok(date, `${rel}: 最終更新日が無い`)
		assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `${rel}: ${date}`)
		assert.ok(date >= MIN_DATE, `${rel}: 最終更新日が古い: ${date}`)
	}
})

test('docs: 無料枠の節に 1 台の PC では合計 2 時間までと書く', () => {
	// Act
	const text = textOf(read('_includes/docs/02-account.html'))

	// Assert
	assert.match(text, /1 台の PC では、別のアカウントで登録し直しても合計 2 時間まで/)
})

test('FAQ: 「無料で使えますか？」の回答に同じ PC では合計 2 時間までと書く', () => {
	// Act
	const item = faqItems().find((i) => i.q === '無料で使えますか？')

	// Assert
	assert.ok(item, '無料の FAQ が無い')
	assert.match(item.a, /同じ PC では合計 2 時間まで/)
})

test('plans.yml: Free の箇条書きに 1 台の PC では合計 2 時間までと書く', () => {
	// Act
	const yml = stripYamlComments(read('_data/plans.yml'))

	// Assert
	assert.match(yml, /- "1 台の PC では合計 2 時間まで（アカウントを作り直しても同じ）"/)
})

test('送信内容: 端末識別子のハッシュ値を一覧と docs と料金ページに書く', () => {
	// Act
	const disclosure = stripYamlComments(read('_data/disclosure.yml'))
	const ops = textOf(read('_includes/docs/06-ops.html'))
	const price = textOf(read('price/index.html'))

	// Assert
	assert.match(disclosure, /item: "端末識別子（ハッシュ化した値）"/)
	assert.match(ops, /使用量（動画の秒数）、ファイルのハッシュ値、端末識別子のハッシュ値のみです/)
	assert.match(price, /使用量（動画の秒数）、ファイルのハッシュ値、端末識別子のハッシュ値のみ/)
})

test('公開面に端末上限 4 時間の古い記述と内部の固有名を残さない', () => {
	for (const rel of PUBLIC_FILES) {
		// Act
		const raw = read(rel)
		const text = rel.endsWith('.yml') ? stripYamlComments(raw) : textOf(raw)

		// Assert
		assert.doesNotMatch(text, /MachineGuid|machine_guid|レジストリ|HKCU|指紋/i, rel)
		assert.doesNotMatch(text, /(端末|PC)[^。]{0,20}4 ?時間/, rel)
	}
})
