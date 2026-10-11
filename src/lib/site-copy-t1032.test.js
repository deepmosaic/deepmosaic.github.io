// T-1032 (2026-10-12) 会社住所の単一真実源 `_data/company.yml` と、それを参照する 4 面を固定する回帰テスト。
//
//   node --test src/lib/site-copy-t1032.test.js
//
//   - 住所は公開する (TICKET-SITE-19 / TICKET-SITE-21 / T-933 / T-943 の「住所を印字しない」を住所について撤回)。
//     電話番号は引き続き「ご請求があれば開示」(site-copy-t943.test.js が検査する)。
//   - 住所の値は `_data/company.yml` に 1 つだけ置き、特商法 (`company/asct.html`)・会社概要 (`company/about.html`)・
//     プライバシーの問い合わせ窓口 (`company/privacy.html`)・JSON-LD (`_includes/schema/organization.html`) の
//     4 面は Liquid で参照する。ページや他のデータに住所を直書きしていないことも検査する (食い違い防止)。
//
// 読み取りはこのファイル内で完結させる (`site-copy-t943.test.js` と同じ流儀。共有モジュールにしない)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

/** Liquid の `{% comment %}` と HTML コメントを落とす (表示されない文字列は検査対象外)。 */
function stripComments(source) {
	return source
		.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
}

/** タグを落とし、空白を 1 つに潰した素の文字列。 */
const textOf = (html) => stripComments(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

/** `<th>見出し</th>` に続く `<td>` の中身。見つからなければ null。 */
function rowValue(html, heading) {
	const m = stripComments(html).match(
		new RegExp(`<th[^>]*>\\s*${heading}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`),
	)
	return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null
}

/** `<td>見出し</td>` に続く 2 列目の `<td>` の中身 (about.html は th ではなく td-td の表)。見つからなければ null。 */
function cellAfter(html, label) {
	const m = stripComments(html).match(
		new RegExp(`<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`),
	)
	return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null
}

/**
 * `key: "value"` の 1 階層だけを読む極小パーサ。空行と `#` コメント行は飛ばす。
 * それ以外の形 (引用符なし・ブロックスカラー・インデント・値なし) は黙って読み飛ばさず throw する
 * (plans-yml.js と同じ割り切り)。
 */
function parseFlatYaml(text) {
	const out = {}
	text.split(/\r?\n/).forEach((line, i) => {
		if (line.trim() === '' || /^\s*#/.test(line)) return
		const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*): "((?:[^"\\]|\\.)*)"\s*$/)
		if (!m) throw new Error(`company.yml の ${i + 1} 行目が "key: \\"value\\"" の形ではない: ${line}`)
		out[m[1]] = m[2]
	})
	return out
}

/** dir 配下 (再帰) の拡張子 ext のファイル (ROOT 相対パス)。 */
function listFiles(dir, ext) {
	return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
		const rel = `${dir}/${e.name}`
		if (e.isDirectory()) return listFiles(rel, ext)
		return e.name.endsWith(ext) ? [rel] : []
	})
}

const company = () => parseFlatYaml(read('_data/company.yml'))

/** 住所を Liquid で参照していること (前に「〒」がある)。 */
function assertAddressRef(value, where) {
	assert.ok(value, `${where} の所在地が無い`)
	assert.match(
		value,
		/〒\s*\{\{\s*site\.data\.company\.postal_code\s*\}\}\s*\{\{\s*site\.data\.company\.address\s*\}\}/,
		`${where} が company.yml を参照していない: ${value}`,
	)
}

test('ヘルパー: rowValue / cellAfter は無い見出しなら null を返し、ある見出しなら値を返す', () => {
	assert.equal(rowValue('<th>A</th><td>x</td>', 'B'), null)
	assert.equal(rowValue('<th>A</th><td>x</td>', 'A'), 'x')
	assert.equal(cellAfter('<td>A</td><td>x</td>', 'B'), null)
	assert.equal(cellAfter('<td>A</td>\n  <td class="c">x</td>', 'A'), 'x')
})

test('ヘルパー: parseFlatYaml は key: "value" だけを読み、それ以外の形は throw する', () => {
	assert.deepEqual(parseFlatYaml('# c\n\na: "b"\n'), { a: 'b' })
	for (const bad of ['a: b', 'a: |', '  a: "b"', 'a:']) {
		assert.throws(() => parseFlatYaml(bad), undefined, `throw しない: ${bad}`)
	}
})

test('company.yml: 住所・社名・代表者の値', () => {
	// Act
	const c = company()

	// Assert
	assert.equal(c.postal_code, '141-0021')
	assert.equal(c.address, '東京都品川区上大崎3丁目14番34号プラスワン402')
	assert.equal(c.address, c.address_region + c.address_locality + c.street_address)
	assert.equal(c.representative, '高田茂臣')
	assert.equal(c.name, 'Deepmosaic合同会社')
	assert.equal(c.phone, undefined, '電話番号は company.yml に持たない')
})

test('特商法・会社概要・プライバシー窓口の所在地は company.yml を参照する', () => {
	// Act
	const asct = rowValue(read('company/asct.html'), '所在地')
	const about = cellAfter(read('company/about.html'), '所在地')
	const privacy = stripComments(read('company/privacy.html')).match(/<li>\s*所在地:\s*([\s\S]*?)<\/li>/)

	// Assert
	assertAddressRef(asct, 'company/asct.html')
	assertAddressRef(about, 'company/about.html')
	assert.ok(privacy, 'company/privacy.html の窓口に所在地が無い')
	assertAddressRef(privacy[1], 'company/privacy.html')
})

test('JSON-LD: Organization は company.yml の住所を PostalAddress で出す', () => {
	// Act
	const body = stripComments(read('_includes/schema/organization.html'))

	// Assert
	assert.match(body, /"@type": "PostalAddress"/)
	assert.match(body, /site\.data\.company\.postal_code\s*\|\s*jsonify/)
	assert.match(body, /site\.data\.company\.street_address\s*\|\s*jsonify/)
	assert.match(body, /"addressCountry": "JP"/)
})

test('住所はページ・include・他のデータ・llms に直書きしない (company.yml だけが持つ)', () => {
	// Arrange
	const targets = [
		...listFiles('company', '.html'),
		...listFiles('_includes', '.html'),
		...listFiles('_data', '.yml').filter((p) => p !== '_data/company.yml'),
		'llms.txt',
		'llms-full.txt',
	]

	// Act
	const hits = targets.filter((rel) => /上大崎|141-0021/.test(stripComments(read(rel))))

	// Assert
	assert.ok(targets.length > 10, `検査対象が少なすぎる: ${targets.length}`)
	assert.deepEqual(hits, [])
	// 陽性対照: 正の側には両方がある
	const yml = read('_data/company.yml')
	assert.match(yml, /上大崎/)
	assert.match(yml, /141-0021/)
})

test('特商法: 旧「所在地・電話番号」の合併行は残っていない (所在地と電話番号は別の行)', () => {
	assert.doesNotMatch(textOf(read('company/asct.html')), /所在地・電話番号/)
})
