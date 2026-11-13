// T-2200 (i18n1112 I18N-702, 2026-11-12) サイトの言語の値と共通の辞書・用語集の写し・英中の文の検査の仕様テスト。
//
//   node --test src/lib/i18n-site-lang.test.js
//
//   - `_data/lang/{en,zh-tw}.json` のキーの集合 (keys(en) == keys(zh-tw) ⊇ keys(ja)、英中だけのキーは決めた 8 個)
//   - URL・ID・言語の値が決めたとおり、空の値が無い
//   - 全部の訳 (URL・ID・言語の値を除く) が lintValue を通る (仮名・漢字・全角・禁止字・禁止語・和製漢語)
//   - site-lint (visibleTexts / lintText) と checks/lang-text の単体 (陽性対照を含む)
//   - 用語集の写し (scripts/i18n/glossary*.json) が glossary.source.json の sha256 と一致する
//   - ja.json の代表値 (陽性対照)。ja.json の不変は ja-identity と git diff で見る
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { visibleTexts, lintText, lintValue } from '../../scripts/i18n/site-lint.mjs'
import check from '../../scripts/i18n/checks/lang-text.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

const ja = readJson('_data/lang/ja.json')
const en = readJson('_data/lang/en.json')
const zh = readJson('_data/lang/zh-tw.json')

/** 英中だけのキー (W7-site.md §0-F) */
const INTL_ONLY_KEYS = [
	'url_prefix',
	'json_ld_lang',
	'seo_brand_suffix',
	'og_image_alt',
	'breadcrumb_home',
	'ja_only_badge',
	'ja_only_title',
	'lang_switch_label',
]
/** ja と同じ値でなければならない URL・ID のキー */
const SAME_AS_JA_KEYS = [
	'url',
	'app_download_link',
	'app_store_protocol_link',
	'app_store_product_id',
	'importer_download_link',
]
/** 言語の値 (lintValue にかけない) */
const LANG_VALUE_KEYS = ['my_lang', 'og_lang', 'json_ld_lang', 'url_prefix']

/** 開始時 (2026-11-12、HEAD d3553a5) の ja.json のキーの数 (実測) */
const JA_KEY_COUNT = 36

const sorted = (o) => Object.keys(o).sort()

// ---- 1. キーの集合 ----

test('キーの集合: keys(en) == keys(zh-tw)', () => {
	assert.deepEqual(sorted(en), sorted(zh))
})

test('キーの集合: keys(ja) ⊆ keys(en)', () => {
	const missing = Object.keys(ja).filter((k) => !(k in en))
	assert.deepEqual(missing, [])
})

test('キーの集合: keys(en) − keys(ja) が英中だけのキー 8 個と一致する', () => {
	const extra = Object.keys(en).filter((k) => !(k in ja)).sort()
	assert.deepEqual(extra, [...INTL_ONLY_KEYS].sort())
})

test('JSON のキーに重複が無い (旧 en.json の "" のような重複を作らない)', () => {
	for (const rel of ['_data/lang/en.json', '_data/lang/zh-tw.json']) {
		const text = readFileSync(join(ROOT, rel), 'utf8')
		const keys = [...text.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gmu)].map((m) => m[1])
		assert.equal(new Set(keys).size, keys.length, `${rel} にキーの重複がある`)
		assert.equal(keys.length, Object.keys(JSON.parse(text)).length, `${rel} のキーの数`)
	}
})

// ---- 2. 値 ----

test('値: URL・ID のキーは ja と同じ', () => {
	for (const k of SAME_AS_JA_KEYS) {
		assert.equal(en[k], ja[k], `en.${k}`)
		assert.equal(zh[k], ja[k], `zh-tw.${k}`)
	}
})

