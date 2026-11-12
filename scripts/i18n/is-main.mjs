// T-2199 (i18n1112 I18N-701): CLI として直接起動されたかの判定。
//
// node は main モジュールの import.meta.url を実パス (realpath) から作るが、process.argv[1] は
// 起動時に渡したパスのまま。ジャンクションやシンボリックリンク越しに起動すると単純な比較が外れ、
// main() が呼ばれずに何も検査せず exit 0 で終わる。両方を realpath にしてから比べる。
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function real(p) {
	try {
		return realpathSync(p)
	} catch {
		return null
	}
}

/** `import.meta.url` を渡す。直接起動されたモジュールなら true。 */
export function isMain(metaUrl, argv1 = process.argv[1]) {
	if (!argv1) return false
	const a = real(argv1)
	const b = real(fileURLToPath(metaUrl))
	if (a === null || b === null) return false
	return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}
