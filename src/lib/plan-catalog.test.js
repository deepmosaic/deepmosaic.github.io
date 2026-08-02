// `_data/plans.yml` ↔ Supabase `plan_catalog` の突き合わせの回帰テスト
// (TICKET-SITE-CONTRACT-SSOT / 案B)。
//
//   node --test src/lib/plan-catalog.test.js
//
// ## ネットワークが無くても必ず通る
//
// 突き合わせロジックの検証は **全てスタブ**で行う。実際に Worker を叩くのは
// 末尾の 1 件だけで、`SUPABASE_PROXY_API_KEY` が無ければ skip、あっても取得に
// 失敗したら skip する。`npm test` がネットワークや Supabase の状態で
// 落ちてはいけない (デプロイを外部サービスに人質に取らせない方針の一部)。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadTiers } from './plans-yml.js';
import {
  CATALOG_URL,
  catalogIncludedMinutes,
  diffPlanCatalog,
  fetchPlanCatalog,
  siteIncludedMinutes,
} from './plan-catalog.js';

const TIERS = loadTiers();
const byCode = (code) => {
  const t = TIERS.find((x) => x.code === code);
  assert.ok(t, `plans.yml に ${code} が無い`);
  return t;
};

/**
 * plans.yml から「一致している plan_catalog」を組み立てる。
 *
 * **期待値を手書きしない** — 手書きすると plans.yml を直したときにここも直す必要が出て、
 * まさにこのチケットが潰そうとしている二重管理が復活する。ずれの検出は、この
 * 「一致する catalog」を意図的に壊して確かめる。
 */
function catalogFrom(tiers, mutate = () => {}) {
  const plans = tiers.map((t) => {
    const minutes = t.included_hours === null ? null : t.included_hours * 60;
    const pooled = t.included_basis === 'pooled';
    return {
      plan_code: t.code,
      display_name: t.name,
      monthly_price_jpy: t.price,
      included_minutes: pooled ? null : minutes,
      included_minutes_per_seat: pooled ? minutes : null,
      included_basis: t.included_basis,
      seat_based: pooled,
      min_seats: t.min_seats ?? 1,
      max_contracts: t.max_contracts,
      is_public: t.public,
      sort_order: 0,
    };
  });
  mutate(plans);
  return plans;
}

const find = (plans, code) => plans.find((p) => p.plan_code === code);

// ── plans.yml 側の前提 ──────────────────────────────────────────────────────

test('全 tier が max_contracts を持っている', () => {
  // 欠けると Liquid 側の「追加契約」行が無言で消える (`contract-quota.html` は
  // max_contracts <= 1 で空文字を返す設計なので、undefined でも空になってしまう)。
  for (const tier of TIERS) {
    assert.equal(typeof tier.max_contracts, 'number', `${tier.code}: max_contracts が無い`);
    assert.ok(tier.max_contracts >= 1, `${tier.code}: max_contracts が 1 未満`);
  }
});

test('契約本数の上限が現行の Supabase 値と一致する (回帰固定)', () => {
  // ここは Supabase `plan_catalog` の写し。実データとの一致は本ファイル末尾の
  // ライブ検査と CI (scripts/check-plan-catalog.mjs) が見る。この test は
  // 「気付かないうちに写しだけ書き換わった」のを止めるための固定。
  assert.equal(byCode('free').max_contracts, 1);
  assert.equal(byCode('light').max_contracts, 3);
  assert.equal(byCode('pro').max_contracts, 2);
  // シート単価で自己申込を塞いでいるため複数契約の対象外
  assert.equal(byCode('enterprise').max_contracts, 1);
});

test('サイトが出す合計時間は included_hours × max_contracts で導出できる', () => {
  // 「最大 3 契約（月 15 時間まで）」の 15 はどこにも手書きしない、という設計の固定。
  assert.equal(byCode('light').included_hours * byCode('light').max_contracts, 15);
  assert.equal(byCode('pro').included_hours * byCode('pro').max_contracts, 80);
});

// ── 単位換算 ────────────────────────────────────────────────────────────────

test('込み時間は分に揃えて比較する', () => {
  assert.equal(siteIncludedMinutes({ included_hours: 5 }), 300);
  assert.equal(siteIncludedMinutes({ included_hours: 40 }), 2400);
  assert.equal(siteIncludedMinutes({ included_hours: null }), null, '無制限');
  assert.equal(siteIncludedMinutes({}), undefined, 'キーが無い');
});

