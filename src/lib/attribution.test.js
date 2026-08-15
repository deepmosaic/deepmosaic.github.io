// 流入経路の引き継ぎの回帰テスト (TICKET-SITE-37)。
//
//   node --test src/lib/attribution.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// **値の出所は着地 URL のクエリ = 攻撃者が自由に作れる**ので、正常系より
// 「壊れた入力で href を壊さないこと」の確認に重心を置いている。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTR_TTL_MS,
  attributionFromLanding,
  decorateDownloadUrl,
  externalReferrerOrigin,
  ga4FileDownloadParams,
  mergeAttribution,
  parseStoredAttribution,
  parseStoredEnvelope,
  sanitizeParam,
  serializeAttribution,
  serializeStored,
} from './attribution.js';

const SITE = 'https://www.deepmosaic.co.jp';
const DL = 'https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows';

// ── sanitizeParam ───────────────────────────────────────────────────────────

test('sanitizeParam は普通のキャンペーン名を通す', () => {
  assert.equal(sanitizeParam('summer-sale_2026', 200), 'summer-sale_2026', '英数と記号は通る');
  assert.equal(sanitizeParam('  twitter  ', 200), 'twitter', '前後の空白は落ちる');
});

test('sanitizeParam は許可リスト外を丸ごと弾く', () => {
  assert.equal(sanitizeParam('<script>', 200), null, 'タグは通さない');
  assert.equal(sanitizeParam('a&b', 200), null, 'クエリ区切りは通さない');
  assert.equal(sanitizeParam('a#b', 200), null, 'fragment 区切りは通さない');
  assert.equal(sanitizeParam('夏キャンペーン', 200), null, '日本語は通さない (ローマ字運用)');
  assert.equal(sanitizeParam('a\nb', 200), null, '改行は通さない');
});

test('sanitizeParam は文字列でないものを null にする', () => {
  assert.equal(sanitizeParam(null, 200), null, 'null');
  assert.equal(sanitizeParam(undefined, 200), null, 'undefined');
  assert.equal(sanitizeParam(123, 200), null, '数値');
  assert.equal(sanitizeParam('', 200), null, '空文字');
  assert.equal(sanitizeParam('   ', 200), null, '空白だけ');
});

// 切らないと DL URL が URL 長制限に当たり、ダウンロード自体が壊れる
test('sanitizeParam は上限で切る', () => {
  assert.equal(sanitizeParam('x'.repeat(100000), 200).length, 200, '10万文字でも 200 で止まる');
});

// ── externalReferrerOrigin ──────────────────────────────────────────────────

test('externalReferrerOrigin は外部サイトの origin だけを返す', () => {
  assert.equal(
    externalReferrerOrigin('https://www.google.com/search?q=mosaic', SITE),
    'https://www.google.com',
    'パスとクエリ (検索語) は落とす',
  );
  assert.equal(externalReferrerOrigin('https://t.co:8443/x', SITE), 'https://t.co:8443', 'ポートは残す');
});

test('externalReferrerOrigin は自サイト内の回遊で上書きしない', () => {
  assert.equal(externalReferrerOrigin(`${SITE}/price`, SITE), null, '同一オリジンは流入ではない');
});

// `startsWith` 実装だとこれを自サイトと誤判定し、外部からの流入を取りこぼす
test('externalReferrerOrigin は自ドメインを接頭辞に持つ別ドメインを外部と判定する', () => {
  assert.equal(
    externalReferrerOrigin('https://www.deepmosaic.co.jp.evil.com/x', SITE),
    'https://www.deepmosaic.co.jp.evil.com',
    'ホストが違えば外部',
  );
});

// 単純な文字列比較だとサイト内回遊が「外部からの流入」として記録され、
// 正規の流入経路を上書きしてしまう (レビュー LOW)
test('externalReferrerOrigin は末尾ドット付きの自ホストを自サイトと見なす', () => {
  assert.equal(externalReferrerOrigin(`${SITE}./x`, SITE), null, 'DNS 的には同じホスト');
  assert.equal(
    externalReferrerOrigin('https://other.example./x', SITE),
    'https://other.example.',
    '別ホストなら末尾ドットでも外部',
  );
});

test('externalReferrerOrigin は直接アクセスと不正な値を null にする', () => {
  assert.equal(externalReferrerOrigin('', SITE), null, '直接アクセスは空文字');
  assert.equal(externalReferrerOrigin(null, SITE), null, 'null');
  assert.equal(externalReferrerOrigin('javascript:alert(1)', SITE), null, 'javascript: は弾く');
  assert.equal(externalReferrerOrigin('data:text/html,x', SITE), null, 'data: は弾く');
  assert.equal(externalReferrerOrigin('not a url', SITE), null, 'URL でない');
  assert.equal(externalReferrerOrigin(`https://e.example/${'x'.repeat(4000)}`, SITE), null, '長大な値');
});

// ── attributionFromLanding ──────────────────────────────────────────────────

