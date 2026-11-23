// docs の説明が画面の文と実際の動きに合っていることの回帰テスト。
//
//   node --test src/lib/site-copy-docs-accuracy.test.js
//
//   - 06-ops #trouble: プランの反映は実際の操作 (前面に戻す・検出オプションを開く・再起動) で書き、無いボタン名を書かない。
//     #update の「再確認」はアップデートの確認の画面にあるボタンなので残る。
//   - 06-ops #trouble: スマート アプリ コントロールの設定の道筋は Windows セキュリティ アプリから。
//   - 04-edit #shortcuts: Ctrl+Z の行はアプリのショートカットの凡例と同じ文 (3 言語)。#edit-bbox の取り消しは同じ順を書く。
//   - web #requirements: Web 版の動画のサイズ・形式のメッセージはアプリの文と同じ。
//   - 06-ops #trouble の最後: 製品版に無い「ログフォルダを開く」を案内せず、ログの置き場を書く。
//   - 03-detect / 04-edit / 05-export: 画面の端の補完は「画面の外」まで補うことと、モザイクを描くのは画面の中だけであることを書く。
//   - 04-edit #edit-player の反転の行: 説明の本体は #edit-mosaic にあり、ここは右クリックの切り替えと参照だけ。
//   - 英中の 03-detect / 04-edit / 05-export: 英中の画面で訳されて出る 3 つのメッセージはアプリの訳の文で書き、
//     日本語のままの断り書きを付けない (06-ops・07-team・01-intro (移行の小見出し) の断り書きは残す)。
//
// 読み取りはこのファイル内で完結させる。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** `<section id="…">` から対応する `</section>` までの中身。見つからなければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const section = (file, id) => {
	const sec = sectionOf(read(file), id)
	assert.ok(sec, `${file} の #${id} 節が見つからない`)
	return sec
}

const ROW_RE =
	/<div class="kv-row(?: kv-alt)?">\s*<div class="kv-key">([\s\S]*?)<\/div>\s*<div class="kv-val">([\s\S]*?)<\/div>\s*<\/div>/g

/** `kv-key` の文字列が `key` の行の `kv-val` の HTML。無ければ null。 */
const kvRowHtml = (html, key) => [...html.matchAll(ROW_RE)].find((m) => textOf(m[1]) === key)?.[2] ?? null

/** ショートカットの表の `data-shortcut` の行の説明の文字列。 */
function shortcutText(file, id) {
	const m = read(file).match(new RegExp(`<tr data-shortcut="${id}"><td>[\\s\\S]*?</td><td>([\\s\\S]*?)</td></tr>`))
	assert.ok(m, `${file} に ${id} の行が無い`)
	return textOf(m[1])
}

// ---- アプリの文 ----
const UNDO_FRAME = {
	ja: '連続 bbox の凍結解除 → 現フレーム初期化',
	en: 'Unfreeze continuous BBox → reset current frame',
	'zh-tw': '解除連續 BBox 的凍結 → 重設目前影格',
}
const WEB_SIZE_ERR = '「この動画 (NGB) はブラウザ版で扱える上限 (約 1.9GB) を超えています。デスクトップ版をご利用ください。」'
const WEB_CONTAINER_ERR = '「この形式 (MKV) はブラウザ版では未対応です。mp4 (H.264) に変換するか、Desktop 版をご利用ください。」'

test('06-ops #trouble: プランの反映は実際の操作で書き、「再確認」のボタンを書かない', () => {
	const trouble = textOf(section('_includes/docs/06-ops.html', 'trouble'))
	const item = trouble.match(/プランを変更したのにアプリに反映されない場合: [^。]*。[^。]*アプリを再起動してください。/)
	assert.ok(item, 'プランの反映の項目が無い')
	assert.doesNotMatch(trouble, /「再確認」/)
	// 確かめる時機はアプリの実装どおり (前面化は前回の確認から 1 分以上・検出オプションを開いた時・表示中の 5 分ごと、検出中は後)
	for (const w of ['画面を前面に戻したとき（前回の確認から 1 分以上たっているとき）', '検出オプションを開いたとき', '5 分ごと', '検出の実行中は、終わってから反映されます']) {
		assert.ok(item[0].includes(w), `プランの反映の項目に「${w}」が無い: ${item[0]}`)
	}
	assert.doesNotMatch(item[0], /開いたままでも 5 分以内/, '放置で 5 分以内と言い切らない (見えている間だけ確かめる)')
})

test('06-ops #update: アップデートの確認の画面の「再確認」は残る', () => {
	assert.match(textOf(section('_includes/docs/06-ops.html', 'update')), /「再確認」で問い合わせ直します。/)
})

test('06-ops #trouble: スマート アプリ コントロールの道筋は Windows セキュリティ アプリから (3 言語)', () => {
	const ja = textOf(section('_includes/docs/06-ops.html', 'trouble'))
	assert.match(ja, /Windows セキュリティ アプリ → アプリ &amp; ブラウザー コントロール → スマート アプリ コントロール設定/)
	assert.doesNotMatch(ja, /Windows の設定 → アプリとブラウザー コントロール/)
	const en = textOf(section('_includes/docs/en/06-ops.html', 'trouble'))
	assert.match(en, /Windows Security app > App &amp; browser control > Smart App Control settings/)
	const zh = textOf(section('_includes/docs/zh-tw/06-ops.html', 'trouble'))
	assert.match(zh, /Windows 安全性 應用程式 → 應用程式 &amp; 瀏覽器控制 → 智慧型應用程式控制設定/)
})

