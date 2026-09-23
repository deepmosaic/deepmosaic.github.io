// scripts/optimize-images.mjs の仕様テスト (T-522)。
//
// 守りたい契約:
//   1. 既定の対象は assets/img/screenshots/ だけ (cwd に依らない)。引数でディレクトリを 1 つ指定できる
//   2. 対象はそのディレクトリ直下の PNG だけ (再帰しない)
//   3. HTML / includes / JSON-LD などサイトの原稿から参照されている PNG は変換も削除もしない
//   4. --apply は変換に成功した PNG だけを消す (失敗したら元 PNG を残し、書きかけ / 空の WebP は消す)
//
// フィクスチャは一時ディレクトリに組み立てる。ffmpeg (外部プロセス) だけを差し替え、
// ファイルの走査・削除は実物の FS で確かめる。
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	DEFAULT_TARGET_DIR,
	applyImageOptimization,
	collectPngReferences,
	extractPngReferences,
	parseOptimizeArgs,
	planImageOptimization,
	resolveTargetDir,
} from './image-optimize.js'

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = path.join(SITE_ROOT, 'scripts', 'optimize-images.mjs')

const tmpRoots = []
after(() => {
	for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true })
})

/** 一時ディレクトリに { 相対パス: 内容 } のファイル群を作り、そのルートを返す。 */
function makeSite(files) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 't522-site-'))
	tmpRoots.push(root)
	for (const [rel, content] of Object.entries(files)) {
		const abs = path.join(root, ...rel.split('/'))
		fs.mkdirSync(path.dirname(abs), { recursive: true })
		fs.writeFileSync(abs, content)
	}
	return root
}

const PNG = 'fake-png-bytes'

/** 本番のサイトの形を縮めたフィクスチャ。 */
function makeFixtureSite() {
	return makeSite({
		'_includes/schema/organization.html':
			'<script type="application/ld+json">{ "logo": "https://www.example.jp/assets/img/logo-font.png" }</script>',
		'_includes/header.html': '<img src="/assets/img/screenshots/used.png" alt="">',
		'index.html': [
			'{%- comment -%} 旧 hero は assets/img/screenshots/commented.png だった {%- endcomment -%}',
			'<!-- <img src="/assets/img/screenshots/html-comment.png"> -->',
			'<img src="/assets/img/screenshots/new.webp" alt="">',
		].join('\n'),
		'docs_draft/notes.md': '`assets/img/screenshots/draft.png` を撮り直した',
		'README.md': 'assets/img/screenshots/readme.png',
		'src/lib/sample.test.js': "const x = '/assets/img/screenshots/in-test.png'",
		'assets/img/logo-font.png': PNG,
		'assets/img/photo.png': PNG,
		'assets/img/screenshots/new.png': PNG,
		'assets/img/screenshots/used.png': PNG,
		'assets/img/screenshots/commented.png': PNG,
		'assets/img/screenshots/html-comment.png': PNG,
		'assets/img/screenshots/draft.png': PNG,
		'assets/img/screenshots/readme.png': PNG,
		'assets/img/screenshots/in-test.png': PNG,
		'assets/img/screenshots/keep.webp': 'webp',
		'assets/img/screenshots/sub/deep.png': PNG,
	})
}

const fixturePath = (root, rel) => path.join(root, ...rel.split('/'))
const names = (items) => items.map((it) => path.basename(it.png)).sort()

/** ffmpeg の代わり: webp を書くだけの変換器。呼ばれた PNG を記録する。 */
function fakeConverter() {
	const calls = []
	const convert = (png, webp) => {
		calls.push(png)
		fs.writeFileSync(webp, 'RIFF----WEBP')
	}
	return { calls, convert }
}

// --- 引数と対象ディレクトリ ---------------------------------------------------

test('parseOptimizeArgs: 引数なしは dry-run で既定ディレクトリ', () => {
	assert.deepEqual(parseOptimizeArgs([]), { apply: false, dir: null })
})

test('parseOptimizeArgs: --apply とディレクトリは順不同で受け付ける', () => {
	assert.deepEqual(parseOptimizeArgs(['--apply']), { apply: true, dir: null })
	assert.deepEqual(parseOptimizeArgs(['--apply', 'assets/img']), { apply: true, dir: 'assets/img' })
	assert.deepEqual(parseOptimizeArgs(['work/shots', '--apply']), { apply: true, dir: 'work/shots' })
})

