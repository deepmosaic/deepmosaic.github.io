// sitemap の lastmod (_plugins/last_modified_at.rb) と控えを書く道具 (scripts/write-lastmod.rb) の仕様テスト。
//
//   node --test src/lib/sitemap-lastmod.test.js
//
//   - 一時の git リポに小さなサイトを作り、`bundle exec jekyll build` の sitemap.xml を読む
//   - 履歴の最初のコミットしか当たらないページは控え (_data/lastmod.yml) の日時、控えに無ければそのコミットの日時
//   - 後のコミットが当たるページ (自分のファイル・追加のパス) は git の日時で、控えの値は使わない
//   - 浅いクローンでは lastmod を出さない
//   - 道具は今のプラグインが入れる日時を UTC の表記で書き、2 回回しても同じ内容になる
//   - Ruby / Bundler / jekyll が無い環境 (CI の npm test はビルドの前に走る) では skip

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BUNDLE_ENV = { ...process.env, BUNDLE_GEMFILE: join(ROOT, 'Gemfile'), JEKYLL_ENV: 'development' }

// bundle は Windows では .bat なので、shell を通さず ruby -S で呼ぶ
const bundle = (args, cwd) => spawnSync('ruby', ['-S', 'bundle', ...args], { cwd, env: BUNDLE_ENV, encoding: 'utf8' })
const HAS_JEKYLL = bundle(['exec', 'jekyll', '--version'], ROOT).status === 0
const SKIP = HAS_JEKYLL ? false : 'bundle exec jekyll が使えない'

const ROOT_DATE = '2025-06-01T00:00:00+00:00'
const SNAPSHOT = {
	'a.html': '2024-01-02T03:04:05+00:00',
	'b.html': '2020-01-01T00:00:00+00:00',
	'price.html': '2024-02-03T04:05:06+00:00',
}

function check(r, what) {
	assert.equal(r.status, 0, `${what}\n${r.stdout}\n${r.stderr}`)
	return r
}
const run = (cmd, args, cwd, env = process.env) => check(spawnSync(cmd, args, { cwd, env, encoding: 'utf8' }), `${cmd} ${args.join(' ')}`)
const runBundle = (args, cwd) => check(bundle(args, cwd), `bundle ${args.join(' ')}`)