test('シート課金プランは included_minutes_per_seat を見る', () => {
  assert.equal(catalogIncludedMinutes({ included_minutes: 300, included_minutes_per_seat: null }), 300);
  assert.equal(catalogIncludedMinutes({ included_minutes: null, included_minutes_per_seat: 2400 }), 2400);
  // どちらも null = 無制限 (pro_legacy_unlimited)
  assert.equal(catalogIncludedMinutes({ included_minutes: null, included_minutes_per_seat: null }), null);
  // 列そのものが無い = 比較できない
  assert.equal(catalogIncludedMinutes({}), undefined);
});

// ── 一致するとき ────────────────────────────────────────────────────────────

test('plans.yml と同じ値の catalog なら errors も warnings も出ない', () => {
  const { errors, warnings, compared } = diffPlanCatalog(TIERS, catalogFrom(TIERS));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(compared, TIERS.length);
});

test('非公開プランが catalog にあっても無視する (グランドファザリング枠)', () => {
  const plans = catalogFrom(TIERS);
  plans.push({
    plan_code: 'pro_legacy_unlimited',
    monthly_price_jpy: 9800,
    included_minutes: null,
    included_minutes_per_seat: null,
    min_seats: 1,
    max_contracts: 1,
    is_public: false,
  });
  const { errors, warnings } = diffPlanCatalog(TIERS, plans);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, [], 'is_public=false は載せなくて当然なので知らせない');
});

// ── 食い違うとき (ここが落ちなければ監視の意味が無い) ────────────────────────

// ⚠️ ずらす値は **実データから導出**する (`+ 1` など)。定数を置くと、料金改定で
//    たまたま同じ値になった瞬間に「ずらしたつもりが一致している」テストに化けて、
//    検知能力が落ちたことに気付けない。

test('max_contracts のずれを検知する', () => {
  const site = byCode('light').max_contracts;
  const plans = catalogFrom(TIERS, (p) => {
    find(p, 'light').max_contracts = site + 2;
  });
  const { errors } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^light: 契約本数の上限が食い違っている/);
  assert.match(errors[0], new RegExp(`サイト ${site} 契約 / Supabase ${site + 2} 契約`));
});

test('込み時間のずれを検知する (分に揃えたうえで)', () => {
  const siteMinutes = byCode('pro').included_hours * 60;
  const plans = catalogFrom(TIERS, (p) => {
    find(p, 'pro').included_minutes = siteMinutes + 600; // 10 時間増枠された想定
  });
  const { errors } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^pro: 込み時間が食い違っている/);
  assert.match(errors[0], new RegExp(`サイト ${siteMinutes} 分 / Supabase ${siteMinutes + 600} 分`));
});

test('シート課金プランの込み時間のずれも検知する', () => {
  // Enterprise は included_minutes が null で per_seat 側に入る。ここを見落とすと
  // シート単価プランだけ突き合わせが素通りする
  const plans = catalogFrom(TIERS, (p) => {
    find(p, 'enterprise').included_minutes_per_seat = byCode('enterprise').included_hours * 60 - 600;
  });
  const { errors } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^enterprise: 込み時間が食い違っている/);
});

test('月額のずれを検知する', () => {
  const site = byCode('light').price;
  const plans = catalogFrom(TIERS, (p) => {
    find(p, 'light').monthly_price_jpy = site + 500;
  });
  const { errors } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`月額が食い違っている — サイト ${site} 円 / Supabase ${site + 500} 円`));
});

test('最低シート数のずれを検知する', () => {
  const plans = catalogFrom(TIERS, (p) => {
    find(p, 'enterprise').min_seats = byCode('enterprise').min_seats + 2;
  });
  const { errors } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /最低シート数が食い違っている/);
});

test('サイトにあって catalog に無いプランは落とす (実在しないプランの広告)', () => {
  const plans = catalogFrom(TIERS).filter((p) => p.plan_code !== 'light');
  const { errors, compared } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /実在しないプランを広告している/);
  assert.equal(compared, TIERS.length - 1);
});

test('複数プランのずれをまとめて報告する (1 件目で止まらない)', () => {
  const plans = catalogFrom(TIERS, (p) => {
    find(p, 'light').max_contracts = byCode('light').max_contracts + 1;
    find(p, 'pro').max_contracts = byCode('pro').max_contracts + 1;
  });
  const { errors } = diffPlanCatalog(TIERS, plans);
  assert.equal(errors.length, 2);
});

// ── 落とさないケース (デプロイを止めない) ───────────────────────────────────

