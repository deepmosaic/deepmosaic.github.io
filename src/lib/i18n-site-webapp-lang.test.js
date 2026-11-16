// 英語・繁体字のページから Web 版へのリンクで表示言語を渡す仕様テスト。
//
//   node --test src/lib/i18n-site-webapp-lang.test.js
//
//   - 値の正は `_data/site.yml` の `web_app.lang_query` / `lang_param` (ja のキーは置かない)。検査 checks/webapp-lang.mjs の定数と一致する
//   - 英中のトップのヒーロー・申し込みのボタン、DL の CTA の Web 版の説明行の href の式が、上の値と web_app.url から組まれている (URL・値の直書きなし)
//   - DL の CTA は page.lang で引いた値が空 (= ja) なら何も足さない
//   - check-site のモジュール scripts/i18n/checks/webapp-lang.mjs の単体 (作った _site の模型で、陽性対照と陰性対照)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { makeContext } from '../../scripts/i18n/check-site.mjs'
import check, { LANG_QUERY, LANG_PARAM } from '../../scripts/i18n/checks/webapp-lang.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const stripComments = (s) =>
	s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')

/** `_data/site.yml` の `web_app:` の節 (次のトップレベルのキーまで、コメント行を除く) */
function webAppBlock() {
	const lines = read('_data/site.yml').split('\n')
	const i = lines.indexOf('web_app:')
	assert.ok(i >= 0, '_data/site.yml に web_app: が無い')
	const out = []
	for (const l of lines.slice(i + 1)) {
		if (/^\S/.test(l)) break
		if (/^\s*#/.test(l) || l.trim() === '') continue
		out.push(l)
	}
	return out
}

/** `web_app.lang_param` の表 (キー → 値) */
function langParamTable(block) {
	const i = block.findIndex((l) => /^ {2}lang_param:\s*$/.test(l))
	assert.ok(i >= 0, 'web_app.lang_param が無い')
	const table = {}
	for (const l of block.slice(i + 1)) {
		const m = l.match(/^ {4}([\w-]+):\s*"([^"]*)"\s*$/)
		if (!m) break
		table[m[1]] = m[2]
	}
	return table
}

/** `<a …>` のうち `data-dl="<id>"` を持つ開始タグ */
const tagOf = (html, id) => html.match(new RegExp(`<a\\b[^>]*data-dl="${id}"[^>]*>`))?.[0] ?? null
const hrefOf = (tag) => tag?.match(/\shref="([^"]*)"/)?.[1] ?? null

// --- 1. 値の正 (_data/site.yml) と検査の定数 ---

test('site.yml: web_app に lang_query "lang" と lang_param (en / zh-tw、ja なし) があり、検査の定数と一致する', () => {
	const block = webAppBlock()
	const q = block.map((l) => l.match(/^ {2}lang_query:\s*"([^"]*)"\s*$/)?.[1]).find(Boolean)
	assert.equal(q, 'lang')
	assert.equal(q, LANG_QUERY)
	const table = langParamTable(block)
	assert.deepEqual(table, { en: 'en', 'zh-tw': 'zh-TW' })
	assert.ok(!('ja' in table), 'ja のキーは置かない (ja のページでは何も付けない)')
	assert.deepEqual(table, LANG_PARAM)
})

test('site.yml: 既存の web_app の値 (enabled・url・trial_minutes) は変えない', () => {
	const block = webAppBlock().join('\n')
	assert.match(block, /^ {2}enabled: true$/m)
	assert.match(block, /^ {2}url: "https:\/\/app\.deepmosaic\.co\.jp\/"$/m)
	assert.match(block, /^ {2}trial_minutes: 10$/m)
})

// --- 2. ソースの式 ---

const LANG_EXPR = '{{ site.data.site.web_app.lang_query }}={{ site.data.site.web_app.lang_param[page.lang] }}'

for (const file of ['en/index.html', 'zh-tw/index.html']) {
	test(`${file}: ヒーローの「ブラウザで試す」の href は web_app.url + ?<lang_query>=<lang_param[page.lang]>`, () => {
		const src = stripComments(read(file))
		const tag = tagOf(src, 'hero-webapp')
		assert.ok(tag, 'hero-webapp のリンクが無い')
		assert.equal(hrefOf(tag), `{{ site.data.site.web_app.url }}?${LANG_EXPR}`)
		assert.match(tag, /target="_blank" rel="noopener noreferrer"/)
		assert.doesNotMatch(src, /app\.deepmosaic\.co\.jp/, 'Web 版の URL を直書きしている')
		assert.doesNotMatch(src, /[?&]lang=/, '言語の値を直書きしている')
	})
}

for (const file of ['en/subscribe/index.html', 'zh-tw/subscribe/index.html']) {
	test(`${file}: 申し込みのボタンは ja と同じ深いリンクに &amp;<lang_query>=<lang_param[page.lang]> を後ろに付ける`, () => {
		const src = stripComments(read(file))
		assert.ok(src.includes('assign app_base = site.data.site.web_app.url'))
		assert.ok(src.includes('assign q = site.data.subscribe.checkout_query'))
		assert.ok(src.includes('assign wa_q = site.data.site.web_app.lang_query'))
		assert.ok(src.includes('assign wa_v = site.data.site.web_app.lang_param[page.lang]'))
		const tag = src.match(/<a\b[^>]*data-dl="subscribe-\{\{ plan\.code \}\}-webapp"[^>]*>/)?.[0]
		assert.ok(tag, '申し込みのボタンが無い')
		assert.equal(hrefOf(tag), '{{ app_base }}?{{ q }}={{ plan.code }}&amp;{{ wa_q }}={{ wa_v }}')
		assert.match(tag, /\srel="nofollow"/)
		assert.doesNotMatch(src, /app\.deepmosaic\.co\.jp/, 'Web 版の URL を直書きしている')
	})
}

