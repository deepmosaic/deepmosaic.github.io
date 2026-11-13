// T-1921 (2026-11-13 改訂) プライバシーポリシー §9 とクッキーポリシーを「サイト配布版 + 配信ストア版」の両方に合う文にした内容を固定する仕様テスト。
//
//   node --test src/lib/site-copy-t1921.test.js
//
//   - ユーザー承認 (2026-11-13 夜): 文案 D:/dm-scratch/backlog1113/privacy9-draft.md の (1) §9 の全文と (2) クッキーポリシーの文。
//     決定: 記録項目に「最初に到達した際の参照元、キャンペーンパラメータ及び最初に表示したページのパス」を足す / 突き合わせの結果を
//     サインインのご案内に使うことを書く / 用語は「サイト配布版」「配信ストア版」。
//   - 配信ストア版の記述は `_data/site.yml` の `distribution.store_enabled` で出し分ける。切り替えを読むのは部品
//     `_includes/legal-distribution.html` だけ (T-2304 の「ページのファイルは切り替えを直接読まない」)。
//       false (既定): 冒頭はサイト配布版だけ、9-1 サイト配布版 / 9-2 利用目的 / 9-3 記録を希望されない場合 (配信ストア版の公開前の文)。
//       true: 冒頭が 2 つの配布方法、9-1 / 9-2 配信ストア版 / 9-3 利用目的 / 9-4 記録を希望されない場合 (公開後の文)。
//   - 事実の出典は docs_draft/notes_T-1921.md (desktop の install_source.rs・download-tracking.ts・web_origin.rs、サイトの attribution.js)。
//   - 法務文書なので企業名・配信サービス名は書かない (Google Analytics を除く)。版 (legal.yml) は動かさない。
//   - npm test はビルドの前に走るので `_site` は読まない。部品は下の小さな描画器で false / true の両方を描く
//     (部品が使ってよい Liquid のタグを限り、描画器が読み違えないことも検査する)。実際のビルドの出力は
//     scripts/i18n/checks/store.mjs (false は check-site、true は scripts/check-store-toggle.mjs) が見る。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const PART_FILE = '_includes/legal-distribution.html'
const PRIVACY = 'company/privacy.html'
const COOKIE = 'company/cookie.html'

const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

const TAG_RE = /\{%(-?)\s*([\s\S]*?)\s*(-?)%\}/g
const COND_PART_RE = /^include\.part\s*==\s*"([a-z0-9-]+)"$/
const COND_STORE = 'site.data.site.distribution.store_enabled'

/**
 * 部品の小さな描画器。使えるタグは comment / if / elsif / else / endif だけで、条件は
 * `include.part == "<名前>"` と `site.data.site.distribution.store_enabled` だけ (それ以外は例外)。
 * `{%-` / `-%}` の空白の削りも Liquid と同じに扱う。
 */
function renderPart(src, { part, store }) {
	const evalCond = (cond) => {
		const m = cond.match(COND_PART_RE)
		if (m) return m[1] === part
		if (cond === COND_STORE) return store
		throw new Error(`部品が描画器の知らない条件を使っている: ${cond}`)
	}
	const stack = [] // { active: 親が有効か, taken: どれかの枝を通ったか, on: 今の枝が有効か }
	const isOn = () => stack.every((f) => f.on)
	let out = ''
	let last = 0
	let trimNext = false
	let inComment = false
	for (const m of src.matchAll(TAG_RE)) {
		let chunk = src.slice(last, m.index)
		if (trimNext) chunk = chunk.replace(/^\s+/, '')
		if (m[1] === '-') chunk = chunk.replace(/\s+$/, '')
		if (!inComment && isOn()) out += chunk
		last = m.index + m[0].length
		trimNext = m[3] === '-'
		const [name, ...rest] = m[2].split(/\s+/)
		const cond = rest.join(' ')
		if (inComment) {
			if (name === 'endcomment') inComment = false
			continue
		}
		if (name === 'comment') inComment = true
		else if (name === 'if') {
			const parentOn = isOn()
			const on = parentOn && evalCond(cond)
			stack.push({ parentOn, taken: on, on })
		} else if (name === 'elsif') {
			const f = stack.at(-1)
			assert.ok(f, 'if の無い elsif')
			const on = f.parentOn && !f.taken && evalCond(cond)
			f.on = on
			f.taken ||= on
		} else if (name === 'else') {
			const f = stack.at(-1)
			assert.ok(f, 'if の無い else')
			f.on = f.parentOn && !f.taken
			f.taken = true
		} else if (name === 'endif') {
			assert.ok(stack.pop(), 'if の無い endif')
		} else throw new Error(`部品が描画器の知らないタグを使っている: ${m[2]}`)
	}
	assert.equal(stack.length, 0, 'if が閉じていない')
	let tail = src.slice(last)
	if (trimNext) tail = tail.replace(/^\s+/, '')
	return out + tail
}

