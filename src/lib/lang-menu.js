// ヘッダーの言語の一覧 (src/islands/LangMenu.svelte) の動きの判定。DOM に触らない純関数だけを置く
// (node --test で検証する。src/lib/lang-menu.test.js)。
//
// 一覧の中身はリンク (a[hreflang]) なので、ARIA の型は menu ではなく開閉型 (disclosure)。
// 矢印・Home・End で項目を移り、Esc で閉じる。Tab は止めない (フォーカスが外へ出たら island が閉じる)。

/** island が扱うキー (ボタンの上と一覧の中の両方)。Tab は含めない。 */
export const LANG_MENU_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'])

/**
 * 開いたときに最初にフォーカスする項目の添字。
 * @param {boolean[]} currentFlags 各リンクが aria-current="true" か
 * @returns {number} 今の言語の添字、無ければ 0、空なら -1
 */
export function initialIndex(currentFlags) {
	if (currentFlags.length === 0) return -1
	const i = currentFlags.indexOf(true)
	return i === -1 ? 0 : i
}

/**
 * 一覧の中のキーに対する次の添字。ArrowDown / ArrowUp は端で回る。
 * @param {number} index 今の添字 (範囲外なら ArrowDown は先頭、ArrowUp は末尾へ)
 * @param {string} key KeyboardEvent.key
 * @param {number} length 項目の数
 * @returns {number | null} 扱わないキー・項目が無いときは null
 */
export function nextIndex(index, key, length) {
	if (length <= 0) return null
	const last = length - 1
	const inRange = Number.isInteger(index) && index >= 0 && index <= last
	switch (key) {
		case 'ArrowDown':
			return inRange && index < last ? index + 1 : 0
		case 'ArrowUp':
			return inRange && index > 0 ? index - 1 : last
		case 'Home':
			return 0
		case 'End':
			return last
		default:
			return null
	}
}

/**
 * ボタンの上のキーの扱い。Enter / Space はネイティブの click でも開閉するので、
 * island は keydown の側で preventDefault してから開く (二重に開閉しない)。
 * @param {string} key KeyboardEvent.key
 * @returns {'open-current' | 'open-last' | null}
 */
export function triggerKeyAction(key) {
	if (key === 'ArrowDown' || key === 'Enter' || key === ' ') return 'open-current'
	if (key === 'ArrowUp') return 'open-last'
	return null
}

/**
 * node が root の中にあるか (root.contains の薄い包み)。
 * @param {{ contains(node: unknown): boolean } | null | undefined} root
 * @param {unknown} node
 * @returns {boolean} root・node のどちらかが null / undefined なら false
 */
export function isInside(root, node) {
	if (root == null || node == null) return false
	return root.contains(node) === true
}
