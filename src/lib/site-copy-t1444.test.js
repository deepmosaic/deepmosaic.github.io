// T-1444 (2026-10-24) Web 版を「お試し用 (1 本 N 分まで)」として案内し、Desktop 版への架け橋にする回帰テスト。
//
//   node --test src/lib/site-copy-t1444.test.js
//
//   - 分数は `_data/site.yml` の `web_app.trial_minutes` が唯一の出所。テンプレートに数字を直書きしない
//     (BFF の `WEB_TRIAL_MAX_SECONDS` 既定 600 秒と同じ値。ずれたら両方直す)。
//   - トップ hero の Web 版ボタンは「ブラウザでお試し（N 分までの動画・インストール不要）」。
//   - DL CTA の説明行に「お試し用（1 本 N 分まで）」。
//   - GA4: `data-dl` が `-webapp` で終わるリンクは `web_app_open`、それ以外は `file_download`
//     (純関数 `ga4EventNameFor` は attribution.test.js が固定。ここでは main.js の配線を見る)。
//   - docs/web: リードに「Web 版はお試し用です」、要件表に「動画の長さ」、Desktop 版との違いに「動画の長さ」。
//   - プライバシーポリシー §9 に、Web 版のアカウントの識別子をダウンロードの記録に保存する旨の 1 文。
//     版 (`_data/legal.yml`・EULA・利用規約) は変えない。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t974.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** YAML のコメント行を落とす。 */
const stripYamlComments = (yaml) =>
	yaml
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('#'))
		.join('\n')

/** `data-dl="<name>"` を持つ `<a …>…</a>` の全体。見つからなければ null。 */
function linkOf(html, name) {
	return html.match(new RegExp(`<a\\s[^>]*data-dl="${name}"[^>]*>[\\s\\S]*?</a>`))?.[0] ?? null
}

/** `<section id="…">` から次の `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** kv 表の行のうち、キーが `key` の行の値 (タグ込み)。見つからなければ null。 */
function kvValueOf(html, key) {
	return html.match(new RegExp(`<div class="kv-key">${key}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`))?.[1] ?? null
}

const TRIAL_VAR = /\{\{\s*site\.data\.site\.web_app\.trial_minutes\s*\}\}/
/** 「10 分」などの数字の直書き (半角・全角数字 + 任意の空白 + 分)。 */
const HARDCODED_MINUTES = /[0-9０-９]+\s*分/

const index = stripComments(read('index.html'))
const cta = stripComments(read('_includes/cta-download.html'))
const webDocs = stripComments(read('_includes/docs/web.html'))

// --- 0. ヘルパーのガード ---

test('ヘルパー: 陽性対照と陰性対照 (検査のすり抜けを防ぐ)', () => {
	assert.equal(linkOf('<p>x</p>', 'hero-webapp'), null)
	assert.equal(linkOf('<a href="/" data-dl="a-webapp">x</a>', 'a-webapp'), '<a href="/" data-dl="a-webapp">x</a>')
	assert.equal(sectionOf('<p>x</p>', 'about'), null)
	assert.equal(kvValueOf('<div class="kv-key">a</div><div class="kv-val">b</div>', 'a'), 'b')
	assert.equal(kvValueOf('<p>x</p>', 'a'), null)
	assert.match('お試し（{{ site.data.site.web_app.trial_minutes }} 分まで）', TRIAL_VAR)
	assert.match('1 本 10 分まで', HARDCODED_MINUTES)
	assert.doesNotMatch('1 本 {{ site.data.site.web_app.trial_minutes }} 分まで', HARDCODED_MINUTES)
})

// --- 1. 唯一の出所 ---

test('site.yml: web_app.trial_minutes は 10 (BFF の既定 600 秒と同じ値)', () => {
	// Act
	const yaml = stripYamlComments(read('_data/site.yml'))
	const minutes = yaml.match(/web_app:[\s\S]*?\n\s+trial_minutes:\s*(\d+)/)?.[1]

	// Assert
	assert.equal(minutes, '10')
	assert.match(read('_data/site.yml'), /600/, 'BFF の既定値 (600 秒) と揃える旨のコメントが無い')
})

// --- 2. トップ hero と DL CTA ---

test('hero: 「ブラウザでお試し（N 分までの動画・インストール不要）」で、N は site.yml から読む', () => {
	// Act
	const link = linkOf(index, 'hero-webapp')

	// Assert
	assert.ok(link, 'hero-webapp のリンクが無い')
	assert.match(link, TRIAL_VAR)
	assert.doesNotMatch(link, HARDCODED_MINUTES)
	const text = textOf(link)
	assert.match(text, /ブラウザでお試し（\{\{[^}]+\}\} 分までの動画・インストール不要）/)
	assert.ok(!text.includes('ブラウザで試す'), '旧文言が残っている')
})

test('CTA: 説明行に「お試し用（1 本 N 分まで）」があり、N は site.yml から読む', () => {
	// Act
	const line = cta.match(/<p[^>]*>[^\n]*data-dl="cta-webapp"[^\n]*<\/p>/)?.[0]

	// Assert
	assert.ok(line, 'cta-webapp の説明行が無い')
	assert.match(line, /お試し用（1 本 \{\{\s*site\.data\.site\.web_app\.trial_minutes\s*\}\} 分まで）/)
	assert.doesNotMatch(line, HARDCODED_MINUTES)
})