const INCLUDE_RE = /\{%-?\s*include\s+legal-distribution\.html\s+part="([a-z0-9-]+)"\s*-?%\}/g

/** ページの部品の呼び出しを、store の値で描いた中身に置き換える (Liquid の他のタグはそのまま) */
function renderPage(rel, store) {
	const part = read(PART_FILE)
	return stripComments(read(rel).replace(INCLUDE_RE, (_, name) => renderPart(part, { part: name, store })))
}

function section9(store) {
	const html = renderPage(PRIVACY, store)
	const start = html.indexOf('9.入手経路の記録について')
	const end = html.indexOf('10.無料枠の管理', start)
	assert.ok(start >= 0 && end > start, '§9 が見つからない')
	return textOf(html.slice(start, end))
}

/** クッキーポリシーの「ブラウザのローカルストレージ」の節の素の文字列 */
function cookieStorage(store) {
	const html = renderPage(COOKIE, store)
	const start = html.indexOf('ブラウザのローカルストレージ</h2>')
	const end = html.indexOf('<h2', start)
	assert.ok(start >= 0 && end > start, 'ローカルストレージの節が見つからない')
	return { raw: html.slice(start, end), text: textOf(html.slice(start, end)) }
}

/** §9 の小見出しの番号 (「9-n 」で始まる段落) を出現順に */
const subNumbers = (s9) => [...s9.matchAll(/(?:^| )(9-\d) (?:サイト配布版|配信ストア版|利用目的|記録を希望)/g)].map((m) => m[1])

// ---- 0. 描画器と部品の作り ----

test('描画器: if / elsif / else / 入れ子 / 空白の削りを Liquid と同じに描き、知らないタグ・条件は例外にする', () => {
	const src = '{%- comment -%}x{%- endcomment -%}{%- if include.part == "a" -%} A {%- if site.data.site.distribution.store_enabled %}S{% else %}N{% endif -%}{%- elsif include.part == "b" -%}B{%- else -%}Z{%- endif -%}'
	assert.equal(renderPart(src, { part: 'a', store: true }), 'AS')
	assert.equal(renderPart(src, { part: 'a', store: false }), 'AN')
	assert.equal(renderPart(src, { part: 'b', store: true }), 'B')
	assert.equal(renderPart(src, { part: 'c', store: false }), 'Z')
	assert.throws(() => renderPart('{% if page.lang == "ja" %}x{% endif %}', { part: 'a', store: false }), /条件/)
	assert.throws(() => renderPart('{% assign x = 1 %}', { part: 'a', store: false }), /タグ/)
	assert.throws(() => renderPart('{% unless site.data.site.distribution.store_enabled %}x{% endunless %}', { part: 'a', store: false }), /タグ/)
})

