// T-1922 (2026-11-11) 有料プランの申し込みページ `/subscribe/` と料金カードの導線。
//
//   node --test src/lib/site-copy-t1922.test.js
//
//   - ユーザー決定「案 B」: サイトに専用の申し込みページを作り、Web 版のアカウントで Stripe の決済へ。
//   - 申し込みのボタンは Web 版の深いリンク `<web_app.url>?checkout=<plan code>` (Web 版の T-1922 が受ける)。
//     クエリ名は `_data/subscribe.yml` の `checkout_query`、ボタンを出すのは plans.yml で `subscribe` を持つプラン。
//   - 料金カード (トップと /price/) の Light / Pro は「申し込む → /subscribe/」(Store に戻ってループしない)。
//   - Enterprise は見積のまま (申し込みボタンを出さず、導入相談へ)。
//   - T-2306 (backlog1113): 2.14 はサイト配布版と Microsoft Store 版の両方で出す。文は両方に合う形
//     「アプリのプロフィールメニュー (Windows 版をダウンロードしてお使いの方)、またはこのページから Web 版のアカウントで申し込める。
//     どちらでも同じアカウントで Desktop 版と Web 版の両方に効く」。Store 版についての文 (購入画面が無い) と FAQ は
//     `_data/site.yml` の `distribution.store_enabled` が true のときだけ出す (部品 `_includes/store-subscribe-note.html` と
//     FAQ の `store_only: true` の項目。FAQ の部品と JSON-LD が同じ条件で外す)。
//   - FAQ は Store の項目を除いて 2〜3 件で、表示と FAQPage JSON-LD が同じデータ (page.faq_data)。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** front matter の 1 行スカラー (`key: value`) を返す。 */
function frontMatter(source, key) {
	const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	assert.ok(fm, 'front matter が無い')
	const line = fm[1].split(/\r?\n/).find((l) => l.startsWith(`${key}:`))
	return line === undefined ? null : line.slice(key.length + 1).trim()
}

/** plans.yml から `subscribe:` を持つ tier の code を返す (順序どおり)。 */
function subscribeCodes(yml) {
	const codes = []
	let code = null
	for (const line of yml.split(/\r?\n/)) {
		const tier = line.match(/^ {2}- code: (\S+)/)
		if (tier) code = tier[1]
		if (/^ {4}subscribe:\s*$/.test(line) && code !== null) codes.push(code)
	}
	return codes
}

const PAGE = 'subscribe/index.html'

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
	assert.deepEqual(subscribeCodes('  - code: a\n    subscribe:\n      label: "x"\n  - code: b\n'), ['a'])
	assert.equal(frontMatter('---\na: 1\n---\n', 'a'), '1')
	assert.equal(frontMatter('---\na: 1\n---\n', 'b'), null)
})

test('plans.yml: subscribe を持つのは Light と Pro だけ (Enterprise / Free には付けない)', () => {
	assert.deepEqual(subscribeCodes(read('_data/plans.yml')), ['light', 'pro'])
})

test('/subscribe/ が front matter 付きで存在し、構造化データ (アプリ / FAQ / パンくず) を出す', () => {
	assert.ok(existsSync(join(ROOT, PAGE)), `${PAGE} が無い`)
	const src = read(PAGE)
	assert.equal(frontMatter(src, 'layout'), 'default')
	assert.equal(frontMatter(src, 'permalink'), '/subscribe/')
	assert.equal(frontMatter(src, 'faq_data'), 'subscribe')
	assert.ok(frontMatter(src, 'title'), 'title が無い')
	assert.ok(frontMatter(src, 'description'), 'description が無い')
	const seo = frontMatter(src, 'seo_title') ?? ''
	assert.ok([...seo].length <= 30, `seo_title が 30 文字を超える: ${seo}`)
	for (const s of ['software-application', 'faq', 'breadcrumb']) {
		assert.match(src, new RegExp(`^\\s+- ${s}\\s*$`, 'm'), `schemas に ${s} が無い`)
	}
})

