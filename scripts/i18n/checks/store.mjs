// ダウンロードの導線 (Microsoft Store の公式のバッジ) の検査 (check-site のモジュール)。ビルドの出力 (_site) を読む。
//
//   - ダウンロードの導線は Microsoft Store だけ。公式サイトからインストーラを配る導線は持たない。
//       `_data/site.yml` の `distribution.store_enabled` は true のまま置く (false はダウンロードの導線が無くなるのでエラー 1 件)。
//   - 切り替えを読むのは次の部品と動作環境の表だけ。ほかのページに条件を書かない。
//       store_enabled: `_includes/store-button.html`・`_includes/docs/store-edition.html`・`_includes/store-subscribe-note.html`・
//                      `_includes/faq.html`・`_includes/schema/faq.html`・`_includes/legal-distribution.html`、動作環境の表 (`spec/index.html` と英中・`llms-full.txt`)
//   - Store へ向くリンクの href は公式のバッジと同じ形の掲載ページ (`storeBadgeUrl`。部品 `_includes/store-install-url.html` が
//       `app_store_product_id` とページの言語 (`STORE_HL`) から作る)。クエリの無い掲載ページ (`storeListingUrl`) は JSON-LD の `downloadUrl` だけ。
//   - バッジ (目印 `data-store-button` の <a> の中の <img>) は、ページの言語の画像 (`badgeSrc`) と alt (`STORE_LABELS`)、元の寸法を持つ。
//       置き場所は 4 か所 × 3 言語 (`expectedPlacements`)。href がページの言語のバッジの行き先、download 属性が無い、data-dl は置き場所の値
//       (計測しない /join/ だけは data-dl を出さない)。ヘッダーと料金のカードもバッジ。
//   - フッターは文字のリンク (文は `STORE_LABELS`)、ドロワーの `data-links` の先頭はバッジの行き先・`dl: mobile`・download なし・同じ文。
//       JSON-LD の `downloadUrl` はクエリの無い掲載ページ。出力のどのファイル (HTML・txt・xml・JSON) にもインストーラの受け口・配布物 (`INSTALLER_MARKS`) が無い。
//   - 申し込みのページ (3 言語) の Store 版の文 (目印 `data-store-note`) と FAQ (`store_only: true` の項目、表示と FAQPage の JSON-LD)、
//       法務文書の配信ストア版の記述 (`LEGAL_STORE_MARKS`)、動作環境の Windows の表の「Microsoft Store 版」の行 (`SPEC_STORE_KEYS`) が出る。
//   - check-site からは、置き場所のページがそろった実際のビルドのときだけ検査する (default export の説明)。

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** バッジの alt とフッター・ドロワーの文 (バッジに書かれた文と同じ。ja は部品に直書き、英中は `_data/l10n/<lang>/parts.yml` の st_label と同じ値) */
export const STORE_LABELS = {
	ja: 'Microsoft Store からダウンロード',
	en: 'Download from the Microsoft Store',
	'zh-tw': '從 Microsoft Store 下載',
}

const LANG_PREFIX = { ja: '', en: 'en/', 'zh-tw': 'zh-tw/' }

/** ページの言語のバッジの画像 (`assets/img/store-badge/<lang>.svg`。Microsoft の配布元の画像) */
export const badgeSrc = (lang) => `/assets/img/store-badge/${lang}.svg`

/** 出力のパスからページの言語 */
export const langOfFile = (rel) => (rel.startsWith('en/') ? 'en' : rel.startsWith('zh-tw/') ? 'zh-tw' : 'ja')

/** 申し込みのページ (Store 版の文と FAQ を切り替えで出す) */
export const SUBSCRIBE_PAGES = Object.values(LANG_PREFIX).map((pre) => `${pre}subscribe/index.html`)
const NOTE_RE = /\sdata-store-note\b/

/** 料金のカードのあるページ (Free の帯のバッジ) */
const PRICE_PAGES = Object.values(LANG_PREFIX).map((pre) => `${pre}price/index.html`)

/** インストーラの受け口と配布物 (出力に 1 件も出さない) */
export const INSTALLER_PATH = 'download/latest/windows'
export const INSTALLER_MARKS = [INSTALLER_PATH, 'download/latest', '/download/issue', 'releases/latest', 'latest.json', 'setup.exe']
const TEXT_EXT = /\.(?:html|txt|xml|json)$/

/** 法務文書 (ja だけ) の配信ストア版の記述。ページごとに出るはずの文 (部品 `_includes/legal-distribution.html` が出す) */
export const LEGAL_STORE_MARKS = {
	'company/privacy.html': ['9-2 配信ストア版について', '配信ストア版をご利用ください'],
	'company/cookie.html': ['配信ストアへ引き渡さず'],
}
const stripHtmlComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '')