test('値: 言語の値・接頭辞・ja だけの印は決めた値', () => {
	assert.equal(en.my_lang, 'en')
	assert.equal(zh.my_lang, 'zh-Hant-TW')
	assert.equal(en.og_lang, 'en_US')
	assert.equal(zh.og_lang, 'zh_TW')
	assert.equal(en.json_ld_lang, 'en')
	assert.equal(zh.json_ld_lang, 'zh-Hant-TW')
	assert.equal(en.url_prefix, '/en')
	assert.equal(zh.url_prefix, '/zh-tw')
	assert.equal(en.ja_only_badge, '(Japanese)')
	assert.equal(zh.ja_only_badge, '（日文）')
	assert.equal(en.ja_only_title, 'This page is in Japanese.')
	assert.equal(zh.ja_only_title, '此頁面為日文。')
	assert.equal(en.lang_switch_label, 'Language')
	assert.equal(zh.lang_switch_label, '語言')
})

test('値: 全部が空でない文字列', () => {
	for (const [name, dict] of [['en', en], ['zh-tw', zh]]) {
		for (const [k, v] of Object.entries(dict)) {
			assert.equal(typeof v, 'string', `${name}.${k} が文字列でない`)
			assert.ok(v.trim().length > 0, `${name}.${k} が空`)
		}
	}
})

test('値: ja の置換の印 {} は訳にも同じ数だけ残る', () => {
	for (const [k, v] of Object.entries(ja)) {
		const want = (v.match(/\{\}/g) ?? []).length
		assert.equal((en[k].match(/\{\}/g) ?? []).length, want, `en.${k}`)
		assert.equal((zh[k].match(/\{\}/g) ?? []).length, want, `zh-tw.${k}`)
	}
})

// ---- 3. 全部の値が lintValue を通る ----

test('値: en の全部の文が lintValue を通る (仮名・漢字・全角の記号・禁止語が無い)', () => {
	for (const [k, v] of Object.entries(en)) {
		if (SAME_AS_JA_KEYS.includes(k) || LANG_VALUE_KEYS.includes(k)) continue
		assert.deepEqual(lintValue('en', v), [], `en.${k}: ${v}`)
	}
})

test('値: zh-tw の全部の文が lintValue を通る (仮名・簡体字・新字体・禁止語・和製漢語が無い)', () => {
	for (const [k, v] of Object.entries(zh)) {
		if (SAME_AS_JA_KEYS.includes(k) || LANG_VALUE_KEYS.includes(k)) continue
		assert.deepEqual(lintValue('zh-tw', v), [], `zh-tw.${k}: ${v}`)
	}
})

test('値: zh-tw の訳に半角の句読点が漢字の直後に無い', () => {
	for (const [k, v] of Object.entries(zh)) {
		assert.doesNotMatch(v, /\p{Script=Han}[,.;:?!]/u, `zh-tw.${k}: ${v}`)
	}
})

// ---- 4. site-lint の単体 ----

const words = (violations) => violations.map((v) => v.word)

test('lintText en: Remove mosaic は違反、allowRemoval なら許す', () => {
	assert.ok(words(lintText('en', 'Remove mosaic from videos')).some((w) => /remove mosaic/i.test(w)))
	assert.deepEqual(lintText('en', 'Remove mosaic from videos', { allowRemoval: true }), [])
	assert.ok(lintText('en', 'A free decensor tool').length > 0)
	assert.deepEqual(lintText('en', 'A free decensor tool', { allowRemoval: true }), [])
})

test('lintText en: allowRemoval でも除去の語以外の禁止語は違反のまま', () => {
	assert.ok(words(lintText('en', 'Detects private parts', { allowRemoval: true })).includes('private'))
})

test('lintText en: private は違反 (単語の境界で、大文字小文字を無視)、privacy は違反でない', () => {
	assert.ok(words(lintText('en', 'Detects Private areas')).some((w) => w.toLowerCase() === 'private'))
	assert.deepEqual(lintText('en', 'Privacy Policy'), [])
	assert.deepEqual(lintText('en', 'It cannot remove existing mosaic.'), [])
})

test('lintText en: 仮名・漢字・全角の記号は違反', () => {
	assert.ok(lintText('en', 'Download ダウンロード').length > 0)
	assert.ok(lintText('en', 'Video 動画').length > 0)
	assert.ok(lintText('en', 'Price（tax）').length > 0)
	assert.ok(lintText('en', 'Hello、world').length > 0)
	assert.deepEqual(lintText('en', 'Sign in to Deepmosaic — ¥2,980 / month…'), [])
})

