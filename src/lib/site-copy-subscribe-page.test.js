// 有料プランの申し込みページ `/subscribe/` と料金カードの導線。
//
//   node --test src/lib/site-copy-subscribe-page.test.js
//
//   - サイトに専用の申し込みページを作り、Web 版のアカウントで決済へ。
//   - 申し込みのボタンは Web 版の深いリンク `<web_app.url>?checkout=<plan code>` (Web 版が受ける)。
//     クエリ名は `_data/subscribe.yml` の `checkout_query`、ボタンを出すのは plans.yml で `subscribe` を持つプラン。
//   - 料金カード (トップと /price/) の Hobby / Pro のボタンは「アプリをダウンロード」(Store のインストーラ)。申し込みはこのページとアプリのプロフィールメニュー。
//   - Enterprise は見積のまま (申し込みボタンを出さず、導入相談へ)。
//   - 配布はサイト配布版と Microsoft Store 版の 2 通り。文は両方に合う形
//     「Windows 版のアプリのプロフィールメニュー、またはこのページから Web 版のアカウントで申し込める。
//     どちらでも同じアカウントで Desktop 版と Web 版の両方に効く」。Store 版についての文 (Store 版のアプリでも申し込める) と FAQ は
//     `_data/site.yml` の `distribution.store_enabled` が true のときだけ出す (部品 `_includes/store-subscribe-note.html` と
//     FAQ の `store_only: true` の項目。FAQ の部品と JSON-LD が同じ条件で外す)。
//   - FAQ は Store の項目を除いて 2〜3 件で、表示と FAQPage JSON-LD が同じデータ (page.faq_data)。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
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
	// プランごとの着地先 (#plan-<code>)
	assert.match(src, /id="plan-\{\{ plan\.code \}\}"/)
})

test('/subscribe/: アプリのプロフィールメニューかこのページで申し込め、同じアカウントで Desktop 版と Web 版の両方に効くことを書く', () => {
	const text = textOf(read(PAGE))
	assert.match(text, /Windows 版のアプリのプロフィールメニュー、またはこのページから Web 版のアカウントでお申し込みいただけます/)
	assert.match(text, /同じアカウントで Desktop 版と Web 版の両方でご利用いただけます/)
	assert.match(frontMatter(read(PAGE), 'description') ?? '', /Windows 版のアプリのプロフィールメニューからも申し込め/)
	// Store 版についての文は切り替えの部品の中だけ (ページの本文・description には書かない)
	assert.doesNotMatch(text, /Microsoft Store|購入画面/, 'ページの本文に Store 版の文が残っている (部品に移す)')
	assert.doesNotMatch(frontMatter(read(PAGE), 'description') ?? '', /Microsoft Store/)
	assert.match(stripComments(read(PAGE)), /\{%-? include store-subscribe-note\.html -?%\}/)
})

