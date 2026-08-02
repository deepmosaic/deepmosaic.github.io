// 料金計算の回帰テスト (TICKET-SITE-20)。
//
//   node --test src/lib/pricing.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// プラン定義は **実際の `_data/plans.yml` を読む** ので、料金を変えたらここが落ちる
// = サイトの表示と計算機が食い違ったまま公開されることがない。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  bestSeatPlan,
  cheapestPlan,
  contractLimit,
  contractsNeeded,
  formatYen,
  monthlyCost,
  planBreakdown,
  suggestEnterpriseOver,
} from './pricing.js';
// plans.yml の極小パーサは `plans-yml.js` に切り出した (TICKET-SITE-CONTRACT-SSOT)。
// Supabase `plan_catalog` との突き合わせ (`scripts/check-plan-catalog.mjs`) も
// 同じ読み手を使う — パーサを 2 つ持つと「片方だけ直して片方が古い」が起きる。
import { loadTiers } from './plans-yml.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const TIERS = loadTiers();
const paid = TIERS.filter((t) => t.price > 0);
const byCode = (code) => {
  const t = TIERS.find((x) => x.code === code);
  assert.ok(t, `plans.yml に ${code} が無い`);
  return t;
};

test('plans.yml から 4 プランが読める', () => {
  assert.deepEqual(
    TIERS.map((t) => t.code),
    ['free', 'light', 'pro', 'enterprise'],
  );
});

test('計算に使う全フィールドが読めている (取りこぼしの検出)', () => {
  // パーサが静かに値を落とすと「テストは通るが計算は間違う」ので、
  // 計算に必要なキーの存在と非 undefined を明示的に確かめる。
  const required = [
    'code',
    'name',
    'display',
    'price',
    'included_hours',
    'included_basis',
    'trial_days',
    'featured',
    'public',
  ];
  for (const tier of TIERS) {
    for (const key of required) {
      assert.ok(key in tier, `${tier.code}: ${key} が読めていない`);
      assert.notEqual(tier[key], undefined, `${tier.code}: ${key} が undefined`);
    }
  }
  // pooled プランは min_seats が無いと最低契約額を計算できない
  for (const tier of TIERS.filter((t) => t.included_basis === 'pooled')) {
    assert.equal(typeof tier.min_seats, 'number', `${tier.code}: min_seats が無い`);
  }
});

test('料金と込み時間が新デザインの確定値と一致する', () => {
  assert.equal(byCode('light').price, 2980);
  assert.equal(byCode('light').included_hours, 5);

  assert.equal(byCode('pro').price, 9800);
  assert.equal(byCode('pro').included_hours, 40);

  assert.equal(byCode('enterprise').price, 8000);
  assert.equal(byCode('enterprise').included_hours, 40);
  // 最低 3 シート = 24,000 円。これは Pro×2 の成立条件でもあるので下げない
  assert.equal(byCode('enterprise').min_seats, 3);

  // Free はアプリの FREE_USAGE_LIMIT_SECONDS = 6h と一致させる
  assert.equal(byCode('free').included_hours, 6);
});

test('無料トライアルはどのプランにも設けない', () => {
  // クレジットカードを登録しなければ全員 Free で使えるので試用期間は不要。
  // (再トライアルの穴を作らないためにも設けない)
  for (const tier of TIERS) {
    assert.equal(tier.trial_days, 0, `${tier.code} に trial_days が残っている`);
  }
});

test('込み時間の内側では基本料だけ', () => {
  assert.equal(monthlyCost(byCode('light'), 5), 2980);
  assert.equal(monthlyCost(byCode('pro'), 40), 9800);
});

test('込み時間を超えたら契約を積む。上限本数でも足りなければ候補外', () => {
  // 従量課金は廃止済み。超過は金銭ではなく「同じプランをもう 1 本」で賄う。
  // 本数を増やしても単価は変わらない (割引なし) ので費用は本数に比例する。
  assert.equal(monthlyCost(byCode('light'), 5), 2980); // 1 本
  assert.equal(monthlyCost(byCode('light'), 6), 5960); // 2 本
  assert.equal(monthlyCost(byCode('light'), 15), 8940); // 3 本 (上限)
  assert.equal(monthlyCost(byCode('light'), 16), Number.POSITIVE_INFINITY); // 上限超え
  assert.equal(monthlyCost(byCode('pro'), 40), 9800); // 1 本
  assert.equal(monthlyCost(byCode('pro'), 41), 19600); // 2 本 (上限)
  assert.equal(monthlyCost(byCode('pro'), 81), Number.POSITIVE_INFINITY); // 上限超え
});