test('lintText zh-tw: 视频・画・表示 は違反、這表示 は許す', () => {
	assert.ok(words(lintText('zh-tw', '上傳视频')).length > 0)
	assert.ok(lintText('zh-tw', '畫面與画面').length > 0)
	assert.ok(words(lintText('zh-tw', '表示結果')).includes('表示'))
	assert.deepEqual(lintText('zh-tw', '這表示偵測已完成。'), [])
})

test('lintText zh-tw: 日本の新字体だけの字 (簡体字の表に無い字) は shinjitai の違反', () => {
	const chars = readJson('scripts/i18n/glossary-chars.json')
	for (const ch of ['仏', '両', '亀']) {
		assert.equal(chars.zh_simplified[ch], undefined, `${ch} は簡体字の表に無い (新字体の規則だけで捕まえる)`)
		const v = lintText('zh-tw', `${ch}像`)
		assert.ok(v.some((x) => x.rule === 'shinjitai' && x.word === ch && x.use === chars.ja_shinjitai[ch]), `${ch}: ${JSON.stringify(v)}`)
	}
	assert.deepEqual(lintText('zh-tw', '佛像'), [])
})

// T-2200 のウェーブ末尾の追い修正 (2026-11-12): desktop の用語集の横断レビュー (T-2137) で足した 3 つ目の表 zh_non_tw_variant
// (標準繁体だが台湾で使わない字体 → 台湾の字形) と、禁止語の追加 (置信度・創建 など) と allow_in を写した
test('lintText zh-tw: 台湾で使わない字体 (爲・衆・啓・裏・着) は variant の違反、台湾の字形は違反でない', () => {
	const chars = readJson('scripts/i18n/glossary-chars.json')
	for (const [ch, tw] of [['爲', '為'], ['衆', '眾'], ['啓', '啟'], ['裏', '裡'], ['着', '著']]) {
		assert.equal(chars.zh_non_tw_variant?.[ch], tw, `${ch} → ${tw} が表にある`)
		const v = lintText('zh-tw', `以${ch}準`)
		assert.ok(v.some((x) => x.rule === 'variant' && x.word === ch && x.use === tw), `${ch}: ${JSON.stringify(v)}`)
		assert.deepEqual(lintText('zh-tw', `以${tw}準`), [], `${tw} は台湾の字形 (陰性対照)`)
	}
})

test('lintText zh-tw: 横断レビューで足した禁止語は違反、用語集の訳語と allow_in の合成語は許す', () => {
	for (const [bad, good] of [['置信度', '信賴度'], ['創建', '建立'], ['菜單', '選單'], ['窗口', '視窗'], ['搜索', '搜尋'], ['反饋', '意見回饋'], ['批量', '批次']]) {
		assert.ok(words(lintText('zh-tw', `${bad}的說明`)).includes(bad), bad)
		assert.deepEqual(lintText('zh-tw', `${good}的說明`), [], good)
	}
	assert.deepEqual(lintText('zh-tw', '感謝您的支持與愛用。'), [], '支持 の allow_in')
	assert.deepEqual(lintText('zh-tw', '請參閱相關文件。'), [], '文件 の allow_in')
	assert.ok(words(lintText('zh-tw', '支持 4K 影片')).includes('支持'), 'allow_in の外の 支持 は違反のまま')
})

test('lintText zh-tw: 仮名・禁止語は違反、除去の語は allowRemoval のときだけ許す', () => {
	assert.ok(lintText('zh-tw', '影片のモザイク').length > 0)
	assert.ok(lintText('zh-tw', '支持 Windows').length > 0)
	assert.ok(lintText('zh-tw', '去馬賽克軟體').length > 0)
	assert.deepEqual(lintText('zh-tw', '去馬賽克軟體', { allowRemoval: true }), [])
	assert.ok(lintText('zh-tw', '敏感部位', { allowRemoval: true }).length > 0)
	assert.deepEqual(lintText('zh-tw', '自動偵測影片中的身體部位並套用馬賽克。'), [])
	assert.deepEqual(lintText('zh-tw', '請參閱說明文件。'), [])
})

