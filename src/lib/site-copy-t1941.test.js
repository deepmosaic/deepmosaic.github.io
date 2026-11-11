// T-1941 (2026-11-11) Enterprise に「御社システムへの導入 (組み込み)」の相談を載せる回帰テスト。
//
//   node --test src/lib/site-copy-t1941.test.js
//
//   - 料金カード (`_data/plans.yml` の enterprise の `note` → `/price/` とトップの PRICING 節) に
//     「御社のシステム・サービスへの導入（組み込み）もご相談ください。内容に応じて別途お見積りします。」
//   - トップの「組織で使う（Enterprise）」カードにも同じ趣旨の 1 文。
//   - 導入相談ページ (`/enterprise/inquiry/`) のリード文・description と、フォームの「ご相談内容」の
//     placeholder に「自社システムへの導入のご相談」を例として入れる。
//   - 提供していない機能 (API・SDK・オンプレなど) を具体名で広告しない。企業名は出さない。
//   - 相談の CTA (`/enterprise/inquiry/`) と「維持管理費用」の注記は残す (CI の grep も見ている)。
//
// ビルド出力 (`/price/` と `/` のカード) の検査は `e2e/enterprise-integration.spec.ts`。
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { loadTiers } from './plans-yml.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const CARD_NOTE = '御社のシステム・サービスへの導入（組み込み）もご相談ください。内容に応じて別途お見積りします。'
const INQUIRY_EXAMPLE = '自社システムへの導入のご相談'
/** 提供していない導入形態の具体名。新しい文に出たら「無い機能の広告」になる。 */
const UNOFFERED = [/API/i, /SDK/i, /オンプレ/, /ライブラリ/, /OEM/i]

const enterprise = loadTiers().find((t) => t.code === 'enterprise')

/** front matter の `description:` 行の値。 */
function descriptionOf(source) {
	const head = source.split(/^---\s*$/m)[1] ?? ''
	const line = head.split(/\r?\n/).find((l) => l.startsWith('description:')) ?? ''
	return line.replace(/^description:\s*/, '')
}

/** index.html の「組織で使う（Enterprise）」カード (見出しから次の `</section>` まで)。 */
function topEnterpriseCard() {
	const index = read('index.html')
	const start = index.indexOf('組織で使う（Enterprise）')
	assert.ok(start >= 0, 'トップに「組織で使う（Enterprise）」カードが無い')
	return index.slice(start, index.indexOf('</section>', start))
}

function assertNoUnofferedFeature(text, where) {
	for (const re of UNOFFERED) {
		assert.doesNotMatch(text, re, `${where} に提供していない機能の具体名 (${re}) がある`)
	}
}

test('料金カード: Enterprise の note に導入 (組み込み) の相談と別途お見積りを書く', () => {
	assert.ok(enterprise, 'plans.yml に enterprise が無い')
	assert.equal(enterprise.note, CARD_NOTE)
	assertNoUnofferedFeature(enterprise.note, 'plans.yml の enterprise.note')
})

test('料金カード: 維持管理費用の注記と相談の CTA を残す', () => {
	assert.match(enterprise.price_note ?? '', /維持管理費用/)
	const yml = read('_data/plans.yml')
	const block = yml.slice(yml.indexOf('  - code: enterprise'))
	assert.match(block, /label: "導入について相談する"/)
	assert.match(block, /href: "\/enterprise\/inquiry\/"/)
})

test('料金カード: note を描く汎用の分岐が残っている', () => {
	assert.match(read('_includes/pricing-cards.html'), /\{%-? if plan\.note %\}/)
})

test('トップの「組織で使う（Enterprise）」カードに導入の相談の 1 文がある', () => {
	const card = topEnterpriseCard()
	assert.ok(card.includes('御社のシステム・サービスへの導入（組み込み）'), 'トップのカードに導入の相談が無い')
	assert.ok(card.includes('別途お見積り'), 'トップのカードに「別途お見積り」が無い')
	assert.ok(card.includes('href="/enterprise/inquiry/"'), 'トップのカードから導入相談のリンクが消えた')
	assertNoUnofferedFeature(card.replace(/<[^>]+>/g, ''), 'トップの Enterprise カード')
})

test('導入相談ページ: リード文と description に自社システムへの導入のご相談がある', () => {
	const page = read('enterprise/inquiry/index.html')
	const description = descriptionOf(page)
	assert.ok(description.includes(INQUIRY_EXAMPLE), `description: ${description}`)
	assertNoUnofferedFeature(description, '導入相談ページの description')

	const lead = page.slice(page.indexOf('<h1'), page.indexOf('</section>'))
	assert.ok(lead.includes(INQUIRY_EXAMPLE), '導入相談ページのリード文に例が無い')
	assertNoUnofferedFeature(lead.replace(/<[^>]+>|\{\{[^}]+\}\}/g, ''), '導入相談ページのリード文')
})

test('問い合わせフォーム: Enterprise の「ご相談内容」の placeholder に例を入れ、一般の問い合わせは変えない', () => {
	const form = read('src/islands/InquiryForm.svelte')
	const m = form.match(/placeholder=\{isGeneral\s*\?\s*'([^']*)'\s*:\s*'([^']*)'\}/)
	assert.ok(m, 'ご相談内容の placeholder が見つからない')
	const [, general, enterprisePlaceholder] = m
	assert.equal(general, '発生した操作、画面に出たメッセージ、お困りの内容などをご記入ください')
	assert.ok(enterprisePlaceholder.includes(INQUIRY_EXAMPLE), `placeholder: ${enterprisePlaceholder}`)
	assertNoUnofferedFeature(enterprisePlaceholder, 'フォームの placeholder')
})
