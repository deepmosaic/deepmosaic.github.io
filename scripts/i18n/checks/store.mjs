// Microsoft Store のボタンの出し分けの検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 切り替えは `_data/site.yml` の `distribution.store_enabled` 1 か所 (部品 `_includes/store-button.html`・docs の `_includes/docs/store-edition.html`・
//     申し込みのページの `_includes/store-subscribe-note.html`・FAQ の部品 `_includes/faq.html` と `_includes/schema/faq.html` だけが読む)。
//   - 英中の docs (`en/docs/index.html`・`zh-tw/docs/index.html`) のインストールの節は Microsoft Store 版の入手の手順なので、
//       切り替えによらず Store のボタン (docs-install-store) を 1 つ出す (`DOCS_INTL_PLACEMENTS`)。
//   - false (既定): サイト全体の出力に Store のボタン (目印 `data-store-button`) と掲載ページ (`apps.microsoft.com`) へのリンクが無い。
//       例外は英中の docs のボタン 1 つだけ (置き場所の検査をしてから、そのボタンを除いて同じ検査をする)。
//       法務文書 (`company/privacy`・`company/cookie`、ja だけ) も同じ検査の対象で、さらに本文に「配信ストア」の語が無い
//       (配信ストア版の記述は部品 `_includes/legal-distribution.html` が true のときだけ出す。HTML のコメントの中は数えない)。
//   - true: 4 か所 × 言語に 1 つずつボタンがあり、href が掲載ページ (`app_store_product_id` から)、文がその言語のもの、
//       download 属性が無い、data-dl は置き場所の値 (計測しない /join/ だけは data-dl を出さない)。それ以外の場所には出ない。
//   - 申し込みのページ (3 言語) の Store 版の文 (目印 `data-store-note`) と FAQ (`store_only: true` の項目) も同じ切り替えで出す。
//       false: 目印がどこにも無く、申し込みのページに `Microsoft Store` の語が無い (表示も JSON-LD も)。
//       true: 申し込みのページごとに目印が 1 つ、Store の FAQ が表示 (<details>) と FAQPage の JSON-LD の両方にある。ほかのページに目印は無い。
//   - true のとき、法務文書に配信ストア版の記述 (`LEGAL_STORE_MARKS`: privacy の 9-2 と公開後の 9-4、cookie の引き渡さない旨) がある。
//       法務文書にも Store のボタンは置かない (置き場所以外の検査の対象)。
//   - true の出力は普段のビルドには無いので、`scripts/check-store-toggle.mjs` が切り替えを true にしたデータの写しでビルドして
//     `checkStore(ctx, true)` を呼ぶ。check-site からは site.yml の値のとおりに検査する。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** ボタンの文 (ja は部品に直書き、英中は `_data/l10n/<lang>/parts.yml` の st_label と同じ値) */
export const STORE_LABELS = {
	ja: 'Microsoft Store で入手',
	en: 'Get it from Microsoft Store',
	'zh-tw': '從 Microsoft Store 取得',
}

const LANG_PREFIX = { ja: '', en: 'en/', 'zh-tw': 'zh-tw/' }

/** 申し込みのページ (Store 版の文と FAQ を切り替えで出す) */
export const SUBSCRIBE_PAGES = Object.values(LANG_PREFIX).map((pre) => `${pre}subscribe/index.html`)
const NOTE_RE = /\sdata-store-note\b/

/**
 * 法務文書 (ja だけ) の配信ストア版の記述。true のときにページごとに出るはずの文で、false のときは
 * 「配信ストア」の語そのものが本文に出ない (部品 `_includes/legal-distribution.html` が出し分ける)。
 */
export const LEGAL_STORE_MARKS = {
	'company/privacy.html': ['9-2 配信ストア版について', '配信ストア版をご利用ください'],
	'company/cookie.html': ['配信ストアへ引き渡さず'],
}
const LEGAL_STORE_WORD = '配信ストア'
const stripHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '')