/** 動作環境の Windows の表の Store 版の行の key (ja は `_data/spec.yml`、英中は `_data/l10n/<lang>/spec.yml` と同じ値) */
export const SPEC_STORE_KEYS = {
	ja: 'Microsoft Store 版',
	en: 'Microsoft Store edition',
	'zh-tw': 'Microsoft Store 版本',
}
const SPEC_PAGES = Object.fromEntries(Object.entries(LANG_PREFIX).map(([lang, pre]) => [lang, `${pre}spec/index.html`]))
/** 動作環境を日本語のデータで出す AI 向けの概要 (ja だけ) */
const LLMS_FULL = 'llms-full.txt'
const countOf = (text, word) => text.split(word).length - 1

/** 動作環境 (3 言語) に Store 版の行が 1 つずつある */
function specEnabledErrors(ctx) {
	const errors = []
	for (const [lang, rel] of Object.entries(SPEC_PAGES)) {
		if (!ctx.exists(rel)) {
			errors.push(`${rel}: ページが無い (Microsoft Store 版の行を確かめられない)`)
			continue
		}
		const n = countOf(stripHtmlComments(ctx.read(rel)), SPEC_STORE_KEYS[lang])
		if (n !== 1) errors.push(`${rel}: 動作環境の Microsoft Store 版の行 (${SPEC_STORE_KEYS[lang]}) が ${n} 個 (1 個のはず)`)
	}
	return errors
}

/** 置き場所の一覧: { file, id, lang, tracked } */
export function expectedPlacements() {
	const out = []
	for (const [lang, pre] of Object.entries(LANG_PREFIX)) {
		out.push({ file: `${pre}index.html`, id: 'hero-store', lang, tracked: true })
		for (const page of ['', 'price/', 'spec/']) out.push({ file: `${pre}${page}index.html`, id: 'cta-store', lang, tracked: true })
		out.push({ file: `${pre}join/index.html`, id: 'join-store', lang, tracked: false })
	}
	for (const [lang, pre] of Object.entries(LANG_PREFIX)) out.push({ file: `${pre}docs/index.html`, id: 'docs-install-store', lang, tracked: true })
	return out
}
const PLACEMENT_IDS = new Set(expectedPlacements().map((p) => p.id))

/** site.yml の文字列から `distribution.store_enabled` を読む (無ければ false) */
export function parseStoreEnabled(yaml) {
	const block = yaml.match(/^distribution:[ \t]*\r?\n((?:[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m)?.[1] ?? ''
	return block.match(/^[ \t]+store_enabled:[ \t]*(true|false)\b/m)?.[1] === 'true'
}

/** `_data/site.yml` の `distribution.store_enabled` (無ければ false = ダウンロードの導線が無い) */
export function readStoreEnabled(root) {
	const path = join(root, '_data', 'site.yml')
	return existsSync(path) ? parseStoreEnabled(readFileSync(path, 'utf8')) : false
}

const productIdOf = (root) => JSON.parse(readFileSync(join(root, '_data', 'lang', 'ja.json'), 'utf8')).app_store_product_id

/** クエリの無い掲載ページ (JSON-LD の `downloadUrl` だけが使う) */
export function storeListingUrl(root) {
	return `https://apps.microsoft.com/detail/${productIdOf(root)}`
}

/** バッジの行き先の掲載ページの言語 (`hl`)。国 (`gl`) は付けない */
export const STORE_HL = { ja: 'ja-JP', en: 'en-US', 'zh-tw': 'zh-TW' }

/** 公式のバッジと同じ形の行き先 (`_includes/store-install-url.html` と同じ形)。Store へ向くボタン・リンクの href */
export function storeBadgeUrl(root, lang) {
	if (!STORE_HL[lang]) throw new Error(`知らない言語: ${lang}`)
	return `${storeListingUrl(root)}?referrer=appbadge&mode=direct&hl=${STORE_HL[lang]}`
}

/** 目印付きの <a> を { id, tag, text, imgs } で返す (imgs は中の <img> の開始タグ) */
function buttonsOf(html) {
	return [...html.matchAll(/<a\b([^>]*\sdata-store-button="([^"]*)"[^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
		tag: m[1],
		id: m[2],
		text: m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
		imgs: [...m[3].matchAll(/<img\b[^>]*>/g)].map((x) => x[0]),
	}))
}

const hasDownloadAttr = (tag) => /\sdownload(?:[\s=]|$)/.test(tag)
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]

