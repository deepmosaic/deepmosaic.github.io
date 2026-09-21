// 動作環境 (/spec/) の文言を固定する回帰テスト (T-333)。
//
//   node --test src/lib/spec-requirements.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// 守るのは 2 点。
//
//   1. **撤去した行が戻らないこと** — WebView2 の「ランタイム」行は
//      インストーラが自動導入するものでユーザーが用意する条件ではないため、
//      動作環境の表からは外した (説明は docs 第 1 章「インストール」に残っている)。
//   2. **必要容量の表記が 3 ファイルで食い違わないこと** — 正は
//      `_data/spec.yml` のストレージ行で、`_data/entity.yml` の
//      `software_requirements` (JSON-LD) と `_includes/docs/06-ops.html` は
//      その手書きの写し。片方だけ直すと実在しない条件を広告することになる
//      (`docs-team-seats.test.js` が docs で守っているのと同じ構図)。
//
// 読み取りはこのファイル内で完結させる (spec.yml に他の読み手がいないため lib 化しない)。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_YML = join(HERE, '..', '..', '_data', 'spec.yml');
const ENTITY_YML = join(HERE, '..', '..', '_data', 'entity.yml');
const OPS_DOC = join(HERE, '..', '..', '_includes', 'docs', '06-ops.html');

/**
 * `_data/spec.yml` のトップレベルの節 (`windows:` / `network:` …) を
 * `{ key, val }` の配列で読む極小パーサ。対応するのは実際に使っている形
 * (`  - key: "…"` / `    val: "…"`) だけで、節が無ければ空配列を返す。
 *
 * @param {string} yml
 * @param {string} section
 * @returns {{key: string, val: string}[]}
 */
function loadSection(yml, section) {
  const lines = yml.split(/\r?\n/);
  const start = lines.findIndex((l) => l === `${section}:`);
  if (start < 0) return [];

  const rows = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const key = line.match(/^ {2}- key: "(.*)"$/);
    if (key) {
      rows.push({ key: key[1], val: '' });
      continue;
    }

    const val = line.match(/^ {4}val: "(.*)"$/);
    if (val && rows.length > 0) {
      rows[rows.length - 1].val = val[1];
      continue;
    }

    if (!/^ /.test(line)) break; // 節の外に出た
  }
  return rows;
}

/** `.kv-val` などのタグを落とした素の文字列。 */
const textOf = (html) => html.replace(/<[^>]*>/g, '');

const specYml = readFileSync(SPEC_YML, 'utf8');
const windows = loadSection(specYml, 'windows');
const network = loadSection(specYml, 'network');

/** 容量表記の正 (例: `10GB程度`)。手書きの写しはこれと一致していなければならない。 */
const storageRows = windows.filter((r) => r.key === 'ストレージ');
const storageSize = (storageRows[0]?.val ?? '').match(/\d+GB程度/)?.[0] ?? '';

/** 撤去した「約 nnGB」形の表記 (これが残っていると SSOT から外れる)。 */
const APPROX_SIZE = /約\s*\d+\s*GB/;

test('loadSection は節が無ければ空を返す (検査のすり抜けを防ぐ)', () => {
  // Arrange / Act
  const rows = loadSection(specYml, '存在しない節');

  // Assert
  assert.deepEqual(rows, []);
});

test('loadSection は windows の行を key / val で読める', () => {
  // Arrange / Act
  const os = windows.filter((r) => r.key === 'OS');

  // Assert
  assert.equal(os.length, 1);
  assert.match(os[0].val, /Windows 10 \/ 11/);
});

test('動作環境の表に「ランタイム」の行が無い (T-333 で撤去)', () => {
  // Arrange / Act
  const runtime = windows.filter((r) => r.key === 'ランタイム');

  // Assert
  assert.deepEqual(runtime, [], 'ランタイム行が動作環境の表に戻っている');
});

test('動作環境の表が WebView2 を必要条件として挙げていない', () => {
  // Arrange / Act
  const mentions = windows.filter((r) => `${r.key}${r.val}`.includes('WebView2'));

  // Assert
  assert.deepEqual(mentions, []);
});

test('ストレージの行はちょうど 1 つで、容量は「nnGB程度」で書く', () => {
  // Arrange / Act / Assert
  assert.equal(storageRows.length, 1, `ストレージ行が ${storageRows.length} 個ある`);
  assert.ok(storageSize !== '', `容量が「nnGB程度」の形で書かれていない: ${storageRows[0]?.val}`);
  assert.ok(!APPROX_SIZE.test(storageRows[0].val), `旧表記が残っている: ${storageRows[0].val}`);
});

test('entity.yml の software_requirements は spec.yml と同じ容量表記を使う', () => {
  // Arrange
  const entity = readFileSync(ENTITY_YML, 'utf8');
  const [, requirements] = entity.match(/^software_requirements: "(.*)"$/m) ?? [];
  assert.ok(requirements, 'entity.yml に software_requirements が無い');
  assert.ok(storageSize !== '', 'spec.yml から容量の正を読めていない');

  // Act / Assert
  assert.ok(requirements.includes(storageSize), `${storageSize} が書かれていない: ${requirements}`);
  assert.ok(!APPROX_SIZE.test(requirements), `旧表記が残っている: ${requirements}`);
});

test('docs 第 6 章の容量表記も spec.yml に揃っている (2 箇所)', () => {
  // Arrange
  assert.ok(storageSize !== '', 'spec.yml から容量の正を読めていない');
  const text = textOf(readFileSync(OPS_DOC, 'utf8'));

  // Act
  const hits = text.match(new RegExp(storageSize, 'g')) ?? [];

  // Assert
  assert.equal(hits.length, 2, `${storageSize} の記載が ${hits.length} 箇所 (保存先の表とアンインストールの 2 箇所)`);
  assert.ok(!APPROX_SIZE.test(text), '旧表記 (約 nnGB) が docs に残っている');
});

test('初回セットアップの通信の説明は「実行ファイル等」と書く (AI モデルに限らない)', () => {
  // Arrange
  const rows = network.filter((r) => r.key === '初回セットアップ');
  assert.equal(rows.length, 1, `初回セットアップ行が ${rows.length} 個ある`);

  // Act / Assert
  assert.equal(rows[0].val, '実行ファイル等のダウンロードに通信が必要です');
});
