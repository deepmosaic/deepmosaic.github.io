// T-2322 (backlog1113) サイトのページの front matter の読み取りと、YAML として読める形かの検査。
//
// 背景: T-2231 で英語のトップの description に引用符なしの `: ` を書いたら、npm test は通り、
// `bundle exec jekyll build --strict_front_matter` (Ruby の Psych) で初めて落ちた。テストの読み取り (fmScalar) は
// 行を文字列として切り出すだけで、YAML として正しいかを見ていなかった。
//
// YAML ライブラリを devDependency に足さない (plans-yml.js と同じ割り切り)。そのため完全な YAML の検証ではなく、
// 「サイトの front matter が実際に使っている形」だけを許し、それ以外は問題として返す小さな検査にしている。
//
// 許す形 (これ以外の行は「この検査が読めない形」として返す。正しい YAML でも、使っていない書き方なら落とす):
//   - 空行、`#` で始まるコメントの行 (インデントしてもよい)
//   - トップレベルの `key: 値` / `key:` (値なし = 次の行からの配列の親)
//   - 値なしの `key:` の下の、同じ幅の空白でインデントした `- 値` (ブロックの配列)
//   - 値は 1 行の 3 通り: 引用符なし (plain)・"…" (\ のエスケープ)・'…' ('' のエスケープ)。閉じた後は ` # コメント` だけ
//
// 見る (Jekyll が落ちる代表的な形):
//   - 引用符なしの値の中の `: ` / `:` + タブ / 末尾の `:` (T-2231 の形。マッピングの入れ子と読まれて落ちる)
//   - 引用符なしの値の先頭の YAML の記号 `@` `` ` `` `*` `&` `!` `%` `|` `>` `[` `{` `#` と `- ` `? ` `: `
//     (予約文字・エイリアス・アンカー・タグ・ブロックスカラー・フロー・コメント。落ちるか、値が別物になる)
//   - 引用符の閉じ忘れ・閉じた後の余り・"…" の中の不正なエスケープ (`\q` など)
//   - タブのインデント、キーの後に空白の無い `key:value`、キーでも配列でもない行、値を持つキーの下の配列、インデントのずれ
//
// 見ない (YAML としては読めるが値が変わるだけのもの・ここで使っていない書き方):
//   - 引用符なしの値の途中の ` #` (以降がコメントになり値が切れる。Jekyll は落ちない)
//   - キーの重複 (Psych は後勝ちで落ちない)、`true` / `123` など文字列以外に読まれる値
//   - 複数行の値 (plain の折り返し・複数行の "…"・ブロックスカラー) と入れ子のマッピング。使っていないので「読めない形」として落とす

import { readdirSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'

/** ページの先頭の front matter (`---` の間) を取り出す。CRLF は LF に揃える。無い・閉じていなければ null */
export function extractFrontMatter(src) {
	const text = src.replace(/\r\n/g, '\n')
	const m = text.match(/^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/)
	if (!m) return null
	return m[1] ?? ''
}

/**
 * front matter のトップレベルの scalar (`key: value`) を文字列で返す。値の両端の同じ引用符は外す。無ければ undefined。
 * i18n-site-*.test.js の読み取り (T-2322 で 4 つの写しをここへ集めた。挙動は写しと同じ)。YAML としての正しさは lintFrontMatter が見る。
 */
export function fmScalar(fm, key) {
	const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm'))
	if (!m) return undefined
	return m[1].replace(/^(["'])(.*)\1$/, '$2')
}

const KEY_LINE = /^([A-Za-z0-9_-]+):(?:([ \t]+)(.*))?$/
const ITEM_LINE = /^( +)-(?:[ \t]+(.*))?$/
const COMMENT_LINE = /^[ \t]*#/
/** 引用符なしの値の先頭に来ると YAML の意味を持つ記号 */
const PLAIN_LEADING = /^(?:[@`*&!%|>[{#]|[-?:](?:[ \t]|$))/
/** "…" の中で許すエスケープ (YAML 1.1 / Psych) */
const DQ_ESCAPES = new Set(['0', 'a', 'b', 't', '\t', 'n', 'v', 'f', 'r', 'e', ' ', '"', '/', '\\', 'N', '_', 'L', 'P', 'x', 'u', 'U'])

/** 1 行の値を検査し、問題の文 (無ければ null) を返す */
function checkValue(value) {
	if (value === '') return null
	if (value[0] === '"') return checkDoubleQuoted(value)
	if (value[0] === "'") return checkSingleQuoted(value)
	if (PLAIN_LEADING.test(value)) return `引用符なしの値の先頭に YAML の記号 \`${value[0]}\` がある (値を "…" で囲む)`
	const body = value.replace(/[ \t]+#.*$/, '')
	if (/:(?:[ \t]|$)/.test(body)) return '引用符なしの値に `: ` (または末尾の `:`) がある (値を "…" で囲む)'
	return null
}

/** 閉じた引用符の後に残ってよいのは空白と ` # コメント` だけ */
const checkRest = (rest, q) => (/^(?:[ \t]+#.*|[ \t]*)$/.test(rest) ? null : `${q} を閉じた後に余りがある`)

function checkDoubleQuoted(value) {
	for (let i = 1; i < value.length; i++) {
		const c = value[i]
		if (c === '\\') {
			if (!DQ_ESCAPES.has(value[i + 1])) return `"…" の中に不正なエスケープ \`\\${value[i + 1] ?? ''}\` がある`
			i++
		} else if (c === '"') return checkRest(value.slice(i + 1), '"')
	}
	return '" の閉じ忘れ (1 行の中で閉じていない)'
}

function checkSingleQuoted(value) {
	for (let i = 1; i < value.length; i++) {
		if (value[i] !== "'") continue
		if (value[i + 1] === "'") {
			i++
			continue
		}
		return checkRest(value.slice(i + 1), "'")
	}
	return "' の閉じ忘れ (1 行の中で閉じていない)"
}

/**
 * front matter の文 (`---` の間) を検査し、問題の一覧を返す。空なら YAML として読める (許す形の範囲で)。
 * @param {string} fm
 * @returns {{ line: number, message: string }[]} line は front matter の中の 1 始まりの行番号
 */
export function lintFrontMatter(fm) {
	const problems = []
	const add = (line, message) => problems.push({ line, message })
	// 値なしの `key:` の直後か (配列を書いてよいか) と、その配列のインデントの幅
	let listParent = false
	let listIndent = null
	fm.split('\n').forEach((raw, i) => {
		const line = i + 1
		const text = raw.replace(/\r$/, '')
		if (/^[ \t]*$/.test(text) || (COMMENT_LINE.test(text) && !/^ *\t/.test(text))) return
		if (/^ *\t/.test(text)) return add(line, 'インデントにタブがある (YAML は空白だけ)')
		const key = text.match(KEY_LINE)
		if (key) {
			// `key: # コメント` も値の先頭の `#` として落とす (値が null になる。サイトでは使っていない)
			listParent = key[3] === undefined || key[3] === ''
			listIndent = null
			const why = checkValue(key[3] ?? '')
			if (why) add(line, `${key[1]}: ${why}`)
			return
		}
		const item = text.match(ITEM_LINE)
		if (item) {
			if (!listParent) return add(line, '配列の要素の親が無い (値なしの `key:` の下でない)')
			if (listIndent === null) listIndent = item[1].length
			else if (item[1].length !== listIndent) return add(line, `配列のインデントがずれている (${listIndent} 文字のはず)`)
			const why = checkValue(item[2] ?? '')
			if (why) add(line, `配列の要素: ${why}`)
			return
		}
		if (/^[A-Za-z0-9_-]+:\S/.test(text)) return add(line, '`key:` の後に空白が無い')
		add(line, 'この検査が読めない形の行 (トップレベルの `key: 値` か、その下の `- 値` だけを許す)')
	})
	return problems
}

/** Jekyll が公開しない・ページでないフォルダ (_config.yml の exclude と、_layouts 以外の `_` で始まるフォルダ) */
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'src', 'scripts', 'e2e', 'docs_draft', 'test-results', 'playwright-report'])
const TEXT_EXT = new Set(['.html', '.md', '.markdown', '.txt', '.xml', '.json', '.css', '.js', '.webmanifest'])

/**
 * サイトの中で front matter を持つファイル (先頭の行が `---`) の、root からの相対パス (区切りは `/`) を返す。
 * 公開しないフォルダ・`.` で始まるもの・`_layouts` 以外の `_` で始まるフォルダ (`_site`・`_includes`・`_data` など) は見ない。
 */
export function listFrontMatterFiles(root) {
	const out = []
	const walk = (dir, rel) => {
		for (const ent of readdirSync(dir, { withFileTypes: true })) {
			const name = ent.name
			if (name.startsWith('.')) continue
			const relPath = rel ? `${rel}/${name}` : name
			if (ent.isDirectory()) {
				if (SKIP_DIRS.has(name) && !rel) continue
				if (name.startsWith('_') && !(name === '_layouts' && !rel)) continue
				walk(join(dir, name), relPath)
			} else if (ent.isFile() && TEXT_EXT.has(extname(name))) {
				const head = readFileSync(join(dir, name), 'utf8').slice(0, 5)
				if (/^---[ \t]*\r?\n/.test(head)) out.push(relPath)
			}
		}
	}
	walk(root, '')
	return out.sort()
}
