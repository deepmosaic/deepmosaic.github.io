// T-1061 (2026-10-11) 法務文書の書き方の方針を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1061.test.js
//
//   ユーザーの差し戻し (公開済みの T-1032〜T-1038 に対して) で決まった方針:
//   - 委託先・サービス提供者の具体的な企業名を本文に出さない。例外は Google Analytics (Google LLC) だけ。
//   - 所在国は「米国」とだけ書く (保存先の国やリージョンの細部は書かない)。
//   - ログは削除しない。保存期間 (7日 / 90日) は書かない。
//   - 配布形態 (デスクトップ版 / Web 版) で区別して書かない。「当社が提供するソフトウェア」とまとめる。
//   - 「法人向け（Enterprise）」は「法人様」と書く。
//   - 特定商取引法に基づく表記の見出し列は狭くしない (`min-w-[10rem]`)。
//   - 版 (legal.yml の version と eula / terms の最終更新日) は 2026-10-12 のまま。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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

/** 本文の「最終更新日: YYYY-MM-DD」の日付。無ければ null。 */
function lastUpdated(html) {
	const m = textOf(html).match(/最終更新日: ?([^\s（(]+)/)
	return m ? m[1] : null
}

/** `company/` 直下の法務ページ (相対パス)。 */
const COMPANY_FILES = readdirSync(join(ROOT, 'company'))
	.filter((name) => name.endsWith('.html'))
	.map((name) => `company/${name}`)

const LEGAL_VERSION = '2026-10-12'

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
	assert.deepEqual(textOf('<!-- Sentry --><p>本文</p>').match(/Sentry/), null)
})

test('企業名: 委託先・サービス提供者の企業名と保存先の細部を本文に書かない', () => {
	const pattern =
		/Supabase|Cloudflare|Auth0|Okta|Stripe|Sentry|Functional Software|GitHub|大韓民国|日本リージョン|auth0\.com/
	assert.deepEqual(findIn(COMPANY_FILES, pattern.source), [])
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

test('プライバシー 13・14 項: 外部のエラー診断サービス・外部の認証サービス・決済代行サービスと書く', () => {
	const text = textOf(read('company/privacy.html'))
	assert.match(text, /外部のエラー診断サービス（米国）/)
	assert.match(text, /外部の認証サービス/)
	assert.match(text, /決済代行サービス/)
	assert.match(text, /クレジットカード番号を保持しません/)
})

test('保存期間: 7日 / 90日 とログを削除する旨を書かない', () => {
	assert.deepEqual(findIn(COMPANY_FILES, /7\s?日|90\s?日/.source), [])
	assert.doesNotMatch(textOf(read('company/privacy.html')), /ログ[^。]*削除します/)
})

test('配布形態: デスクトップ版 / Web 版で区別して書かない', () => {
	assert.deepEqual(findIn(COMPANY_FILES, /デスクトップ版|Web\s?版|ウェブ版/.source), [])
})

test('配布形態: 使用許諾契約書第 1 条は配布形態及び利用形態を問わない「本ソフトウェア」を定義する', () => {
	const text = textOf(read('company/eula.html'))
	assert.match(text, /当社が提供するソフトウェア（配布形態及び利用形態を問わず/)
	assert.match(text, /同一のアカウントで同時に本ソフトウェアを利用できる端末は\s?1\s?台とします。/)
})

test('配布形態: 特商法の役務の提供の時期はダウンロード又はログイン後ただちに', () => {
	const text = textOf(read('company/asct.html'))
	assert.match(
		text,
		/ダウンロード又はログイン後、ただちにご利用いただけます。有料プランは決済完了後ただちにご利用いただけます。/,
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

test('版: legal.yml の version と eula / terms の最終更新日は 2026-10-12 のまま', () => {
	assert.match(read('_data/legal.yml'), new RegExp(`^version: "${LEGAL_VERSION}"$`, 'm'))
	assert.equal(lastUpdated(read('company/eula.html')), LEGAL_VERSION)
	assert.equal(lastUpdated(read('company/terms.html')), LEGAL_VERSION)
})