test('契約本数の上限はデータから読む (コードに数値を持たない)', () => {
  // 真の SSOT は Supabase `plan_catalog.max_contracts`。_data/plans.yml はその写しで、
  // 乖離は CI (scripts/check-plan-catalog.mjs) が検知する。
  assert.equal(contractLimit(byCode('light')), 3);
  assert.equal(contractLimit(byCode('pro')), 2);
  // 欠落・0・負値は 1 に丸める (0 に倒れると「1 本も契約できない」になる)
  assert.equal(contractLimit({}), 1);
  assert.equal(contractLimit({ max_contracts: 0 }), 1);
  assert.equal(contractLimit({ max_contracts: -3 }), 1);
});

test('必要契約本数は切り上げ、上限を超えたら null', () => {
  assert.equal(contractsNeeded(byCode('light'), 0), 1);
  assert.equal(contractsNeeded(byCode('light'), 5), 1);
  assert.equal(contractsNeeded(byCode('light'), 5.1), 2);
  assert.equal(contractsNeeded(byCode('light'), 15), 3);
  assert.equal(contractsNeeded(byCode('light'), 15.1), null);
  assert.equal(contractsNeeded(byCode('pro'), 80), 2);
  assert.equal(contractsNeeded(byCode('pro'), 80.1), null);
});

test('従量課金が復活していないこと (回帰固定)', () => {
  // 超過単価をデータに書き戻すと計算機が「使った分だけ課金」に逆戻りする。
  // Stripe の従量 price は archive 済み・メーターも停止済みなので、
  // ここが緑でなくなったら本番と広告表示が食い違う。
  for (const tier of TIERS) {
    assert.ok(
      tier.overage_per_hour === null || tier.overage_per_hour === undefined,
      `${tier.code}: overage_per_hour が復活している`,
    );
  }
  for (const tier of paid) {
    assert.ok(!planBreakdown(tier, 12).includes('超過'), `${tier.code}: 内訳文に超過が出ている`);
  }
});

test('未使用分の翌月繰越が復活していないこと (回帰固定)', () => {
  // 繰越はサイト・アプリともに撤去した。Supabase `plan_catalog.carryover_max_minutes` は
  // sandbox / live とも 0 に更新済み (出荷済みアプリのパース互換のため列だけ残置) なので、
  // ここが緑でなくなったら本番と広告表示が食い違う。
  for (const tier of TIERS) {
    assert.ok(
      tier.carryover_hours === null || tier.carryover_hours === undefined,
      `${tier.code}: carryover_hours が復活している`,
    );
  }
  for (const tier of paid) {
    assert.ok(!planBreakdown(tier, 12).includes('繰越'), `${tier.code}: 内訳文に繰越が出ている`);
  }
});

test('Free は込み時間を超えたら候補にならない', () => {
  assert.equal(monthlyCost(byCode('free'), 6), 0);
  assert.equal(monthlyCost(byCode('free'), 7), Number.POSITIVE_INFINITY);
});

test('無制限プラン (旧 Pro の据え置き枠) は時間に関係なく基本料', () => {
  const legacy = { price: 9800, included_hours: null, included_basis: 'unlimited' };
  assert.equal(monthlyCost(legacy, 0), 9800);
  assert.equal(monthlyCost(legacy, 1000), 9800);
});

test('Enterprise は最低シート数を下回らない', () => {
  const ent = byCode('enterprise');
  assert.deepEqual(bestSeatPlan(ent, 0), { seats: 3, cost: 24000 });
  assert.deepEqual(bestSeatPlan(ent, 12), { seats: 3, cost: 24000 });
  // 3 シート = 120 時間ぶんのプール。ここまでは基本料だけ
  assert.deepEqual(bestSeatPlan(ent, 120), { seats: 3, cost: 24000 });
  // 最低シート数 × 単価が最低契約額
  assert.equal(monthlyCost(ent, 12), 8000 * 3);
});

test('プールを超えたらシートを足す (超過課金は廃止したので他に手段が無い)', () => {
  const ent = byCode('enterprise');
  // 3 シート = 120 時間。1 時間でも超えたら 4 シート目が要る
  assert.deepEqual(bestSeatPlan(ent, 121), { seats: 4, cost: 32000 });
  assert.deepEqual(bestSeatPlan(ent, 160), { seats: 4, cost: 32000 });
  assert.deepEqual(bestSeatPlan(ent, 161), { seats: 5, cost: 40000 });
});

