// docs の導入と更新の節は、Microsoft Store 版を先に書き、インストーラ版の提供終了と移行の手順を案内する。
//
//   node --test src/lib/site-copy-docs-install-update.test.js
//
//   - #install: Microsoft Store から入手する手順と kv (対応 OS・画面の言語・インストール先・アップデート・使用許諾契約書)、
//     Microsoft Store のバッジ (補足文つき)、移行の小見出し (#install-migrate)、
//     Store 版とインストーラ版の違い (部品 `_includes/docs/store-edition.html`、`store_enabled` が true のときだけ)。
//   - 移行の文の期限はアプリのお知らせ (exe 版は 2026年12月31日 をもってご利用いただけなくなります) と同じ意味。
//     アプリの画面の語 (「あとで」「Microsoft Store からダウンロード」) はアプリの辞書の文。
//   - #update・#uninstall は Store 版の 1 段落を先に置き、インストーラ版の説明を残す。
//   - 01-intro・06-ops・07-team は切り替えを直接読まない (site-store-button.test.js の「切り替えを読むのは部品だけ」)。
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

/** `<h3 id="…">` から次の h2 / h3 / 部品の include までを返す。無ければ null。 */
function subsectionOf(html, id) {
	const start = html.indexOf(`<h3 id="${id}"`)
	if (start < 0) return null
	const rest = html.slice(start + 1)
	const end = rest.search(/<h[23]\b|\{%-?\s*include docs\//)
	return end < 0 ? html.slice(start) : html.slice(start, start + 1 + end)
}

const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

const intro = read('_includes/docs/01-intro.html')
const ops = read('_includes/docs/06-ops.html')
const team = read('_includes/docs/07-team.html')
const STORE_EDITION = '_includes/docs/store-edition.html'

test('ヘルパー: 陽性対照と陰性対照', () => {
	assert.equal(sectionOf('<p>x</p>', 'install'), null)
	assert.equal(textOf('{% comment %}x{% endcomment %}<b>y</b>'), 'y')
	assert.equal(subsectionOf('<h3 id="a">x</h3><p>y</p><h3 id="b">z</h3>', 'a'), '<h3 id="a">x</h3><p>y</p>')
	assert.equal(subsectionOf('<p>x</p>', 'a'), null)
})

test('#install: Microsoft Store から入手する手順と kv、インストーラを実行する手順は無い', () => {
	const install = sectionOf(intro, 'install')
	assert.ok(install, '01-intro に #install が無い')
	const text = textOf(install)
	assert.match(text, /Microsoft Store から入手してください。下の「Microsoft Store からダウンロード」を押すと、小さなインストーラがダウンロードされます。開くと Microsoft Store を通してインストールが始まり、終わると Deepmosaic が起動します。/)
	assert.match(install, /<a href="\{\{ site\.data\.lang\.ja\.app_store_protocol_link \}\}">こちら<\/a>/, 'Microsoft Store アプリで直接開くリンク')
	assert.match(text, /管理者権限は不要です/)
	assert.match(text, /対応 OS Windows 10（バージョン 2004 以降）\/ 11（64 ビット）。macOS 版は開発中です/)
	assert.match(text, /画面の言語 アプリの画面は日本語・英語・繁体字中国語に対応しています/)
	assert.match(text, /インストール先 Windows が管理するアプリのフォルダ（変更できません）。スタートメニューに「Deepmosaic」が登録されます/)
	assert.match(text, /アップデート 新しいバージョンは Microsoft Store が配信し、自動で更新されます（アップデート）/)
	assert.match(text, /project\.db/, '2.8.0 より前のプロジェクトの変換の説明')
	assert.match(text, /使用許諾契約書 初めて起動したときの「ご利用の前に」で確認し、同意します（初回セットアップ）/)
	assert.doesNotMatch(text, /ダウンロードしたインストーラ（Deepmosaic Setup）を実行|インストーラの言語|インストーラの途中で使用許諾契約書/)
	assert.doesNotMatch(text, /ログイン/, '語は「サインイン」')
	assert.equal((install.match(/class="kv-row/g) ?? []).length, 5)
})

test('#install (英中): バッジを押すと小さなインストーラがダウンロードされ、開くと Microsoft Store を通して入る手順', () => {
	const en = textOf(sectionOf(read('_includes/docs/en/01-intro.html'), 'install') ?? '')
	assert.match(en, /Get it from Microsoft Store\. Select "Download from the Microsoft Store" below to download a small installer\. Open it to start the installation through Microsoft Store; Deepmosaic starts when the installation finishes\./)
	const zh = textOf(sectionOf(read('_includes/docs/zh-tw/01-intro.html'), 'install') ?? '')
	assert.match(zh, /請從 Microsoft Store 取得。按下方的「從 Microsoft Store 下載」，會下載小型安裝程式。開啟後即透過 Microsoft Store 開始安裝，安裝完成後會啟動 Deepmosaic。/)
})

test('#install: Store のバッジに補足文・移行の小見出し・違いの部品を置き、インストーラのボタンは無い', () => {
	const install = stripComments(sectionOf(intro, 'install') ?? '')
	assert.doesNotMatch(install, /download-button|app_download_link/, 'インストーラのボタンが残っている')
	assert.match(install, /\{% include store-button\.html dl="docs-install-store" lazy=true note="Windows 10（バージョン 2004 以降）\/ 11（64bit）。入れてすぐ、サインインなしでお試しいただけます" %\}/)
	assert.match(install, /\{%-? include docs\/store-edition\.html -?%\}/)
	assert.ok(install.indexOf('id="install-migrate"') < install.search(/include docs\/store-edition\.html/), '移行の小見出しは違いの部品の前')
	assert.doesNotMatch(install, /app_store_product_id|apps\.microsoft\.com|get\.microsoft\.com|store-install-url/, 'Store へのリンクは Store のボタンの部品だけ')
})

test('#install-migrate: 提供終了の期限・引き継がれるもの・お知らせ・手順 3 つ・2.18 より前のアンインストーラの注意', () => {
	const sec = subsectionOf(sectionOf(intro, 'install') ?? '', 'install-migrate')
	assert.ok(sec, '#install に移行の小見出し (h3 id="install-migrate") が無い')
	const text = textOf(sec)
	assert.match(text, /^インストーラ版の提供終了と Microsoft Store 版への移行/)
	// 期限の文はアプリのお知らせ (1a) と同じ意味。用語の対応 (アプリの画面では「exe 版」) を最初の 1 か所に
	assert.match(text, /公式サイトからダウンロードしたインストーラ版（アプリの画面では「exe 版」）は、2026 年 12 月 31 日をもってご利用いただけなくなります。それまでは引き続きご利用いただけます。/)
	assert.match(text, /料金・ご利用条件・機能は変わりません。/)
	assert.equal((text.match(/exe 版/g) ?? []).length, 1, '「exe 版」は対応を書く 1 か所だけ')
	assert.match(text, /引き継がれるもの: プロジェクトフォルダ・設定とサインインの情報・AI モデル等は、Microsoft Store 版がそのまま使います/)
	assert.match(text, /インストーラ版の 2\.18 以降では、起動時に移行のお知らせが表示されます（「あとで」で閉じると、次に起動するまで表示されません）。2027 年 1 月 1 日以降に起動すると、提供終了の画面が表示され、操作できません/)
	assert.match(text, /2026 年 12 月 31 日までは、インストーラ版にもアプリ内のアップデートが届きます/)
	const steps = [...sec.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1]))
	const ol = sec.match(/<ol>([\s\S]*?)<\/ol>/)?.[1] ?? ''
	assert.equal((ol.match(/<li>/g) ?? []).length, 3, '手順は 3 つ (アプリのお知らせの手順と同じ順)')
	assert.match(steps.join(' '), /Microsoft Store 版をインストールします（上のボタン、またはアプリのお知らせの「Microsoft Store からダウンロード」）/)
	assert.match(steps.join(' '), /Microsoft Store 版を起動し、設定とプロジェクトが引き継がれていることを確かめます/)
	assert.match(steps.join(' '), /インストーラ版をアンインストールします（アンインストール）/)
	assert.match(text, /2\.18 より前のインストーラ版をアンインストールするときは、確認画面の「アプリのデータとプロジェクトフォルダを削除する」にチェックを入れないでください/)
	assert.match(text, /先にアプリ内のアップデートで 2\.18 以降に更新しておくと、これらは削除されません/)
	assert.match(sec, /href="#uninstall"/)
})

test('ファイルメニューの「アップデートを確認」の説明 (旧インストーラ版のみ、と書かない。インストーラ版だけの項目)', () => {
	const text = textOf(intro)
	assert.match(text, /アップデートを確認 本体 \/ エンジン \/ モデル・アセットの更新を確認します（アップデート）。インストーラ版だけの項目です/)
	assert.doesNotMatch(text, /旧インストーラ版/)
})

test('#setup: 検出エンジンと軽量の検出モデルはアプリに含まれる', () => {
	assert.match(textOf(sectionOf(intro, 'setup') ?? ''), /検出エンジンと軽量の検出モデルはアプリに含まれています/)
})

test('#update: Store 版の 1 段落が先、インストーラ版の自動確認・今すぐ更新・あとで・手動で確認 + 検出エンジンと AI モデルの 2 行', () => {
	const update = sectionOf(ops, 'update')
	assert.ok(update, '06-ops に #update が無い')
	const text = textOf(update)
	assert.match(text, /Microsoft Store 版は、新しいバージョンを Microsoft Store が配信し、自動で更新されます。AI モデルは起動時に新しいものがあれば自動で取得・差し替えられます。以下は、インストーラ版（2026 年 12 月 31 日まで。移行）の説明です。/)
	assert.match(update, /<a href="#install-migrate">移行<\/a>/)
	assert.ok(text.indexOf('Microsoft Store 版は') < text.indexOf('インストーラ版のアプリは、起動時に自動で新しいバージョンを確認します'), 'Store 版の段落が先')
	assert.match(text, /自動確認のタイミング 起動直後、その後は 1 時間ごと/)
	assert.match(text, /今すぐ更新 新しいバージョンをダウンロードして適用し、アプリが自動で再起動します/)
	assert.match(text, /あとで このセッションではそれ以上の自動確認を行いません/)
	assert.match(text, /検出エンジン アプリに含まれていて、アプリと一緒に更新されます/)
	assert.match(text, /AI モデル 起動時に新しいものがあれば自動で取得・差し替えられます/)
	assert.match(text, /手動で確認する メニューの「ファイル ▸ アップデートを確認」で/)
	assert.match(text, /ネットワーク接続をご確認のうえ、もう一度お試しください。/)
	assert.doesNotMatch(text, /本体とは別に配布され/, '検出エンジンは本体に含まれる')
	assert.doesNotMatch(text, /旧インストーラ版/)
})

test('#data: Store 版への切り替えの文は移行の小見出しに置き、#data には書かない。検出エンジンの同梱を書く', () => {
	const text = textOf(sectionOf(ops, 'data') ?? '')
	assert.match(text, /%LOCALAPPDATA%\\deepmosaic/)
	assert.match(text, /検出エンジンと動画処理ツールはアプリに含まれています/)
	assert.doesNotMatch(text, /Microsoft Store|インストーラ版から/)
})

test('#uninstall: Store 版の 1 段落が先、インストーラ版は確認画面のチェックでデータも消す', () => {
	const sec = sectionOf(ops, 'uninstall') ?? ''
	const text = textOf(sec)
	assert.match(text, /Microsoft Store 版も同じ手順でアンインストールできます。確認画面のチェックは無く、設定とサインインの情報とプロジェクトフォルダは残ります（Microsoft Store 版とインストーラ版の違い）。/)
	assert.match(sec, /<a href="#install-store">Microsoft Store 版とインストーラ版の違い<\/a>/)
	assert.match(text, /インストールされているアプリ/)
	assert.match(text, /インストーラ版をアンインストールすると、AI モデル等（%LOCALAPPDATA%\\deepmosaic、10GB程度）は自動で削除されます（再インストールしたときは初回セットアップで再ダウンロードします。Microsoft Store 版が入っている PC の 2\.18 以降のインストーラ版では削除しません）/)
	assert.match(text, /「アプリのデータとプロジェクトフォルダを削除する \(中の書き出し動画も削除されます\)」にチェックを入れると/)
	assert.match(text, /設定とサインインの情報（%USERPROFILE%\\\.deepmosaic）/)
	assert.match(text, /チェックしない場合、これらは残ります/)
	assert.doesNotMatch(text, /ログイン/)
})

test('#licenses: 「Desktop 版のアプリには」(Store 版に限らない)', () => {
	const text = textOf(sectionOf(ops, 'licenses') ?? '')
	assert.match(text, /Desktop 版のアプリには、次の第三者ソフトウェアを同梱しています/)
	assert.doesNotMatch(text, /Microsoft Store/, '差し替えできない旨は違いの部品へ')
	assert.match(text, /Deepmosaic のアプリ本体にはリンクしていません/)
})

test('07-team: アプリをまだ入れていない方は Microsoft Store から入れる (/join/ と同じ言い方)', () => {
	const text = textOf(team)
	assert.match(text, /アプリをまだ入れていない場合は、先に Microsoft Store からアプリを入れてください/)
	assert.doesNotMatch(text, /先にアプリをダウンロードしてインストールしてください/)
})

test('Store 版とインストーラ版の違い: 全体が store_enabled の if の中にあり、異なる点は決まった項目だけで、プランの申し込みはインストーラ版と同じ', () => {
	const src = read(STORE_EDITION)
	const m = stripComments(src).match(/^\s*\{%-?\s*if site\.data\.site\.distribution\.store_enabled\s*-?%\}([\s\S]*)\{%-?\s*endif\s*-?%\}\s*$/)
	assert.ok(m, `${STORE_EDITION}: 全体が store_enabled の if の中に無い (false のときに何かが出る)`)
	const text = textOf(m[1])
	assert.match(m[1], /<h3 id="install-store"[^>]*>Microsoft Store 版とインストーラ版の違い<\/h3>/)
	assert.match(text, /アプリ内の更新ダイアログと「ファイル ▸ アップデートを確認」は Microsoft Store 版にはありません/)
	assert.match(text, /使える機能・アカウント・プラン（アプリからのプランの申し込み・変更・解約を含む）はインストーラ版と同じです。次の点だけが異なります/)
	// 異なる点の項目は許可の一覧のとおり (入手先は #install の本文、切り替えは移行の小見出しに書く)
	const labels = [...m[1].matchAll(/<li><strong>([^<]*)<\/strong>/g)].map((x) => x[1])
	assert.deepEqual(labels, ['アップデート', '同梱する第三者ソフト', 'Premiere Pro 連携', 'アンインストール'])
	assert.match(text, /差し替えることはできません/)
	assert.doesNotMatch(text, /チェックを入れないでください/, '同じ注意を 2 か所に書かない (移行の小見出しだけ)')
	assert.doesNotMatch(m[1], /apps\.microsoft\.com/, '掲載ページへのリンクは Store のボタン (store-button.html) だけ')
})

/** FAQ の `- q: "…"` / `a: "…"` の組を読む (ja はトップレベル、英中は items: の下) */
function faqItems(src) {
	return [...src.matchAll(/^\s*- q: "((?:[^"\\]|\\.)*)"\r?\n\s+a: "((?:[^"\\]|\\.)*)"/gm)].map((m) => ({ q: m[1], a: m[2].replace(/\\"/g, '"') }))
}

test('FAQ: アップデートの答えは Store 版を先に、直後にインストーラ版の期限の質問 (3 言語・同じ位置)', () => {
	const cases = [
		['_data/faq.yml', 'アプリのアップデートはどうすればよいですか？', 'Microsoft Store 版は、Microsoft Store が新しいバージョンを自動で配信します。インストーラ版をお使いの場合（2026 年 12 月 31 日まで）は、起動時に自動で新しいバージョンを確認し、更新がある場合はダイアログでお知らせします。ワンクリックで更新できます。', 'インストーラ版はいつまで使えますか？', '公式サイトからダウンロードしたインストーラ版は、2026 年 12 月 31 日をもってご利用いただけなくなります。それまでに Microsoft Store 版へ移行してください。料金・ご利用条件・機能は変わらず、設定・サインインの情報・プロジェクトはそのまま引き継がれます。手順はドキュメントの「インストール」をご覧ください。'],
		['_data/l10n/en/faq.yml', 'How do I update the app?', 'In the Microsoft Store edition, Microsoft Store delivers new versions automatically. If you use the installer edition (until December 31, 2026), it checks for a new version at launch and shows a dialog if an update is available. You can update with one click.', 'Until when can I use the installer edition?', 'The installer edition downloaded from our website will stop working after December 31, 2026. Please switch to the Microsoft Store edition before then. Pricing, terms of use, and features stay the same, and your settings, sign-in information, and projects carry over as they are. See "Installation" in the user guide for the steps.'],
		['_data/l10n/zh-tw/faq.yml', '如何更新應用程式？', 'Microsoft Store 版會由 Microsoft Store 自動發布新版本。若您使用安裝程式版（至 2026 年 12 月 31 日為止），會在啟動時自動檢查新版本，有更新時會以對話方塊通知，按一下即可更新。', '安裝程式版可以使用到什麼時候？', '從官方網站下載的安裝程式版，於 2026 年 12 月 31 日之後將無法再使用。請在此之前移轉至 Microsoft Store 版。費用、使用條款與功能皆不變，設定、登入資訊與專案會原樣沿用。步驟請參閱使用說明的「安裝」。'],
	]
	const positions = []
	for (const [rel, uq, ua, eq, ea] of cases) {
		const items = faqItems(read(rel))
		assert.equal(items.length, 16, `${rel}: 件数`)
		const i = items.findIndex((x) => x.q === uq)
		assert.ok(i >= 0, `${rel}: アップデートの質問が無い`)
		assert.equal(items[i].a, ua, `${rel}: アップデートの答え`)
		assert.deepEqual(items[i + 1], { q: eq, a: ea }, `${rel}: 直後の期限の質問`)
		assert.doesNotMatch(items[i].a + items[i + 1].a, /除去/, `${rel}: 語彙ポリシー`)
		positions.push(i)
	}
	assert.equal(new Set(positions).size, 1, '3 言語で同じ位置')
})

test('llms.txt: 基本情報に入手先 (Microsoft Store) とインストーラ版の期限、llms-full.txt にも同じ 1 行', () => {
	const line = '- 入手 / Get it: Microsoft Store (https://apps.microsoft.com/detail/{{ site.data.lang.ja.app_store_product_id }})。公式サイトのインストーラ版は 2026 年 12 月 31 日をもってご利用いただけなくなります / Microsoft Store; the installer edition from our website stops working after December 31, 2026'
	const llms = read('llms.txt')
	const facts = llms.slice(llms.indexOf('**基本情報 / Key facts**'), llms.indexOf('## 製品 / Product'))
	assert.ok(facts.includes(line), 'llms.txt の基本情報に入手の行が無い')
	assert.ok(read('llms-full.txt').includes(line), 'llms-full.txt に入手の行が無い')
	for (const rel of ['llms.txt', 'llms-full.txt']) assert.doesNotMatch(read(rel), /app_download_link|download\/latest\/windows/, rel)
})