test('切り替えを読むのは部品だけ: privacy / cookie は store_enabled を直接読まず、部品を決まった数だけ呼ぶ', () => {
	assert.match(read(PART_FILE), /site\.data\.site\.distribution\.store_enabled/)
	for (const rel of [PRIVACY, COOKIE]) {
		assert.doesNotMatch(stripComments(read(rel)), /store_enabled/, `${rel} が切り替えを直接読んでいる`)
	}
	const parts = (rel) => [...stripComments(read(rel)).matchAll(INCLUDE_RE)].map((m) => m[1])
	assert.deepEqual(parts(PRIVACY), ['privacy-9-lead', 'privacy-9-after-site'])
	assert.deepEqual(parts(COOKIE), ['cookie-store'])
	// 部品はどの part でも描ける (知らないタグ・条件を使っていない)
	for (const part of ['privacy-9-lead', 'privacy-9-after-site', 'cookie-store']) {
		for (const store of [false, true]) assert.doesNotThrow(() => renderPart(read(PART_FILE), { part, store }))
	}
})

// ---- 1. §9 の見出し ----

test('§9 の見出しは「入手経路の記録」で、旧見出し「ダウンロード経路の記録」は残さない', () => {
	const html = stripComments(read(PRIVACY))
	assert.match(html, /<h2[^>]*>9\.入手経路の記録について<\/h2>/)
	assert.ok(!html.includes('9.ダウンロード経路の記録について'))
})

// ---- 2. 両方に共通の 9-1 (サイト配布版) ----

for (const store of [false, true]) {
	test(`9-1 (store_enabled: ${store}): サイト配布版の記録項目・ファイル名の識別子・識別子が無いときの送信・サインインの突き合わせとご案内`, () => {
		const s9 = section9(store)
		assert.match(s9, /9-1 サイト配布版について 当社は、当社の配信元からサイト配布版をダウンロードした際に、どのような経路でお知りいただいたかを把握する目的で、次の情報を記録します。/)
		for (const item of [
			'参照元のURL（本サイトへ遷移する直前のページ）',
			'キャンペーンパラメータ（utm_source、utm_medium、utm_campaign）',
			'当社ウェブサイトに最初に到達した際の参照元、キャンペーンパラメータ（utm_source）及び最初に表示したページのパス',
			'国コード（IPアドレスそのものは保存しません）',
			'ご利用のブラウザ・OSの情報（User-Agent）',
			'ダウンロード日時および配布したアプリケーションのバージョン',
		]) {
			assert.ok(s9.includes(item), `${item} が無い`)
		}
		assert.match(s9, /当該識別子はインストーラーのファイル名に含まれ、インストール時にお使いの端末に保存され、本ソフトウェアの初回起動時に当社サーバーへ送信されます。/)
		assert.match(s9, /なお、インストーラーのファイル名に識別子が含まれていない場合も、本ソフトウェアの初回起動時に、識別子が無かった旨を、アプリケーションのバージョン及び本サービス上のアカウントまたは端末ごとの識別子とあわせて当社サーバーへ送信します。/)
		assert.match(s9, /ブラウザで本サービスにサインインした状態でサイト配布版をダウンロードした場合、そのアカウントの識別子をダウンロードの記録にあわせて保存し、本ソフトウェアの初回起動時の記録と突き合わせます。/)
		assert.match(s9, /当社は、この突き合わせの結果を、本ソフトウェアの初回起動時に、ブラウザでご利用のアカウントでのサインインをご案内するためにも用います。/)
	})
}

// ---- 3. false (既定) の出力: いま配っているのはサイト配布版だけ ----

test('false: 冒頭はサイト配布版だけを定義し、配信ストア (版) の記述が §9 のどこにも出ない', () => {
	const s9 = section9(false)
	assert.match(s9, /^9\.入手経路の記録について 当社は、本ソフトウェアを、当社の配信元から配布するインストーラー形式のもの（以下「サイト配布版」といいます。）として配布しています。本項では、その入手経路について当社が記録する情報を定めます。/)
	assert.doesNotMatch(s9, /配信ストア|2つの方法/)
	assert.doesNotMatch(s9, /サイト配布版に限って/, '比べる相手 (配信ストア版) が無いので「限って」の文は出さない')
	assert.deepEqual(subNumbers(s9), ['9-1', '9-2', '9-3'])
})

