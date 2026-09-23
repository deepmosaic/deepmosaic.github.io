#!/usr/bin/env node
// サイトの画像を WebP へ変換する (TICKET-SITE-13 / T-522)。
//
//   node scripts/optimize-images.mjs                     # assets/img/screenshots/ の対象を表示するだけ
//   node scripts/optimize-images.mjs --apply             # 同上を変換して元 PNG を削除
//   node scripts/optimize-images.mjs <dir> [--apply]     # 対象ディレクトリを明示 (cwd 基準、直下の PNG のみ)
//
// 既定の対象は **assets/img/screenshots/ だけ** で、どこから実行しても同じ (サイトのルートは
// このファイルの位置から求める)。サイトの原稿 (HTML / _includes / JSON-LD / Markdown / YAML /
// CSS / アイランド) から参照されている PNG は [KEEP] と表示し、--apply でも変換・削除しない
// (T-522: 以前はリポのルートで --apply すると assets/img/ 直下の logo-font.png まで消え、
// JSON-LD のロゴが 404 になった)。判定ロジックは src/lib/image-optimize.js (`npm test` で検証)。
//
// ## なぜスクリプトにするか
//
// スクリーンショットは desktop リポの `node scripts/e2e/screenshots.mjs` が **PNG で**
// 出力し、それを手で `assets/img/screenshots/` にコピーする運用になっている。
// 変換を手作業にすると、次にスクショを撮り直したときに PNG に戻って
// **参照だけ .webp のまま残り画像が消える**。コピー後に必ず本スクリプトを通すこと。
//
// ## ビルドに組み込まない理由
//
// Jekyll プラグイン (jekyll-picture-tag 等) は ImageMagick / libvips を CI ランナーに
// 要求する。年数回しか変わらないアセットのためにデプロイの故障点を増やしたくない。
// Vite に通すと `/assets/img/…` の URL が全部変わってしまう。
// ローカルで変換してコミットするのが、CI 不変・レビュー時に実物を確認できる点で最良。
//
// ## 依存
//
// ffmpeg (libwebp 付き)。`ffmpeg -encoders | grep webp` で確認できる。
// PATH に無ければ環境変数 FFMPEG で場所を指定する。
//
// 終了コード: 0 = 正常 / 1 = 変換に失敗した PNG がある (その PNG は残る) / 2 = 引数・対象の誤り (何もしない)
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	applyImageOptimization,
	parseOptimizeArgs,
	planImageOptimization,
	resolveTargetDir,
} from '../src/lib/image-optimize.js'

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const QUALITY = 82

const kb = (n) => (n / 1024).toFixed(0).padStart(6)

/** サイト内はルートからの相対 (posix)、サイト外は絶対パスで表示する。 */
function show(p) {
	const rel = path.relative(SITE_ROOT, p)
	if (rel === '') return '.'
	if (rel.startsWith('..') || path.isAbsolute(rel)) return p
	return rel.split(path.sep).join('/')
}

function convertWithFfmpeg(png, webp) {
	execFileSync(FFMPEG, [
		'-hide_banner', '-loglevel', 'error', '-y',
		'-i', png,
		'-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '6',
		webp,
	])
}

function printPlan(plan, apply) {
	const total = plan.convert.length + plan.protected.length + plan.skipped.length
	console.log(`対象: ${show(plan.targetDir)} (直下の PNG ${total} 枚)`)
	if (!apply) {
		for (const { png, webp, bytes } of plan.convert) {
			console.log(`  [DRY] ${show(png)} → ${path.basename(webp)} (${kb(bytes)} KB)`)
		}
	}
	for (const { png, referrers } of plan.protected) {
		console.log(`  [KEEP] ${show(png)} ← ${referrers.join(', ')} (参照されているので変換も削除もしない)`)
	}
	for (const { png, reason } of plan.skipped) {
		console.log(`  [SKIP] ${show(png)} (${reason})`)
	}
}

function runApply(plan) {
	const results = applyImageOptimization(plan, { convert: convertWithFfmpeg })
	let before = 0
	let after = 0
	const failed = results.filter((r) => r.error)
	for (const r of results) {
		if (r.error) {
			console.log(`  [FAIL] ${show(r.png)}: ${r.error}`)
			continue
		}
		before += r.before
		after += r.after
		console.log(`  ${kb(r.before)} KB → ${kb(r.after)} KB  ${show(r.webp)}`)
	}
	const done = results.length - failed.length
	console.log('  ------')
	console.log(`  ${kb(before)} KB → ${kb(after)} KB  (${done} 枚 / 削減 ${kb(before - after)} KB / 保護 ${plan.protected.length} 枚)`)
	console.log('\n参照の更新を忘れずに: grep -rn "\\.png" --include="*.html" .')
	return failed.length === 0 ? 0 : 1
}

function main(argv) {
	let options
	let plan
	try {
		options = parseOptimizeArgs(argv)
		const targetDir = resolveTargetDir(options.dir, { cwd: process.cwd(), siteRoot: SITE_ROOT })
		plan = planImageOptimization({ siteRoot: SITE_ROOT, targetDir })
	} catch (err) {
		console.error(`optimize-images: ${err instanceof Error ? err.message : String(err)}`)
		console.error('使い方: node scripts/optimize-images.mjs [<dir>] [--apply]  (何も変更していません)')
		return 2
	}
	printPlan(plan, options.apply)
	if (options.apply) return runApply(plan)
	const bytes = plan.convert.reduce((sum, it) => sum + it.bytes, 0)
	console.log('  ------')
	console.log(
		`  ${plan.convert.length} 枚が対象 (${kb(bytes)} KB) / 保護 ${plan.protected.length} 枚。実行するには --apply を付けてください。`,
	)
	return 0
}

process.exitCode = main(process.argv.slice(2))