/** 英中の docs のインストールの節 (切り替えによらず出す置き場所) */
export const DOCS_INTL_PLACEMENTS = [
	{ file: 'en/docs/index.html', id: 'docs-install-store', lang: 'en', tracked: true },
	{ file: 'zh-tw/docs/index.html', id: 'docs-install-store', lang: 'zh-tw', tracked: true },
]

/** 置き場所の一覧: { file, id, lang, tracked } */
export function expectedPlacements() {
	const out = []
	for (const [lang, pre] of Object.entries(LANG_PREFIX)) {
		out.push({ file: `${pre}index.html`, id: 'hero-store', lang, tracked: true })
		for (const page of ['', 'price/', 'spec/']) out.push({ file: `${pre}${page}index.html`, id: 'cta-store', lang, tracked: true })
		out.push({ file: `${pre}join/index.html`, id: 'join-store', lang, tracked: false })
	}
	// docs: ja は切り替えで出す、英中はいつも出す
	out.push({ file: 'docs/index.html', id: 'docs-install-store', lang: 'ja', tracked: true })
	out.push(...DOCS_INTL_PLACEMENTS)
	return out
}

/** `_data/site.yml` の `distribution.store_enabled` (無ければ false = 出さない側) */
export function readStoreEnabled(root) {
	const path = join(root, '_data', 'site.yml')
	if (!existsSync(path)) return false
	const m = readFileSync(path, 'utf8').match(/^distribution:[ \t]*\r?\n(?:[ \t]+(?:#.*|[a-z_]+:.*)\r?\n|[ \t]*\r?\n)*?[ \t]+store_enabled:[ \t]*(true|false)\b/m)
	return m?.[1] === 'true'
}

function storeUrl(root) {
	const id = JSON.parse(readFileSync(join(root, '_data', 'lang', 'ja.json'), 'utf8')).app_store_product_id
	return `https://apps.microsoft.com/detail/${id}`
}

/** 目印付きの <a> を { id, tag, text } で返す */
function buttonsOf(html) {
	return [...html.matchAll(/<a\b([^>]*\sdata-store-button="([^"]*)"[^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
		tag: m[1],
		id: m[2],
		text: m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
	}))
}

/** 置き場所 p のボタンが html に 1 つだけあり、href・文・download 属性・data-dl が正しいか */
function checkPlacement(html, p, url) {
	const errors = []
	const mine = buttonsOf(html).filter((b) => b.id === p.id)
	if (mine.length !== 1) return [`${p.file}: ${p.id} のボタンが ${mine.length} 個 (1 個のはず)`]
	const { tag, text } = mine[0]
	if (!tag.includes(`href="${url}"`)) errors.push(`${p.file}: ${p.id} の href が掲載ページ (${url}) でない`)
	if (text !== STORE_LABELS[p.lang]) errors.push(`${p.file}: ${p.id} の文が ${p.lang} のもの (${STORE_LABELS[p.lang]}) でない: ${text}`)
	if (/\sdownload(?:[\s=]|$)/.test(tag)) errors.push(`${p.file}: ${p.id} に download 属性がある (ファイル DL ではない)`)
	const dl = tag.match(/\sdata-dl="([^"]*)"/)?.[1]
	if (p.tracked && dl !== p.id) errors.push(`${p.file}: ${p.id} の data-dl が ${dl ?? '無い'} (計測の目印は ${p.id})`)
	if (!p.tracked && dl !== undefined) errors.push(`${p.file}: 計測しないページの ${p.id} に data-dl="${dl}" がある`)
	return errors
}

/** 目印が id のボタン (<a>…</a>) を除いた html */
const withoutButton = (html, id) =>
	html.replace(/<a\b[^>]*\sdata-store-button="([^"]*)"[^>]*>[\s\S]*?<\/a>/g, (all, bid) => (bid === id ? '' : all))

