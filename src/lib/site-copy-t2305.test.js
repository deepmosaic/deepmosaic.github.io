// T-2305 (backlog1113, 2026-11-13) docs をサイト配布版 (インストーラ + 自動更新) の実態に戻す。
//
//   node --test src/lib/site-copy-t2305.test.js
//
//   - 2.14 はサイト配布版と Microsoft Store 版の両方で出す。ダウンロードの既定はインストーラ (T-2303)。
//   - #install・#update・#uninstall・ファイルメニューの「アップデートを確認」は公開中 (origin/master) の文に戻す
//     (語は「サインイン」、T-2115)。ブランチで入った 2.13 の変更 (検出エンジンと軽量モデルの同梱・「ヘルプ」・GPU の自動取得) は残す。
//   - Store 版だけの補足 (入手先・更新は Store・アプリ内に購入画面が無い・同梱ソフトの差し替え不可) は
//     部品 `_includes/docs/store-edition.html` にまとめ、`store_enabled` が true のときだけ出す。
//     01-intro は切り替えを直接読まない (site-store-button-t2304.test.js の「切り替えを読むのは部品だけ」)。
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

const intro = read('_includes/docs/01-intro.html')
const ops = read('_includes/docs/06-ops.html')
const team = read('_includes/docs/07-team.html')
const STORE_EDITION = '_includes/docs/store-edition.html'

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'install'), null)
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
})

test('#install: インストーラを実行する手順 (公開中の文)、Store だけの節と 2.11.1 終了の節は無い', () => {
	const install = sectionOf(intro, 'install')
	assert.ok(install, '01-intro に #install が無い')
	const text = textOf(install)
	assert.match(text, /ダウンロードしたインストーラ（Deepmosaic Setup）を実行してください/)
	assert.match(text, /WebView2/)
	assert.match(text, /インストール先 現在のユーザーのアプリフォルダ/)
	assert.match(text, /インストーラの途中で使用許諾契約書が表示されます/)
	assert.match(text, /アップグレード アプリは起動時に新しいバージョンを確認し、更新があるとダイアログで「今すぐ更新」「あとで」を選べます/)
	assert.match(text, /project\.db/, '2.8.0 より前のプロジェクトの変換の説明')
	assert.doesNotMatch(text, /Microsoft Store/, '#install の本文 (Store だけの部品の外) に Store の文が残っている')
	assert.doesNotMatch(text, /2\.11\.1 で終了|インストーラ版（Deepmosaic Setup）をお使いの方へ/, '配布終了の節が残っている')
	assert.doesNotMatch(text, /ログイン/, '語は「サインイン」 (T-2115)')
})

