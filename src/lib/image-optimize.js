// scripts/optimize-images.mjs (PNG → WebP) のロジック (TICKET-SITE-13 / T-522)。
//
// 実行入口は scripts/optimize-images.mjs (ffmpeg の起動と表示だけを担当)。
// `node --test src/lib/*.test.js` で検証する。
//
// 守りたい契約 (T-522):
//   1. 既定の対象は assets/img/screenshots/ だけ。以前は assets/img/ 直下も対象で、リポのルートで
//      --apply すると JSON-LD が参照する logo-font.png まで WebP 化して元 PNG を消し、ロゴが 404 になった
//   2. 対象は指定ディレクトリ直下の PNG だけ (再帰しない。assets/img/ico/ の favicon 群を巻き込まない)
//   3. サイトの原稿 (HTML / includes / JSON-LD / Markdown / YAML / CSS / アイランド) から参照されている
//      PNG は変換も削除もしない。参照を .webp に書き換えてから実行すれば変換される
//   4. --apply は WebP ができたことを確かめてから元 PNG を消す (失敗した PNG は残す)。失敗時は
//      書きかけ / 空の WebP を消して PNG の隣に壊れた資産を残さない (実行前からある WebP は残す)
import fs from 'node:fs'
import path from 'node:path'

/** 既定の対象ディレクトリ (サイトのルートからの相対パス)。 */
export const DEFAULT_TARGET_DIR = 'assets/img/screenshots'

/** 参照が無くても変換しない名前 (小さい / 互換性優先。TICKET-SITE-13 から据え置き)。 */
const COMPAT_SKIP = new Set(['app-icon-128.png', 'logo-font-cropped.png'])

/** 参照を探すテキストファイルの拡張子。 */
const SCAN_EXTS = new Set([
	'.html', '.md', '.markdown', '.liquid', '.yml', '.yaml', '.json', '.xml', '.txt',
	'.css', '.js', '.mjs', '.svelte', '.webmanifest',
])

/**
 * 原稿ではないので走査しない場所 (ルートからの相対パス)。ドット始まりのディレクトリも除く。
 * ここに書かれた .png の名前 (作業メモ・履歴・テスト) でスクショの変換が止まらないようにする。
 * 本ファイル自身も除く (COMPAT_SKIP やコメントの名前を参照と取り違えないため)。
 */
const SKIP_PATHS = new Set([
	'_site', 'node_modules', 'vendor', 'assets/dist', 'docs_draft', 'e2e', 'scripts',
	'README.md', 'CLAUDE.md', 'CHANGELOG.md', 'package.json', 'package-lock.json',
	'src/lib/image-optimize.js',
])
const TEST_FILE = /\.test\.[cm]?js$/

const LIQUID_COMMENT = /\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g
/**
 * 区切り (空白・引用符・括弧・コロン・Liquid の波括弧など) を含まない「… .png」の並び。
 * コロンで切るので `https://host/a.png` は `//host/a.png`、`key:/a.png` は `/a.png` として拾われる。
 */