test('/subscribe/: ボタンは Web 版の ?checkout=<code> を指し、web_app_open の計測 (-webapp) を付ける', () => {
	const src = stripComments(read(PAGE))
	const cfg = read('_data/subscribe.yml')
	assert.match(cfg, /^checkout_query: "checkout"\s*$/m, 'checkout_query が Web 版の契約 (checkout) と違う')
	// 申し込み対象は plans.yml の subscribe から引き、Web 版の URL とクエリ名もデータから組む (直書きしない)
	assert.match(src, /where_exp: "p", "p\.subscribe"/)
	assert.match(src, /site\.data\.site\.web_app\.url/)
	assert.match(src, /site\.data\.subscribe\.checkout_query/)
	const btn = src.match(/<a href="\{\{ app_base \}\}\?\{\{ q \}\}=\{\{ plan\.code \}\}"[^>]*>/)
	assert.ok(btn, '申し込みボタン (<web_app.url>?<checkout_query>=<code>) が無い')
	assert.match(btn[0], /data-dl="subscribe-\{\{ plan\.code \}\}-webapp"/)
	assert.doesNotMatch(btn[0], /\sdownload(\s|=|>)/)
	assert.doesNotMatch(src, /app\.deepmosaic\.co\.jp/, 'Web 版の URL を直書きしている (site.yml の web_app.url を使う)')
	// 料金カードの「申し込む」の着地先 (#plan-<code>)
	assert.match(src, /id="plan-\{\{ plan\.code \}\}"/)
})

test('/subscribe/: アプリのプロフィールメニューかこのページで申し込め、同じアカウントで Desktop 版と Web 版の両方に効くことを書く (T-2306)', () => {
	const text = textOf(read(PAGE))
	assert.match(text, /アプリのプロフィールメニュー（Windows 版をダウンロードしてお使いの方）、またはこのページから Web 版のアカウントでお申し込みいただけます/)
	assert.match(text, /同じアカウントで Desktop 版と Web 版の両方でご利用いただけます/)
	assert.match(frontMatter(read(PAGE), 'description') ?? '', /プロフィールメニュー/)
	// Store 版についての文は切り替えの部品の中だけ (ページの本文・description には書かない)
	assert.doesNotMatch(text, /Microsoft Store|購入画面/, 'ページの本文に Store 版の文が残っている (部品に移す)')
	assert.doesNotMatch(frontMatter(read(PAGE), 'description') ?? '', /Microsoft Store/)
	assert.match(stripComments(read(PAGE)), /\{%-? include store-subscribe-note\.html -?%\}/)
})

test('store-subscribe-note.html: 全体が store_enabled の if の中で、購入画面が無いことを言語ごとのデータから出す (T-2306)', () => {
	const src = stripComments(read('_includes/store-subscribe-note.html'))
	const m = src.match(/^\s*\{%-?\s*if site\.data\.site\.distribution\.store_enabled\s*-?%\}([\s\S]*)\{%-?\s*endif\s*-?%\}\s*$/)
	assert.ok(m, '全体が store_enabled の if の中に無い (false のときに何かが出る)')
	assert.match(m[1], /data-store-note="subscribe"/)
	assert.match(m[1], /\.store_note\b/)
	assert.match(read('_data/subscribe.yml'), /^store_note: ".*Microsoft Store 版のアプリには購入画面がありません。.*"\s*$/m)
	for (const lang of ['en', 'zh-tw']) assert.match(read(`_data/l10n/${lang}/subscribe.yml`), /^store_note: ".*Microsoft Store.*"\s*$/m, lang)
	// 英中のページも同じ位置に部品を置く
	for (const rel of ['en/subscribe/index.html', 'zh-tw/subscribe/index.html']) {
		const page = stripComments(read(rel))
		assert.match(page, /\{%-? include store-subscribe-note\.html -?%\}/, rel)
		assert.doesNotMatch(textOf(read(rel)), /Microsoft Store/, `${rel}: 本文に Store 版の文が残っている`)
	}
})

