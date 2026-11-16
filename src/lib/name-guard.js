// 公開ページに出さない名前の検査の部品 (node テスト用。ブラウザには読み込まない)。
//
// 出さない名前の一覧は、ソースに名前そのものを書かず、sha256 の先頭 16 桁で持つ。
// 検査は本文の部分文字列のハッシュを一覧と突き合わせ、当たった本文の文字列を返す。
//
//   - words : 英数字の連なりの先頭から始まり、後ろが英数字でない語 (正規表現の (?<![A-Za-z0-9])語(?![A-Za-z0-9]) と同じ)
//   - starts: 英数字の連なりの先頭から始まる語 (後ろは問わない。\b語と同じ)
//   - parts : 部分文字列 (後ろも前も問わない)。既定では空白を含まない ASCII の連なりの中を見る
//   - ignoreCase: 本文を小文字にそろえて比べる (一覧は小文字の値のハッシュで持つ)
//
// 一覧を足すときは nameHash('<名前>') の値を足す。

import { createHash } from 'node:crypto'

/** 名前のハッシュ (sha256 の先頭 16 桁)。 */
export const nameHash = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)

/** words / starts で見る語の長さの上限 (文字数)。 */
const MAX_LEN = 32
const ALNUM = /[A-Za-z0-9]/

/**
 * 本文の中で規則に当たった文字列 (本文のまま) を、出てきた順に重ねずに返す。無ければ空の配列。
 * @param {string} text
 * @param {{ words?: string[], starts?: string[], parts?: string[], ignoreCase?: boolean, lengths?: number[], ascii?: boolean }} rule
 * @returns {string[]}
 */
export function findNames(text, rule) {
	const t = rule.ignoreCase ? text.toLowerCase() : text
	const words = new Set(rule.words ?? [])
	const starts = new Set(rule.starts ?? [])
	const parts = new Set(rule.parts ?? [])
	const hits = new Set()

	if (words.size || starts.size) {
		for (const m of t.matchAll(/[A-Za-z0-9]+/g)) {
			const i = m.index
			for (let len = 1; len <= MAX_LEN && i + len <= t.length; len++) {
				const h = nameHash(t.slice(i, i + len))
				if (starts.has(h)) hits.add(text.slice(i, i + len))
				if (words.has(h) && !ALNUM.test(t[i + len] ?? '')) hits.add(text.slice(i, i + len))
			}
		}
	}

	if (parts.size) {
		const lengths = rule.lengths ?? Array.from({ length: MAX_LEN - 1 }, (_, k) => k + 2)
		const runs = rule.ascii === false ? [{ 0: t, index: 0 }] : t.matchAll(/[\x21-\x7e]+/g)
		for (const m of runs) {
			const run = m[0]
			for (const len of lengths) {
				for (let i = 0; i + len <= run.length; i++) {
					if (parts.has(nameHash(run.slice(i, i + len)))) hits.add(text.slice(m.index + i, m.index + i + len))
				}
			}
		}
	}
	return [...hits]
}

/** 製品の docs に書かない技術名・部品名・他社の製品名 (英数字に挟まれていないときだけ当たる)。 */
export const TECH_NAMES = Object.freeze({
	words: ['d9aa89fdd15ad5c4', '5ece526b2e72c2e5', '039af0d3ec45ea58', '8eeceae1fd9f7aad', 'd19b2ae00a5691e5', '5bcae7b30ba71e06', 'dcc9be2679d9e1a4', 'ab78d989ee72589c', 'c4d058eb49698a3f', '297a7a1fd8e237a8', '984965b2b1909800', '4002db391171d35f', '1b166e2a7fb0fd86', '4bec5a51a3d35e53', '336154bf67f765f8', '01aef669208c8a9c', '6763d40714d58386', 'f0fdc5831b885e96', '6862fa01d6f0bc4c', 'a16a695ef6f7b739', 'd1c72f226cafdcc4', 'e6910bd404b0f318', 'ae59881901283088', '30a1b6c40b7cb854', '6a90da527efd9938', 'd4389744f9ff9f99', 'f2164b12c4391939', '306552499b8ead05', '5fe08838de86ca0d', 'af8c51f3193d187c', '2aa25afbb0678958', '16b35e94be9a7980', 'aaf7bfa89603addc', '1281d47940eac2b3', 'f7acc24c4bf5445a', '5a1aed53eef4e6f5', 'e3fd232721785e52', 'be831db56b1ebbb7', '99f26510712ec61b', 'cea42d914233a4c0', 'f223faa96f229162', '70eb489c966bfbe6', 'b8f4e54cebf8bfba', '26cfd0a87801785f', 'ca4fd9296c6521b6'],
})

/** 法務のページに書かない外部のサービスの名前 (部分文字列で当たる)。 */
export const SERVICE_NAMES = Object.freeze({
	parts: ['fe7ceb7816ed0e35', 'f9191531404c4016', '2e5576f58d325a4a', '961a6062ba1ba2d8', '5ece526b2e72c2e5', 'f911e414cf6bdfc5', '16e18c23bebe2425'],
})

/** 動作記録・エラー診断の説明に書かない保存先・サービスの名前。 */
export const LOG_SERVICE_NAMES = Object.freeze({
	words: ['d653b016db1da8f5'],
	parts: ['5ece526b2e72c2e5', 'f9191531404c4016', 'fe7ceb7816ed0e35'],
})

/** 端末の記録の説明に書かない保存の仕組みの名前 (大文字と小文字を区別しない)。 */
export const STORE_NAMES = Object.freeze({
	parts: ['4d7594e57f7d03f3', '9c22a8bd957378ed', '28a69e91d724eeec', '6ed542ad4783f0b1', '5d5b09f6dcb2d53a', 'e30d23049c0ea9ff'],
	ignoreCase: true,
})

/** モザイクの精緻化のモデルの名前 (大文字と小文字を区別しない語)。 */
export const MODEL_NAMES = Object.freeze({
	words: ['e96e02d8e47f2a7c'],
	starts: ['a33beaec9c1f9ec6', 'f89cbb1d56ccedd9', '769406d282e1a122'],
	ignoreCase: true,
})

/** モデルの名前の略号 (大文字の部分文字列)。 */
export const MODEL_ABBR = Object.freeze({ parts: ['be831db56b1ebbb7'] })

/** 使用許諾契約書に書かない部品の呼び方。 */
export const PART_NAMES = Object.freeze({ parts: ['fc52bb8897af4264'], lengths: [5], ascii: false })

/**
 * アセットのパスの中で、区切り (先頭・/・_・-) の後に始まり、数字・_・.・- が続く英字の語のうち、
 * モデルの名前に当たるもの (例: `<名前>_1.webp`・`<名前>2-…`)。無ければ空の配列。
 * @param {string} path
 */
export function assetModelHits(path) {
	const out = []
	for (const m of path.matchAll(/(?:^|[/_-])([a-z]+)(?=[\d_.-])/gi)) {
		if (MODEL_NAMES.words.includes(nameHash(m[1].toLowerCase()))) out.push(m[1])
	}
	return out
}