test('Web 版リンクの href に utm を焼き込まない (装飾は実行時)', () => {
	for (const html of [linkOf(index, 'hero-webapp'), linkOf(cta, 'cta-webapp')]) {
		assert.ok(html)
		assert.doesNotMatch(html, /href="[^"]*[?&](utm_|ref=)/)
	}
})

// --- 3. GA4 の配線 ---

test('main.js: GA4 のイベント名は ga4EventNameFor(data-dl) で決め、file_download を直書きしない', () => {
	// Act
	const main = read('src/main.js')

	// Assert
	assert.match(main, /import\s*\{[^}]*\bga4EventNameFor\b[^}]*\}\s*from\s*'\.\/lib\/attribution\.js'/)
	assert.match(main, /window\.gtag\?\.\(\s*'event',\s*ga4EventNameFor\(a\.dataset\.dl\)/)
	assert.doesNotMatch(main, /'event',\s*'file_download'/)
})

// --- 4. docs/web ---

test('docs/web のリード: Web 版はお試し用で、長い動画・多数の動画・1.9GB 超は Desktop 版へ', () => {
	// Act
	const about = sectionOf(webDocs, 'about')

	// Assert
	assert.ok(about, '#about が無い')
	const text = textOf(about)
	assert.ok(text.includes('Web 版はお試し用です'), text)
	assert.match(about, TRIAL_VAR)
	assert.doesNotMatch(about, HARDCODED_MINUTES)
	assert.match(text, /分までの動画を処理できます/)
	assert.match(text, /長い動画、多数の動画、1\.9GB を超える動画は Desktop 版をご利用ください/)
	assert.match(text, /有料プラン（Light \/ Pro）と組織/, '有料と組織の免除 (ユーザー決定 1) が書かれていない')
})

test('docs/web の要件表: 「動画の長さ」行が「動画のサイズ」の隣にある', () => {
	// Act
	const req = sectionOf(webDocs, 'requirements')
	const value = kvValueOf(req ?? '', '動画の長さ')

	// Assert
	assert.ok(value, '「動画の長さ」行が無い')
	assert.match(value, TRIAL_VAR)
	assert.doesNotMatch(value, HARDCODED_MINUTES)
	assert.ok(req.indexOf('動画のサイズ') < req.indexOf('動画の長さ'), '「動画のサイズ」の後に置く')
})

test('docs/web の Desktop 版との違い: 「動画の長さ」行がある', () => {
	// Act
	const diff = sectionOf(webDocs, 'diff')
	const value = kvValueOf(diff ?? '', '動画の長さ')

	// Assert
	assert.ok(value, '#diff に「動画の長さ」行が無い')
	assert.match(value, TRIAL_VAR)
	assert.doesNotMatch(value, HARDCODED_MINUTES)
	assert.match(textOf(value), /Desktop 版/)
})

test('docs/web の始め方: ボタン名は「ブラウザでお試し」', () => {
	const start = textOf(sectionOf(webDocs, 'start') ?? '')
	assert.ok(start.includes('「ブラウザでお試し」'), start)
	assert.ok(!webDocs.includes('ブラウザで試す'), '旧ボタン名が残っている')
})

// --- 5. llms ---

test('llms.txt / llms-full.txt: Web 版の行がお試し用 (N 分まで) を伝え、N は site.yml から読む', () => {
	for (const rel of ['llms.txt', 'llms-full.txt']) {
		const body = stripComments(read(rel))
		const line = body.split('\n').find((l) => l.includes('/docs/web/') && l.includes('お試し'))
		assert.ok(line, `${rel} に Web 版のお試しの行が無い`)
		assert.match(line, TRIAL_VAR, rel)
		assert.doesNotMatch(line, HARDCODED_MINUTES, rel)
	}
})

// --- 6. プライバシーポリシー §9 ---

// 法務文書は配布形態 (デスクトップ版 / Web 版) で区別して書かない (T-1061 のテストとユーザー指示)。
// 契約 F の趣旨 (「Web 版にログインした状態で Desktop 版を…」) を「ブラウザで本サービスに…インストーラーを…」と書く。
test('privacy §9: ブラウザでログインしてインストーラーを DL したときのアカウント識別子の保存と突き合わせを書く', () => {
	// Act
	const html = stripComments(read('company/privacy.html'))
	const start = html.indexOf('9.ダウンロード経路の記録について')
	const end = html.indexOf('10.無料枠の管理', start)
	const s9 = textOf(html.slice(start, end))

	// Assert
	assert.ok(start >= 0 && end > start, '§9 が見つからない')
	assert.match(
		s9,
		/ブラウザで本サービスにログインした状態でインストーラーをダウンロードした場合、そのアカウントの識別子をダウンロードの記録にあわせて保存し、アプリケーションの初回起動時の記録と突き合わせます。/
	)
})

test('privacy: 最終更新日は 2026-10-24 (版 = legal.yml / EULA / 利用規約は 2026-10-12 のまま)', () => {
	assert.match(read('company/privacy.html'), /最終更新日: 2026-10-24（制定: 2019-06-01）/)
	assert.match(stripYamlComments(read('_data/legal.yml')), /version:\s*"?2026-10-12"?/)
	assert.match(read('company/eula.html'), /最終更新日: 2026-10-12/)
	assert.match(read('company/terms.html'), /最終更新日: 2026-10-12/)
})
