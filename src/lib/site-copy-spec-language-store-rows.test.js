// 動作環境 (/spec/ の 3 言語・llms-full.txt) の Windows の表の「表示言語」と「Microsoft Store 版」の行、llms.txt の画面の言語の回帰テスト。
//
//   node --test src/lib/site-copy-spec-language-store-rows.test.js
//
//   - `_data/spec.yml` の windows に「表示言語」の行 (ストレージの後) と、切り替え (store_enabled) の下だけで出す
//     「Microsoft Store 版」の行 (`store_only: true`) がある。英中の写しは件数と store_only の位置が ja と同じ。
//   - 表示 (3 言語の /spec/・llms-full.txt) は store_enabled が true でないとき store_only の行を除いて回す。
//   - 出力の検査 (checks/store.mjs) は true のとき 3 言語に 1 つずつあることを見る (false はダウンロードの導線が無いのでエラー)。
//   - llms.txt の基本情報に画面の言語の行がある。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { checkStore, SPEC_STORE_KEYS } from '../../scripts/i18n/checks/store.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * YAML の `windows:` 節を `{ key, val, store_only }` の配列で読む極小パーサ (実際に使っている形だけ)。
 * 節が無ければ空配列。
 */
function loadWindows(yml) {
	const lines = yml.split(/\r?\n/)
	const start = lines.findIndex((l) => l === 'windows:')
	if (start < 0) return []
	const rows = []
	for (const line of lines.slice(start + 1)) {
		if (line.trim() === '' || line.trim().startsWith('#')) continue
		if (!/^ /.test(line)) break
		const key = line.match(/^ {2}- key: "(.*)"$/)
		if (key) {
			rows.push({ key: key[1], val: '', store_only: false })
			continue
		}
		const val = line.match(/^ {4}val: "(.*)"$/)
		if (val && rows.length > 0) rows[rows.length - 1].val = val[1]
		if (/^ {4}store_only: true\s*$/.test(line) && rows.length > 0) rows[rows.length - 1].store_only = true
	}
	return rows
}

/** ja と写しの windows の行の件数と store_only の位置が一致するか (不一致の理由の文、一致なら null) */
function windowsShapeMismatch(jaRows, l10nRows) {
	if (jaRows.length !== l10nRows.length) return `件数が違う (ja ${jaRows.length} / 写し ${l10nRows.length})`
	const i = jaRows.findIndex((r, k) => r.store_only !== l10nRows[k].store_only)
	return i < 0 ? null : `${i + 1} 行目の store_only が違う`
}

const jaWindows = loadWindows(read('_data/spec.yml'))

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.deepEqual(loadWindows('other:\n  - key: "x"\n'), [])
	assert.deepEqual(loadWindows('windows:\n  - key: "a"\n    val: "b"\n    store_only: true\nperformance:\n'),[{ key: 'a', val: 'b', store_only: true }])
	assert.equal(windowsShapeMismatch([{ store_only: false }], [{ store_only: false }]), null)
	assert.notEqual(windowsShapeMismatch([{ store_only: false }], [{ store_only: true }]), null)
	assert.equal(stripComments('{% comment %}x{% endcomment %}<!-- z -->y'), 'y')
})

test('spec.yml: 表示言語の行がちょうど 1 つ (3 つの言語名を含む)、ストレージの後', () => {
	const rows = jaWindows.filter((r) => r.key === '表示言語')
	assert.equal(rows.length, 1)
	assert.match(rows[0].val, /^日本語 \/ English \/ 繁體中文（初めて起動したときは Windows の表示言語に合わせて選ばれ/)
	assert.match(rows[0].val, /アプリ内でいつでも切り替えられます/)
	const keys = jaWindows.map((r) => r.key)
	assert.equal(keys.indexOf('表示言語'), keys.indexOf('ストレージ') + 1)
})

test('spec.yml: store_only の行はちょうど 1 つで Microsoft Store 版 (Windows 10 バージョン 2004 以降)', () => {
	const rows = jaWindows.filter((r) => r.store_only)
	assert.equal(rows.length, 1)
	assert.equal(rows[0].key, 'Microsoft Store 版')
	assert.equal(rows[0].key, SPEC_STORE_KEYS.ja)
	assert.match(rows[0].val, /^Windows 10 バージョン 2004 以降。/)
	assert.doesNotMatch(rows[0].val, /インストーラ/, 'インストーラ版と比べない (入手先は Store だけ)')
})