test('attributionFromLanding は utm を 3 つとも拾う', () => {
  const r = attributionFromLanding({
    search: '?utm_source=twitter&utm_medium=social&utm_campaign=launch',
    referrer: '',
    origin: SITE,
  });
  assert.deepEqual(r, { s: 'twitter', m: 'social', c: 'launch', r: null }, '3 つとも入る');
});

test('attributionFromLanding は utm が一部でも記録する', () => {
  const r = attributionFromLanding({ search: '?utm_source=hn', referrer: '', origin: SITE });
  assert.equal(r.s, 'hn', 'source だけでも記録する');
  assert.equal(r.m, null, '無い項目は null');
});

test('attributionFromLanding は外部 referrer だけでも記録する', () => {
  const r = attributionFromLanding({ search: '', referrer: 'https://news.ycombinator.com/x', origin: SITE });
  assert.equal(r.r, 'https://news.ycombinator.com', 'referrer だけでも経路になる');
});

// これが null を返すことが「sessionStorage を上書きしない」の合図になる
test('attributionFromLanding は記録するものが無ければ null', () => {
  assert.equal(attributionFromLanding({ search: '', referrer: '', origin: SITE }), null, '直接アクセス');
  assert.equal(
    attributionFromLanding({ search: '?foo=bar', referrer: `${SITE}/price`, origin: SITE }),
    null,
    'サイト内回遊 + utm 以外のクエリ',
  );
});

test('attributionFromLanding は壊れたクエリでも落ちない', () => {
  assert.doesNotThrow(
    () => attributionFromLanding({ search: '?%', referrer: '', origin: SITE }),
    '不正なパーセントエンコードで例外を投げない',
  );
});

// ── mergeAttribution ────────────────────────────────────────────────────────

test('mergeAttribution は新しい着地で record ごと差し替える', () => {
  const stored = { s: 'google', m: 'organic', c: null, r: 'https://www.google.com' };
  const landing = { s: 'twitter', m: 'social', c: 'launch', r: null };
  assert.deepEqual(mergeAttribution(stored, landing), landing, 'last non-direct');
});

// 項目ごとにマージすると「utm_source=twitter なのに r=google」という
// どちらの経路でもない行ができる
test('mergeAttribution は項目ごとに混ぜない', () => {
  const stored = { s: 'google', m: 'organic', c: null, r: 'https://www.google.com' };
  const landing = { s: 'twitter', m: null, c: null, r: null };
  assert.equal(mergeAttribution(stored, landing).r, null, '古い referrer は残さない');
});

test('mergeAttribution は着地に何も無ければ保存済みを保つ', () => {
  const stored = { s: 'google', m: null, c: null, r: null };
  assert.deepEqual(mergeAttribution(stored, null), stored, 'サイト内回遊で消さない');
  assert.equal(mergeAttribution(null, null), null, 'どちらも無ければ null');
});

// ── serialize / parse ───────────────────────────────────────────────────────

test('serialize と parse は往復する', () => {
  const r = { s: 'twitter', m: 'social', c: 'launch', r: 'https://t.co' };
  assert.deepEqual(parseStoredAttribution(serializeAttribution(r)), r, '往復で変わらない');
});

// sessionStorage は開発者ツールで書き換えられる。読み出し時にも検証する
test('parseStoredAttribution は保存済みの値を再検証する', () => {
  assert.equal(parseStoredAttribution('{"s":"<script>"}'), null, 'タグは潰れて record ごと null');
  assert.equal(parseStoredAttribution('{"s":"ok","m":"<script>"}').m, null, '不正な項目だけ null');
  assert.equal(parseStoredAttribution('{"s":"ok","m":"<script>"}').s, 'ok', '正常な項目は残る');
});

test('parseStoredAttribution は壊れた JSON で落ちない', () => {
  assert.equal(parseStoredAttribution('{'), null, '壊れた JSON');
  assert.equal(parseStoredAttribution('[]'), null, '配列');
  assert.equal(parseStoredAttribution('null'), null, 'null リテラル');
  assert.equal(parseStoredAttribution('"x"'), null, '文字列');
  assert.equal(parseStoredAttribution(''), null, '空文字');
  assert.equal(parseStoredAttribution(null), null, 'null');
});

// ── decorateDownloadUrl ─────────────────────────────────────────────────────

test('decorateDownloadUrl は utm と ref を載せる', () => {
  const out = decorateDownloadUrl(DL, { s: 'twitter', m: 'social', c: 'launch', r: 'https://t.co' });
  const q = new URL(out).searchParams;
  assert.equal(q.get('utm_source'), 'twitter', 'utm_source');
  assert.equal(q.get('utm_medium'), 'social', 'utm_medium');
  assert.equal(q.get('utm_campaign'), 'launch', 'utm_campaign');
  assert.equal(q.get('ref'), 'https://t.co', 'ref');
  assert.ok(out.startsWith(DL), 'base は変えない');
});

test('decorateDownloadUrl は record が null なら 1 文字も変えない', () => {
  assert.equal(decorateDownloadUrl(DL, null), DL, '流入経路が無ければ素の href のまま');
});