test('false: 9-2 利用目的 (サインインのご案内を含む)・第三者提供なし・配布の種類 (サイト配布版であること) を動作記録とエラー診断に含める', () => {
	const s9 = section9(false)
	assert.match(s9, /9-2 利用目的及び第三者提供について 9-1に定める情報は、どの経路からのご利用が多いかを把握し、本サービスの改善および広報活動の最適化に用いるもの（同項に定めるサインインのご案内を含みます。）であり、それ以外の目的では利用しません。第三者への提供は行いません。/)
	assert.match(s9, /なお、配布の種類（サイト配布版であること）は、不具合の調査のため、12項に定める動作記録及び13項に定めるエラー診断レポートに含めます。/)
})

test('false: 9-3 は配信ストア版の公開前の文 (識別子を含まないインストーラーの案内・開示等の請求の窓口)', () => {
	const s9 = section9(false)
	assert.match(s9, /9-3 記録を希望されない場合 サイト配布版について9-1の記録を希望されない場合は、9-1の識別子を含まないインストーラーを別途ご案内いたしますので、下記の問い合わせ窓口までご連絡ください。また、記録済みの情報の開示・訂正・利用停止・消去のご請求については、6項および7項に定めるところに従い、同窓口にて承ります。/)
	assert.doesNotMatch(s9, /ご利用ください/)
})

// ---- 4. true の出力: 2 つの配布方法 ----

test('true: 冒頭で 2 つの配布方法と用語 (サイト配布版・配信ストア・配信ストア版) を定義し、9-1〜9-4 の並び', () => {
	const s9 = section9(true)
	assert.match(s9, /^9\.入手経路の記録について 当社は、本ソフトウェアを、当社の配信元から配布するインストーラー形式のもの（以下「サイト配布版」といいます。）と、外部のアプリケーション配信サービス（以下「配信ストア」といいます。）を通じて配布するもの（以下「配信ストア版」といいます。）の2つの方法で配布しています。本項では、それぞれの入手経路について当社が記録する情報を定めます。/)
	assert.match(s9, /本項に定めるダウンロードごとの識別子の発行と、ブラウザでサインインした状態でのダウンロードの突き合わせは、サイト配布版に限って行うものです。/)
	assert.deepEqual(subNumbers(s9), ['9-1', '9-2', '9-3', '9-4'])
})

test('true: 9-2 配信ストア版は配布の種類を版・識別子と記録し、流入元は記録せず配信ストアへも引き渡さない', () => {
	const s9 = section9(true)
	assert.match(s9, /9-2 配信ストア版について 当社は、本ソフトウェアがどのような経路で入手されたかを把握する目的で、配信ストア版の初回起動時に、配布の種類（配信ストアから入手したものであること）を、アプリケーションのバージョン及び本サービス上のアカウントまたは端末ごとの識別子とあわせて当社サーバーに記録します。/)
	assert.match(s9, /配信ストア版については、ダウンロードごとの識別子を用いず、どのような経路でお知りいただいたか（参照元のURL、キャンペーンパラメータ等）の情報を当社サーバーに記録しません。/)
	assert.match(s9, /当社ウェブサイトの閲覧状況及び当社ウェブサイトから配信ストアへのリンクのご利用状況は、8項に定める Google Analytics により統計的に把握します。/)
	assert.match(s9, /当社は、当社ウェブサイトまたはブラウザでご利用いただく本サービスから配信ストアへ移動する際に、参照元のURL、キャンペーンパラメータ等の流入元の情報を配信ストアへ引き渡しません。/)
})

