// 組織への参加のページの言語の切り替え・en の FAQ の言い回し・Tailwind の検出の対象の仕様テスト。
//
//   node --test src/lib/i18n-site-join-switch.test.js
//
//   - /join/ の言語の切り替えで組織コード (フラグメント) を引き継ぐ純関数 `carryJoinHash` (src/lib/join-switch.js)
//     と、main.js がそれを言語の切り替えのリンクに使っていること
//   - en の FAQ の 2 つの言い回し (mosaic must be applied・"DeepMosaics", の引用符とカンマ)
//   - Tailwind の自動検出を切って app.css に書いたファイルだけを走査し (テストと scripts/ は走査しない)、語 table・shrink を class として拾わない
//     (`@source not inline(…)`。en の本文が .shrink を生む)
//   - ビルド用の道具 (scripts/) を公開物から外す (_config.yml の exclude)
//   - `_site` は読まない (CI では npm test がビルドの前に走る)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { carryJoinHash, JOIN_PATHS } from './join-switch.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

// ---------------------------------------------------------------- 1. carryJoinHash

test('carryJoinHash: join の 3 版へのリンクに、検証に通った #code= を付け直す (大文字・空白除去の正規化後の値)', () => {
	assert.deepEqual([...JOIN_PATHS].sort(), ['/en/join/', '/join/', '/zh-tw/join/'])
	assert.equal(carryJoinHash('/en/join/', '#code=ABCD-EFGH-JKLM'), '/en/join/#code=ABCD-EFGH-JKLM')
	assert.equal(carryJoinHash('/zh-tw/join/', '#code=abcd-efgh-jklm'), '/zh-tw/join/#code=ABCD-EFGH-JKLM')
	assert.equal(carryJoinHash('/join/', 'code=%20ABCD-EFGH-JKLM%20'), '/join/#code=ABCD-EFGH-JKLM')
})

test('carryJoinHash: #admin は #admin のまま付ける', () => {
	assert.equal(carryJoinHash('/en/join/', '#admin'), '/en/join/#admin')
	assert.equal(carryJoinHash('/zh-tw/join/', '#ADMIN'), '/zh-tw/join/#admin')
})

test('carryJoinHash: 検証に通らないフラグメントは付けない (前に付けたフラグメントも外す)', () => {
	for (const bad of ['', '#', '#code=', '#code=ABCD', '#code=ABCD-EFGH-JKLM&x=1', '#code=<script>', '#code=%E0%A4', `#code=${'A'.repeat(80)}`, '#other']) {
		assert.equal(carryJoinHash('/en/join/', bad), '/en/join/', JSON.stringify(bad))
		assert.equal(carryJoinHash('/en/join/#code=ABCD-EFGH-JKLM', bad), '/en/join/', `付け直し ${JSON.stringify(bad)}`)
	}
	assert.equal(carryJoinHash('/en/join/', undefined), '/en/join/')
	assert.equal(carryJoinHash('/en/join/', null), '/en/join/')
})

test('carryJoinHash: join 以外の行き先・サイトの外・形の違う値はそのまま返す (コードを外へ渡さない)', () => {
	const hash = '#code=ABCD-EFGH-JKLM'
	for (const href of ['/', '/en/', '/zh-tw/price/', '/en/joinx/', '/en/join', 'https://evil.example/en/join/', '//evil.example/en/join/', 'deepmosaic://join', 'javascript:alert(1)', '/en/join/?x=1']) {
		assert.equal(carryJoinHash(href, hash), href, href)
	}
	assert.equal(carryJoinHash(undefined, hash), undefined)
	assert.equal(carryJoinHash(42, hash), 42)
})

test('main.js: join のページだけ、言語の切り替えのリンクに carryJoinHash を使う (innerHTML を使わない)', () => {
	const src = read('src/main.js')
	assert.match(src, /import \{[^}]*carryJoinHash[^}]*\} from '\.\/lib\/join-switch\.js'/)
	// 切り替え (ヘッダー・フッター・ドロワー = [data-i18n-switch]) の a[hreflang] だけ
	assert.ok(src.includes("const LANG_LINKS = '[data-i18n-switch] a[hreflang]';"), 'リンクの選び方')
	assert.ok(!src.includes('.lang-suggest'), '言語の案内の帯のリンクを選ばない')
	// 読み込み時・hashchange・クリックの直前 (後から描かれるドロワー) に付け直す
	const fn = src.slice(src.indexOf('function initJoinPage'), src.indexOf('// 英中の 404 への振り分け'))
	assert.match(fn, /syncJoinSwitchLinks\(\)/)
	assert.match(fn, /addEventListener\('click', [^)]*, true\)/)
	assert.match(fn, /addEventListener\('auxclick', [^)]*, true\)/)
	assert.ok(!/innerHTML/.test(fn), 'innerHTML を使わない')
	assert.ok(!/console\.|gtag|fetch\(|sendBeacon/.test(fn), 'コードをログ・計測・通信に出さない')
})

test('join-switch.js: DOM・通信・保存に触らない純関数で、検証は join-hash.js の parseJoinHash を通す', () => {
	const src = read('src/lib/join-switch.js')
	assert.match(src, /import \{[^}]*parseJoinHash[^}]*\} from '\.\/join-hash\.js'/)
	assert.ok(!/document|window|localStorage|sessionStorage|fetch\(|console\./.test(src.replace(/^\s*(\/\/|\*).*$/gm, '')))
})

// ---------------------------------------------------------------- 2. en の FAQ の言い回し

test('en の FAQ: 1 件目は mosaic must be applied、DeepMosaics の引用符の後にカンマ (entity.yml と同じ)', () => {
	const faq = read('_data/l10n/en/faq.yml')
	assert.ok(faq.includes('in video production where mosaic must be applied.'))
	assert.ok(!faq.includes('mosaic processing'))
	assert.ok(faq.includes('\\"DeepMosaics\\", which is published as open source,'))
	assert.ok(!faq.includes('DeepMosaics,\\"'))
	assert.ok(read('_data/l10n/en/entity.yml').includes('\\"DeepMosaics\\", which'), '揃える先 (entity.yml)')
})

// ---------------------------------------------------------------- 3. Tailwind の自動検出と公開物

// Tailwind は app.css に書いたファイルだけを走査する (自動検出を切る)。テスト・e2e の道具・テキストのファイルの語を class の候補にしない。
test('app.css: Tailwind の自動検出を切り、テスト・scripts/ を走査せず、語 table・shrink を class として拾わない', () => {
	const lines = read('src/app.css').split('\n')
	for (const line of [
		'@import "tailwindcss" source(none);',
		'@source not "./lib/*.test.js";',
		'@source not "./lib/i18n-overflow.js";',
		'@source not "../_site";',
		'@source not "../scripts";',
		'@source not inline("table");',
		'@source not inline("shrink");',
	]) {
		assert.ok(lines.includes(line), line)
	}
})

test('_config.yml: exclude に scripts (ビルド用の道具。scripts/i18n を含む) がある', () => {
	const cfg = read('_config.yml')
	const ex = cfg.split(/^exclude:\s*$/m)[1].split(/^\S/m)[0]
	assert.match(ex, /^\s*-\s*scripts\s*(#.*)?$/m)
})
