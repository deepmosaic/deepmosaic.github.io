// 料金計算の仕様テスト。
//
//   node --test src/lib/pricing.test.js
//
// Node 組み込みの test runner のみを使う (vitest / jsdom を持ち込まない)。
// プラン定義は **実際の `_data/plans.yml` を読む** ので、料金を変えたらここが落ちる
// = サイトの表示と計算機が食い違ったまま公開されることがない。
// お見積りのプラン (Enterprise) と public が false のプラン (Pro) は plans.yml に金額を持たないので、計算の規則は
// 実データの込み時間・契約本数に仮の単価 (TEST_PRICE) を足した写しで確かめる。

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
  roiFit,
  roiTiers,
  suggestEnterpriseOver,
} from './pricing.js';
// plans.yml を読むのは `plans-yml.js` だけ (scripts/check-plan-catalog.mjs も同じ読み手を使う)。
import { loadTiers } from './plans-yml.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const TIERS = loadTiers();
/** 有料のプラン (Free 以外)。内訳文の検査に使う (内訳文は金額を使わない) */
const paid = TIERS.filter((t) => t.code !== 'free');
const byCode = (code) => {
  const t = TIERS.find((x) => x.code === code);
  assert.ok(t, `plans.yml に ${code} が無い`);
  return t;
};

/** 計算の規則を確かめるための仮の単価。実在の単価ではない */
const TEST_PRICE = { pro: 7000, enterprise: 4000 };
/** plans.yml の pro / enterprise に仮の単価を足した写し */
const PRO = { ...byCode('pro'), price: TEST_PRICE.pro };
const ENT = { ...byCode('enterprise'), price: TEST_PRICE.enterprise };
/** 計算の規則を確かめる有料プランの並び (plans.yml の順) */
const paidPriced = [byCode('light'), PRO, ENT];

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
  // 金額を出すプラン (公開でお見積りでない) は price を持つ
  for (const tier of TIERS.filter((t) => t.public === true && !t.quote_label)) {
    assert.equal(typeof tier.price, 'number', `${tier.code}: price が読めていない`);
  }
  // pooled プランは min_seats が無いとアカウント数を計算できない
  for (const tier of TIERS.filter((t) => t.included_basis === 'pooled')) {
    assert.equal(typeof tier.min_seats, 'number', `${tier.code}: min_seats が無い`);
  }
});

test('料金と込み時間が料金カードの値と一致する', () => {
  assert.equal(byCode('light').price, 2980);
  assert.equal(byCode('light').included_hours, 5);

  assert.equal(byCode('pro').included_hours, 20);
  assert.equal(byCode('enterprise').included_hours, 20);
  // Enterprise は 1 アカウントから契約できる
  assert.equal(byCode('enterprise').min_seats, 1);

  // Free はアプリの無料の上限 (2 時間) と同じ。料金のカタログとの一致は plan-catalog.test.js が見る
  assert.equal(byCode('free').included_hours, 2);
});

test('Enterprise はお見積りの表示を持ち、金額の欄と price_note を持たない', () => {
  // 料金カードは金額の代わりに「お見積り」を出すカード (`_includes/pricing-cards.html` の `quote_label` 分岐)。
  const ent = byCode('enterprise');
  for (const key of ['quote_label', 'quote_note']) {
    assert.equal(typeof ent[key], 'string', `enterprise.${key} が読めていない`);
    assert.ok(ent[key].trim().length > 0, `enterprise.${key} が空`);
  }
  assert.equal(ent.price_note, undefined, 'enterprise.price_note が残っている');
  for (const key of ['price', 'price_display', 'price_incl_display', 'price_unit']) {
    assert.ok(!(key in ent), `enterprise.${key} が残っている`);
  }

  // ⚠️ CTA (「導入について相談する」/ `/enterprise/inquiry/`) はここでは検査できない。
  //    `loadTiers()` は `cta:` のネストを読み飛ばす (plans-yml.js) ため。
  //    相談導線が静かに消えないことは **ビルド出力への CI grep** が固定する —
  //    `.github/workflows/jekyll.yml` の `Verify build output`:
  //      grep -q 'href="/enterprise/inquiry/"' _site/price/index.html
  //      grep -q 'お見積り'                     _site/price/index.html (と quote_note の文)
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
  assert.equal(monthlyCost(PRO, 20), TEST_PRICE.pro);
});

