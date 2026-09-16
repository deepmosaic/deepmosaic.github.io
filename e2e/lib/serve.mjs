#!/usr/bin/env node
// E2E 用の静的配信サーバ (T-286)。
//
//   node e2e/lib/serve.mjs            # _site/ を http://127.0.0.1:4173 で配信
//   E2E_PORT=4174 node e2e/lib/serve.mjs
//
// ## なぜ jekyll serve ではないのか
//
// Playwright の `webServer` が待つのは「HTTP が返ってくること」だけで、Jekyll の
// dev server を使うと **Ruby のプロセス管理が Windows で噛み合わない**
// (CLAUDE.md: `--detach` は fork() 未実装で不可)。ここで検証したいのは
// **CI が公開するのと同じ `_site/` の中身**なので、生成物をそのまま配るのが
// 一番近い。依存も増えない (node:http だけ)。
//
// ## 契約
//
// - ルートは `_site/`。**無ければ起動せずに落ちる** (空の 404 を配って
//   「フォームが無い」と誤診されるのを防ぐ)。
// - `/enterprise/inquiry/` のような末尾スラッシュは `index.html` に解決する。
//   GitHub Pages と同じ見え方にするため、拡張子なしのパスも
//   `<path>/index.html` → `<path>.html` の順で探す。
// - 見つからなければ `_site/404.html` を **404 のまま**返す (200 で返すと
//   リンク切れが E2E をすり抜ける)。
// - `Cache-Control: no-store`。再ビルド直後の実行で古い app.js を掴ませない。
// - `..` や絶対パスでルート外に出る要求は 403。
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = path.join(ROOT, '_site');
const PORT = Number(process.env.E2E_PORT ?? 4173);
const HOST = '127.0.0.1';

/** 拡張子 → Content-Type。**未知の拡張子は octet-stream** (勝手に text/html にしない)。 */
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
});

/**
 * URL のパス部を `_site/` 配下の実ファイルへ解決する。
 *
 * @param {string} rawPath `req.url` のパス部 (クエリ・ハッシュ除去済み)
 * @returns {{ kind: 'file', file: string } | { kind: 'missing' } | { kind: 'forbidden' }}
 */
function resolveFile(rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { kind: 'forbidden' }; // 壊れた %エスケープ
  }
  if (decoded.includes('\0')) return { kind: 'forbidden' };

  const normalized = path.normalize(path.join(SITE, decoded));
  // `path.join` は `..` を畳んでしまうので、**畳んだ後**にルート配下かを見る
  if (normalized !== SITE && !normalized.startsWith(SITE + path.sep)) return { kind: 'forbidden' };

  const endsWithSlash = decoded.endsWith('/');
  const candidates = endsWithSlash
    ? [path.join(normalized, 'index.html')]
    : [normalized, path.join(normalized, 'index.html'), `${normalized}.html`];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    if (!statSync(candidate).isFile()) continue;
    return { kind: 'file', file: candidate };
  }
  return { kind: 'missing' };
}

function send(res, status, file, method) {
  res.writeHead(status, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': statSync(file).size,
    'Cache-Control': 'no-store',
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

function sendText(res, status, body, method) {
  const buf = Buffer.from(body, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
  res.end(method === 'HEAD' ? undefined : buf);
}

const server = createServer((req, res) => {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    sendText(res, 405, 'Method Not Allowed', method);
    return;
  }
  const rawPath = (req.url ?? '/').split('?')[0].split('#')[0];
  const result = resolveFile(rawPath);
  if (result.kind === 'forbidden') {
    sendText(res, 403, 'Forbidden', method);
    return;
  }
  if (result.kind === 'missing') {
    const notFound = path.join(SITE, '404.html');
    if (existsSync(notFound)) send(res, 404, notFound, method);
    else sendText(res, 404, 'Not Found', method);
    return;
  }
  send(res, 200, result.file, method);
});

if (!existsSync(SITE)) {
  console.error(
    `[e2e/serve] ${SITE} が見つかりません。先に \`npm run build && bundle exec jekyll build\` を実行してください。`,
  );
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`[e2e/serve] http://${HOST}:${PORT}/ で ${SITE} を配信しています`);
});

// Playwright の webServer は SIGTERM で止める。ストリーム中の接続を待たずに閉じる。
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