test('月 12 時間 (既定値) の適合プランは Light×3 (月額 8,940 円)', () => {
  // トップの ROI 計算機の既定 = 月 6 本 × 2 時間。noscript の記載と一致させる。
  // 複数契約により Light×3 (15 時間 / 8,940 円) が Pro (9,800 円) より安い。
  const best = cheapestPlan(paid, 12);
  assert.equal(best.tier.code, 'light');
  assert.equal(best.cost, 8940);
});

test('既定値の年間削減額が 1,620,720 円になる', () => {
  // 月 6 本 × 1 本 24,000 円の現状コストとの差額。
  const currentYearly = 6 * 24000 * 12;
  const dmYearly = cheapestPlan(paid, 12).cost * 12;
  assert.equal(currentYearly - dmYearly, 1620720);
});

test('作業量が増えると Light → Pro → Enterprise に切り替わる', () => {
  // 切替点は「込み時間 × 契約本数」で決まる (超過単価は廃止済み)
  //   5h: Light×1 2,980                            → Light
  assert.equal(cheapestPlan(paid, 5).tier.code, 'light');
  //  15h: Light×3 8,940 < Pro 9,800                → まだ Light
  assert.equal(cheapestPlan(paid, 15).tier.code, 'light');
  //  16h: Light は 3 本でも 15h までで候補外        → Pro
  assert.equal(cheapestPlan(paid, 16).tier.code, 'pro');
  //  80h: Pro×2 19,600 < Ent 3 シート 24,000       → まだ Pro
  assert.equal(cheapestPlan(paid, 80).tier.code, 'pro');
  //  81h: Pro は 2 本でも 80h までで候補外          → Enterprise
  assert.equal(cheapestPlan(paid, 81).tier.code, 'enterprise');
});

test('込み時間ちょうどでは本数を増やさない (境界の丸め事故を防ぐ)', () => {
  assert.equal(monthlyCost(byCode('light'), 5), 2980);
  assert.equal(monthlyCost(byCode('light'), 5.000001), 5960);
  assert.equal(monthlyCost(byCode('pro'), 40), 9800);
  assert.equal(monthlyCost(byCode('pro'), 40.000001), 19600);
});

test('内訳文がプランごとの条件をデータから組み立てる', () => {
  assert.equal(planBreakdown(byCode('pro'), 12), '月 40 時間込み');
  // 複数契約が必要な時間数では本数と合計時間を出す
  assert.equal(planBreakdown(byCode('light'), 12), '3 契約（月 15 時間込み）');
  assert.equal(planBreakdown(byCode('pro'), 41), '2 契約（月 80 時間込み）');
  assert.equal(planBreakdown(byCode('enterprise'), 12), '3 シート（120 時間をプール共有）');
  // プールを超えるとシート数が増え、内訳もそれに追従する
  assert.equal(planBreakdown(byCode('enterprise'), 147), '4 シート（160 時間をプール共有）');
});

test('Enterprise の検討を促す閾値は Pro の込み時間', () => {
  assert.equal(suggestEnterpriseOver(paid), 40);
});

test('/price/ の meta description が plans.yml の金額と一致している', () => {
  // Jekyll の front matter は Liquid で site.data を参照できないため、ここだけは
  // 金額を手書きするしかない。二重管理になるのでテストで一致を強制する。
  const PRICE_PAGE = join(HERE, '..', '..', 'price', 'index.html');
  const head = readFileSync(PRICE_PAGE, 'utf8').split(/\r?\n/).slice(0, 12).join('\n');
  const line = head.split(/\r?\n/).find((l) => l.startsWith('description:'));
  assert.ok(line, 'price/index.html に description の front matter が無い');

  for (const code of ['light', 'pro', 'enterprise']) {
    const tier = byCode(code);
    assert.ok(
      line.includes(tier.price_display),
      `description に ${tier.name} の金額 ${tier.price_display} が無い (plans.yml と乖離)`,
    );
  }
  assert.ok(
    line.includes(String(byCode('free').included_hours)),
    'description に Free の無料時間が無い (plans.yml と乖離)',
  );
});

test('金額は日本語ロケールの桁区切りで出す', () => {
  assert.equal(formatYen(9800), '¥9,800');
  assert.equal(formatYen(1610400), '¥1,610,400');
  assert.equal(formatYen(0), '¥0');
});