test('store-subscribe-note.html: 全体が store_enabled の if の中で、Store 版のアプリでも申し込めることを言語ごとのデータから出す', () => {
	const src = stripComments(read('_includes/store-subscribe-note.html'))
	const m = src.match(/^\s*\{%-?\s*if site\.data\.site\.distribution\.store_enabled\s*-?%\}([\s\S]*)\{%-?\s*endif\s*-?%\}\s*$/)
	assert.ok(m, '全体が store_enabled の if の中に無い (false のときに何かが出る)')
	assert.match(m[1], /data-store-note="subscribe"/)
	assert.match(m[1], /\.store_note\b/)
	const jaNote = read('_data/subscribe.yml').match(/^store_note: "(.*)"\s*$/m)
	assert.ok(jaNote, 'ja の store_note が無い')
	assert.match(jaNote[1], /^Microsoft Store 版のアプリでも、画面右上のプロフィールメニューから申し込めます/)
	assert.doesNotMatch(jaNote[1], /インストーラ/, 'インストーラ版と比べない (入手先は Store だけ)')
	// 切り替えの検査 (checks/store.mjs・i18n-site-data-plans.test.js) が頼る語 (Microsoft Store) は 3 言語とも残す
	for (const [lang, re] of [
		['en', /^In the Microsoft Store version of the app, you can also subscribe from the profile menu at the top right of the screen \(the payment screen opens in your browser\)/],
		['zh-tw', /^Microsoft Store 版的應用程式也可從畫面右上角的個人資料選單訂閱/],
	]) {
		const note = read(`_data/l10n/${lang}/subscribe.yml`).match(/^store_note: "(.*)"\s*$/m)
		assert.ok(note, `${lang} の store_note が無い`)
		assert.match(note[1], re, lang)
	}
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
	assert.match(cfg, /Windows 版のアプリでは、画面右上のプロフィールメニューから申し込めます（決済画面はブラウザで開きます）/)
	assert.match(cfg, /Windows 版のアプリのプロフィールメニューの「プランの契約と管理」からも行えます/)
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

test('料金カード: ボタンは「申し込む」ではなく、申し込みのページへ向けない (subscribe は申し込みのページだけが読む)', () => {
	const src = stripComments(read('_includes/pricing-cards.html'))
	assert.doesNotMatch(src, /plan\.subscribe|subscribe_label|\/subscribe\//)
	assert.match(src, /\{%- if plan\.cta\.kind == "download" %\}/)
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
	// 両方の配布に合う文。Store 版の補足は docs/store-edition.html にあり、#plan には書かない
	assert.match(textOf(planSec), /Windows 版のアプリのプロフィールメニュー、または有料プランのお申し込みのページから Web 版のアカウントで申し込めます/)
	assert.match(textOf(planSec), /同じアカウントで Desktop 版と Web 版の両方/)
	assert.match(textOf(planSec), /アプリにサインインし、画面右上のプロフィールアイコンをクリックします/)
	assert.doesNotMatch(textOf(planSec), /Microsoft Store|購入画面|ログイン/)
	assert.match(read('llms.txt'), /\{\{ U \}\}\/subscribe\//)
	assert.match(read('src/app.css'), /@source "\.\.\/subscribe\/\*\*\/\*\.html";/)
})

test('トップの料金節・料金ページ・llms.txt は両方の配布に合う文 (Store 版の文を書かない)', () => {
	const sub = read('index.html').match(/kicker="PRICING"[^%]*sub="([^"]*)"/)
	assert.ok(sub, 'トップの料金節の sub が無い')
	assert.match(sub[1], /^有料プランは、Windows 版のアプリのプロフィールメニュー、またはお申し込みページから Web 版のアカウントでお申し込みいただけます/)
	assert.doesNotMatch(sub[1], /「申し込む」/, '料金のカードに「申し込む」のボタンは無い')
	assert.match(sub[1], /Desktop 版と Web 版の両方/)
	assert.doesNotMatch(sub[1], /Microsoft Store/)
	const price = textOf(read('price/index.html'))
	assert.match(price, /有料プランは、Windows 版のアプリのプロフィールメニュー、またはお申し込みページから Web 版のアカウントでお申し込みいただけます/)
	assert.doesNotMatch(price, /Microsoft Store|購入画面/)
	const llms = read('llms.txt').split(/\r?\n/).find((l) => l.includes('{{ U }}/subscribe/'))
	assert.match(llms, /\): Windows 版のアプリのプロフィールメニュー、またはこのページから Web 版のアカウントで申し込める/)
	assert.match(llms, / \/ subscribe from the profile menu in the Windows app, or on this page with your Web edition account/)
	assert.doesNotMatch(llms, /Microsoft Store/)
	// 英中
	for (const [rel, re] of [
		['en/index.html', /^You can subscribe to a paid plan from the profile menu in the Windows app, or on the subscription page with your Web app account\./],
		['zh-tw/index.html', /^付費方案可從 Windows 版應用程式的個人資料選單，或透過付費方案申請頁面以網頁版的帳號申請/],
	]) {
		const s = read(rel).match(/kicker="PRICING"[^%]*sub="([^"]*)"/)
		assert.ok(s, `${rel}: 料金節の sub が無い`)
		assert.match(s[1], re, rel)
		assert.doesNotMatch(s[1], /Microsoft Store/, rel)
	}
	for (const [rel, re] of [
		['en/price/index.html', /You can subscribe to a paid plan from the profile menu in the Windows app or on the subscription page with your Web app account/],
		['zh-tw/price/index.html', /付費方案可從 Windows 版應用程式的個人資料選單，或透過付費方案申請頁面以網頁版的帳號申請/],
		['en/subscribe/index.html', /You can subscribe to a paid plan from the profile menu in the Windows app or from this page with your Web app account/],
		['zh-tw/subscribe/index.html', /付費方案可從 Windows 版應用程式的個人資料選單，或從本頁面以網頁版的帳號申請/],
	]) {
		const t = textOf(read(rel))
		assert.match(t, re, rel)
		assert.doesNotMatch(t, /Microsoft Store|purchase screen|購買畫面/, rel)
	}
	assert.match(frontMatter(read('en/subscribe/index.html'), 'description') ?? '', /, or from the profile menu in the Windows app\./)
	assert.match(frontMatter(read('zh-tw/subscribe/index.html'), 'description') ?? '', /也可從 Windows 版應用程式的個人資料選單申請/)
	for (const [lang, first, last] of [
		['en', /^ {4}a: "Yes\. In the Windows app, you can subscribe from the profile menu at the top right of the screen/m, /You can also use \\"Plan subscription and management\\" in the profile menu in the Windows app\./],
		['zh-tw', /^ {4}a: "可以。在 Windows 版的應用程式中，可從畫面右上角的個人資料選單訂閱/m, /也可從 Windows 版應用程式的個人資料選單中的「方案訂閱與管理」進行。/],
	]) {
		const yml = read(`_data/l10n/${lang}/subscribe.yml`)
		assert.match(yml, first, `${lang}: アプリから申し込めるかの FAQ`)
		assert.match(yml, last, `${lang}: 変更・解約の場所の FAQ`)
	}
})

test('Store の FAQ は 3 言語とも肯定で答え、Store 版のアプリのプロフィールメニューから申し込めると書く', () => {
	for (const [rel, re] of [
		['_data/subscribe.yml', /^はい。Microsoft Store 版のアプリでも、画面右上のプロフィールメニューから申し込めます。/],
		['_data/l10n/en/subscribe.yml', /^Yes\. In the Microsoft Store version of the app, you can also subscribe from the profile menu at the top right of the screen\./],
		['_data/l10n/zh-tw/subscribe.yml', /^可以。Microsoft Store 版的應用程式也可從畫面右上角的個人資料選單訂閱。/],
	]) {
		const m = read(rel).match(/^ {4}store_only: true\s*\r?\n {4}a: "(.*)"\s*$/m)
		assert.ok(m, `${rel}: store_only の項目の答えが無い`)
		assert.match(m[1], re, rel)
	}
})

/** 公開面のファイル (`*.html`・`_data/**\/*.yml`・`_includes/**\/*.html`・`llms*.txt`) を返す。 */
function publicFiles(dir = '') {
	const SKIP = new Set(['node_modules', '_site', '.git', '.jekyll-cache', 'vendor', 'e2e', 'test-results', 'playwright-report'])
	const out = []
	for (const ent of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const rel = dir ? `${dir}/${ent.name}` : ent.name
		if (ent.isDirectory()) {
			if (!SKIP.has(ent.name)) out.push(...publicFiles(rel))
			continue
		}
		if (rel.endsWith('.test.js')) continue
		if (rel.endsWith('.html') || /^llms.*\.txt$/.test(rel) || (rel.startsWith('_data/') && rel.endsWith('.yml'))) out.push(rel)
	}
	return out
}

/** 申し込みの場所 (アプリのプロフィールメニュー・Store 版のアプリ) を書いた文の目印。同じ文の中に両方の語がある所を数える。 */
const ROUTE_MENTIONS = [
	[/プロフィールメニュー/, /申し込/],
	[/profile menu/i, /subscri/i],
	[/個人資料選單/, /訂閱|申請/],
	[/Microsoft Store/, /購入|申し込|purchase|subscri|購買|訂閱|申請/i],
]

/** コメントとタグを落とした文を、文の区切りと改行で分けて、申し込みの場所を書いた文だけを返す。 */
function routeSentences(source) {
	const text = stripComments(source).replace(/^\s*#.*$/gm, '').replace(/<[^>]*>/g, '')
	return text
		.split(/[。！？\n]|\.\s/)
		.map((s) => s.trim())
		.filter((s) => ROUTE_MENTIONS.some(([a, b]) => a.test(s) && b.test(s)))
}

/**
 * 申し込みの場所を書いてよいファイル (許可の一覧)。どれも上のテストが文を 1 つずつ固定している。
 * 一覧に無いファイルに申し込みの場所を書いたら、文を決めてここと上のテストに足す。
 */
const ROUTE_FILES = [
	'index.html',
	'price/index.html',
	'subscribe/index.html',
	'llms.txt',
	'_data/subscribe.yml',
	'_includes/docs/02-account.html',
	'_includes/docs/store-edition.html',
	'_includes/docs/web.html',
	'en/index.html',
	'en/price/index.html',
	'en/subscribe/index.html',
	'_data/l10n/en/subscribe.yml',
	'zh-tw/index.html',
	'zh-tw/price/index.html',
	'zh-tw/subscribe/index.html',
	'_data/l10n/zh-tw/subscribe.yml',
	// 英中の docs は日本語の同じファイルの訳 (節ごとの hash で日本語と結ぶ)。07-team はメニューの項目の名前
	// (「プランの契約と管理」。英中の画面の文は subscription / 訂閱 を含む) を書いた文で、申し込みの場所の文ではない
	...['en', 'zh-tw'].flatMap((lang) => ['02-account', '07-team', 'store-edition', 'web'].map((n) => `_includes/docs/${lang}/${n}.html`)),
]

test('申し込みの場所を書いた文は許可の一覧のファイルにだけあり、一覧のファイルにはどれもある', () => {
	// 陽性対照と陰性対照: 同じ文に両方の語があるときだけ拾い、コメントの中は数えない
	assert.equal(routeSentences('<p>画面右上のプロフィールメニューから申し込めます。</p>').length, 1)
	assert.equal(routeSentences('<p>プロフィールメニューを開きます。申し込みはこちら。</p>').length, 0)
	assert.equal(routeSentences('{% comment %}プロフィールメニューから申し込める{% endcomment %}<!-- profile menu to subscribe -->').length, 0)
	assert.equal(routeSentences('store_note: "Microsoft Store 版のアプリには購入画面がありません"').length, 1)
	const files = publicFiles()
	assert.ok(files.includes('subscribe/index.html') && files.includes('_data/subscribe.yml') && files.includes('llms.txt'), '公開面の列挙が足りない')
	const found = files.filter((rel) => routeSentences(read(rel)).length > 0).sort()
	assert.deepEqual(found, [...ROUTE_FILES].sort())
})