test('#install: DL ボタン (インストーラ)・Store のボタン・Store だけの補足の部品を置く', () => {
	const install = stripComments(sectionOf(intro, 'install') ?? '')
	assert.match(install, /\{% include download-button\.html dl="docs-install" note="Windows 10 \/ 11（64bit）。ダウンロードしてすぐ、サインインなしでお試しいただけます" %\}/)
	assert.match(install, /\{%-? include store-button\.html dl="docs-install-store"/)
	assert.match(install, /\{%-? include docs\/store-edition\.html -?%\}/)
	assert.doesNotMatch(install, /app_store_protocol_link|app_store_product_id/, 'Store のリンクは部品の中だけ')
})

test('ファイルメニューの「アップデートを確認」は公開中の文 (旧インストーラ版のみ、と書かない)', () => {
	const text = textOf(intro)
	assert.match(text, /アップデートを確認 本体 \/ エンジン \/ モデル・アセットの更新を確認します（アップデート）/)
	assert.doesNotMatch(text, /旧インストーラ版/)
})

test('#setup: 検出エンジンと軽量の検出モデルはアプリに含まれる (2.13 の変更は残す)', () => {
	assert.match(textOf(sectionOf(intro, 'setup') ?? ''), /検出エンジンと軽量の検出モデルはアプリに含まれています/)
})

test('#update: 自動確認・今すぐ更新・あとで・手動で確認 (公開中の文) + 検出エンジンと AI モデルの 2 行', () => {
	const update = sectionOf(ops, 'update')
	assert.ok(update, '06-ops に #update が無い')
	const text = textOf(update)
	assert.match(text, /アプリは起動時に自動で新しいバージョンを確認します/)
	assert.match(text, /自動確認のタイミング 起動直後、その後は 1 時間ごと/)
	assert.match(text, /今すぐ更新 新しいバージョンをダウンロードして適用し、アプリが自動で再起動します/)
	assert.match(text, /あとで このセッションではそれ以上の自動確認を行いません/)
	assert.match(text, /検出エンジン アプリに含まれていて、アプリと一緒に更新されます/)
	assert.match(text, /AI モデル 起動時に新しいものがあれば自動で取得・差し替えられます/)
	assert.match(text, /手動で確認する メニューの「ファイル ▸ アップデートを確認」で/)
	assert.match(text, /ネットワーク接続をご確認のうえ、もう一度お試しください。/)
	assert.doesNotMatch(text, /Microsoft Store|インストーラ版/)
	assert.doesNotMatch(text, /本体とは別に配布され/, '検出エンジンは本体に含まれる (2.13)')
})

test('#data: Store 版への切り替えの文を外し、検出エンジンの同梱は残す', () => {
	const text = textOf(sectionOf(ops, 'data') ?? '')
	assert.match(text, /%LOCALAPPDATA%\\deepmosaic/)
	assert.match(text, /検出エンジンと動画処理ツールはアプリに含まれています/)
	assert.doesNotMatch(text, /Microsoft Store|インストーラ版から/)
})

test('#uninstall: 確認画面のチェックでデータも消す (公開中の文、2.13 のアンインストーラも同じ)', () => {
	const text = textOf(sectionOf(ops, 'uninstall') ?? '')
	assert.match(text, /インストールされているアプリ/)
	assert.match(text, /%LOCALAPPDATA%\\deepmosaic、10GB程度）は自動で削除されます/)
	assert.match(text, /「アプリのデータとプロジェクトフォルダを削除する \(中の書き出し動画も削除されます\)」にチェックを入れると/)
	assert.match(text, /設定とサインインの情報（%USERPROFILE%\\\.deepmosaic）/)
	assert.match(text, /チェックしない場合、これらは残ります/)
	assert.doesNotMatch(text, /Microsoft Store|インストーラ版|ログイン/)
})

test('#licenses: 「Desktop 版のアプリには」(Store 版に限らない)', () => {
	const text = textOf(sectionOf(ops, 'licenses') ?? '')
	assert.match(text, /Desktop 版のアプリには、次の第三者ソフトウェアを同梱しています/)
	assert.doesNotMatch(text, /Microsoft Store/, '差し替えできない旨は Store だけの補足へ')
	assert.match(text, /Deepmosaic のアプリ本体にはリンクしていません/)
})

test('07-team: アプリをまだ入れていない方はダウンロードしてインストール', () => {
	const text = textOf(team)
	assert.match(text, /アプリをまだ入れていない場合は、先にアプリをダウンロードしてインストールしてください/)
	assert.doesNotMatch(text, /Microsoft Store/)
})

test('Store だけの補足: 全体が store_enabled の if の中にあり、4 点 (入手先・更新・購入画面・差し替え) を書く', () => {
	const src = read(STORE_EDITION)
	const m = stripComments(src).match(/^\s*\{%-?\s*if site\.data\.site\.distribution\.store_enabled\s*-?%\}([\s\S]*)\{%-?\s*endif\s*-?%\}\s*$/)
	assert.ok(m, `${STORE_EDITION}: 全体が store_enabled の if の中に無い (false のときに何かが出る)`)
	const text = textOf(m[1])
	assert.match(m[1], /app_store_protocol_link/, '入手先 (Microsoft Store アプリで開くリンク)')
	assert.match(text, /Microsoft Store 版をお使いの方へ/)
	assert.match(text, /Microsoft Store が配信/)
	assert.match(text, /「ファイル ▸ アップデートを確認」はありません/)
	assert.match(text, /購入画面がありません/)
	assert.match(text, /差し替えることはできません/)
	assert.doesNotMatch(m[1], /apps\.microsoft\.com/, '掲載ページへのリンクは Store のボタン (store-button.html) だけ')
})

test('docs の章の部品 (01 / 06 / 07) は Store だけの補足の外で Microsoft Store を書かない', () => {
	for (const [rel, src] of [['01-intro', intro], ['06-ops', ops], ['07-team', team]]) {
		assert.doesNotMatch(textOf(src), /Microsoft Store/, `${rel} に Store の文が残っている`)
	}
})
