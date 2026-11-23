// 英中のページ・l10n のデータが、元の ja のソースに追随していることの検査の部品。
//
//   - normalizeSource(text, kind): 比べる前の正規化 (kind = 'html' | 'yml')
//   - sourceHash(absPath): 正規化した本文の sha256 (hex)
//   - readFrontMatter(text): `---` の間の `key: value` を素朴に読む
//   - checkTranslatedSources(root): `en/`・`zh-tw/` のページ・`_data/l10n/**/*.yml`・訳の include の規則の検査 (エラーの文字列の配列)
//   - 訳の include (`_includes/docs/<lang>/<名前>.html`): splitSections・sectionHashesOf (節ごとの hash)、
//     readIncludeHeader・formatIncludeHeader (先頭の Liquid コメント)、diffIncludeSections (日本語との違い)
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

// ---------------------------------------------------------------- 訳の include

/** 訳の include を置くフォルダ (この下の `<lang>/` に、日本語の include と同じ名前で置く)。 */
export const TRANSLATED_INCLUDE_DIRS = ['_includes/docs']

/** 最初の節の前の部分の名前。 */
export const HEAD_SECTION = '_head'

/** 節ごとの hash の桁数 (sha256 の hex の先頭)。 */
export const SECTION_HASH_LENGTH = 16

const SECTION_TAG = /<section\b[^>]*>|<\/section\s*>/gi

/**
 * 正規化した本文 (normalizeSource の出力) を、一番外の `<section id="…">` ごとに分ける。
 *   - 節は `<section id>` の開始から次の一番外の `<section id>` の開始の手前まで (節の後ろの部分も前の節に入る)
 *   - 最初の節の前は HEAD_SECTION (空なら作らない)。節が無いファイルは HEAD_SECTION だけ
 *   - 入れ子の `<section>` は外の節に含める
 * 戻り値: [{ name, text }] (text は前後の空白を除いたもの)
 */