test('込み時間を超えたら契約を積む。上限本数でも足りなければ候補外', () => {
  // 込み時間を超えた分は金銭ではなく「同じプランをもう 1 本」で賄う。
  // 本数を増やしても単価は変わらない (割引なし) ので費用は本数に比例する。
  assert.equal(monthlyCost(byCode('light'), 5), 2980); // 1 本 (上限)
  assert.equal(monthlyCost(byCode('light'), 6), Number.POSITIVE_INFINITY); // 上限超え (同じプランは 1 本まで)
  assert.equal(monthlyCost(PRO, 20), TEST_PRICE.pro); // 1 本
  assert.equal(monthlyCost(PRO, 21), TEST_PRICE.pro * 2); // 2 本 (上限)
  assert.equal(monthlyCost(PRO, 41), Number.POSITIVE_INFINITY); // 上限超え
});

test('契約本数の上限はデータから読む (コードに数値を持たない)', () => {
  // _data/plans.yml は料金のカタログの写しで、ずれは scripts/check-plan-catalog.mjs が検知する。
  assert.equal(contractLimit(byCode('light')), 1);
  assert.equal(contractLimit(byCode('pro')), 2);
  // 欠落・0・負値は 1 に丸める (0 に倒れると「1 本も契約できない」になる)
  assert.equal(contractLimit({}), 1);
  assert.equal(contractLimit({ max_contracts: 0 }), 1);
  assert.equal(contractLimit({ max_contracts: -3 }), 1);
});

test('必要契約本数は切り上げ、上限を超えたら null', () => {
  assert.equal(contractsNeeded(byCode('light'), 0), 1);
  assert.equal(contractsNeeded(byCode('light'), 5), 1);
  assert.equal(contractsNeeded(byCode('light'), 5.1), null);
  assert.equal(contractsNeeded(byCode('pro'), 40), 2);
  assert.equal(contractsNeeded(byCode('pro'), 40.1), null);
});

test('超過単価は全プランで空で、内訳文に超過が出ない', () => {
  // 料金は込み時間のある月額だけ。超過単価に値があると計算機が「使った分だけ課金」で試算してしまう。
  for (const tier of TIERS) {
    assert.ok(
      tier.overage_per_hour === null || tier.overage_per_hour === undefined,
      `${tier.code}: overage_per_hour に値がある`,
    );
  }
  for (const tier of paid) {
    assert.ok(!planBreakdown(tier, 12).includes('超過'), `${tier.code}: 内訳文に超過が出ている`);
  }
});

test('繰越の時間は全プランで空で、内訳文に繰越が出ない', () => {
  // 未使用分の繰越は無い。データに値があると計算機と料金カードが食い違う。
  for (const tier of TIERS) {
    assert.ok(
      tier.carryover_hours === null || tier.carryover_hours === undefined,
      `${tier.code}: carryover_hours に値がある`,
    );
  }
  for (const tier of paid) {
    assert.ok(!planBreakdown(tier, 12).includes('繰越'), `${tier.code}: 内訳文に繰越が出ている`);
  }
});

test('Free は込み時間を超えたら候補にならない', () => {
  // 境界は込み時間ちょうど。**データから読む** — ここに数値を直書きすると
  // 料金改定のたびに片方だけ古くなる
  const free = byCode('free');
  assert.equal(monthlyCost(free, free.included_hours), 0);
  assert.equal(monthlyCost(free, free.included_hours + 1), Number.POSITIVE_INFINITY);
});

test('無制限プランは時間に関係なく基本料', () => {
  const unlimited = { price: 1234, included_hours: null, included_basis: 'unlimited' };
  assert.equal(monthlyCost(unlimited, 0), 1234);
  assert.equal(monthlyCost(unlimited, 1000), 1234);
});

test('Enterprise は最低シート数 (1) を下回らない', () => {
  const p = TEST_PRICE.enterprise;
  assert.deepEqual(bestSeatPlan(ENT, 0), { seats: 1, cost: p });
  assert.deepEqual(bestSeatPlan(ENT, 12), { seats: 1, cost: p });
  // 1 シート = 20 時間ぶんのプール。ここまでは基本料だけ
  assert.deepEqual(bestSeatPlan(ENT, 20), { seats: 1, cost: p });
  assert.deepEqual(bestSeatPlan(ENT, 60), { seats: 3, cost: p * 3 });
  // 最低シート数 × 単価が最低契約額
  assert.equal(monthlyCost(ENT, 12), p * 1);
});

