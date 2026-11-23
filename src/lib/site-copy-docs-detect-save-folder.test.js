// docs の検出の章とトラブルシューティングの、保存先 (プロジェクトフォルダ) の確かめ方・検出ログ・プレビューの文の回帰テスト。
//
//   node --test src/lib/site-copy-docs-detect-save-folder.test.js
//
//   - 03-detect #detect-options: 検出オプション画面を開いたときに保存先に書けるかを確かめ、書けないときは開始できない
//     (理由の文と 3 つのボタン)。メニューで保存先を変えたときの扱いも書く。
//   - 03-detect の検出中の画面の「ログ」の行: 英中の表示ではログの行もその言語 (一部は日本語のまま)、問い合わせに添えるログは日本語の原文。
//   - 06-ops #trouble「読み込みと検出」: 保存先にフォルダを作れないときの項目と、プレビューに必要なファイルが無いときの文。
//   - 画面の文・ボタン名はアプリの ja の文と同じ文字列をここで定数に持つ。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

// ---- アプリの ja の文 ----
const PICK_LABEL = 'プロジェクトフォルダを選び直す'
const RESET_LABEL = '既定の場所に戻す'
const RECHECK_LABEL = 'もう一度確かめる'
const START_HINT = '保存先 (プロジェクトフォルダ) に書き込めないため開始できません'
/** 検出の開始時のエラー */
const PROJECT_DIR_FAIL = '検出結果の保存先にプロジェクトのフォルダを作成できませんでした'
/** 検出オプション画面の事前確認の通知 */
const PROJECT_DIR_PRECHECK = '検出結果の保存先にプロジェクトのフォルダを作成できません'
/** プレビューに必要なファイルが無いときの文 */
const TOOLING_MISSING = 'プレビューに必要な動画処理のファイルが見つかりません'

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}
const textOf = (src) => stripComments(src).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

/** `<h3 …>title</h3>` から次の `<h3` (無ければ末尾) までを返す。無ければ null。 */
function h3BlockOf(html, title) {
	const m = html.match(new RegExp(`<h3\\b[^>]*>${title}</h3>`))
	if (!m) return null
	const start = m.index + m[0].length
	const next = html.indexOf('<h3', start)
	return html.slice(start, next < 0 ? undefined : next)
}

/** kv の行 (`<div class="kv-key">key</div>` の後の kv-val) の中身。無ければ null。 */
function kvValOf(html, key) {
	const m = html.match(new RegExp(`<div class="kv-key">${key}</div>\\s*<div class="kv-val">([\\s\\S]*?)</div>`))
	return m ? m[1] : null
}

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'a'), null)
	assert.equal(sectionOf('<section id="a">b</section>', 'a'), '<section id="a">b')
	assert.equal(h3BlockOf('<p>x</p>', '読み込みと検出'), null)
	assert.equal(h3BlockOf('<h3 class="x">A</h3><ul>1</ul><h3>B</h3>', 'A'), '<ul>1</ul>')
	assert.equal(kvValOf('<p>x</p>', 'ログ'), null)
	assert.equal(kvValOf('<div class="kv-key">ログ</div>\n<div class="kv-val">v</div>', 'ログ'), 'v')
	assert.equal(textOf('{%- comment -%}秘{%- endcomment -%}<!-- 秘 --><b>見える</b>'), '見える')
})

test('03-detect #detect-options: 保存先に書けないときは開始できず、3 つのボタンが出る', () => {
	const sec = sectionOf(read('_includes/docs/03-detect.html'), 'detect-options')
	assert.ok(sec, '陽性対照: #detect-options が無い')
	const text = textOf(sec)
	assert.match(text, /検出オプション画面を開いたとき（この画面で保存先を選び直したときも）、検出結果の保存先（プロジェクトフォルダ）に書き込めるかを確かめます/)
	assert.ok(text.includes(`「${START_HINT}」と理由が表示されます`), `「${START_HINT}」が無い`)
	for (const s of [PICK_LABEL, RESET_LABEL, RECHECK_LABEL]) assert.ok(text.includes(`「${s}」`), `#detect-options に「${s}」が無い`)
	assert.ok(text.includes('プロジェクトフォルダを選択'), 'メニューで変えたときの扱いが無い')
})

test('03-detect のログの行: 英中の表示 (訳せない行は日本語のまま残りうる) と、問い合わせに添えるログは日本語の原文のまま', () => {
	const log = kvValOf(read('_includes/docs/03-detect.html'), 'ログ')
	assert.ok(log, '陽性対照: ログの行が無い')
	assert.ok(log.includes('アプリの表示言語が英語・繁体字中国語のときは、ログの行もその言語で表示されます（一部の行は日本語のまま表示されることがあります）'), '英中の表示の文が無い')
	assert.ok(log.includes('日本語の原文のまま'), '問い合わせに添えるログの文が無い')
	assert.ok(log.includes('「表示中の行をコピー」「ログフォルダを開く」は開発用で、製品版では表示されません'), '開発用の文が変わっている')
})

test('06-ops #trouble「読み込みと検出」: 保存先のフォルダを作れないときの項目と、プレビューに必要なファイルの文', () => {
	const trouble = sectionOf(read('_includes/docs/06-ops.html'), 'trouble')
	assert.ok(trouble, '陽性対照: #trouble が無い')
	const block = h3BlockOf(trouble, '読み込みと検出')
	assert.ok(block, '陽性対照: 「読み込みと検出」が無い')
	const items = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1])
	const item = items.find((li) => li.includes(PROJECT_DIR_FAIL))
	assert.ok(item, `「${PROJECT_DIR_FAIL}」の項目が無い`)
	assert.ok(item.startsWith(`「${PROJECT_DIR_FAIL}」と出る場合`), '項目の見出しがエラーの文言 (できませんでした) と違う')
	assert.ok(item.includes(`「${PROJECT_DIR_PRECHECK}」と表示されます`), '検出オプション画面の文言が無い')
	for (const s of [PICK_LABEL, RESET_LABEL]) assert.ok(item.includes(`「${s}」`), `項目に「${s}」が無い`)
	assert.match(item, /href="#import"/)
	const preview = items.find((li) => li.startsWith('検出オプション画面にプレビューが出ない場合'))
	assert.ok(preview, 'プレビューが出ないときの項目が無い')
	assert.ok(preview.includes(`「${TOOLING_MISSING}」と表示されるときは、アプリを再起動して、必要なファイルのダウンロードを完了させてください`), 'プレビューに必要なファイルの文が無い')
})