test('cta-download.html: Web 版の説明行の href は、page.lang で引いた値が空 (ja) なら web_app.url のまま', () => {
	const src = stripComments(read('_includes/cta-download.html'))
	assert.ok(src.includes('{%- assign cd_L = site.data.site.web_app.lang_param[page.lang] -%}'), 'cd_L の assign が無い')
	assert.ok(
		src.includes(
			"{%- assign cd_WQ = '' -%}{%- if cd_L -%}{%- assign cd_WQ = '?' | append: site.data.site.web_app.lang_query | append: '=' | append: cd_L -%}{%- endif -%}",
		),
		'cd_WQ (言語があるときだけ ?<lang_query>=<値>) の assign が無い',
	)
	const tag = tagOf(src, 'cta-webapp')
	assert.ok(tag, 'cta-webapp のリンクが無い')
	assert.equal(hrefOf(tag), '{{ site.data.site.web_app.url }}{{ cd_WQ }}')
	assert.doesNotMatch(src, /app\.deepmosaic\.co\.jp/)
})

// --- 3. checks/webapp-lang.mjs の単体 ---

const page = (lang, body) => `<!doctype html><html lang="${lang}"><head></head><body>${body}</body></html>\n`
const a = (href) => `<a href="${href}" target="_blank">x</a>`
const APP = 'https://app.deepmosaic.co.jp/'

function goodSite() {
	return {
		'index.html': page('ja', a(APP) + a('https://apps.microsoft.com/detail/9PDKMKWHN9RW')),
		'subscribe/index.html': page('ja', a(`${APP}?checkout=light`)),
		'docs/index.html': page('ja', a(APP) + a('/docs/')),
		'en/index.html': page('en', a(`${APP}?lang=en`) + a('/docs/') + a('https://apps.microsoft.com/detail/9PDKMKWHN9RW')),
		'en/subscribe/index.html': page('en', a(`${APP}?checkout=light&amp;lang=en`)),
		'zh-tw/index.html': page('zh-Hant-TW', a(`${APP}?lang=zh-TW`)),
		'enterprise/inquiry/index.html': page('ja', a(APP)),
	}
}

async function runCheck(files) {
	const dir = mkdtempSync(join(tmpdir(), 'i18n-webapp-lang-'))
	try {
		for (const [rel, text] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, rel)), { recursive: true })
			writeFileSync(join(dir, rel), text)
		}
		return await check(makeContext(dir, ROOT))
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('checks/webapp-lang: 正しい模型は 0 件 (陽性対照)', async () => {
	assert.deepEqual(await runCheck(goodSite()), [])
})

test('checks/webapp-lang: 境界 — Web 版以外のホストに言語が無くてもよい、enterprise/ は ja として扱う', async () => {
	const files = {
		...goodSite(),
		'en/spec/index.html': page('en', a('https://apps.microsoft.com/detail/9PDKMKWHN9RW') + a('/docs/') + a('https://deepmosaic.co.jp/')),
		'enterprise/index.html': page('ja', a(APP)),
	}
	assert.deepEqual(await runCheck(files), [])
	const errs = await runCheck({ ...files, 'enterprise/index.html': page('ja', a(`${APP}?lang=en`)) })
	assert.ok(errs.some((e) => e.includes('enterprise/index.html')), errs.join(' / '))
})

const set = (rel, body, lang = 'en') => (files) => ({ ...files, [rel]: page(lang, body) })
const BAD_CASES = [
	['en のリンクに言語が無い', set('en/index.html', a(APP)), 'en/index.html'],
	['en に lang=zh-TW', set('en/index.html', a(`${APP}?lang=zh-TW`)), 'en/index.html'],
	['zh-tw に lang=zh-tw (小文字)', set('zh-tw/index.html', a(`${APP}?lang=zh-tw`), 'zh-Hant-TW'), 'zh-tw/index.html'],
	['en に lang が 2 つ', set('en/index.html', a(`${APP}?lang=en&amp;lang=en`)), 'en/index.html'],
	['en の申し込みのボタンに言語が無い', set('en/subscribe/index.html', a(`${APP}?checkout=light`)), 'en/subscribe/index.html'],
	['ja のリンクに ?lang=ja', set('index.html', a(`${APP}?lang=ja`), 'ja'), 'index.html'],
	['ja のリンクに ?lang=en', set('docs/index.html', a(`${APP}?lang=en`), 'ja'), 'docs/index.html'],
	['ja の申し込みに &lang=en', set('subscribe/index.html', a(`${APP}?checkout=light&amp;lang=en`), 'ja'), 'subscribe/index.html'],
	['解釈できない href', set('en/index.html', a('https://app.deepmosaic.co.jp:bad/?lang=en')), 'en/index.html'],
]

for (const [name, mutate, needle] of BAD_CASES) {
	test(`checks/webapp-lang: ${name} → エラー`, async () => {
		const errs = await runCheck(mutate(goodSite()))
		assert.ok(errs.length > 0 && errs.some((e) => e.startsWith(`${needle}:`)), `${name}: ${errs.join(' / ')}`)
	})
}