test('lintValue は lintText と同じ規則 (html の除外は無い)', () => {
	assert.ok(lintValue('en', 'ログイン').length > 0)
	assert.ok(lintValue('zh-tw', '视频').length > 0)
	assert.deepEqual(lintValue('en', 'Sign in'), [])
})

test('lintText: 知らない言語は例外', () => {
	assert.throws(() => lintText('fr', 'Bonjour'))
})

const SAMPLE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pricing &amp; plans</title>
<meta name="description" content="Apply mosaic automatically.">
<meta property="og:description" content="OG text here">
<meta property="og:url" content="https://www.deepmosaic.co.jp/en/">
<meta name="twitter:title" content="Twitter title">
<script>var x = "ダウンロード";</script>
<style>.a::after { content: "日本語"; }</style>
</head>
<body>
<style>.b::after { content: "スタイル"; }</style>
<p>Hello <b>world</b></p>
<img src="/a.png" alt="Screenshot (Japanese UI)">
<button aria-label="Open menu" title="Menu">X</button>
<input placeholder="Email address">
<p data-ja-allowed>Deepmosaic合同会社</p>
<div data-i18n-switch><a href="/">日本語</a><span>繁體中文</span></div>
<p data-i18n-allow="mosaic_removal">It is not a decensor tool.</p>
<script type="module">console.log('ログ')</script>
</body>
</html>`

test('visibleTexts: head の title・description・og:*・twitter:* と、body の文・alt・title・aria-label・placeholder を拾う (陽性対照)', () => {
	const got = visibleTexts(SAMPLE)
	const texts = got.map((t) => t.text)
	assert.ok(texts.includes('Pricing & plans'), 'title (実体参照を戻す)')
	assert.ok(texts.includes('Apply mosaic automatically.'), 'meta description')
	assert.ok(texts.includes('OG text here'), 'og:description')
	assert.ok(texts.includes('Twitter title'), 'twitter:title')
	assert.ok(texts.includes('Screenshot (Japanese UI)'), 'alt')
	assert.ok(texts.includes('Open menu'), 'aria-label')
	assert.ok(texts.includes('Menu'), 'title 属性')
	assert.ok(texts.includes('Email address'), 'placeholder')
	assert.ok(texts.some((t) => t.includes('Hello')), '本文')
	for (const t of got) assert.equal(typeof t.where, 'string')
})

test('visibleTexts: script・style・data-ja-allowed・data-i18n-switch の中は除く', () => {
	const texts = visibleTexts(SAMPLE).map((t) => t.text).join('\n')
	assert.doesNotMatch(texts, /ダウンロード|ログ|日本語|繁體中文|合同会社|スタイル/u)
})

test('visibleTexts: data-i18n-allow="mosaic_removal" の中の文に allowRemoval が付く', () => {
	const hit = visibleTexts(SAMPLE).find((t) => t.text.includes('decensor'))
	assert.ok(hit)
	assert.equal(hit.allowRemoval, true)
	const other = visibleTexts(SAMPLE).find((t) => t.text.includes('Hello'))
	assert.notEqual(other.allowRemoval, true)
})

test('visibleTexts: URL の og:url は文として拾わない', () => {
	assert.ok(!visibleTexts(SAMPLE).some((t) => t.text.startsWith('https://')))
})

test('visibleTexts: 「語 + コロン」や空白を含む meta の content は URL とみなさず拾う (陽性対照)', () => {
	const html = `<html lang="en"><head>