test('parseOptimizeArgs: 不明なオプションとディレクトリの複数指定は拒否する', () => {
	assert.throws(() => parseOptimizeArgs(['--aply']), /不明なオプション: --aply/)
	assert.throws(() => parseOptimizeArgs(['a', 'b']), /ディレクトリは 1 つだけ/)
})

test('resolveTargetDir: 既定は cwd に依らずサイトの assets/img/screenshots', () => {
	assert.equal(DEFAULT_TARGET_DIR, 'assets/img/screenshots')
	const root = path.resolve('/site')
	assert.equal(
		resolveTargetDir(null, { cwd: path.resolve('/elsewhere'), siteRoot: root }),
		path.join(root, 'assets', 'img', 'screenshots'),
	)
})

test('resolveTargetDir: 明示したディレクトリは cwd 基準 (絶対パスはそのまま)', () => {
	const cwd = path.resolve('/work')
	const root = path.resolve('/site')
	assert.equal(resolveTargetDir('shots', { cwd, siteRoot: root }), path.join(cwd, 'shots'))
	const abs = path.resolve('/abs/dir')
	assert.equal(resolveTargetDir(abs, { cwd, siteRoot: root }), abs)
})

// --- 参照の抽出 (純関数) --------------------------------------------------------

test('extractPngReferences: img / JSON-LD の絶対 URL / JSON のエスケープを正規化する', () => {
	const refs = extractPngReferences(
		[
			'<img src="/assets/img/a.png">',
			'"logo": "https://www.example.jp/assets/img/logo-font.png"',
			'"src": "\\/android-icon-36x36.png"',
			'<link href="//cdn.example.jp/assets/img/cdn.png">',
		].join('\n'),
	)
	assert.deepEqual(refs.sort(), [
		'android-icon-36x36.png',
		'assets/img/a.png',
		'assets/img/cdn.png',
		'assets/img/logo-font.png',
	])
})

test('extractPngReferences: srcset / url() / Markdown / クエリ / 相対パス / 大文字 / %エンコード', () => {
	const refs = extractPngReferences(
		[
			'<img srcset="/x/one.png 1x, /x/two.png 2x">',
			"background: url('../img/bg.png?v=2');",
			'![図](./shots/fig.PNG)',
			'<img src="/assets/img/%E5%9B%B3.png">',
			'og_image:/assets/img/og.png',
		].join('\n'),
	)
	assert.deepEqual(
		refs.sort(),
		['img/bg.png', 'shots/fig.png', 'x/one.png', 'x/two.png', 'assets/img/図.png', 'assets/img/og.png'].sort(),
	)
})

test('extractPngReferences: Liquid / HTML のコメント内と .png 以外の拡張子は参照に数えない', () => {
	const refs = extractPngReferences(
		[
			'{%- comment -%} old/hero.png {%- endcomment -%}',
			'{% comment %}\nold/two.png\n{% endcomment %}',
			'<!-- <img src="/old/three.png"> -->',
			'<img src="/a.webp"> <img src="/b.pngx"> image/png',
			'<img src="/live.png">',
		].join('\n'),
	)
	assert.deepEqual(refs, ['live.png'])
})

test('collectPngReferences: 原稿ではない場所 (docs_draft / README / *.test.js) は走査しない', () => {
	const root = makeFixtureSite()
	const refs = collectPngReferences(root)
	assert.deepEqual(refs.get('assets/img/logo-font.png'), ['_includes/schema/organization.html'])
	assert.deepEqual(refs.get('assets/img/screenshots/used.png'), ['_includes/header.html'])
	for (const excluded of ['draft.png', 'readme.png', 'in-test.png', 'commented.png', 'html-comment.png']) {
		assert.equal(refs.has(`assets/img/screenshots/${excluded}`), false, excluded)
	}
})

// --- 計画 (dry-run) ------------------------------------------------------------