/** バッジの中身: 画像 1 つ・ページの言語の画像と alt・元の寸法・画像のほかに文が無い。問題の文の配列 */
function badgeProblems(b, lang) {
	const out = []
	if (b.text !== '') out.push(`バッジの <a> に画像のほかの文がある: ${b.text}`)
	if (b.imgs.length !== 1) return [...out, `バッジの画像が ${b.imgs.length} 個 (1 個のはず)`]
	const img = b.imgs[0]
	if (attr(img, 'src') !== badgeSrc(lang)) out.push(`バッジの画像が ${lang} の版 (${badgeSrc(lang)}) でない: ${attr(img, 'src') ?? '無い'}`)
	if (attr(img, 'alt') !== STORE_LABELS[lang]) out.push(`バッジの alt が ${lang} のもの (${STORE_LABELS[lang]}) でない: ${attr(img, 'alt') ?? '無い'}`)
	if (attr(img, 'width') !== '161' || attr(img, 'height') !== '44') out.push('バッジの画像の width / height が元の寸法 (161 × 44) でない')
	return out
}

/** 置き場所のバッジ (4 か所 × 3 言語) */
function placementErrors(ctx, urlOf) {
	const errors = []
	for (const p of expectedPlacements()) {
		if (!ctx.exists(p.file)) {
			errors.push(`${p.file}: ページが無い (${p.id} を置けない)`)
			continue
		}
		const mine = buttonsOf(ctx.read(p.file)).filter((b) => b.id === p.id)
		if (mine.length !== 1) {
			errors.push(`${p.file}: ${p.id} のバッジが ${mine.length} 個 (1 個のはず)`)
			continue
		}
		const { tag } = mine[0]
		const url = urlOf(p.lang)
		if (!tag.includes(`href="${url}"`)) errors.push(`${p.file}: ${p.id} の href がバッジの行き先 (${url}) でない`)
		for (const problem of badgeProblems(mine[0], p.lang)) errors.push(`${p.file}: ${p.id} の${problem}`)
		if (hasDownloadAttr(tag)) errors.push(`${p.file}: ${p.id} に download 属性がある (ファイル DL ではない)`)
		const dl = attr(tag, 'data-dl')
		if (p.tracked && dl !== p.id) errors.push(`${p.file}: ${p.id} の data-dl が ${dl ?? '無い'} (計測の目印は ${p.id})`)
		if (!p.tracked && dl !== undefined) errors.push(`${p.file}: 計測しないページの ${p.id} に data-dl="${dl}" がある`)
	}
	return errors
}

/** 申し込みのページ・法務文書・動作環境の Store 版の記述 */
function storeContentErrors(ctx) {
	const errors = []
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
	errors.push(...specEnabledErrors(ctx))
	for (const rel of ctx.listHtml()) {
		if (!SUBSCRIBE_PAGES.includes(rel) && NOTE_RE.test(ctx.read(rel))) errors.push(`${rel}: 申し込みのページでない所に Store 版の文 (data-store-note) がある`)
	}
	return errors
}

/** ドロワーの data-links の JSON (HTML の属性の実体参照を戻して読む。読めなければ null) */
function drawerLinks(html) {
	const raw = html.match(/data-island="mobile-nav"[^>]*\sdata-links='([^']*)'/)?.[1]
	if (raw === undefined) return undefined
	try {
		return JSON.parse(raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'))
	} catch {
		return null
	}
}

/** 出力の全テキストファイル (HTML・txt・xml・JSON) の相対パス */
function listTextFiles(siteDir) {
	const out = []
	const walk = (d) => {
		for (const name of readdirSync(d)) {
			const abs = join(d, name)
			if (statSync(abs).isDirectory()) walk(abs)
			else if (TEXT_EXT.test(name)) out.push(relative(siteDir, abs).split(sep).join('/'))
		}
	}
	if (existsSync(siteDir)) walk(siteDir)
	return out.sort()
}