function commit(dir, message, date) {
	const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
	run('git', ['add', '-A'], dir)
	run('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message], dir, env)
}

const page = (title) => `---\ntitle: ${title}\n---\n<p>${title}</p>\n`

/** 1 つのコミット (ルート) だけの小さなサイトを作る */
function makeSite(dir, snapshot = SNAPSHOT) {
	mkdirSync(join(dir, '_plugins'), { recursive: true })
	mkdirSync(join(dir, '_data'), { recursive: true })
	copyFileSync(join(ROOT, '_plugins', 'last_modified_at.rb'), join(dir, '_plugins', 'last_modified_at.rb'))
	writeFileSync(
		join(dir, '_config.yml'),
		'url: https://example.com\nplugins:\n  - jekyll-sitemap\nlast_modified_at_extra_paths:\n  price.html: [_data/plans.yml]\n',
	)
	for (const name of ['a', 'b', 'c', 'price']) writeFileSync(join(dir, `${name}.html`), page(name))
	writeFileSync(join(dir, '_data', 'plans.yml'), 'free: 0\n')
	const lines = Object.entries(snapshot).map(([k, v]) => `"${k}": "${v}"`)
	writeFileSync(join(dir, '_data', 'lastmod.yml'), lines.join('\n') + '\n')
	run('git', ['init', '-q', '-b', 'main'], dir)
	run('git', ['config', 'core.autocrlf', 'false'], dir)
	commit(dir, 'site', ROOT_DATE)
}

/** jekyll build して sitemap の { '/a.html': 'UTC の ISO 文字列' | null } を返す */
function buildLastmod(dir) {
	runBundle(['exec', 'jekyll', 'build', '--quiet', '--disable-disk-cache', '-s', dir, '-d', join(dir, '_site')], dir)
	const xml = readFileSync(join(dir, '_site', 'sitemap.xml'), 'utf8')
	const out = {}
	for (const [, body] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
		const loc = body.match(/<loc>([^<]*)<\/loc>/)[1].replace('https://example.com', '')
		const lastmod = (body.match(/<lastmod>([^<]*)<\/lastmod>/) ?? [])[1]
		out[loc] = lastmod === undefined ? null : new Date(lastmod).toISOString()
	}
	return out
}

const iso = (s) => new Date(s).toISOString()

function withTemp(fn) {
	const dir = mkdtempSync(join(tmpdir(), 'sitemap-lastmod-'))
	try {
		return fn(dir)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}

test('lastmod: ルートのコミットしか当たらないページは控えの日時、控えに無いページはルートの日時', { skip: SKIP }, () => {
	withTemp((dir) => {
		makeSite(dir)
		const got = buildLastmod(dir)
		assert.equal(got['/a.html'], iso(SNAPSHOT['a.html']))
		assert.equal(got['/b.html'], iso(SNAPSHOT['b.html']))
		assert.equal(got['/price.html'], iso(SNAPSHOT['price.html']))
		assert.equal(got['/c.html'], iso(ROOT_DATE))
	})
})

test('lastmod: 後のコミットが当たるページ (自分のファイル・追加のパス) は git の日時、ほかは控えのまま', { skip: SKIP }, () => {
	withTemp((dir) => {
		makeSite(dir)
		writeFileSync(join(dir, 'b.html'), page('b2'))
		commit(dir, 'b', '2025-07-01T00:00:00+00:00')
		writeFileSync(join(dir, '_data', 'plans.yml'), 'free: 1\n')
		commit(dir, 'plans', '2025-08-01T12:00:00+09:00')
		const got = buildLastmod(dir)
		assert.equal(got['/b.html'], iso('2025-07-01T00:00:00+00:00'))
		assert.equal(got['/price.html'], iso('2025-08-01T12:00:00+09:00'))
		assert.equal(got['/a.html'], iso(SNAPSHOT['a.html']))
		assert.equal(got['/c.html'], iso(ROOT_DATE))
	})
})

test('lastmod: 控えの値が日時として読めないページはルートの日時', { skip: SKIP }, () => {
	withTemp((dir) => {
		makeSite(dir, { 'a.html': 'yesterday' })
		const got = buildLastmod(dir)
		assert.equal(got['/a.html'], iso(ROOT_DATE))
	})
})

test('lastmod: 浅いクローンでは lastmod を出さない', { skip: SKIP }, () => {
	withTemp((dir) => {
		const src = join(dir, 'src')
		mkdirSync(src)
		makeSite(src)
		writeFileSync(join(src, 'b.html'), page('b2'))
		commit(src, 'b', '2025-07-01T00:00:00+00:00')
		const shallow = join(dir, 'shallow')
		run('git', ['clone', '-q', '--depth', '1', pathToFileURL(src).href, shallow], dir)
		const got = buildLastmod(shallow)
		assert.ok(Object.keys(got).length >= 4, JSON.stringify(got))
		for (const [loc, v] of Object.entries(got)) assert.equal(v, null, `${loc} に lastmod がある`)
	})
})

test('write-lastmod: 今のプラグインが入れる日時を UTC の表記で書き、2 回目も同じ内容', { skip: SKIP }, () => {
	withTemp((dir) => {
		makeSite(dir)
		writeFileSync(join(dir, 'b.html'), page('b2'))
		commit(dir, 'b', '2025-07-01T09:00:00+09:00')
		const script = join(ROOT, 'scripts', 'write-lastmod.rb')
		runBundle(['exec', 'ruby', script, dir], dir)
		const first = readFileSync(join(dir, '_data', 'lastmod.yml'), 'utf8')
		const values = Object.fromEntries([...first.matchAll(/^"([^"]+)": "([^"]+)"$/gm)].map((m) => [m[1], m[2]]))
		assert.deepEqual(values, {
			'a.html': '2024-01-02T03:04:05+00:00',
			'b.html': '2025-07-01T00:00:00+00:00',
			'c.html': '2025-06-01T00:00:00+00:00',
			'price.html': '2024-02-03T04:05:06+00:00',
		})
		runBundle(['exec', 'ruby', script, dir], dir)
		assert.equal(readFileSync(join(dir, '_data', 'lastmod.yml'), 'utf8'), first)
	})
})

test('write-lastmod: 浅いクローンでは書かずに終了コード 1', { skip: SKIP }, () => {
	withTemp((dir) => {
		const src = join(dir, 'src')
		mkdirSync(src)
		makeSite(src)
		writeFileSync(join(src, 'b.html'), page('b2'))
		commit(src, 'b', '2025-07-01T00:00:00+00:00')
		const shallow = join(dir, 'shallow')
		run('git', ['clone', '-q', '--depth', '1', pathToFileURL(src).href, shallow], dir)
		const before = readFileSync(join(shallow, '_data', 'lastmod.yml'), 'utf8')
		const r = bundle(['exec', 'ruby', join(ROOT, 'scripts', 'write-lastmod.rb'), shallow], shallow)
		assert.equal(r.status, 1, r.stdout + r.stderr)
		assert.equal(readFileSync(join(shallow, '_data', 'lastmod.yml'), 'utf8'), before)
	})
})