test('spec の英中の写し: windows の件数と store_only の位置が ja と同じ', () => {
	for (const [rel, langKey, storeKey] of [
		['_data/l10n/en/spec.yml', 'Display language', SPEC_STORE_KEYS.en],
		['_data/l10n/zh-tw/spec.yml', '顯示語言', SPEC_STORE_KEYS['zh-tw']],
	]) {
		const src = read(rel)
		const rows = loadWindows(src)
		assert.equal(windowsShapeMismatch(jaWindows, rows), null, rel)
		assert.equal(rows[jaWindows.findIndex((r) => r.key === '表示言語')]?.key, langKey, `${rel}: 表示言語の行の key`)
		assert.equal(rows.find((r) => r.store_only)?.key, storeKey, `${rel}: Store 版の行の key`)
		// 境界: 行を 1 つ消した写し・store_only を外した写しは不一致になる
		const dropped = src.replace(/^ {2}- key: "[^"]*"\r?\n {4}val: "[^"]*"\r?\n/m, '')
		assert.notEqual(windowsShapeMismatch(jaWindows, loadWindows(dropped)), null, `${rel}: 1 行少ない写しが通る`)
		const unflagged = src.replace(/^ {4}store_only: true\r?\n/m, '')
		assert.notEqual(windowsShapeMismatch(jaWindows, loadWindows(unflagged)), null, `${rel}: store_only の無い写しが通る`)
	}
})

test('動作環境の表示 (3 言語・llms-full): store_enabled が true でないとき store_only の行を除いて回す', () => {
	for (const [rel, list] of [['spec/index.html', 'SPEC_WIN'], ['en/spec/index.html', 'SPEC_WIN'], ['zh-tw/spec/index.html', 'SPEC_WIN'], ['llms-full.txt', 'SP_WIN']]) {
		const src = stripComments(read(rel))
		assert.match(src, /unless site\.data\.site\.distribution\.store_enabled/, `${rel}: 切り替えの条件が無い`)
		assert.match(src, /where_exp: "r", "r\.store_only != true"/, `${rel}: store_only を除いていない`)
		assert.ok(src.includes(list), `${rel}: 除いた後の一覧 ${list} を回していない`)
	}
})

// ---- checks/store.mjs の Store 版の行 ----

/** 小さな偽の ctx (siteDir の代わりに files の表) */
function fakeCtx(files) {
	return {
		root: ROOT,
		read: (rel) => files[rel],
		exists: (rel) => rel in files,
		listHtml: () => Object.keys(files).filter((r) => r.endsWith('.html')),
	}
}
const SPEC_FILES = { ja: 'spec/index.html', en: 'en/spec/index.html', 'zh-tw': 'zh-tw/spec/index.html' }

test('checks/store.mjs (false): store_enabled が false はダウンロードの導線が無いのでエラー 1 件', () => {
	const errors = checkStore(fakeCtx({ 'spec/index.html': '<p>OS</p>' }), false)
	assert.equal(errors.length, 1, errors.join(' / '))
	assert.match(errors[0], /store_enabled/)
})

test('checks/store.mjs (true): 3 言語の spec のどれかに Store 版の行が無ければエラー、全部にあればそのエラーは無い', () => {
	const specFiles = Object.fromEntries(Object.entries(SPEC_FILES).map(([lang, rel]) => [rel, `<div class="kv-key">${SPEC_STORE_KEYS[lang]}</div>`]))
	const specErrors = (files) => checkStore(fakeCtx(files), true).filter((e) => e.includes('Microsoft Store 版の行'))
	assert.deepEqual(specErrors(specFiles), [])
	for (const [lang, rel] of Object.entries(SPEC_FILES)) {
		const errors = specErrors({ ...specFiles, [rel]: '<p>OS</p>' })
		assert.equal(errors.length, 1, `${lang}: ${errors.join(' / ')}`)
		assert.ok(errors[0].startsWith(`${rel}:`), errors[0])
	}
})

test('llms.txt: 基本情報に画面の言語 (UI languages) の行', () => {
	assert.match(read('llms.txt'), /^- 画面の言語 \/ UI languages: 日本語・英語・繁体字中国語 \/ Japanese, English, Traditional Chinese$/m)
})
