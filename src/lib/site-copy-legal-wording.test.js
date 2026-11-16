// 法務文書の書き方の方針を固定する回帰テスト。
//
//   node --test src/lib/site-copy-legal-wording.test.js
//
//   - 委託先・サービス提供者の企業名を本文に出さない。例外は Google Analytics (Google LLC) だけ。
//   - 配布形態 (デスクトップ版 / Web 版) で区別して書かない。「当社が提供するソフトウェア」とまとめる。
//   - 「法人向け（Enterprise）」は「法人様」と書く。
//   - 特定商取引法に基づく表記の見出し列は狭くしない (`min-w-[10rem]`)。
//   - 版 (legal.yml の version と eula / terms の最終更新日) の値。
//
// 読み取りはこのファイル内で完結させる (`site-copy-asct-phone.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findNames, nameHash, SERVICE_NAMES } from './name-guard.js'

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

/** 本文の「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?([^\s（(]+)/)
	return m ? m[1] : null
}

/** `company/` 直下の法務ページ (相対パス)。 */
const COMPANY_FILES = readdirSync(join(ROOT, 'company'))
	.filter((name) => name.endsWith('.html'))
	.map((name) => `company/${name}`)

const LEGAL_VERSION = '2026-11-08'

/** 各ページの本文 (コメント・タグを除く) のうち、パターンに一致した箇所を `file: 一致` で返す。 */
function findIn(files, pattern) {
	const hits = []
	for (const rel of files) {
		for (const m of textOf(read(rel)).matchAll(new RegExp(pattern, 'g'))) hits.push(`${rel}: ${m[0]}`)
	}
	return hits
}

test('検査対象の法務ページが 6 本そろっている (空の一覧で検査がすり抜けないこと)', () => {
	for (const slug of ['about', 'asct', 'cookie', 'eula', 'privacy', 'terms']) {
		assert.ok(COMPANY_FILES.includes(`company/${slug}.html`), `company/${slug}.html が無い`)
	}
})

test('textOf はコメントの中の語を本文として扱わない', () => {
	assert.deepEqual(textOf('<!-- Example --><p>本文</p>').match(/Example/), null)
})

test('企業名の検査器: 一覧の名前は本文の中で拾い、コメントの中は拾わない (陽性対照と陰性対照)', () => {
	const rule = { parts: [nameHash('Example')] }
	assert.deepEqual(findNames(textOf('<p>提供: ExampleCorp</p>'), rule), ['Example'])
	assert.deepEqual(findNames(textOf('<!-- Example --><p>本文</p>'), rule), [])
	assert.equal(SERVICE_NAMES.parts.length, 7)
})

test('企業名: 委託先・サービス提供者の企業名を本文に書かない', () => {
	const hits = COMPANY_FILES.flatMap((rel) => findNames(textOf(read(rel)), SERVICE_NAMES).map((w) => `${rel}: ${w}`))
	assert.deepEqual(hits, [])
})

test('企業名: 例外として Google Analytics は書いてよく、プライバシーに載っている', () => {
	assert.match(textOf(read('company/privacy.html')), /Google Analytics/)
})

test('プライバシー 15 項: 表はサービスの種類 / 用途 / 所在国で、5 行とも所在国は「米国」だけ', () => {
	// Arrange
	const html = stripComments(read('company/privacy.html'))
	const section = html.split(/<h2[^>]*>15\./)[1].split(/<h2/)[0]
	const heads = [...section.matchAll(/<th scope="col"[^>]*>\s*([^<]*?)\s*<\/th>/g)].map((m) => m[1])
	const rows = [...section.matchAll(/<tr class="border-b border-edge even:bg-panel">([\s\S]*?)<\/tr>/g)].map(
		(m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1].replace(/<[^>]*>/g, '').trim()),
	)

	// Assert
	assert.deepEqual(heads, ['サービスの種類', '用途', '所在国'])
	assert.deepEqual(
		rows.map((r) => r[0]),
		['データベース', '配信・実行基盤', '認証', '決済', 'アクセス解析（Google Analytics）'],
	)
	for (const r of rows) assert.equal(r[2], '米国')
	assert.doesNotMatch(textOf(section), /エラー診断/)
})

test('プライバシー 13・14 項: エラー診断は当社のサーバー (12 項と同じ仕組み)、外部の認証サービス・決済代行サービスと書く (企業名は書かない)', () => {
	const text = textOf(read('company/privacy.html'))
	// エラー診断は 12 項の動作記録と同じ仕組みで送る。外部のエラー診断サービス（米国）は 13 項の以前のバージョンの経過の 1 文にだけ書く。
	assert.match(text, /12項に定める動作記録と同じ仕組みで当社のサーバーに送信します/)
	assert.equal(text.match(/外部のエラー診断サービス/g)?.length, 1)
	assert.match(text, /以前のバージョンの本ソフトウェアは、[^。]*外部のエラー診断サービス（米国）に送信する場合があります。/)
	assert.match(text, /外部の認証サービス/)
	assert.match(text, /決済代行サービス/)
	assert.match(text, /クレジットカード番号を保持しません/)
})

test('配布形態: デスクトップ版 / Web 版で区別して書かない', () => {
	assert.deepEqual(findIn(COMPANY_FILES, /デスクトップ版|Web\s?版|ウェブ版/.source), [])
})

test('配布形態: 使用許諾契約書第 1 条は配布形態及び利用形態を問わない「本ソフトウェア」を定義する', () => {
	const text = textOf(read('company/eula.html'))
	assert.match(text, /当社が提供するソフトウェア（配布形態及び利用形態を問わず/)
	assert.match(text, /同一のアカウントで同時に本ソフトウェアを利用できる端末は\s?1\s?台とします。/)
})

test('配布形態: 特商法の役務の提供の時期はダウンロード又はサインイン後ただちに', () => {
	const text = textOf(read('company/asct.html'))
	assert.match(
		text,
		/ダウンロード又はサインイン後、ただちにご利用いただけます。有料プランは決済完了後ただちにご利用いただけます。/,
	)
})

test('法人様: 「法人向け」「Enterprise」を書かず「法人様」と書く', () => {
	assert.deepEqual(findIn(COMPANY_FILES, /法人向け|Enterprise/.source), [])
	for (const rel of ['company/asct.html', 'company/eula.html', 'company/terms.html']) {
		assert.match(textOf(read(rel)), /法人様/, rel)
	}
})

test('特商法の表: 見出し列 (th scope="row") はすべて min-w-[10rem] を持つ', () => {
	const ths = [...stripComments(read('company/asct.html')).matchAll(/<th scope="row"([^>]*)>/g)]
	assert.ok(ths.length > 0, '見出しの行が無い')
	for (const m of ths) assert.match(m[1], /min-w-\[10rem\]/)
})

test('版: legal.yml の version と eula / terms の最終更新日が LEGAL_VERSION にそろう', () => {
	assert.match(read('_data/legal.yml'), new RegExp(`^version: "${LEGAL_VERSION}"$`, 'm'))
	assert.equal(lastUpdated(read('company/eula.html')), LEGAL_VERSION)
	assert.equal(lastUpdated(read('company/terms.html')), LEGAL_VERSION)
})