test('/subscribe/: Enterprise は申し込みボタンではなく導入相談へ', () => {
	const src = stripComments(read(PAGE))
	assert.match(src, /href="\/enterprise\/inquiry\/"/)
	assert.doesNotMatch(src, /checkout=enterprise/)
})

/** subscribe.yml の faq を [{ q, storeOnly }] で返す (2 行目以降の `store_only: true` を見る)。 */
function faqItems(yml) {
	const items = []
	for (const line of yml.split(/\r?\n/)) {
		const q = line.match(/^ {2}- q: "(.*)"\s*$/)
		if (q) items.push({ q: q[1], storeOnly: false })
		else if (/^ {4}store_only: true\s*$/.test(line) && items.length > 0) items[items.length - 1].storeOnly = true
	}
	return items
}

test('/subscribe/: FAQ は Store の項目を除いて 2〜3 件で、表示と JSON-LD が同じデータを使う', () => {
	assert.deepEqual(faqItems('faq:\n  - q: "a"\n    a: "x"\n  - q: "b"\n    store_only: true\n    a: "y"\n'), [{ q: 'a', storeOnly: false }, { q: 'b', storeOnly: true }])
	const cfg = read('_data/subscribe.yml')
	const items = faqItems(cfg)
	const common = items.filter((i) => !i.storeOnly)
	assert.ok(common.length >= 2 && common.length <= 3, `Store 以外の FAQ が ${common.length} 件`)
	// 両方の配布に合う FAQ: アプリ (プロフィールメニュー) から申し込めるか
	assert.ok(common.some((i) => i.q === 'アプリから申し込めますか？'), 'アプリから申し込めるかの FAQ が無い')
	assert.match(cfg, /アプリの画面右上のプロフィールメニューから申し込めます/)
	// Store 版の FAQ は 1 件で store_only。ほかの項目は Store に触れない
	const store = items.filter((i) => i.storeOnly)
	assert.deepEqual(store.map((i) => i.q), ['Microsoft Store 版のアプリで申し込めますか？'])
	for (const i of common) assert.doesNotMatch(i.q, /Microsoft Store/)
	// 英中も同じ順・同じ位置に store_only
	for (const lang of ['en', 'zh-tw']) {
		assert.deepEqual(faqItems(read(`_data/l10n/${lang}/subscribe.yml`)).map((i) => i.storeOnly), items.map((i) => i.storeOnly), `${lang} の store_only の位置が ja と違う`)
	}
	assert.match(stripComments(read(PAGE)), /\{% include faq\.html items=site\.data\.subscribe\.faq %\}/)
	const schema = read('_includes/schema/faq.html')
	assert.match(schema, /site\.data\[page\.faq_data\]\.faq/)
	assert.match(schema, /for item in faq_src/)
	// 表示と JSON-LD が同じ条件で Store の項目を外す (食い違うと FAQPage のガイドライン違反)
	const drop = /\{%-?\s*unless site\.data\.site\.distribution\.store_enabled\s*-?%\}\s*\{%-?\s*assign (\w+) = \1 \| where_exp: "i", "i\.store_only != true"\s*-?%\}\s*\{%-?\s*endunless\s*-?%\}/
	assert.match(stripComments(read('_includes/faq.html')), drop, 'faq.html が store_only を外していない')
	assert.match(stripComments(schema), drop, 'schema/faq.html が store_only を外していない')
	const sch = stripComments(schema)
	assert.ok(sch.search(drop) < sch.indexOf('for item in faq_src'), 'schema/faq.html: 外すのがループの後になっている')
})

test('料金カード: subscribe があれば「申し込む → /subscribe/#plan-<code>」で、Store の DL ボタンより優先する', () => {
	const src = stripComments(read('_includes/pricing-cards.html'))
	const iSub = src.indexOf('{%- if plan.subscribe %}')
	const iDl = src.indexOf('{%- elsif plan.cta.kind == "download" %}')
	assert.ok(iSub >= 0 && iDl > iSub, 'subscribe の分岐が DL ボタンより先に無い')
	assert.match(src.slice(iSub, iDl), /href="\/subscribe\/#plan-\{\{ plan\.code \}\}"/)
	assert.match(src.slice(iSub, iDl), /\{\{ plan\.subscribe\.label \}\}/)
})