test('04-edit #shortcuts: Ctrl+Z の行はアプリの凡例と同じ文 (3 言語)', () => {
	assert.equal(shortcutText('_includes/docs/04-edit.html', 'undo_frame'), UNDO_FRAME.ja)
	assert.equal(shortcutText('_includes/docs/en/04-edit.html', 'undo_frame'), UNDO_FRAME.en)
	assert.equal(shortcutText('_includes/docs/zh-tw/04-edit.html', 'undo_frame'), UNDO_FRAME['zh-tw'])
})

test('04-edit #edit-bbox: 取り消しは終端の確定の解除が先で、凡例の凍結解除と対応させる', () => {
	const undo = textOf(kvRowHtml(section('_includes/docs/04-edit.html', 'edit-bbox'), '取り消し') ?? '')
	assert.match(undo, /凡例では「凍結解除」/)
	assert.ok(undo.indexOf('終端の確定を解除') < undo.indexOf('現在のフレームの編集を元に戻します'), '終端の確定の解除が先に書かれていない')
})

test('web #requirements: 動画のサイズ・形式のメッセージはアプリの文と同じ', () => {
	const req = textOf(section('_includes/docs/web.html', 'requirements'))
	assert.ok(req.includes(WEB_SIZE_ERR), 'サイズの文がアプリと違う')
	assert.ok(req.includes(WEB_CONTAINER_ERR), '形式の文がアプリと違う')
})

test('06-ops #trouble: 製品版に無い「ログフォルダを開く」を案内せず、ログの置き場を書く', () => {
	const trouble = section('_includes/docs/06-ops.html', 'trouble')
	assert.doesNotMatch(trouble, /ログフォルダを開く/)
	assert.match(trouble, /<code>%USERPROFILE%\\\.deepmosaic\\logs\\app\.log<\/code>/)
	assert.match(trouble, /<code>%USERPROFILE%\\\.deepmosaic\\logs\\runs<\/code>/)
})

test('03-detect / 04-edit / 05-export: 画面の端の補完は「画面の外」と書き、「枠の外まで」と書かない', () => {
	const files = ['03-detect', '04-edit', '05-export'].map((n) => textOf(read(`_includes/docs/${n}.html`)))
	for (const t of files) {
		assert.doesNotMatch(t, /枠の外まで|枠の外への|枠の外へはみ出した/)
	}
	const [detect, edit, exp] = files
	assert.match(detect, /検出の枠を画面の外まで補って記録します。書き出しでモザイクを描くのは画面の中だけなので/)
	assert.match(edit, /画面の外まで自動で補われます。/)
	assert.match(exp, /画面の外まで補った形をもとに、画面の中の部分にモザイクがかかります/)
})

test('04-edit #edit-player: 反転の行は右クリックの切り替えと #edit-mosaic への参照だけ', () => {
	const row = kvRowHtml(section('_includes/docs/04-edit.html', 'edit-player'), '反転（外側にかける）')
	assert.ok(row, '反転の行が無い')
	const text = textOf(row)
	assert.match(row, /<a href="#edit-mosaic">モザイク設定パネル<\/a>/)
	assert.match(text, /「反転を解除 \(内側にかける\)」/)
	assert.match(text, /回避マスクには出ません/)
	assert.doesNotMatch(text, /枠の内側は元の映像のまま/)
})

// ---- 英中の画面で訳されて出る 3 つのメッセージ ----
const TRANSLATED_MESSAGES = {
	en: {
		'03-detect.html': "This detection engine doesn't support detecting existing mosaic, so this option is skipped and detection continues",
		'04-edit.html': 'Tracking needs a newer detection engine.',
		'05-export.html':
			"Sending was stopped because N settings use Invert (apply outside). Premiere Pro can't reproduce inversion, so the outside would be exported without being covered. Turn off Invert, or export from this app.",
	},
	'zh-tw': {
		'03-detect.html': '此偵測引擎不支援偵測既有馬賽克，因此將略過此項目並繼續偵測',
		'04-edit.html': '追蹤需要較新的偵測引擎。',
		'05-export.html': '因為有 N 項設定使用了「反轉（套用於外側）」，已中止傳送。Premiere Pro 無法重現反轉，外側會在未遮蔽的狀態下輸出。請取消反轉，或改用本應用程式匯出。',
	},
}

for (const [lang, files] of Object.entries(TRANSLATED_MESSAGES)) {
	test(`${lang}: 訳されて出る 3 つのメッセージはアプリの訳の文で書き、日本語のままの断り書きを付けない`, () => {
		for (const [file, message] of Object.entries(files)) {
			const html = read(`_includes/docs/${lang}/${file}`)
			assert.ok(textOf(html).includes(message), `${file} にアプリの訳の文が無い: ${message}`)
			assert.doesNotMatch(html, /data-ja-allowed/, `${file} に日本語のままの断り書きが残っている`)
			assert.doesNotMatch(html, /This message appears in Japanese|此訊息以日文顯示/, `${file} に日本語のままの断り書きが残っている`)
		}
		// 日本語のまま出るもの (アンインストーラ・メールの件名) の断り書きは残す
		for (const file of ['06-ops.html', '07-team.html', '01-intro.html']) {
			assert.match(read(`_includes/docs/${lang}/${file}`), /data-ja-allowed/, `陽性対照: ${file} の断り書きが無い`)
		}
	})
}
