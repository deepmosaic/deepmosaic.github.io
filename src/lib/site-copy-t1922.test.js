// T-1922 (2026-11-11) 有料プランの申し込みページ `/subscribe/` と料金カードの導線。
//
//   node --test src/lib/site-copy-t1922.test.js
//
//   - ユーザー決定「案 B」: サイトに専用の申し込みページを作り、Web 版のアカウントで Stripe の決済へ。
//   - 申し込みのボタンは Web 版の深いリンク `<web_app.url>?checkout=<plan code>` (Web 版の T-1922 が受ける)。
//     クエリ名は `_data/subscribe.yml` の `checkout_query`、ボタンを出すのは plans.yml で `subscribe` を持つプラン。
//   - 料金カード (トップと /price/) の Light / Pro は「申し込む → /subscribe/」(Store に戻ってループしない)。
//   - Enterprise は見積のまま (申し込みボタンを出さず、導入相談へ)。
//   - 「申し込みは Web 版のアカウントで行い、Store 版のアプリでもそのまま使えます」「Store 版アプリには購入画面がありません」。
//   - FAQ は 2〜3 件で、表示と FAQPage JSON-LD が同じデータ (page.faq_data)。
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

test('/subscribe/: Store 版アプリには購入画面が無いこと、Web 版のアカウントで申し込み Store 版でもそのまま使えることを書く', () => {
	const text = textOf(read(PAGE))
	assert.match(text, /お申し込みは Web 版のアカウントで行い、Microsoft Store 版のアプリでもそのまま使えます/)
	assert.match(text, /Microsoft Store 版のアプリには購入画面がありません/)
})

test('/subscribe/: Enterprise は申し込みボタンではなく導入相談へ', () => {
	const src = stripComments(read(PAGE))
	assert.match(src, /href="\/enterprise\/inquiry\/"/)
	assert.doesNotMatch(src, /checkout=enterprise/)
})

test('/subscribe/: FAQ は 2〜3 件で、表示と JSON-LD が同じデータを使う', () => {
	const cfg = read('_data/subscribe.yml')
	const qs = cfg.match(/^ {2}- q: /gm) ?? []
	assert.ok(qs.length >= 2 && qs.length <= 3, `FAQ が ${qs.length} 件`)
	assert.match(cfg, /購入画面がありません/)
	assert.match(stripComments(read(PAGE)), /\{% include faq\.html items=site\.data\.subscribe\.faq %\}/)
	const schema = read('_includes/schema/faq.html')
	assert.match(schema, /site\.data\[page\.faq_data\]\.faq/)
	assert.match(schema, /for item in faq_src/)
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
	const plan = stripComments(read('_includes/docs/02-account.html'))
	assert.match(plan, /href="\/subscribe\/"/)
	assert.match(textOf(plan), /Microsoft Store 版のアプリには購入画面がありません/)
	assert.match(read('llms.txt'), /\{\{ U \}\}\/subscribe\//)
	assert.match(read('src/app.css'), /@source "\.\.\/subscribe\/\*\*\/\*\.html";/)
})