const PNG_TOKEN = /[^\s"'`()<>=,;:{}[\]|\\*]+\.png(?![\w-])/gi
/** プロトコル相対の `//host` 部分。 */
const URL_ORIGIN = /^\/\/[^/]*/

/**
 * CLI 引数を解釈する。`--apply` とディレクトリ 1 つ (任意) を順不同で受け付ける。
 * @returns {{ apply: boolean, dir: string | null }}
 */
export function parseOptimizeArgs(argv) {
	let apply = false
	const dirs = []
	for (const arg of argv) {
		if (arg === '--apply') apply = true
		else if (arg.startsWith('-')) throw new Error(`不明なオプション: ${arg}`)
		else dirs.push(arg)
	}
	if (dirs.length > 1) throw new Error(`ディレクトリは 1 つだけ指定できます: ${dirs.join(' ')}`)
	return { apply, dir: dirs[0] ?? null }
}

/** 対象ディレクトリの絶対パス。既定はサイトの screenshots、明示したものは cwd 基準。 */
export function resolveTargetDir(dir, { cwd, siteRoot }) {
	if (dir == null) return path.join(siteRoot, ...DEFAULT_TARGET_DIR.split('/'))
	return path.resolve(cwd, dir)
}

/** 参照文字列をサイトのルートからの相対パス風 (小文字・先頭の / や ../ なし) にそろえる。 */
function normalizeRef(raw) {
	let ref = raw.replace(URL_ORIGIN, '')
	try {
		ref = decodeURIComponent(ref)
	} catch {
		// 壊れた %エンコードはそのまま使う (保護が広がる側に倒れる)
	}
	ref = ref.replace(/^(?:\.{1,2}\/)+/, '').replace(/^\/+/, '')
	return ref.toLowerCase()
}

/**
 * テキストから .png への参照を抜き出す (純関数)。Liquid / HTML のコメント内は数えない。
 * @returns {string[]} 正規化した参照 (重複なし)
 */
export function extractPngReferences(text) {
	const live = text.replace(LIQUID_COMMENT, ' ').replace(HTML_COMMENT, ' ').replaceAll('\\/', '/')
	const refs = new Set()
	for (const [token] of live.matchAll(PNG_TOKEN)) {
		const ref = normalizeRef(token)
		if (ref && !ref.startsWith('.')) refs.add(ref)
	}
	return [...refs]
}

const toPosix = (p) => p.split(path.sep).join('/')

function isScannedFile(name) {
	return SCAN_EXTS.has(path.extname(name).toLowerCase()) && !TEST_FILE.test(name)
}

/** サイトの原稿ファイル (ルートからの posix 相対パス) を列挙する。 */
function listSourceFiles(siteRoot, relDir = '') {
	const out = []
	for (const entry of fs.readdirSync(path.join(siteRoot, relDir), { withFileTypes: true })) {
		const rel = relDir ? `${relDir}/${entry.name}` : entry.name
		if (entry.name.startsWith('.') || SKIP_PATHS.has(rel)) continue
		if (entry.isDirectory()) out.push(...listSourceFiles(siteRoot, rel))
		else if (entry.isFile() && isScannedFile(entry.name)) out.push(rel)
	}
	return out
}

/**
 * サイトの原稿から .png への参照を集める。読めないファイルがあれば例外 (確かめずに消さない)。
 * @returns {Map<string, string[]>} 正規化した参照 → 参照元 (ルートからの posix 相対パス、昇順)
 */
export function collectPngReferences(siteRoot) {
	const refs = new Map()
	for (const rel of listSourceFiles(siteRoot).sort()) {
		const text = fs.readFileSync(path.join(siteRoot, rel), 'utf8')
		for (const ref of extractPngReferences(text)) {
			refs.set(ref, [...(refs.get(ref) ?? []), rel])
		}
	}
	return refs
}

/** PNG (絶対パス) を参照しているファイル。サイトの外の PNG は参照されようがないので空。 */
function findReferrers(png, siteRoot, refs) {
	const rel = toPosix(path.relative(siteRoot, png)).toLowerCase()
	if (rel.startsWith('../') || path.isAbsolute(rel)) return []
	const referrers = new Set()
	for (const [ref, files] of refs) {
		// 名前だけ・途中からの相対参照も後方一致で拾う (同名の別ファイルも守る = 安全側)
		if (rel === ref || rel.endsWith(`/${ref}`)) files.forEach((f) => referrers.add(f))
	}
	return [...referrers].sort()
}

function listPngs(targetDir) {
	if (!fs.existsSync(targetDir)) throw new Error(`対象ディレクトリがありません: ${targetDir}`)
	if (!fs.statSync(targetDir).isDirectory()) throw new Error(`ディレクトリではありません: ${targetDir}`)
	return fs
		.readdirSync(targetDir, { withFileTypes: true })
		.filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === '.png')
		.map((e) => path.join(targetDir, e.name))
		.sort()
}

/**
 * 変換の計画を立てる (ファイルは変更しない)。
 * @returns {{
 *   siteRoot: string, targetDir: string,
 *   convert: { png: string, webp: string, bytes: number }[],
 *   protected: { png: string, referrers: string[] }[],
 *   skipped: { png: string, reason: string }[],
 * }}
 */
export function planImageOptimization({ siteRoot, targetDir }) {
	const pngs = listPngs(targetDir)
	const refs = collectPngReferences(siteRoot)
	const plan = { siteRoot, targetDir, convert: [], protected: [], skipped: [] }
	for (const png of pngs) {
		const referrers = findReferrers(png, siteRoot, refs)
		if (referrers.length > 0) plan.protected.push({ png, referrers })
		else if (COMPAT_SKIP.has(path.basename(png))) plan.skipped.push({ png, reason: '互換性優先で PNG のまま' })
		else plan.convert.push({ png, webp: png.replace(/\.png$/i, '.webp'), bytes: fs.statSync(png).size })
	}
	return plan
}

const errorMessage = (err) => (err instanceof Error ? err.message : String(err))

/**
 * 失敗した変換の後始末。この実行で作られた (書きかけの) WebP と空の WebP を消し、PNG の隣に
 * 壊れた資産を残さない。実行前からあった中身入りの WebP は消さない (自分が作っていないため)。
 * @returns {string | null} 後始末に失敗したときの説明
 */
function discardFailedWebp(webp, existedBefore) {
	try {
		if (!fs.existsSync(webp)) return null
		if (existedBefore && fs.statSync(webp).size > 0) return null
		fs.unlinkSync(webp)
		return null
	} catch (err) {
		return `書きかけの WebP を消せませんでした: ${errorMessage(err)}`
	}
}

function convertOne({ png, webp, bytes }, convert) {
	const existedBefore = fs.existsSync(webp)
	const fail = (message) => {
		const cleanupError = discardFailedWebp(webp, existedBefore)
		return { png, webp, before: bytes, error: cleanupError ? `${message} / ${cleanupError}` : message }
	}
	try {
		convert(png, webp)
		const after = fs.existsSync(webp) ? fs.statSync(webp).size : 0
		if (after === 0) return fail('WebP ができていません (元の PNG は残します)')
		fs.unlinkSync(png)
		return { png, webp, before: bytes, after }
	} catch (err) {
		return fail(errorMessage(err))
	}
}

/**
 * 計画の convert だけを実行する。protected / skipped の PNG には触れない。
 * @param {(png: string, webp: string) => void} options.convert 1 枚を変換する (ffmpeg の起動。テストで差し替える)
 * @returns {{ png: string, webp: string, before: number, after?: number, error?: string }[]}
 */
export function applyImageOptimization(plan, { convert }) {
	return plan.convert.map((item) => convertOne(item, convert))
}