test('bestSeatPlan は min_seats が無ければ 1、あれば下限として使う', () => {
  const base = { price: 1000, included_hours: 10, included_basis: 'pooled' };
  assert.deepEqual(bestSeatPlan(base, 0), { seats: 1, cost: 1000 });
  assert.deepEqual(bestSeatPlan({ ...base, min_seats: 3 }, 0), { seats: 3, cost: 3000 });
  assert.deepEqual(bestSeatPlan({ ...base, min_seats: 3 }, 31), { seats: 4, cost: 4000 });
});

test('Enterprise (アカウント共有型) は月次プランで賄えるうちは候補に出さない', () => {
  // 仮の単価では Enterprise 1 アカウントが Light×2 / Pro より安いが、Enterprise はお見積りの契約なので、
  // 月次プランで賄えない作業量になったときだけ Enterprise を出す。
  assert.ok(TEST_PRICE.enterprise < byCode('light').price * 2, '前提: 単価だけなら Enterprise が安い');
  for (const h of [0, 11, 12, 16, 20, 21, 40]) {
    assert.notEqual(cheapestPlan(paidPriced, h).tier.code, 'enterprise', `${h} 時間で Enterprise が出た`);
  }
  assert.equal(cheapestPlan(paidPriced, 41).tier.code, 'enterprise');
  assert.equal(cheapestPlan(paidPriced, 41).cost, TEST_PRICE.enterprise * 3);
});

test('cheapestPlan は候補が無ければ null、アカウント共有型だけならそれを返す', () => {
  const pooled = { code: 'p', price: 1000, included_hours: 10, included_basis: 'pooled', min_seats: 1 };
  assert.equal(cheapestPlan([], 5), null);
  assert.equal(cheapestPlan([pooled], 5).tier.code, 'p');
});

test('プールを超えたらシートを足す (超過課金は無いので他に手段が無い)', () => {
  const p = TEST_PRICE.enterprise;
  // 3 シート = 60 時間。1 時間でも超えたら 4 シート目が要る
  assert.deepEqual(bestSeatPlan(ENT, 61), { seats: 4, cost: p * 4 });
  assert.deepEqual(bestSeatPlan(ENT, 80), { seats: 4, cost: p * 4 });
  assert.deepEqual(bestSeatPlan(ENT, 81), { seats: 5, cost: p * 5 });
});

// トップの ROI 計算機の既定 = `_data/site.yml` の roi (月 5 本 × 2 時間 = 月 10 時間)。
// 計算機は `roiTiers` で選んだプランから `roiFit` で選ぶ。noscript の確定文の照合は site-copy-pricing-text.test.js。
const SITE_YML = readFileSync(join(HERE, '..', '..', '_data', 'site.yml'), 'utf8');
const roiDefault = (key) => Number(SITE_YML.match(new RegExp(`^\\s+${key}:\\s*([0-9.]+)`, 'm'))[1]);
const ROI_HOURS = roiDefault('default_videos_per_month') * roiDefault('default_length_hours');
const paidPublic = roiTiers(TIERS);

test('既定値 (月 10 時間) は Hobby の込み時間を超えるので Enterprise (お見積り・金額なし)', () => {
  assert.equal(ROI_HOURS, 10);
  const fit = roiFit(paidPublic, ROI_HOURS);
  assert.equal(fit.tier.code, 'enterprise');
  assert.equal(fit.cost, null);
  assert.equal(fit.quote, true);
});

test('既定値より少ない月 5 時間では Hobby (月額 2,980 円) が適合する', () => {
  const fit = roiFit(paidPublic, 5);
  assert.equal(fit.tier.code, 'light');
  assert.equal(fit.cost, 2980);
  assert.equal(fit.quote, false);
});