test('true: 9-3 利用目的は 9-1 及び 9-2、配布の種類はいずれの配布方法でも含める。9-4 は公開後の文', () => {
	const s9 = section9(true)
	assert.match(s9, /9-3 利用目的及び第三者提供について 9-1及び9-2に定める情報は、どの経路からのご利用が多いかを把握し、本サービスの改善および広報活動の最適化に用いるもの（9-1に定めるサインインのご案内を含みます。）であり、それ以外の目的では利用しません。第三者への提供は行いません。/)
	assert.match(s9, /なお、配布の種類（サイト配布版であるか配信ストア版であるか）は、不具合の調査のため、いずれの配布方法でも、12項に定める動作記録及び13項に定めるエラー診断レポートに含めます。/)
	assert.match(s9, /9-4 記録を希望されない場合 サイト配布版について9-1の記録を希望されない場合は、配信ストア版をご利用ください。サイト配布版をご希望の場合は、9-1の識別子を含まないインストーラーを別途ご案内いたしますので、下記の問い合わせ窓口までご連絡ください。また、記録済みの情報の開示・訂正・利用停止・消去のご請求については、6項および7項に定めるところに従い、同窓口にて承ります。/)
})

// ---- 5. 両方に共通の禁止 ----

for (const store of [false, true]) {
	test(`§9 (store_enabled: ${store}): 企業名・配信サービス名・旧い前提 (インストーラー版 / 2.11.1)・文案の注記・削除の約束を書かない`, () => {
		const s9 = section9(store)
		assert.doesNotMatch(s9, /Microsoft|マイクロソフト|Store|ストア（/)
		assert.doesNotMatch(s9, /インストーラー版|2\.11\.1|ログイン/)
		assert.doesNotMatch(s9, /〔|〕/, '文案の注記の括弧が本文に入っている')
		assert.doesNotMatch(s9, /削除します/)
	})
}

// ---- 6. クッキーポリシー ----

test('cookie (false): ローカルストレージの記録はサイト配布版のダウンロードの経路の把握に使い (9-1)、配信ストアの文は出さない', () => {
	const { text } = cookieStorage(false)
	assert.match(text, /この記録は、当社ウェブサイトからインストーラー形式の当社のソフトウェア（サイト配布版）をダウンロードされた際に、どの経路からのご利用かを把握するために使用します（プライバシーポリシー 9-1）。/)
	assert.doesNotMatch(text, /配信ストア|バージョン 2\.11\.1|9-3/)
})

test('cookie (true): 配信ストアへ引き渡さず当社サーバーにも送信しない旨を、9-1 の文の直後に空白を挟まず続ける', () => {
	const { raw, text } = cookieStorage(true)
	assert.match(text, /（プライバシーポリシー 9-1）。外部のアプリケーション配信サービス（配信ストア）から当社のソフトウェアを入手される場合は、当社ウェブサイトから配信ストアへ移動する際にこの記録を配信ストアへ引き渡さず、当社サーバーにも送信しません（同 9-2）。/)
	assert.match(raw, /9-1）。外部の/, '部品の出力の前に空白や改行が入っている')
})

for (const store of [false, true]) {
	test(`cookie (store_enabled: ${store}): 保存する内容に最初に表示したページのパスを含め、個人を識別できる情報は含まない`, () => {
		const { text } = cookieStorage(store)
		assert.match(text, /保存する内容は、参照元サイトのドメインとキャンペーン識別子、及び最初に到達した際の記録については最初に表示したページのパス（URLのクエリ等を除いた部分）のみで、検索キーワード・閲覧ページの内容・お客様を個人として識別できる情報は一切含みません。/)
		assert.doesNotMatch(text, /キャンペーン識別子のみ/)
		assert.doesNotMatch(text, /Microsoft|マイクロソフト|Store/)
	})
}

// ---- 7. 日付と版 ----

test('最終更新日は 2026-11-13 (privacy / cookie)、版 (legal.yml) は privacy / cookie の改定では動かさない', () => {
	assert.match(read(PRIVACY), /最終更新日: 2026-11-13（制定: 2019-06-01）/)
	assert.match(read(COOKIE), /最終更新日: 2026-11-13/)
	assert.match(read('_data/legal.yml'), /version:\s*"2026-11-08"/)
})
