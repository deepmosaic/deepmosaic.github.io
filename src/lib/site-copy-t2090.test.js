// T-2090 (login1111, 2026-11-11) 法人の案内メールのリンクの着地点 `/join/` の原稿とレイアウトの固定。
//
//   node --test src/lib/site-copy-t2090.test.js
//
//   - 表示の振る舞い (3 つの表示・href・計測のリクエストが出ないこと) はビルド出力に対して `e2e/join.spec.ts` が見る。
//     ここでは原稿 (front matter・文言・属性) とレイアウトの「計測なし」の切り替えを固定する。
//   - 読み取りはこのファイル内で完結させる (site-copy-t1922.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

/** `data-join-view="<kind>"` の要素の中身 (入れ子の div を数えて閉じ位置を探す)。 */
function viewBlock(html, kind) {
	const start = html.indexOf(`data-join-view="${kind}"`)
	assert.notEqual(start, -1, `data-join-view="${kind}" が無い`)
	const open = html.lastIndexOf('<div', start)
	let depth = 0
	const re = /<div\b|<\/div>/g
	re.lastIndex = open
	for (let m = re.exec(html); m !== null; m = re.exec(html)) {
		depth += m[0] === '</div>' ? -1 : 1
		if (depth === 0) return html.slice(open, m.index + m[0].length)
	}
	assert.fail(`data-join-view="${kind}" が閉じていない`)
}

const PAGE = 'join/index.html'
const page = read(PAGE)
const body = stripComments(page)

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
	assert.equal(frontMatter('---\na: 1\n---\n', 'a'), '1')
	assert.equal(frontMatter('---\na: 1\n---\n', 'b'), null)
	assert.equal(viewBlock('<div data-join-view="a"><div>x</div></div><p>', 'a'), '<div data-join-view="a"><div>x</div></div>')
})

test('front matter: /join/ に置き、計測なし・noindex・サイトマップ外', () => {
	assert.equal(frontMatter(page, 'layout'), 'default')
	assert.equal(frontMatter(page, 'permalink'), '/join/')
	assert.equal(frontMatter(page, 'title'), 'Deepmosaic を開く')
	assert.ok(frontMatter(page, 'description'), 'description は必須 (SEO 規約)')
	assert.equal(frontMatter(page, 'noindex'), 'true')
	assert.equal(frontMatter(page, 'sitemap'), 'false')
	assert.equal(frontMatter(page, 'no_tracking'), 'true')
	// 計測の目印 (data-dl) と JSON-LD を載せない
	assert.equal(/data-dl\b/.test(body), false, 'data-dl を付けない (計測の対象にしない)')
	assert.equal(frontMatter(page, 'schemas'), null)
})

test('見出しと 3 つの表示 (既定はすべて hidden)', () => {
	assert.match(body, /<h1[^>]*>Deepmosaic を開く<\/h1>/)
	for (const kind of ['code', 'admin', 'invalid']) {
		const block = viewBlock(body, kind)
		assert.match(block.slice(0, block.indexOf('>') + 1), /\shidden[\s>]/, `${kind} は既定で hidden`)
	}
})

test('組織コードの表示: 文言・ボタン・手順 3 行・コピー', () => {
	const block = viewBlock(body, 'code')
	const text = textOf(block)
	assert.match(text, /組織コード\s*でアプリを開きます。/)
	assert.match(block, /<strong[^>]*data-join-code[^>]*><\/strong>/, 'コードは JS が textContent で入れる (原稿は空)')
	// 主ボタンの href は JS が検証後に入れる (原稿には持たせない)
	const open = block.match(/<a\b[^>]*data-join-open-code[^>]*>([^<]*)<\/a>/)
	assert.ok(open, '「アプリで開く」が無い')
	assert.equal(open[1], 'アプリで開く')
	assert.equal(/href=/.test(open[0]), false, '原稿の時点では href を持たない')
	const steps = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1])
	assert.equal(steps.length, 3)
	assert.match(steps[0], /「アプリで開く」を押します/)
	assert.match(steps[1], /「エンタープライズプランの方はこちら」に組織コードが入っていることを確かめます/)
	assert.match(steps[2], /「メールアドレスではじめる」または「パスワードで登録済みの方はこちら」からログインします/)
	assert.match(block, /<button type="button"[^>]*data-join-copy[^>]*>コピー<\/button>/)
	assert.match(block, /data-join-copy-status/)
})