<meta name="description" content="Deepmosaic: a decensor tool for private parts">
<meta property="og:title" content="FAQ: private">
<meta name="twitter:description" content="/en/ is the English site; login here">
<meta property="og:description" content="/ month">
<meta property="og:image" content="https://www.deepmosaic.co.jp/a.png">
<meta property="og:url" content="/en/">
<meta name="twitter:site" content="mailto:info@example.com">
</head><body></body></html>`
	const got = visibleTexts(html)
	const texts = got.map((t) => t.text)
	assert.deepEqual(texts, [
		'Deepmosaic: a decensor tool for private parts',
		'FAQ: private',
		'/en/ is the English site; login here',
		'/ month',
	])
	const desc = got.find((t) => t.where === '<meta description>')
	assert.ok(lintText('en', desc.text).some((v) => v.word.toLowerCase() === 'decensor'), 'description が違反になる')
	assert.ok(lintText('en', texts[1]).some((v) => v.word.toLowerCase() === 'private'), 'og:title が違反になる')
})

test('visibleTexts: 閉じタグを省いた li・p の除外は後ろの兄弟に広がらない、引用符の無い `/` で終わる値は自己終了でない', () => {
	const texts = (html) => visibleTexts(html).map((t) => t.text)
	assert.deepEqual(texts('<body><ul><li data-ja-allowed>日本語<li>Login now</ul></body>'), ['Login now'])
	assert.deepEqual(texts('<body><p data-ja-allowed>会社<p>Next para</body>'), ['Next para'])
	assert.deepEqual(texts('<body><p data-ja-allowed>会社<div>Block</div></body>'), ['Block'])
	assert.deepEqual(texts('<body><a data-ja-allowed href=/x/>合同会社</a><span>After</span></body>'), ['After'])
	assert.deepEqual(texts('<body><br/><p>A<br />B</p></body>'), ['A', 'B'])
	const allow = visibleTexts('<body><ul><li data-i18n-allow="mosaic_removal">decensor<li>Other</ul></body>')
	assert.equal(allow.find((t) => t.text === 'Other').allowRemoval, undefined)
})

test('checks/lang-text: 英中のページの違反を「ファイル: 場所: 語 → use」の形で返し、mosaic-removal のページは除去の語を許す', () => {
	const files = {
		'index.html': '<html lang="ja"><body><p>日本語のページ</p></body></html>',
		'en/index.html': '<html lang="en"><body><p>Remove mosaic now</p></body></html>',
		'en/mosaic-removal/index.html':
			'<html lang="en"><body><p>Can it remove mosaic? It is not a decensor tool.</p></body></html>',
		'zh-tw/index.html': '<html lang="zh-Hant-TW"><head><title>视频</title></head><body><p>影片</p></body></html>',
	}
	const ctx = {
		listHtml: (prefix = '') => Object.keys(files).filter((f) => f.startsWith(prefix)).sort(),
		read: (rel) => files[rel],
		exists: (rel) => rel in files,
	}
	const errors = check(ctx)
	const enErrors = errors.filter((e) => e.startsWith('en/'))
	assert.equal(enErrors.length, 1, errors.join('\n'))
	assert.match(enErrors[0], /^en\/index\.html: .+: .*remove mosaic.* → /iu)
	assert.ok(errors.some((e) => /^zh-tw\/index\.html: <title>: 视频 → 影片$/u.test(e)), errors.join('\n'))
	assert.ok(errors.some((e) => /^zh-tw\/index\.html: <title>: 视 → 視$/u.test(e)), '簡体字の 1 字ごとの違反')
	assert.ok(!errors.some((e) => e.startsWith('index.html') || e.includes('mosaic-removal')), errors.join('\n'))
})

test('checks/lang-text: 英中のページが無ければ 0 件', () => {
	const ctx = { listHtml: () => [], read: () => '', exists: () => false }
	assert.deepEqual(check(ctx), [])
})

// ---- 5. 用語集の写し ----

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
/** 改行を LF にそろえた内容 (autocrlf=true の checkout で CRLF になっても同じ値にする) */
const lf = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

test('用語集の写し: glossary.json・glossary-chars.json の sha256 が glossary.source.json と一致する', () => {
	const src = readJson('scripts/i18n/glossary.source.json')
	assert.match(src.desktop_commit, /^[0-9a-f]{40}$/)
	for (const name of ['glossary.json', 'glossary-chars.json']) {
		assert.equal(sha256(lf(`scripts/i18n/${name}`)), src.sha256[name], name)
	}
})

test('用語集の写し: 形が desktop の用語集 (terms・forbidden・zh_simplified・ja_shinjitai) を持つ', () => {
	const g = readJson('scripts/i18n/glossary.json')
	const c = readJson('scripts/i18n/glossary-chars.json')
	assert.ok(Array.isArray(g.terms) && g.terms.length > 0)
	assert.ok(Array.isArray(g.forbidden.en))
	assert.ok(Array.isArray(g.forbidden['zh-TW']))
	assert.ok(Array.isArray(g.forbidden['zh-TW_ja_words']))
	assert.ok(Object.keys(c.zh_simplified).length > 0)
	assert.ok(Object.keys(c.ja_shinjitai).length > 0)
})

test('用語集の写し: desktop の横断レビュー (T-2137) の改訂版 + signin1113 (T-2238) の 法人 (211 語・3 つ目の表 zh_non_tw_variant・必須語の追加)', () => {
	const g = readJson('scripts/i18n/glossary.json')
	const c = readJson('scripts/i18n/glossary-chars.json')
	assert.equal(g.terms.length, 211)
	assert.ok(Object.keys(c.zh_non_tw_variant ?? {}).length > 0, 'zh_non_tw_variant')
	const byId = new Map(g.terms.map((t) => [t.id, t]))
	for (const [id, en, zh] of [
		['quote', 'quote', '報價'],
		['confidence', 'confidence', '信賴度'],
		['threshold', 'threshold', '臨界值'],
		['menu', 'menu', '選單'],
		['window', 'window', '視窗'],
		['create', 'create', '建立'],
		['search', 'search', '搜尋'],
		['enterprise', 'Enterprise', 'Enterprise'],
	]) {
		assert.equal(byId.get(id)?.en, en, id)
		assert.equal(byId.get(id)?.zh, zh, id)
		assert.equal(byId.get(id)?.kind, 'required', id)
	}
	const src = readJson('scripts/i18n/glossary.source.json')
	assert.notEqual(src.desktop_commit, 'be5c5aea7f0593fc8cf597ecc32d71d858d82436', '写し直した desktop のコミット')
})

test('用語集の写し: 隣に desktop の用語集があれば同じ内容 (無ければ skip)', (t) => {
	for (const name of ['glossary.json', 'glossary-chars.json']) {
		const neighbour = join(ROOT, '..', 'desktop', 'src', 'lib', 'i18n', name)
		if (!existsSync(neighbour)) {
			t.skip(`隣に desktop の ${name} が無い`)
			continue
		}
		assert.equal(readFileSync(neighbour, 'utf8').replace(/\r\n/g, '\n'), lf(`scripts/i18n/${name}`), name)
	}
})

test('用語集の写し: signin1113 (T-2238) の版 (sign_in / sign_out の ja がサインイン / サインアウト、法人 が reference)', () => {
	const g = readJson('scripts/i18n/glossary.json')
	const byId = new Map(g.terms.map((t) => [t.id, t]))
	assert.equal(byId.get('sign_in')?.ja, 'サインイン')
	assert.equal(byId.get('sign_out')?.ja, 'サインアウト')
	assert.equal(byId.get('corporate')?.ja, '法人')
	assert.equal(byId.get('corporate')?.kind, 'reference')
	for (const t of g.terms) {
		assert.ok(!['ログイン', 'ログアウト'].includes(t.ja), t.id)
	}
})

test('用語集の写し: T-2249 の版 (body_areas の ja が 局部、en / zh は body areas / 身體部位)', () => {
	const g = readJson('scripts/i18n/glossary.json')
	const body = g.terms.find((t) => t.id === 'body_areas')
	assert.equal(body?.ja, '局部')
	assert.equal(body?.en, 'body areas')
	assert.equal(body?.zh, '身體部位')
	assert.equal(body?.kind, 'required')
	for (const t of g.terms) {
		assert.notEqual(t.ja, '身体のプライバシー部位', t.id)
	}
})

// ---- 6. ja.json の代表値 (陽性対照) ----

test('ja.json の代表値: my_lang = ja、og_lang = ja_JP、キーの数は開始時のまま', () => {
	assert.equal(ja.my_lang, 'ja')
	assert.equal(ja.og_lang, 'ja_JP')
	assert.equal(Object.keys(ja).length, JA_KEY_COUNT)
})
