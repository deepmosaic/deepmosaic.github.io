// T-2199 (i18n1112 I18N-701): 英中のページ・l10n のデータが、元の ja のソースに追随していることの検査の部品。
//
//   - normalizeSource(text, kind): 比べる前の正規化 (kind = 'html' | 'yml')
//   - sourceHash(absPath): 正規化した本文の sha256 (hex)
//   - readFrontMatter(text): `---` の間の `key: value` を素朴に読む
//   - checkTranslatedSources(root): `en/`・`zh-tw/` のページと `_data/l10n/**/*.yml` の規則の検査 (エラーの文字列の配列)
//   依存なし (node の標準モジュールだけ)。

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep, extname } from 'node:path'

/** 英中のページの置き場 (リポの root 直下) と、front matter の lang の値。 */
export const TRANSLATED_LANGS = ['en', 'zh-tw']

const LIQUID_COMMENT = /\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

/**
 * ja のソースを正規化する。
 *   - CRLF → LF
 *   - html: `{% comment %}…{% endcomment %}` (`{%- -%}` も) と `<!-- … -->` を除く
 *   - yml: `#` で始まる行 (前の空白は許す) を除く
 *   - 行末の空白を除き、空白だけの行を除く (コメントを除いて空いた行を数えないため)
 *   - 末尾の改行を 1 つにする
 */
export function normalizeSource(text, kind = 'html') {
	let out = text.replace(/\r\n?/g, '\n')
	if (kind === 'html') {
		out = out.replace(LIQUID_COMMENT, '').replace(HTML_COMMENT, '')
	}
	let lines = out.split('\n').map((l) => l.replace(/[ \t]+$/, ''))
	if (kind === 'yml') lines = lines.filter((l) => !/^\s*#/.test(l))
	lines = lines.filter((l) => l.trim() !== '')
	return lines.join('\n') + '\n'
}

/** 拡張子から正規化の種類を決める (.yml / .yaml は yml、それ以外は html)。 */
export function kindOf(path) {
	const ext = extname(path).toLowerCase()
	return ext === '.yml' || ext === '.yaml' ? 'yml' : 'html'
}

/** 正規化した本文の sha256 (hex 64 桁)。 */
export function sourceHash(absPath) {
	const text = readFileSync(absPath, 'utf8')
	return createHash('sha256').update(normalizeSource(text, kindOf(absPath)), 'utf8').digest('hex')
}

/** 値の両端の引用符を外す。 */
export function unquote(value) {
	const v = value.trim()
	if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
		return v.slice(1, -1)
	}
	return v
}

/** front matter (`---` の間) を `key: value` で素朴に読む。配列・入れ子は読まない。無ければ {}。 */
export function readFrontMatter(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
	if (!m) return {}
	const out = {}
	for (const line of m[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/)
		if (kv && kv[2] !== undefined && kv[2].trim() !== '') out[kv[1]] = unquote(kv[2])
	}
	return out
}

/** yml のトップレベルの `key: value` を 1 つ読む (無ければ undefined)。 */
export function readYmlScalar(text, key) {
	const m = text.match(new RegExp(`^${key}:[ \\t]*(.+?)[ \\t]*\\r?$`, 'm'))
	return m ? unquote(m[1]) : undefined
}

/** dir 以下のファイルを相対パス (区切りは `/`) で再帰に列挙する。 */
function walk(dir, root, pred) {
	const out = []
	const rec = (d) => {
		for (const name of readdirSync(d)) {
			const abs = join(d, name)
			if (statSync(abs).isDirectory()) rec(abs)
			else if (pred(name)) out.push(relative(root, abs).split(sep).join('/'))
		}
	}
	if (existsSync(dir)) rec(dir)
	return out.sort()
}

/** 英中のページ 1 本の front matter の規則。 */
function checkPage(root, rel, lang) {
	const errors = []
	const fm = readFrontMatter(readFileSync(join(root, rel), 'utf8'))
	if (fm.lang !== lang) errors.push(`${rel}: front matter の lang が "${lang}" でない (${fm.lang ?? '無し'})`)
	if (!fm.permalink || !fm.permalink.startsWith(`/${lang}/`)) {
		errors.push(`${rel}: permalink が /${lang}/ で始まらない (${fm.permalink ?? '無し'})`)
	}
	if (!fm.ja_url) errors.push(`${rel}: ja_url が無い`)
	if (!fm.source) {
		errors.push(`${rel}: source が無い (元の ja のファイル。試しのページの消し忘れでないか)`)
		return errors
	}
	const src = join(root, fm.source)
	if (!existsSync(src)) {
		errors.push(`${rel}: source のファイルが無い (${fm.source})`)
		return errors
	}
	const want = sourceHash(src)
	if (fm.source_hash !== want) {
		errors.push(`${rel}: source_hash が ${fm.source} と一致しない (ja が変わった。英中を直して node scripts/i18n/accept-site.mjs ${rel})`)
	}
	return errors
}

/** `_source:` を持つ l10n のデータファイル 1 本の規則。 */
function checkL10n(root, rel) {
	const text = readFileSync(join(root, rel), 'utf8')
	const source = readYmlScalar(text, '_source')
	if (source === undefined) return []
	const src = join(root, source)
	if (!existsSync(src)) return [`${rel}: _source のファイルが無い (${source})`]
	if (readYmlScalar(text, '_source_hash') !== sourceHash(src)) {
		return [`${rel}: _source_hash が ${source} と一致しない (node scripts/i18n/accept-site.mjs ${rel})`]
	}
	return []
}

/**
 * 英中のファイルの規則を検査する。
 *   - `en/**\/*.html`・`zh-tw/**\/*.html` の全部が lang (ディレクトリと一致)・permalink (`/<lang>/` で始まる)・
 *     ja_url・source (実在)・source_hash (今の sourceHash(source) と一致) を持つ
 *   - `en/`・`zh-tw/` があるのに .html が 0 件ならエラー (列挙の書き損じを捕まえる)
 *   - `_data/l10n/**\/*.yml` のうち `_source:` を持つものは `_source_hash` が一致する
 */
export function checkTranslatedSources(root) {
	const errors = []
	for (const lang of TRANSLATED_LANGS) {
		const dir = join(root, lang)
		if (!existsSync(dir)) continue
		const pages = walk(dir, root, (n) => n.endsWith('.html'))
		if (pages.length === 0) errors.push(`${lang}/ があるのに .html が 0 件 (列挙の書き損じか、空のディレクトリ)`)
		for (const rel of pages) errors.push(...checkPage(root, rel, lang))
	}
	for (const rel of walk(join(root, '_data', 'l10n'), root, (n) => /\.ya?ml$/.test(n))) {
		errors.push(...checkL10n(root, rel))
	}
	return errors
}