test('管理者の表示: deepmosaic://login と手順 2 行', () => {
	const block = viewBlock(body, 'admin')
	assert.match(textOf(block), /管理者としてログインします。/)
	assert.match(block, /<a href="deepmosaic:\/\/login"[^>]*>アプリで開く<\/a>/)
	const steps = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1])
	assert.equal(steps.length, 2)
	assert.match(steps[1], /案内メールを受け取ったメールアドレスでログインします \(組織コードは入力しません\)/)
})

test('不正なリンクの表示: 文言だけでボタンを出さない', () => {
	const block = viewBlock(body, 'invalid')
	assert.match(textOf(block), /リンクが正しくありません。メールのリンクをもう一度開くか、アプリを起動して組織コードを入力してください。/)
	assert.equal(/<a\b|<button\b/.test(block), false)
})

test('アプリをまだ入れていない方: Microsoft Store (既存の DL URL) へ、別タブ・noopener', () => {
	assert.match(body, /アプリをまだ入れていない方/)
	assert.match(body, /入れた後に、もう一度このページの「アプリで開く」を押してください。/)
	const store = body.match(/<a\b[^>]*data-join-store[^>]*>/)
	assert.ok(store, 'Store へのリンクが無い')
	assert.match(store[0], /href="\{\{ store_url \}\}"/)
	assert.match(page, /assign store_url = site\.data\.lang\.ja\.app_download_link/)
	assert.match(store[0], /target="_blank"/)
	assert.match(store[0], /rel="noopener noreferrer"/)
})

test('自動では開かない: ページに自前のスクリプトや meta refresh を置かない', () => {
	assert.equal(/<script\b/i.test(body), false, 'インラインのスクリプトを置かない (src/main.js にまとめる)')
	assert.equal(/http-equiv=["']?refresh/i.test(body), false)
	assert.equal(/innerHTML/.test(read('src/main.js').split('initJoinPage')[1] ?? ''), false)
})

test('ナビゲーション・フッター・llms.txt には載せない', () => {
	for (const rel of ['_includes/header.html', '_includes/footer.html', 'llms.txt']) {
		assert.equal(read(rel).includes('/join/'), false, `${rel} に /join/ を載せない`)
	}
})

test('Tailwind の @source が /join/ を走査する', () => {
	assert.match(read('src/app.css'), /@source "\.\.\/join\/\*\*\/\*\.html";/)
})

test('レイアウト: no_tracking のときだけ計測を外し、referrer を送らない', () => {
	const layout = read('_layouts/default.html')
	const live = stripComments(layout)
	// gtag は else 側 (no_tracking でないとき) にだけある
	const gtagBlock = live.match(/\{% if page\.no_tracking %\}\s*(<meta name="referrer"[\s\S]*?)\{% else %\}([\s\S]*?)\{% endif %\}/)
	assert.ok(gtagBlock, 'no_tracking の分岐が無い')
	assert.match(gtagBlock[1], /<meta name="referrer" content="no-referrer">/)
	assert.equal(gtagBlock[1].includes('googletagmanager'), false)
	assert.match(gtagBlock[2], /googletagmanager\.com\/gtag\/js/)
	// 計測・第三者のスクリプトはすべて no_tracking の分岐の内側
	const outside = live
		.replace(/\{% if page\.no_tracking %\}[\s\S]*?\{% endif %\}/g, '')
		.replace(/\{% unless page\.no_tracking %\}[\s\S]*?\{% endunless %\}/g, '')
	for (const host of ['googletagmanager.com', 'cloudflareinsights.com', 'line-scdn.net']) {
		assert.equal(outside.includes(host), false, `${host} が no_tracking の分岐の外にある`)
	}
	assert.match(live, /<html lang="[^"]*"\{% if page\.no_tracking %\} data-no-tracking\{% endif %\}>/)
	// noindex は既存の切り替えを使う
	assert.match(live, /\{% if page\.noindex %\}<meta name="robots" content="noindex, nofollow">/)
})

test('main.js: 計測なしのページでは流入経路を記録しない', () => {
	const main = read('src/main.js')
	assert.match(main, /hasAttribute\('data-no-tracking'\)/)
	assert.match(main, /noTracking\s*\?\s*\{ record: null, first: null \}\s*:\s*initDownloadTracking\(\)/)
})
