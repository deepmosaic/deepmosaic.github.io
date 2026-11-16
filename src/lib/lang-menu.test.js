// ヘッダーの言語の一覧 (LangMenu.svelte) の動きの判定 (lang-menu.js) の仕様テスト。
//
//   node --test src/lib/lang-menu.test.js
//
//   - initialIndex: 開いたときに最初にフォーカスする項目 (今の言語、無ければ先頭、空なら -1)
//   - nextIndex: 一覧の中の矢印・Home・End (端で回る、扱わないキーは null)
//   - triggerKeyAction: ボタンの上のキー (ArrowDown / Enter / Space = 今の言語で開く、ArrowUp = 末尾で開く)
//   - isInside: root.contains の薄い包み (null・undefined は false で投げない)

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { LANG_MENU_KEYS, initialIndex, nextIndex, triggerKeyAction, isInside } from './lang-menu.js'

test('initialIndex: 今の言語の添字、無ければ 0、空なら -1', () => {
	assert.equal(initialIndex([false, true, false]), 1)
	assert.equal(initialIndex([false, false, true]), 2)
	assert.equal(initialIndex([true, false, false]), 0)
	assert.equal(initialIndex([false, false, false]), 0)
	assert.equal(initialIndex([]), -1)
})

test('nextIndex: ArrowDown / ArrowUp は端で回る', () => {
	assert.equal(nextIndex(0, 'ArrowDown', 3), 1)
	assert.equal(nextIndex(1, 'ArrowDown', 3), 2)
	assert.equal(nextIndex(2, 'ArrowDown', 3), 0)
	assert.equal(nextIndex(0, 'ArrowUp', 3), 2)
	assert.equal(nextIndex(1, 'ArrowUp', 3), 0)
	assert.equal(nextIndex(2, 'ArrowUp', 3), 1)
})

test('nextIndex: Home は先頭、End は末尾', () => {
	assert.equal(nextIndex(1, 'Home', 3), 0)
	assert.equal(nextIndex(1, 'End', 3), 2)
	assert.equal(nextIndex(2, 'Home', 3), 0)
	assert.equal(nextIndex(0, 'End', 3), 2)
})

test('nextIndex: 扱わないキーは null', () => {
	for (const key of ['a', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight']) {
		assert.equal(nextIndex(0, key, 3), null, key)
	}
})

test('nextIndex: 長さが 0 以下なら null', () => {
	for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
		assert.equal(nextIndex(0, key, 0), null, key)
		assert.equal(nextIndex(0, key, -1), null, key)
	}
})

test('nextIndex: 範囲外の添字は ArrowDown で先頭、ArrowUp で末尾', () => {
	for (const index of [-1, 5, 3]) {
		assert.equal(nextIndex(index, 'ArrowDown', 3), 0, `ArrowDown from ${index}`)
		assert.equal(nextIndex(index, 'ArrowUp', 3), 2, `ArrowUp from ${index}`)
	}
})

test('nextIndex: 長さ 1 ではどのキーでも 0', () => {
	assert.equal(nextIndex(0, 'ArrowDown', 1), 0)
	assert.equal(nextIndex(0, 'ArrowUp', 1), 0)
	assert.equal(nextIndex(0, 'Home', 1), 0)
	assert.equal(nextIndex(0, 'End', 1), 0)
})

test('triggerKeyAction: ArrowDown / Enter / Space は今の言語で開く、ArrowUp は末尾で開く', () => {
	assert.equal(triggerKeyAction('ArrowDown'), 'open-current')
	assert.equal(triggerKeyAction('Enter'), 'open-current')
	assert.equal(triggerKeyAction(' '), 'open-current')
	assert.equal(triggerKeyAction('ArrowUp'), 'open-last')
})

test('triggerKeyAction: 扱わないキーは null', () => {
	for (const key of ['Escape', 'Tab', 'x', 'Home', 'End', '']) assert.equal(triggerKeyAction(key), null, key)
})

test('LANG_MENU_KEYS: 扱うキーの集合', () => {
	for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape']) {
		assert.ok(LANG_MENU_KEYS.has(key), key)
	}
	assert.equal(LANG_MENU_KEYS.has('Tab'), false, 'Tab は止めない')
	assert.equal(LANG_MENU_KEYS.has('a'), false)
})

test('isInside: root.contains の結果を返し、null・undefined は false', () => {
	const inner = { name: 'inner' }
	const root = { contains: (n) => n === inner }
	assert.equal(isInside(root, inner), true)
	assert.equal(isInside(root, { name: 'other' }), false)
	assert.equal(isInside(root, null), false)
	assert.equal(isInside(root, undefined), false)
	assert.equal(isInside(null, inner), false)
	assert.equal(isInside(undefined, inner), false)
})
