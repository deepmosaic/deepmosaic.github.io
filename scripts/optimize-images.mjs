#!/usr/bin/env node
// サイトの画像を WebP へ変換する (TICKET-SITE-13)。
//
//   node scripts/optimize-images.mjs            # 変換対象を表示するだけ
//   node scripts/optimize-images.mjs --apply    # 変換して元 PNG を削除
//
// ## なぜスクリプトにするか
//
// スクリーンショットは front リポの `node scripts/e2e/screenshots.mjs` が **PNG で**
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
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync, existsSync, unlinkSync } from 'node:fs'
import { join, extname } from 'node:path'

const APPLY = process.argv.includes('--apply')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const QUALITY = 82

/** 変換対象。favicon (`assets/img/ico/`) とロゴは対象外 (小さい / 互換性優先)。 */
const TARGET_DIRS = ['assets/img', 'assets/img/screenshots']
const SKIP = new Set(['app-icon-128.png', 'logo-font-cropped.png', 'favicon.ico'])

function listPngs() {
	const out = []
	for (const dir of TARGET_DIRS) {
		if (!existsSync(dir)) continue
		for (const name of readdirSync(dir)) {
			const p = join(dir, name)
			if (!statSync(p).isFile()) continue
			if (extname(name).toLowerCase() !== '.png') continue
			if (SKIP.has(name)) continue
			out.push(p)
		}
	}
	return out
}

const kb = (n) => (n / 1024).toFixed(0).padStart(6)
let before = 0
let after = 0
let n = 0

for (const png of listPngs()) {
	const webp = png.replace(/\.png$/i, '.webp')
	const sizeBefore = statSync(png).size
	if (!APPLY) {
		console.log(`  [DRY] ${png} → ${webp} (${kb(sizeBefore)} KB)`)
		before += sizeBefore
		n++
		continue
	}
	execFileSync(FFMPEG, [
		'-hide_banner', '-loglevel', 'error', '-y',
		'-i', png,
		'-c:v', 'libwebp', '-quality', String(QUALITY), '-compression_level', '6',
		webp,
	])
	const sizeAfter = statSync(webp).size
	unlinkSync(png)
	before += sizeBefore
	after += sizeAfter
	n++
	console.log(`  ${kb(sizeBefore)} KB → ${kb(sizeAfter)} KB  ${webp}`)
}

console.log('  ------')
if (APPLY) {
	console.log(`  ${kb(before)} KB → ${kb(after)} KB  (${n} 枚 / 削減 ${kb(before - after)} KB)`)
	console.log('\n参照の更新を忘れずに: grep -rn "\\.png" --include="*.html" .')
} else {
	console.log(`  ${n} 枚が対象 (${kb(before)} KB)。実行するには --apply を付けてください。`)
}
