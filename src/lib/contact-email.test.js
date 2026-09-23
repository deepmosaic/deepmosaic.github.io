// 公式サイトに載せる連絡先メールアドレスを support@ に固定する回帰テスト (T-508)。
//
//   node --test src/lib/contact-email.test.js
//
// 2026-09-23 に連絡先を contact@deepmosaic.co.jp から support@deepmosaic.co.jp へ一本化した
// (Stripe の請求書に載るサポートメールと同じ宛先)。サイトで連絡先を出している面は 3 つ:
//
//   - `company/asct.html`             特定商取引法に基づく表記の「メールアドレス」行
//   - `company/privacy.html`          プライバシーポリシーの「お問い合わせ窓口」
//   - `_includes/schema/organization.html`  JSON-LD (Organization.contactPoint.email)
//
// 宛先の正は `_data/inquiry.yml` の `support_email` (問い合わせフォームの mailto と
// 502 時の案内文が使う)。3 面がこれとずれると「フォームの案内と会社情報で宛先が違う」になる。
//
// 読み取りはこのファイル内で完結させる (`docs-team-quote.test.js` と同じ流儀)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 旧宛先。サイトの公開面に残してはいけない。 */
const RETIRED_EMAIL = 'contact@deepmosaic.co.jp'

/** 連絡先メールアドレスを出している公開面 (リポジトリ相対)。 */
const CONTACT_SURFACES = Object.freeze([
	'company/asct.html',
	'company/privacy.html',
	'_includes/schema/organization.html',
])

const read = (relPath) => readFileSync(join(ROOT, relPath), 'utf8')

/** `_data/inquiry.yml` の `support_email`。見つからなければ null。 */
function supportEmailOf(yaml) {
	const m = yaml.match(/^support_email:\s*"([^"]+)"\s*$/m)
	return m === null ? null : m[1]
}

test('supportEmailOf は support_email の行が無ければ null を返す (検査のすり抜けを防ぐ)', () => {
	// Arrange / Act
	const found = supportEmailOf('endpoint: "https://example.com/inquiry"\n')

	// Assert
	assert.equal(found, null)
})

test('_data/inquiry.yml の support_email は support@deepmosaic.co.jp', () => {
	// Arrange / Act
	const email = supportEmailOf(read('_data/inquiry.yml'))

	// Assert
	assert.equal(email, 'support@deepmosaic.co.jp')
})

for (const surface of CONTACT_SURFACES) {
	test(`${surface} は support_email と同じ宛先を載せている`, () => {
		// Arrange
		const email = supportEmailOf(read('_data/inquiry.yml'))
		assert.ok(email, '_data/inquiry.yml に support_email が無い')

		// Act
		const html = read(surface)

		// Assert
		assert.ok(html.includes(email), `${surface} に ${email} が無い`)
	})

	test(`${surface} に旧宛先 ${RETIRED_EMAIL} が残っていない`, () => {
		// Arrange / Act
		const html = read(surface)

		// Assert
		assert.ok(!html.includes(RETIRED_EMAIL), `${surface} に旧宛先が残っている`)
	})
}
