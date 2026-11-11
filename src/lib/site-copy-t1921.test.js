// T-1921 (2026-11-11) プライバシーポリシー §9 を配信ストアからの入手に合わせて改訂した内容を固定する仕様テスト。
//
//   node --test src/lib/site-copy-t1921.test.js
//
//   - 配布は外部のアプリケーション配信サービスだけ (ユーザー決定 2026-11-11、インストーラー版は 2.11.1 で終了)。
//   - 配信ストア版は初回起動時に配布の種類をアカウントまたは端末の識別子・版と記録し、ダウンロードの識別子・参照元は記録しない
//     (desktop `telemetry/install_source.rs` の `pending_report_for` = source "store" 固定)。
//   - インストーラー版 (2.11.1 以前) の記録の記述は 9-3 に残す (ログインした状態の DL の突き合わせも)。
//   - 法務文書なので企業名・配信サービス名は書かない (Google Analytics を除く)。版 (legal.yml) は動かさない。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

function section9() {
	const html = stripComments(read('company/privacy.html'))
	const start = html.indexOf('9.入手経路の記録について')
	const end = html.indexOf('10.無料枠の管理', start)
	assert.ok(start >= 0 && end > start, '§9 が見つからない')
	return textOf(html.slice(start, end))
}

test('§9 の見出しは「入手経路の記録」で、旧見出し「ダウンロード経路の記録」は残さない', () => {
	const html = stripComments(read('company/privacy.html'))
	assert.match(html, /<h2[^>]*>9\.入手経路の記録について<\/h2>/)
	assert.ok(!html.includes('9.ダウンロード経路の記録について'))
})

test('9-1: 配信ストア版は配布の種類を版・アカウントまたは端末の識別子と記録し、ダウンロードの識別子と参照元は記録しない', () => {
	const s9 = section9()
	assert.match(s9, /配信ストアから入手した本ソフトウェアの初回起動時に、配布の種類（配信ストアから入手したものであること）を、アプリケーションのバージョン及び本サービス上のアカウントまたは端末ごとの識別子とあわせて当社サーバーに記録します。/)
	assert.match(s9, /ダウンロードごとの識別子を用いず、どのような経路でお知りいただいたか（参照元のURL、キャンペーンパラメータ等）の情報を当社サーバーに記録しません。/)
	assert.match(s9, /配布の種類は、不具合の調査のため、12項に定める動作記録及び13項に定めるエラー診断レポートにも含めます。/)
})

test('9-2: サイトの計測は Google Analytics、配信ストアへ流入元を引き渡さない', () => {
	const s9 = section9()
	assert.match(s9, /8項に定める Google Analytics により統計的に把握します。/)
	assert.match(s9, /流入元の情報を配信ストアへ引き渡しません。/)
})

test('9-3: インストーラー版 (2.11.1 以前) の記録はファイル名の識別子・ログイン時の突き合わせを含めて残す', () => {
	const s9 = section9()
	assert.match(s9, /インストーラー形式で配布していた本ソフトウェア（バージョン2\.11\.1以前。以下「インストーラー版」といいます。）/)
	assert.match(s9, /当該識別子はインストーラーのファイル名に含まれ、アプリケーションの初回起動時に当社サーバーへ送信されます。/)
	for (const item of ['参照元のURL', 'キャンペーンパラメータ', '国コード', 'User-Agent', 'ダウンロード日時']) {
		assert.ok(s9.includes(item), `${item} が無い`)
	}
})

test('9-4 / 9-5: 目的の限定・第三者提供なし・開示等の請求の窓口。記録の削除の約束は書かない', () => {
	const s9 = section9()
	assert.match(s9, /それ以外の目的では利用しません。第三者への提供は行いません。/)
	assert.match(s9, /6項および7項に定めるところに従い、下記の問い合わせ窓口にて承ります。/)
	assert.doesNotMatch(s9, /削除します/)
})

test('企業名・配信サービスの名称を書かない (Google Analytics を除く)', () => {
	const s9 = section9()
	assert.doesNotMatch(s9, /Microsoft|マイクロソフト|Store|ストア（/)
})

test('最終更新日は 2026-11-11、版 (legal.yml) は privacy の改定では動かさない', () => {
	assert.match(read('company/privacy.html'), /最終更新日: 2026-11-11（制定: 2019-06-01）/)
	assert.match(read('_data/legal.yml'), /version:\s*"2026-11-08"/)
})