/** 置き場所でない所 (ヘッダー・フッター・料金のカード)・ドロワー・JSON-LD・インストーラの受け口。urlOf は言語 → バッジの行き先、listing はクエリの無い掲載ページ */
function singleLinkErrors(ctx, urlOf, listing) {
	const errors = []
	for (const rel of ctx.listHtml()) {
		const html = ctx.read(rel)
		const lang = langOfFile(rel)
		const url = urlOf(lang)
		const buttons = buttonsOf(html)
		// 置き場所でない目印のリンク: バッジの行き先・download なし・data-dl が同じ値。フッターは文字のリンク、ほか (ヘッダー・料金のカード) はバッジ
		for (const b of buttons.filter((x) => !PLACEMENT_IDS.has(x.id))) {
			if (!b.tag.includes(`href="${url}"`)) errors.push(`${rel}: ${b.id} のリンクの href がバッジの行き先 (${url}) でない`)
			if (hasDownloadAttr(b.tag)) errors.push(`${rel}: ${b.id} のリンクに download 属性がある (ファイル DL ではない)`)
			if (attr(b.tag, 'data-dl') !== b.id) errors.push(`${rel}: ${b.id} のリンクの data-dl が ${attr(b.tag, 'data-dl') ?? '無い'} (${b.id} のはず)`)
			if (b.id === 'footer') {
				if (b.text !== STORE_LABELS[lang] || b.imgs.length > 0) errors.push(`${rel}: フッターの Store のリンクの文が ${lang} のもの (${STORE_LABELS[lang]}) でない: ${b.text}`)
			} else {
				for (const problem of badgeProblems(b, lang)) errors.push(`${rel}: ${b.id} の${problem}`)
			}
		}
		const links = drawerLinks(html)
		if (links !== undefined) {
			const first = links?.[0]
			if (!first || first.href !== url || first.dl !== 'mobile' || first.download !== undefined || first.target !== '_blank' || first.label !== STORE_LABELS[lang]) {
				errors.push(`${rel}: ドロワーの先頭がバッジの行き先 (href ${url}・dl mobile・target _blank・download なし・文 ${STORE_LABELS[lang]}) でない: ${JSON.stringify(first ?? null)}`)
			}
			const headers = buttons.filter((b) => b.id === 'header').length
			if (headers !== 1) errors.push(`${rel}: ヘッダーの Store のリンク (data-store-button="header") が ${headers} 個 (1 個のはず)`)
		}
		if (/<footer\b/.test(html)) {
			const footers = buttons.filter((b) => b.id === 'footer').length
			if (footers !== 1) errors.push(`${rel}: フッターの Store のリンク (data-store-button="footer") が ${footers} 個 (1 個のはず)`)
		}
		for (const m of html.matchAll(/"downloadUrl":\s*"([^"]*)"/g)) {
			if (m[1] !== listing) errors.push(`${rel}: JSON-LD の downloadUrl がクエリの無い掲載ページ (${listing}) でない: ${m[1]}`)
		}
		for (const m of html.matchAll(/<a\b[^>]*href="https:\/\/(?:apps|get)\.microsoft\.com[^"]*"[^>]*>/g)) {
			if (hasDownloadAttr(m[0])) errors.push(`${rel}: Store へのリンクに download 属性がある: ${m[0]}`)
		}
	}
	for (const rel of PRICE_PAGES) {
		if (!ctx.exists(rel)) continue
		const cards = buttonsOf(ctx.read(rel)).filter((b) => !PLACEMENT_IDS.has(b.id) && b.id !== 'header' && b.id !== 'footer')
		if (cards.length === 0) errors.push(`${rel}: 料金のカードに Store へのリンク (data-store-button) が無い`)
	}
	for (const rel of listTextFiles(ctx.siteDir)) {
		const text = ctx.read(rel)
		for (const mark of INSTALLER_MARKS) {
			if (text.includes(mark)) errors.push(`${rel}: インストーラの受け口・配布物 (${mark}) が出力に残っている`)
		}
	}
	return errors
}

/** 置き場所のバッジの id (hero-store など) を置き場所以外に出さない */
function misplacedPlacementErrors(ctx) {
	const errors = []
	const allowedByFile = new Map()
	for (const p of expectedPlacements()) allowedByFile.set(p.file, [...(allowedByFile.get(p.file) ?? []), p.id])
	for (const rel of ctx.listHtml()) {
		const allowed = new Set(allowedByFile.get(rel) ?? [])
		for (const b of buttonsOf(ctx.read(rel))) {
			if (PLACEMENT_IDS.has(b.id) && !allowed.has(b.id)) errors.push(`${rel}: 置き場所でない所に Store のボタン (${b.id}) がある`)
		}
	}
	return errors
}

/** 検査し、エラーの文の配列を返す。store は `distribution.store_enabled` の値 */
export function checkStore(ctx, store) {
	if (!store) return ['_data/site.yml: store_enabled が false (ダウンロードの導線が無くなる)']
	const urlOf = (lang) => storeBadgeUrl(ctx.root, lang)
	return [...placementErrors(ctx, urlOf), ...storeContentErrors(ctx), ...misplacedPlacementErrors(ctx), ...singleLinkErrors(ctx, urlOf, storeListingUrl(ctx.root))]
}

/**
 * check-site から: site.yml の値で検査する。store_enabled が true のときは、置き場所のページがそろった実際のビルドのときだけ見る
 * (ja のトップがレイアウトを通っている = `<link rel="canonical"` を持つ。ほかの検査の模型では何もしない。checks/complete.mjs と同じ線引き)。
 */
export default function check(ctx) {
	const store = readStoreEnabled(ctx.root)
	const built = ctx.exists('index.html') && /<link rel="canonical"/.test(ctx.read('index.html'))
	if (store && !built) return []
	return checkStore(ctx, store)
}