// 二度呼んでも増えない (読み込み時 + クリック時の二重装飾を許すため)
test('decorateDownloadUrl は冪等', () => {
  const r = { s: 'twitter', m: null, c: null, r: null };
  const once = decorateDownloadUrl(DL, r);
  assert.equal(decorateDownloadUrl(once, r), once, '2 回目で値が増えない');
});

test('decorateDownloadUrl は既存のクエリを壊さない', () => {
  const out = decorateDownloadUrl(`${DL}?keep=1`, { s: 'x', m: null, c: null, r: null });
  const q = new URL(out).searchParams;
  assert.equal(q.get('keep'), '1', '既存のパラメータは残る');
  assert.equal(q.get('utm_source'), 'x', '新しいパラメータも入る');
});

test('decorateDownloadUrl は href が URL でなければそのまま返す', () => {
  assert.equal(decorateDownloadUrl('not a url', { s: 'x', m: null, c: null, r: null }), 'not a url');
});

// ── ga4FileDownloadParams ───────────────────────────────────────────────────

test('ga4FileDownloadParams は公式パラメータ名で組む', () => {
  const p = ga4FileDownloadParams({
    href: `${DL}?utm_source=x`,
    text: '  無料でダウンロード  ',
    id: 'hero',
    classes: 'btn-primary btn-lg',
  });
  assert.equal(p.file_extension, 'exe', '配布物は exe');
  assert.equal(p.file_name, '/download/latest/windows', 'パス形式 (拡張計測の定義に合わせる)');
  assert.equal(p.link_url, `${DL}?utm_source=x`, 'utm 込みの最終 URL');
  assert.equal(p.link_text, '無料でダウンロード', '前後の空白は落とす');
  assert.equal(p.link_id, 'hero', 'どのボタンか');
});

test('ga4FileDownloadParams は欠けた値でも落ちない', () => {
  const p = ga4FileDownloadParams({ href: 'not a url', text: undefined, id: undefined, classes: undefined });
  assert.equal(p.link_text, '', 'text 無し');
  assert.equal(p.link_id, '', 'id 無し');
  assert.equal(p.file_name, 'not a url', 'パースできなければ href をそのまま');
});

// ── 保存層のエンベロープ (T-007) ────────────────────────────────────────────
//
// 以前は sessionStorage に素の record を入れていたため、タブを閉じた時点で流入元が
// 消えていた (「Google で見つけて後日ダウンロード」が全部 direct になる)。
// localStorage へ広げるが永続に残すのは筋が悪いので有効期限を持たせる。

const REC = { s: 'google', m: null, c: null, r: 'https://www.google.com' };
const T0 = 1_700_000_000_000;

test('保存期間は 30 日', () => {
  // 「30 日」は cookie.html の記載と対になっている。変えるなら両方直すこと
  assert.equal(ATTR_TTL_MS, 30 * 86_400_000);
});

test('serializeStored / parseStoredEnvelope は往復する', () => {
  const json = serializeStored(REC, T0);
  const back = parseStoredEnvelope(json, T0 + 1000);
  assert.deepEqual(back, REC);
});

test('期限切れは null (境界ちょうども切る)', () => {
  const json = serializeStored(REC, T0);
  assert.notEqual(parseStoredEnvelope(json, T0 + ATTR_TTL_MS - 1), null, '期限内は残る');
  assert.equal(parseStoredEnvelope(json, T0 + ATTR_TTL_MS), null, '境界ちょうどは切る');
  assert.equal(parseStoredEnvelope(json, T0 + ATTR_TTL_MS + 1), null, '期限後は切る');
});

// T-007 のリリースをまたいだセッションの流入元を落とさない。
// **1 リリースで外してよい** (sessionStorage はタブを閉じれば消えるため)
test('エンベロープ無しの旧形式も読める', () => {
  const v1 = serializeAttribution(REC);
  assert.deepEqual(parseStoredEnvelope(v1, T0), REC);
});

test('壊れた保存値は null (握りつぶして続行する)', () => {
  for (const bad of ['', '{', 'null', '[]', '"x"', undefined, null, '{"v":2,"a":{}}']) {
    assert.equal(parseStoredEnvelope(bad, T0), null, JSON.stringify(bad));
  }
});

// **exp が無い / 数値でないエンベロープは信用しない。** 開発者ツールで
// exp を消せば無期限になる、という抜け道を作らない
test('exp が壊れているエンベロープは null', () => {
  for (const exp of ['9999999999999', null, undefined, NaN, Infinity]) {
    const json = JSON.stringify({ v: 2, exp, a: REC });
    assert.equal(parseStoredEnvelope(json, T0), null, String(exp));
  }
});

// 保存値も外部入力。中身は parseStoredAttribution が全項目を再検証する
test('エンベロープの中身も再検証される', () => {
  const json = JSON.stringify({ v: 2, exp: T0 + 1000, a: { s: '<script>', m: null, c: null, r: null } });
  assert.equal(parseStoredEnvelope(json, T0), null, '使えない文字は落ちて record が空になる');
});

test('record が null なら空文字を保存する', () => {
  assert.equal(serializeStored(null, T0), '');
  assert.equal(parseStoredEnvelope('', T0), null);
});