test('作業量が増えると Hobby → Pro → Enterprise に切り替わる (仮の単価)', () => {
  // 切替点は「込み時間 × 契約本数」で決まる (超過単価は無い)
  //   5h: Hobby×1                                   → Hobby
  assert.equal(cheapestPlan(paidPriced, 5).tier.code, 'light');
  //   6h: Hobby は 1 本 (5h) までで候補外           → Pro
  assert.equal(cheapestPlan(paidPriced, 6).tier.code, 'pro');
  //  40h: Pro×2 で賄える (Enterprise は月次プランで賄えないときだけ) → まだ Pro
  assert.equal(cheapestPlan(paidPriced, 40).tier.code, 'pro');
  //  41h: Pro は 2 本でも 40h までで候補外           → Enterprise
  assert.equal(cheapestPlan(paidPriced, 41).tier.code, 'enterprise');
});

test('込み時間ちょうどでは本数を増やさない (境界の丸め事故を防ぐ)', () => {
  assert.equal(monthlyCost(byCode('light'), 5), 2980);
  assert.equal(monthlyCost(byCode('light'), 5.000001), Number.POSITIVE_INFINITY);
  assert.equal(monthlyCost(PRO, 20), TEST_PRICE.pro);
  assert.equal(monthlyCost(PRO, 20.000001), TEST_PRICE.pro * 2);
});

test('内訳文がプランごとの条件をデータから組み立てる', () => {
  assert.equal(planBreakdown(byCode('pro'), 12), '月 20 時間込み');
  // 1 本で賄える時間数では本数を出さない
  assert.equal(planBreakdown(byCode('light'), 4), '月 5 時間込み');
  // 複数契約が必要な時間数では本数と合計時間を出す (上限 2 本のプラン)
  assert.equal(planBreakdown(byCode('pro'), 21), '2 契約（月 40 時間込み）');
  // Pro の上限 (2 本 = 40 時間) を超える時間数では **そもそも Pro が候補に出ない**。
  // ここで planBreakdown(pro, 41) を assert すると「賄えないプランの内訳文」を
  // 仕様として固定してしまうので、適合プランの選択のほうを固定する
  assert.equal(cheapestPlan(paidPriced, 41).tier.code, 'enterprise');
  // 表示上の呼称は「アカウント」(識別子は seats のまま)
  assert.equal(planBreakdown(byCode('enterprise'), 12), '1 アカウント（20 時間をプール共有）');
  // プールを超えるとアカウント数が増え、内訳もそれに追従する
  assert.equal(planBreakdown(byCode('enterprise'), 73), '4 アカウント（80 時間をプール共有）');
});

test('Enterprise の検討を促す閾値は Pro の込み時間', () => {
  assert.equal(suggestEnterpriseOver(paid), 20);
});

test('/price/ の meta description が plans.yml の金額と一致している', () => {
  // Jekyll の front matter は Liquid で site.data を参照できないため、ここだけは
  // 金額を手書きするしかない。二重管理になるのでテストで一致を強制する。
  // 金額を書くのは Light だけ。Enterprise はお見積り。
  const PRICE_PAGE = join(HERE, '..', '..', 'price', 'index.html');
  const head = readFileSync(PRICE_PAGE, 'utf8').split(/\r?\n/).slice(0, 12).join('\n');
  const line = head.split(/\r?\n/).find((l) => l.startsWith('description:'));
  assert.ok(line, 'price/index.html に description の front matter が無い');

  const light = byCode('light');
  assert.ok(line.includes(light.price_display), `description に Light の金額 ${light.price_display} が無い (plans.yml と乖離)`);
  // 桁区切りの数 (金額) は金額を出すプランの価格・税込額だけ
  const shown = TIERS.filter((t) => t.public === true && !t.quote_label).flatMap((t) => [t.price_display, t.price_incl_display]);
  const amounts = line.match(/\d{1,3}(?:,\d{3})+/g) ?? [];
  assert.ok(amounts.length > 0, '陽性対照: description の金額が読めていない');
  for (const a of amounts) assert.ok(shown.includes(a), `description にカードに無い金額 ${a} がある`);
  assert.ok(!/\bPro\b/.test(line), 'description に Pro がある');
  assert.ok(line.includes(byCode('enterprise').quote_label), 'description に Enterprise のお見積りが無い');
  assert.ok(
    line.includes(String(byCode('free').included_hours)),
    'description に Free の無料時間が無い (plans.yml と乖離)',
  );
});

test('金額は日本語ロケールの桁区切りで出す', () => {
  assert.equal(formatYen(12345), '¥12,345');
  assert.equal(formatYen(1610400), '¥1,610,400');
  assert.equal(formatYen(0), '¥0');
});
