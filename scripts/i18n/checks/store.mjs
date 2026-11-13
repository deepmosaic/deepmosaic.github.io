// T-2304 (backlog1113): Microsoft Store のボタンの出し分けの検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - 切り替えは `_data/site.yml` の `distribution.store_enabled` 1 か所 (部品 `_includes/store-button.html` と docs の `_includes/docs/store-edition.html` だけが読む)。
//   - false (既定): サイト全体の出力に Store のボタン (目印 `data-store-button`) と掲載ページ (`apps.microsoft.com`) へのリンクが無い。
//       法務文書 (`company/privacy`・`company/cookie`、英中も) の本文は対象外 (T-1921 で別に扱う)。
//   - true: 4 か所 × 言語 (docs は ja だけ) に 1 つずつボタンがあり、href が掲載ページ (`app_store_product_id` から)、文がその言語のもの、
//       download 属性が無い、data-dl は置き場所の値 (計測しない /join/ だけは data-dl を出さない)。それ以外の場所には出ない。
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

/** 法務文書 (本文に Store の記述があってよい) */
const LEGAL_RE = /^(?:(?:en|zh-tw)\/)?company\/(?:privacy|cookie)(?:\/|\.html)/

/** 置き場所の一覧: { file, id, lang, tracked } */
export function expectedPlacements() {
	const out = []
	for (const [lang, pre] of Object.entries(LANG_PREFIX)) {
		out.push({ file: `${pre}index.html`, id: 'hero-store', lang, tracked: true })
		for (const page of ['', 'price/', 'spec/']) out.push({ file: `${pre}${page}index.html`, id: 'cta-store', lang, tracked: true })
		out.push({ file: `${pre}join/index.html`, id: 'join-store', lang, tracked: false })
	}
	// docs は日本語だけ
	out.push({ file: 'docs/index.html', id: 'docs-install-store', lang: 'ja', tracked: true })
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

function checkDisabled(ctx) {
	const errors = []
	for (const rel of ctx.listHtml()) {
		if (LEGAL_RE.test(rel)) continue
		const html = ctx.read(rel)
		const found = []
		if (/data-store-button\b/.test(html)) found.push('Store のボタン (data-store-button)')
		if (/href="[^"]*apps\.microsoft\.com/i.test(html)) found.push('掲載ページ (apps.microsoft.com) へのリンク')
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
		const mine = buttonsOf(ctx.read(p.file)).filter((b) => b.id === p.id)
		if (mine.length !== 1) {
			errors.push(`${p.file}: ${p.id} のボタンが ${mine.length} 個 (1 個のはず)`)
			continue
		}
		const { tag, text } = mine[0]
		if (!tag.includes(`href="${url}"`)) errors.push(`${p.file}: ${p.id} の href が掲載ページ (${url}) でない`)
		if (text !== STORE_LABELS[p.lang]) errors.push(`${p.file}: ${p.id} の文が ${p.lang} のもの (${STORE_LABELS[p.lang]}) でない: ${text}`)
		if (/\sdownload(?:[\s=]|$)/.test(tag)) errors.push(`${p.file}: ${p.id} に download 属性がある (ファイル DL ではない)`)
		const dl = tag.match(/\sdata-dl="([^"]*)"/)?.[1]
		if (p.tracked && dl !== p.id) errors.push(`${p.file}: ${p.id} の data-dl が ${dl ?? '無い'} (計測の目印は ${p.id})`)
		if (!p.tracked && dl !== undefined) errors.push(`${p.file}: 計測しないページの ${p.id} に data-dl="${dl}" がある`)
	}

	// 置き場所以外には出さない (ヘッダー・ドロワー・フッターなど)
	for (const rel of ctx.listHtml()) {
		if (LEGAL_RE.test(rel)) continue
		const allowed = new Set((expectedByFile.get(rel) ?? []).map((p) => p.id))
		for (const b of buttonsOf(ctx.read(rel))) {
			if (!allowed.has(b.id)) errors.push(`${rel}: 置き場所でない所に Store のボタン (${b.id}) がある`)
		}
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
