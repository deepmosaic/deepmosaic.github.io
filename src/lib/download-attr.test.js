// `<a download>` の属性値の回帰テスト (T-231)。
//
//   node --test src/lib/download-attr.test.js
//
// `download` は真偽属性ではないので、`true` / `false` を値にしてはいけない。
// スマホのドロワーで料金 / ドキュメントを押すと "false.html" が落ちてきたのが発端。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { downloadAttr } from './download-attr.js';

test('downloadAttr は DL 項目に空文字を返す (サーバのファイル名で保存)', () => {
  assert.equal(downloadAttr(true), '');
});

test('downloadAttr は DL 以外の項目に undefined を返す (属性を付けない)', () => {
  assert.equal(downloadAttr(false), undefined);
  assert.equal(downloadAttr(undefined), undefined, 'data-links に download が無い項目');
  assert.equal(downloadAttr(null), undefined);
});

// 真偽値を文字列化した "true" / "false" がファイル名になるのが本件のバグ
test('downloadAttr の戻り値は常に \'\' か undefined', () => {
  for (const v of [true, false, undefined, null, 0, 1, '', 'x', {}, []]) {
    const out = downloadAttr(v);
    assert.ok(out === '' || out === undefined, `${JSON.stringify(v)} → ${String(out)}`);
  }
});