test('catalog に列が無いときは warning に留める (スキーマ変更でデプロイを止めない)', () => {
  const plans = catalogFrom(TIERS, (p) => {
    for (const plan of p) delete plan.max_contracts;
  });
  const { errors, warnings } = diffPlanCatalog(TIERS, plans);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, TIERS.length);
  assert.match(warnings[0], /plan_catalog に max_contracts が無い/);
});

test('公開プランがサイトに無いのは warning (載せない判断もありうる)', () => {
  const plans = catalogFrom(TIERS);
  plans.push({
    plan_code: 'studio',
    monthly_price_jpy: 19800,
    included_minutes: 6000,
    included_minutes_per_seat: null,
    min_seats: 1,
    max_contracts: 1,
    is_public: true,
  });
  const { errors, warnings } = diffPlanCatalog(TIERS, plans);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^studio: plan_catalog では is_public=true だがサイトに載っていない/);
});

// ── 取得の失敗種別 (全て「落とさない」に倒れること) ──────────────────────────

test('鍵が無ければネットワークに触れずスキップする', async () => {
  const res = await fetchPlanCatalog({
    apiKey: '',
    fetchImpl: () => assert.fail('鍵が無いのに fetch した'),
  });
  assert.equal(res.status, 'no-key');
  assert.match(res.message, /SUPABASE_PROXY_API_KEY/);
});

test('401 / 403 は鍵の問題として報告するが落とさない', async () => {
  for (const status of [401, 403]) {
    const res = await fetchPlanCatalog({
      apiKey: 'dummy',
      fetchImpl: async () => new Response('{}', { status }),
    });
    assert.equal(res.status, 'auth');
    assert.match(res.message, /無効か失効している/);
    assert.ok(!res.message.includes('dummy'), 'メッセージに鍵が混ざっている');
  }
});

test('5xx / ネットワーク断はスキップ扱い', async () => {
  const server5xx = await fetchPlanCatalog({
    apiKey: 'dummy',
    fetchImpl: async () => new Response('boom', { status: 503 }),
  });
  assert.equal(server5xx.status, 'http');

  const offline = await fetchPlanCatalog({
    apiKey: 'dummy',
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  assert.equal(offline.status, 'network');
  assert.match(offline.message, /到達できない/);
});

test('sandbox が返ってきたら比較しない (値が別物になりうる)', async () => {
  const res = await fetchPlanCatalog({
    apiKey: 'dummy',
    fetchImpl: async () =>
      Response.json({ livemode: false, plans: [{ plan_code: 'light', max_contracts: 9 }] }),
  });
  assert.equal(res.status, 'shape');
  assert.match(res.message, /livemode=false/);
});

test('空配列 / 形の違うレスポンスも比較しない', async () => {
  const empty = await fetchPlanCatalog({
    apiKey: 'dummy',
    fetchImpl: async () => Response.json({ livemode: true, plans: [] }),
  });
  assert.equal(empty.status, 'shape');

  const broken = await fetchPlanCatalog({
    apiKey: 'dummy',
    fetchImpl: async () => Response.json({ ok: true }),
  });
  assert.equal(broken.status, 'shape');
});

test('X-API-Key ヘッダを付けて live を要求する', async () => {
  let seen = null;
  await fetchPlanCatalog({
    apiKey: 'dummy',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return Response.json({ livemode: true, plans: [{ plan_code: 'x' }] });
    },
  });
  assert.equal(seen.url, CATALOG_URL);
  assert.match(seen.url, /livemode=true/, 'livemode を省くと Worker の既定に依存する');
  assert.equal(seen.init.headers['X-API-Key'], 'dummy');
  assert.ok(seen.init.signal, 'タイムアウトが設定されていない');
});

// ── ライブ検査 (鍵があるときだけ) ───────────────────────────────────────────

test('本番の plan_catalog と一致している', async (t) => {
  const apiKey = process.env.SUPABASE_PROXY_API_KEY || '';
  if (!apiKey) {
    t.skip('SUPABASE_PROXY_API_KEY 未設定 — ライブ検査を飛ばす (CI は scripts/check-plan-catalog.mjs が行う)');
    return;
  }
  const res = await fetchPlanCatalog({ apiKey });
  if (res.status !== 'ok') {
    // ネットワーク不調で `npm test` を落とさない。落とすのは「取得できて食い違ったとき」だけ
    t.skip(`plan_catalog を取得できなかった: ${res.message}`);
    return;
  }
  const { errors } = diffPlanCatalog(TIERS, res.plans);
  assert.deepEqual(errors, [], errors.join('\n'));
});