test('planImageOptimization: 既定の対象は screenshots 直下だけで assets/img 直下とサブフォルダは含めない', () => {
	const root = makeFixtureSite()
	const plan = planImageOptimization({ siteRoot: root, targetDir: resolveTargetDir(null, { cwd: root, siteRoot: root }) })
	assert.deepEqual(names(plan.convert), [
		'commented.png',
		'draft.png',
		'html-comment.png',
		'in-test.png',
		'new.png',
		'readme.png',
	])
	assert.deepEqual(plan.protected, [
		{ png: fixturePath(root, 'assets/img/screenshots/used.png'), referrers: ['_includes/header.html'] },
	])
	const all = [...plan.convert, ...plan.protected, ...plan.skipped].map((it) => it.png)
	assert.ok(!all.includes(fixturePath(root, 'assets/img/logo-font.png')))
	assert.ok(!all.includes(fixturePath(root, 'assets/img/screenshots/sub/deep.png')))
	const newItem = plan.convert.find((it) => it.png.endsWith('new.png'))
	assert.equal(newItem.webp, fixturePath(root, 'assets/img/screenshots/new.webp'))
	assert.equal(newItem.bytes, PNG.length)
})

test('planImageOptimization: assets/img を明示すると JSON-LD が参照するロゴは保護される', () => {
	const root = makeFixtureSite()
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'assets/img') })
	assert.deepEqual(names(plan.convert), ['photo.png'])
	assert.deepEqual(plan.protected, [
		{ png: fixturePath(root, 'assets/img/logo-font.png'), referrers: ['_includes/schema/organization.html'] },
	])
})

test('planImageOptimization: 名前だけの参照でも同名の PNG を保護する (安全側)', () => {
	const root = makeSite({
		'assets/img/ico/browserconfig.xml': '<square70x70logo src="/ms-icon-70x70.png"/>',
		'assets/img/ico/ms-icon-70x70.png': PNG,
	})
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'assets/img/ico') })
	assert.deepEqual(plan.convert, [])
	assert.deepEqual(plan.protected[0].referrers, ['assets/img/ico/browserconfig.xml'])
})

test('planImageOptimization: 互換性優先の名前 (app-icon-128.png 等) は参照が無くても対象外', () => {
	const root = makeSite({ 'assets/img/app-icon-128.png': PNG, 'assets/img/logo-font-cropped.png': PNG })
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'assets/img') })
	assert.deepEqual(plan.convert, [])
	assert.deepEqual(names(plan.skipped), ['app-icon-128.png', 'logo-font-cropped.png'])
})

test('planImageOptimization: サイト外の作業フォルダも対象にできる (参照による保護は無い)', () => {
	const root = makeSite({ 'index.html': '<img src="/shot.png">' })
	const work = makeSite({ 'shot.png': PNG })
	const plan = planImageOptimization({ siteRoot: root, targetDir: work })
	assert.deepEqual(names(plan.convert), ['shot.png'])
	assert.deepEqual(plan.protected, [])
})

test('planImageOptimization: 存在しない / ファイルを指すディレクトリは拒否する', () => {
	const root = makeFixtureSite()
	assert.throws(
		() => planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'nope') }),
		/対象ディレクトリがありません/,
	)
	assert.throws(
		() => planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'assets/img/photo.png') }),
		/ディレクトリではありません/,
	)
})

// --- 実行 (--apply) ------------------------------------------------------------

test('applyImageOptimization: 未参照の PNG は WebP にして消し、参照中の PNG には触れない', () => {
	const root = makeFixtureSite()
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'assets/img/screenshots') })
	const { calls, convert } = fakeConverter()

	const results = applyImageOptimization(plan, { convert })

	assert.equal(results.length, plan.convert.length)
	assert.ok(results.every((r) => !r.error && r.after > 0))
	assert.ok(!calls.includes(fixturePath(root, 'assets/img/screenshots/used.png')))
	assert.ok(fs.existsSync(fixturePath(root, 'assets/img/screenshots/used.png')))
	assert.ok(!fs.existsSync(fixturePath(root, 'assets/img/screenshots/used.webp')))
	assert.ok(!fs.existsSync(fixturePath(root, 'assets/img/screenshots/new.png')))
	assert.ok(fs.existsSync(fixturePath(root, 'assets/img/screenshots/new.webp')))
	assert.ok(fs.existsSync(fixturePath(root, 'assets/img/logo-font.png')))
	assert.ok(fs.existsSync(fixturePath(root, 'assets/img/screenshots/sub/deep.png')))
})