export function splitSections(normalized) {
	const starts = [{ index: 0, name: HEAD_SECTION }]
	let depth = 0
	for (const m of normalized.matchAll(SECTION_TAG)) {
		if (m[0].startsWith('</')) {
			depth = Math.max(0, depth - 1)
			continue
		}
		if (depth === 0) {
			const id = m[0].match(/\sid=(["'])(.*?)\1/)?.[2]
			if (id) starts.push({ index: m.index, name: id })
		}
		depth += 1
	}
	const parts = []
	for (let i = 0; i < starts.length; i += 1) {
		const text = normalized.slice(starts[i].index, starts[i + 1]?.index).trim()
		if (i === 0 && text === '') continue
		parts.push({ name: starts[i].name, text })
	}
	return parts
}

const shortHash = (text) => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, SECTION_HASH_LENGTH)

/** html のソースの節ごとの hash。戻り値: [{ name, hash }] (節の並び)。 */
export function sectionHashesOf(text) {
	return splitSections(normalizeSource(text, 'html')).map((p) => ({ name: p.name, hash: shortHash(`${p.text}\n`) }))
}

/** html のソースの一番外の節の id の並び (HEAD_SECTION を除く)。 */
export function sectionIdsOf(text) {
	return splitSections(normalizeSource(text, 'html'))
		.map((p) => p.name)
		.filter((n) => n !== HEAD_SECTION)
}

const INCLUDE_HEADER = /^\{%-?\s*comment\s*-?%\}\r?\n([\s\S]*?)\{%-?\s*endcomment\s*-?%\}(?:\r?\n)?/

/**
 * 訳の include の先頭の Liquid コメントを読む。先頭がそのコメントでない・`source:` が無ければ null。
 * 戻り値: { source, hashes: [{ name, hash }], length (コメントと直後の改行の文字数) }
 */
export function readIncludeHeader(text) {
	const m = text.match(INCLUDE_HEADER)
	if (!m) return null
	let source
	const hashes = []
	let inHash = false
	for (const line of m[1].split(/\r?\n/)) {
		const src = line.match(/^source:\s*(.+?)\s*$/)
		if (src) {
			source = unquote(src[1])
			inHash = false
			continue
		}
		if (/^hash:\s*$/.test(line)) {
			inHash = true
			continue
		}
		const h = inHash && line.match(/^\s+([\w-]+):\s*([0-9a-f]+)\s*$/)
		if (h) hashes.push({ name: h[1], hash: h[2] })
	}
	if (!source) return null
	return { source, hashes, length: m[0].length }
}

/** 訳の include の先頭の Liquid コメントを作る (出力に出ないよう前後の空白を削る `{%- -%}`)。 */
export function formatIncludeHeader(source, hashes, eol = '\n') {
	const lines = ['{%- comment -%}', `source: ${source}`, 'hash:', ...hashes.map((h) => `  ${h.name}: ${h.hash}`), '{%- endcomment -%}']
	return lines.join(eol) + eol
}

const LANG_FOLDER = new RegExp(`^(.+)/(?:${TRANSLATED_LANGS.join('|')})/([^/]+\\.html)$`)

/** 訳の include のパスから、言語のフォルダを外した日本語の include のパス。訳の include の置き場でなければ null。 */
export function includeSourceFor(rel) {
	const m = rel.match(LANG_FOLDER)
	if (!m || !TRANSLATED_INCLUDE_DIRS.includes(m[1])) return null
	return `${m[1]}/${m[2]}`
}

/** リポの訳の include の一覧。戻り値: [{ rel, lang }] */
export function translatedIncludes(root) {
	const out = []
	for (const dir of TRANSLATED_INCLUDE_DIRS) {
		for (const lang of TRANSLATED_LANGS) {
			for (const rel of walk(join(root, dir, lang), root, (n) => n.endsWith('.html'))) out.push({ rel, lang })
		}
	}
	return out
}

/**
 * 訳の include 1 本と日本語の include の違い。
 * 戻り値: { header (先頭のコメントがあるか), source, sourceExists, jaSections ([{ name, hash, text }]),
 *          stale (hash が違う節), missing (日本語にあって hash が無い節), extra (hash があって日本語に無い節),
 *          jaIds, ownIds (一番外の節の id の並び。HEAD_SECTION を除く) }
 */
export function diffIncludeSections(root, rel) {
	const text = readFileSync(join(root, rel), 'utf8')
	const header = readIncludeHeader(text)
	const source = header?.source ?? includeSourceFor(rel)
	const out = { header: Boolean(header), source, sourceExists: false, jaSections: [], stale: [], missing: [], extra: [], jaIds: [], ownIds: sectionIdsOf(text) }
	if (!source || !existsSync(join(root, source))) return out
	out.sourceExists = true
	const ja = readFileSync(join(root, source), 'utf8')
	const parts = splitSections(normalizeSource(ja, 'html'))
	out.jaSections = parts.map((p) => ({ name: p.name, hash: shortHash(`${p.text}\n`), text: p.text }))
	out.jaIds = out.jaSections.map((p) => p.name).filter((n) => n !== HEAD_SECTION)
	const have = new Map((header?.hashes ?? []).map((h) => [h.name, h.hash]))
	for (const p of out.jaSections) {
		if (!have.has(p.name)) out.missing.push(p.name)
		else if (have.get(p.name) !== p.hash) out.stale.push(p.name)
	}
	const jaNames = new Set(out.jaSections.map((p) => p.name))
	out.extra = [...have.keys()].filter((n) => !jaNames.has(n))
	return out
}

/** 訳の include 1 本の規則 (エラーの文字列の配列)。 */
export function checkTranslatedInclude(root, rel, lang) {
	const d = diffIncludeSections(root, rel)
	const accept = `node scripts/i18n/accept-site.mjs ${rel}`
	if (!d.header) return [`${rel}: 先頭に元のファイルと節ごとの hash の Liquid コメントが無い (訳を書いたら ${accept})`]
	if (!d.sourceExists) return [`${rel}: source のファイルが無い (${d.source})`]
	const errors = []
	if (JSON.stringify(d.ownIds) !== JSON.stringify(d.jaIds)) {
		errors.push(`${rel}: 節の id の並びが ${d.source} と違う (ja ${JSON.stringify(d.jaIds)} / 訳 ${JSON.stringify(d.ownIds)})`)
	}
	for (const name of d.stale) {
		errors.push(`${rel}: 節 ${name} の日本語が変わった (${d.source}。違いは node scripts/i18n/docs-diff.mjs ${lang}、訳を直して ${accept} --section ${name})`)
	}
	for (const name of d.missing) {
		errors.push(`${rel}: 節 ${name} の hash が無い (${d.source} に節が増えた。訳を足して ${accept} --section ${name})`)
	}
	for (const name of d.extra) {
		errors.push(`${rel}: 節 ${name} は ${d.source} に無い (日本語の節が消えたか改名された。訳を合わせて ${accept})`)
	}
	return errors
}

/**
 * 英中のファイルの規則を検査する。
 *   - `en/**\/*.html`・`zh-tw/**\/*.html` の全部が lang (ディレクトリと一致)・permalink (`/<lang>/` で始まる)・
 *     ja_url・source (実在)・source_hash (今の sourceHash(source) と一致) を持つ
 *   - `en/`・`zh-tw/` があるのに .html が 0 件ならエラー (列挙の書き損じを捕まえる)
 *   - `_data/l10n/**\/*.yml` のうち `_source:` を持つものは `_source_hash` が一致する
 *   - 訳の include (`_includes/docs/<lang>/*.html`) は先頭のコメントの source が実在し、一番外の節の id の並びが
 *     日本語と同じで、節ごとの hash が日本語の今の値と一致する
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
	for (const { rel, lang } of translatedIncludes(root)) errors.push(...checkTranslatedInclude(root, rel, lang))
	return errors
}