test('導線: フッター・料金ページ・トップの料金節・docs #plan・llms.txt が /subscribe/ を案内する', () => {
	assert.match(stripComments(read('_includes/footer.html')), /href="\/subscribe\/"/)
	const price = stripComments(read('price/index.html'))
	assert.match(price, /href="\/subscribe\/"/)
	assert.doesNotMatch(textOf(read('price/index.html')), /アプリ内のプラン管理からお手続き/)
	assert.doesNotMatch(read('index.html'), /アプリ内のプラン管理からお手続き/)
	const account = read('_includes/docs/02-account.html')
	const planSec = account.slice(account.indexOf('<section id="plan"'), account.indexOf('</section>', account.indexOf('<section id="plan"')))
	const plan = stripComments(planSec)
	assert.match(plan, /href="\/subscribe\/"/)
	// T-2306: 両方の配布に合う文。Store 版の補足は docs/store-edition.html (T-2305) にあり、#plan には書かない
	assert.match(textOf(planSec), /アプリのプロフィールメニュー（Windows 版をダウンロードしてお使いの方）、または有料プランのお申し込みのページから Web 版のアカウントで申し込めます/)
	assert.match(textOf(planSec), /同じアカウントで Desktop 版と Web 版の両方/)
	assert.match(textOf(planSec), /アプリにサインインし、画面右上のプロフィールアイコンをクリックします/)
	assert.doesNotMatch(textOf(planSec), /Microsoft Store|購入画面|ログイン/)
	assert.match(read('llms.txt'), /\{\{ U \}\}\/subscribe\//)
	assert.match(read('src/app.css'), /@source "\.\.\/subscribe\/\*\*\/\*\.html";/)
})

test('T-2306: トップの料金節・料金ページ・llms.txt は両方の配布に合う文 (Store 版の文を書かない)', () => {
	const sub = read('index.html').match(/kicker="PRICING"[^%]*sub="([^"]*)"/)
	assert.ok(sub, 'トップの料金節の sub が無い')
	assert.match(sub[1], /アプリのプロフィールメニュー、または各プランの「申し込む」から Web 版のアカウントでお申し込みいただけます/)
	assert.match(sub[1], /Desktop 版と Web 版の両方/)
	assert.doesNotMatch(sub[1], /Microsoft Store/)
	const price = textOf(read('price/index.html'))
	assert.match(price, /アプリのプロフィールメニュー（Windows 版をダウンロードしてお使いの方）、またはお申し込みページから Web 版のアカウントでお申し込みいただけます/)
	assert.doesNotMatch(price, /Microsoft Store|購入画面/)
	const llms = read('llms.txt').split(/\r?\n/).find((l) => l.includes('{{ U }}/subscribe/'))
	assert.match(llms, /プロフィールメニュー/)
	assert.match(llms, /profile menu/)
	assert.doesNotMatch(llms, /Microsoft Store/)
	// 英中
	for (const [rel, re] of [
		['en/index.html', /profile menu in the app/],
		['zh-tw/index.html', /個人資料選單/],
	]) {
		const s = read(rel).match(/kicker="PRICING"[^%]*sub="([^"]*)"/)
		assert.ok(s, `${rel}: 料金節の sub が無い`)
		assert.match(s[1], re, rel)
		assert.doesNotMatch(s[1], /Microsoft Store/, rel)
	}
	for (const [rel, re] of [
		['en/price/index.html', /profile menu in the app/],
		['zh-tw/price/index.html', /個人資料選單/],
	]) {
		const t = textOf(read(rel))
		assert.match(t, re, rel)
		assert.doesNotMatch(t, /Microsoft Store|purchase screen|購買畫面/, rel)
	}
})