test('applyImageOptimization: 変換が失敗した PNG は残し、残りの変換は続ける', () => {
	const root = makeSite({ 'shots/bad.png': PNG, 'shots/good.png': PNG })
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'shots') })
	const convert = (png, webp) => {
		if (png.endsWith('bad.png')) throw new Error('ffmpeg exited with 1')
		fs.writeFileSync(webp, 'RIFF----WEBP')
	}

	const results = applyImageOptimization(plan, { convert })

	const bad = results.find((r) => r.png.endsWith('bad.png'))
	assert.match(bad.error, /ffmpeg exited with 1/)
	assert.ok(fs.existsSync(fixturePath(root, 'shots/bad.png')))
	assert.ok(!fs.existsSync(fixturePath(root, 'shots/good.png')))
	assert.ok(fs.existsSync(fixturePath(root, 'shots/good.webp')))
})

test('applyImageOptimization: 変換器が WebP を書かなかった / 空だった場合も PNG を残す', () => {
	const root = makeSite({ 'shots/none.png': PNG, 'shots/empty.png': PNG })
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'shots') })
	const convert = (png, webp) => {
		if (png.endsWith('empty.png')) fs.writeFileSync(webp, '')
	}

	const results = applyImageOptimization(plan, { convert })

	assert.ok(results.every((r) => /WebP ができていません/.test(r.error)))
	assert.ok(fs.existsSync(fixturePath(root, 'shots/none.png')))
	assert.ok(fs.existsSync(fixturePath(root, 'shots/empty.png')))
	assert.ok(!fs.existsSync(fixturePath(root, 'shots/empty.webp')), '空の WebP を PNG の隣に残さない')
})

test('applyImageOptimization: 変換器が途中まで書いて失敗したら書きかけの WebP を消す', () => {
	const root = makeSite({ 'shots/partial.png': PNG })
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'shots') })
	const convert = (png, webp) => {
		fs.writeFileSync(webp, 'RIFF')
		throw new Error('ffmpeg killed')
	}

	const [result] = applyImageOptimization(plan, { convert })

	assert.match(result.error, /ffmpeg killed/)
	assert.ok(fs.existsSync(fixturePath(root, 'shots/partial.png')))
	assert.ok(!fs.existsSync(fixturePath(root, 'shots/partial.webp')))
})

test('applyImageOptimization: 失敗しても実行前からあった WebP は消さない', () => {
	const root = makeSite({ 'shots/kept.png': PNG, 'shots/kept.webp': 'RIFF----WEBP-committed' })
	const plan = planImageOptimization({ siteRoot: root, targetDir: fixturePath(root, 'shots') })
	const convert = () => {
		throw new Error('ffmpeg exited with 1')
	}

	const [result] = applyImageOptimization(plan, { convert })

	assert.match(result.error, /ffmpeg exited with 1/)
	assert.ok(fs.existsSync(fixturePath(root, 'shots/kept.png')))
	assert.equal(fs.readFileSync(fixturePath(root, 'shots/kept.webp'), 'utf8'), 'RIFF----WEBP-committed')
})

// --- CLI (本リポに対する読み取り専用の dry-run) -----------------------------------

const runCli = (args, cwd = SITE_ROOT) =>
	spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' })

test('CLI: 既定の dry-run は cwd に依らず screenshots だけを見てロゴを対象にしない', () => {
	const r = runCli([], os.tmpdir())
	assert.equal(r.status, 0, r.stderr)
	assert.match(r.stdout, /対象: assets\/img\/screenshots/)
	assert.doesNotMatch(r.stdout, /assets\/img\/logo-font\.png/)
})

test('CLI: assets/img を明示した dry-run は JSON-LD のロゴを保護対象として一覧に出す', () => {
	const r = runCli(['assets/img'])
	assert.equal(r.status, 0, r.stderr)
	assert.match(r.stdout, /\[KEEP\] assets\/img\/logo-font\.png .*_includes\/schema\/organization\.html/)
	assert.doesNotMatch(r.stdout, /\[DRY\] assets\/img\/logo-font\.png/)
})

test('CLI: 不明なオプションと存在しないディレクトリは exit 2 で何もしない', () => {
	const unknown = runCli(['--aply'])
	assert.equal(unknown.status, 2)
	assert.match(unknown.stderr, /不明なオプション: --aply/)
	const missing = runCli(['--apply', 'no-such-dir-t522'])
	assert.equal(missing.status, 2)
	assert.match(missing.stderr, /対象ディレクトリがありません/)
})
