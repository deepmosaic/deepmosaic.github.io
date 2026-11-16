// docs のメニューバー「ヘルプ」と GPU の取得の記述の仕様テスト。
//
//   node --test src/lib/site-copy-docs-help-menu.test.js
//
//   - メニューバーの「ヘルプ」(ライセンス / ドキュメント)。プロフィールメニューにはこの 2 項目が無い。
//     「ライセンス」への案内はメニューバーの「ヘルプ」から。初回セットアップ中も「ヘルプ」は使える。
//     (項目の表示名は旧「このアプリについて」→「ライセンス」。旧名の不在は site-copy-sign-in-docs.test.js)
//     ファイルメニューの「アップデートを確認」はサイト配布版の文 (Store 版に無いことは docs/store-edition.html)。
//   - GPU 高速化のスイッチは無く、NVIDIA 製 GPU 搭載機では初回に自動取得 (GPU の無い PC は取得しない)。
//     失敗時の文言はアプリの実文言 (「再試行」/ 次回の起動時に取り直す)。
//     #licenses に「初回に取得する第三者ソフト」(NVIDIA CUDA / cuDNN と ONNX Runtime の CUDA 実行プロバイダ)。
//   正本はアプリの画面の文言。
//
// 読み取りはこのファイル内で完結させる (spec-requirements.test.js と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid / HTML のコメントを落とす (コメント内の記述は数えない)。 */
function stripComments(source) {
	return source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
}

/** `<section id="…">` から次の `</section>` までを返す。無ければ null。 */
function sectionOf(html, id) {
	const start = html.indexOf(`<section id="${id}"`)
	if (start < 0) return null
	const end = html.indexOf('</section>', start)
	return end < 0 ? null : html.slice(start, end)
}