function checkDisabled(ctx) {
	const errors = []
	const docsIntl = new Map(DOCS_INTL_PLACEMENTS.map((p) => [p.file, p]))
	for (const rel of ctx.listHtml()) {
		let html = ctx.read(rel)
		const p = docsIntl.get(rel)
		if (p) {
			const own = checkPlacement(html, p, storeUrl(ctx.root))
			errors.push(...own)
			if (own.length === 0) html = withoutButton(html, p.id)
		}
		const found = []
		if (/data-store-button\b/.test(html)) found.push('Store のボタン (data-store-button)')
		if (/href="[^"]*apps\.microsoft\.com/i.test(html)) found.push('掲載ページ (apps.microsoft.com) へのリンク')
		if (NOTE_RE.test(html)) found.push('Store 版の文 (data-store-note)')
		if (SUBSCRIBE_PAGES.includes(rel) && /Microsoft Store/.test(html)) found.push('申し込みのページの Store 版の文・FAQ (Microsoft Store)')
		if (rel in LEGAL_STORE_MARKS && stripHtmlComments(html).includes(LEGAL_STORE_WORD)) found.push(`法務文書の${LEGAL_STORE_WORD} (版) の記述`)
		if (found.length > 0) errors.push(`${rel}: store_enabled が false なのに ${found.join('・')} が出ている`)
	}
	return errors
}

function checkEnabled(ctx) {
	const errors = []
	const url = storeUrl(ctx.root)
	const expected = expectedPlacements()
	const expectedByFile = new Map()
	for (const p of expected) expectedByFile.set(p.file, [...(expectedByFile.get(p.file) ?? []), p])

	for (const p of expected) {
		if (!ctx.exists(p.file)) {
			errors.push(`${p.file}: ページが無い (${p.id} を置けない)`)
			continue
		}
		errors.push(...checkPlacement(ctx.read(p.file), p, url))
	}

	// 申し込みのページの Store 版の文と FAQ (表示と JSON-LD)
	for (const rel of SUBSCRIBE_PAGES) {
		if (!ctx.exists(rel)) {
			errors.push(`${rel}: ページが無い (Store 版の文を置けない)`)
			continue
		}
		const html = ctx.read(rel)
		const notes = (html.match(/\sdata-store-note="subscribe"/g) ?? []).length
		if (notes !== 1) errors.push(`${rel}: Store 版の文 (data-store-note="subscribe") が ${notes} 個 (1 個のはず)`)
		const details = [...html.matchAll(/<details\b[\s\S]*?<\/details>/g)].map((m) => m[0])
		if (!details.some((d) => d.includes('Microsoft Store'))) errors.push(`${rel}: Store 版の FAQ が表示 (<details>) に無い`)
		const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((j) => j.includes('"FAQPage"'))
		if (!ld || !ld.includes('Microsoft Store')) errors.push(`${rel}: Store 版の FAQ が FAQPage の JSON-LD に無い`)
	}

	// 法務文書の配信ストア版の記述 (HTML のコメントの中は数えない)
	for (const [rel, marks] of Object.entries(LEGAL_STORE_MARKS)) {
		if (!ctx.exists(rel)) {
			errors.push(`${rel}: ページが無い (配信ストア版の記述を確かめられない)`)
			continue
		}
		const body = stripHtmlComments(ctx.read(rel))
		for (const mark of marks) {
			if (!body.includes(mark)) errors.push(`${rel}: 配信ストア版の記述「${mark}」が無い`)
		}
	}

	// 置き場所以外には出さない (ヘッダー・ドロワー・フッター・法務文書など)
	for (const rel of ctx.listHtml()) {
		const allowed = new Set((expectedByFile.get(rel) ?? []).map((p) => p.id))
		for (const b of buttonsOf(ctx.read(rel))) {
			if (!allowed.has(b.id)) errors.push(`${rel}: 置き場所でない所に Store のボタン (${b.id}) がある`)
		}
		if (!SUBSCRIBE_PAGES.includes(rel) && NOTE_RE.test(ctx.read(rel))) errors.push(`${rel}: 申し込みのページでない所に Store 版の文 (data-store-note) がある`)
	}
	return errors
}

/** enabled のとおりに検査し、エラーの文の配列を返す */
export function checkStore(ctx, enabled) {
	return enabled ? checkEnabled(ctx) : checkDisabled(ctx)
}

export default function check(ctx) {
	return checkStore(ctx, readStoreEnabled(ctx.root))
}