const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<h3>title</h3>` の直後から次の `<h3` までの本文 (テキスト)。無ければ null。 */
function afterHeading(html, title) {
	const marker = `>${title}</h3>`
	const at = html.indexOf(marker)
	if (at < 0) return null
	const start = at + marker.length
	const end = html.indexOf('<h3', start)
	return textOf(end < 0 ? html.slice(start) : html.slice(start, end))
}

const intro = read('_includes/docs/01-intro.html')
const ops = read('_includes/docs/06-ops.html')
const layout = sectionOf(intro, 'layout') ?? ''
const setupText = textOf(sectionOf(intro, 'setup') ?? '')
const licenses = sectionOf(ops, 'licenses') ?? ''
const licensesText = textOf(licenses)
const troubleText = textOf(sectionOf(ops, 'trouble') ?? '')
const allDocsText = textOf(intro) + textOf(ops)

const RETRY_TEXT = '取得に失敗しました。「再試行」を押すか、次回の起動時にもう一度取得します'

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(afterHeading('<h3>a</h3><p>x</p><h3>b</h3>', 'a'), 'x')
	assert.equal(afterHeading('<h3>a</h3>', 'z'), null)
	assert.equal(textOf('{% comment %}x{% endcomment %}<p>y</p>'), 'y')
})

test('メニューバー「ヘルプ」に「ライセンス」と「ドキュメント」', () => {
	const help = afterHeading(layout, 'メニューバー「ヘルプ」')
	assert.ok(help, '#layout に「メニューバー「ヘルプ」」の見出しが無い')
	assert.match(help, /ライセンス/)
	assert.match(help, /ドキュメント/)
	assert.match(help, /初回セットアップ中も使えます/)
	// 並び: ファイル → キュー → ヘルプ → プロフィールメニュー
	const order = ['メニューバー「ファイル」', 'メニューバー「キュー」', 'メニューバー「ヘルプ」', 'プロフィールメニュー（右上）'].map((t) =>
		layout.indexOf(`>${t}</h3>`),
	)
	assert.ok(order.every((i) => i > 0), `見出しが欠けている: ${order}`)
	assert.deepEqual([...order].sort((a, b) => a - b), order, '見出しの並びが違う')
})

test('プロフィールメニューの項目に「ドキュメント」「ライセンス」を並べない', () => {
	const profile = afterHeading(layout, 'プロフィールメニュー（右上）')
	assert.ok(profile)
	assert.doesNotMatch(profile, /ドキュメント（このページを開きます）/, '旧記述が残っている')
	const list = profile.slice(0, profile.indexOf('が並びます'))
	assert.ok(list.length > 0, '陽性対照: 項目の列挙が見つからない')
	assert.match(list, /お問い合わせ/)
	assert.match(list, /サインアウト/)
	assert.match(list, /テーマ/)
	assert.doesNotMatch(list, /ドキュメント|ライセンス|このアプリについて/)
	assert.match(profile, /メニューバーの「ヘルプ」にあります/)
})

test('「ライセンス」への案内はメニューバーの「ヘルプ」から', () => {
	assert.doesNotMatch(allDocsText, /プロフィールメニューの「(このアプリについて|ライセンス)」/, '旧記述が残っている')
	assert.match(licensesText, /メニューバーの「ヘルプ ▸ ライセンス」から/)
})

test('初回セットアップ中は「ファイル ▸ 終了」と「ヘルプ」だけ使える', () => {
	assert.match(setupText, /「ファイル ▸ 終了」と「ヘルプ」以外が無効/)
})

// ファイルメニューの説明はサイト配布版の文。Store 版に「アップデートを確認」が無いことは docs/store-edition.html (切り替えが true のときだけ) に書く。
test('「アップデートを確認」の説明 (旧インストーラ版のみ、と書かない)', () => {
	const file = afterHeading(layout, 'メニューバー「ファイル」')
	assert.ok(file)
	assert.match(file, /アップデートを確認 本体 \/ エンジン \/ モデル・アセットの更新を確認します/)
	assert.doesNotMatch(file, /旧インストーラ版|Microsoft Store/)
})

test('#setup は NVIDIA 製 GPU 搭載機で初回に自動取得、GPU の無い PC は取得しない', () => {
	const gpu = afterHeading(sectionOf(intro, 'setup') ?? '', 'GPU 高速化の準備（NVIDIA GPU 搭載機のみ）')
	assert.ok(gpu, '#setup の GPU 高速化の節が無い')
	assert.match(gpu, /NVIDIA 製 GPU を搭載したパソコンでは、初回に高速化用のコンポーネント/)
	assert.match(gpu, /約 1\.7 GB をダウンロード、展開後 約 2\.4 GB/)
	assert.match(gpu, /自動で取得します/)
	assert.match(gpu, /NVIDIA 製 GPU の無いパソコンでは取得しません/)
	assert.match(gpu, /取得が終わるまでは CPU で動きます/)
	assert.ok(gpu.includes(RETRY_TEXT), '失敗時の文言がアプリの文言と違う')
})

test('スイッチ・任意取得・旧い失敗文言の記述が docs と spec に残っていない', () => {
	const spec = read('_data/spec.yml').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
	for (const text of [allDocsText, spec]) {
		assert.doesNotMatch(text, /GPU 高速化 \(NVIDIA\) を有効にする/)
		assert.doesNotMatch(text, /自動では取得しません/)
		assert.doesNotMatch(text, /オンにしたときだけ/)
		assert.doesNotMatch(text, /GPU 高速化を有効にした場合/)
		assert.doesNotMatch(text, /検出時に自動取得します/)
	}
	assert.match(spec, /NVIDIA 製 GPU を搭載したパソコンでは、GPU 高速化用の NVIDIA 製のコンポーネントも自動でダウンロードします/)
})

test('トラブルシューティングは右下の「再試行」と次回起動時の取り直しを案内する', () => {
	assert.ok(troubleText.includes(RETRY_TEXT), '#trouble に新しい失敗時の文言が無い')
	assert.match(troubleText, /「再試行」を押すか、アプリを起動し直してください/)
})

test('#licenses の「初回に取得する第三者ソフト」に NVIDIA と ONNX Runtime の CUDA 実行プロバイダ', () => {
	const fetched = licenses.slice(licenses.indexOf('初回に取得する第三者ソフト'))
	assert.ok(licenses.includes('初回に取得する第三者ソフト'), '見出しが無い')
	const text = textOf(fetched)
	// アプリの画面の文と同じ
	assert.ok(
		text.includes(
			'NVIDIA GPU 搭載機では、NVIDIA Corporation のソフトウェア (CUDA / cuDNN ほか) をその使用許諾条件に従って当社の配信元から取得し、このパソコンに保存します。取得したものは GPU での処理にだけ使います。',
		),
		'アプリの画面の文と違う',
	)
	assert.match(text, /NVIDIA CUDA \/ cuDNN ほか（GPU 高速化のコンポーネント）/)
	assert.match(text, /ONNX Runtime の CUDA 実行プロバイダ/)
	assert.match(text, /MIT License/)
	assert.match(text, /NVIDIA 製 GPU の無いパソコンでは取得しません/)
	// 同梱の一覧 (FFmpeg / ONNX Runtime / VC++) より後ろに置く
	assert.ok(licenses.indexOf('Visual C++') < licenses.indexOf('初回に取得する第三者ソフト'))
})
