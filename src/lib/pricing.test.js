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
  formatYen,
  monthlyCost,
  planBreakdown,
  suggestEnterpriseOver,
} from './pricing.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANS_YML = join(HERE, '..', '..', '_data', 'plans.yml');

/**
 * plans.yml の `tiers:` を読む極小パーサ。
 *
 * YAML ライブラリを devDependency に足さないための割り切り。対応するのは
 * このファイルが実際に使っている形 (2 階層のスカラーと `- label:` の配列) だけ。
 *
 * **非対応の記法に当たったら黙って読み飛ばさず `assert.fail` で落とす。** 静かに
 * `undefined` を返すと「テストは通るが計算は間違っている」状態になり、この
 * テストの存在意義が消えるため。具体的には以下を検出する:
 *
 *   - ブロックスカラー (`summary: |` / `>`)
 *   - 暗黙 null (`overage_per_hour:` のように値を書かない形)
 *     → 次の行のインデントを見て「ネストブロックの開始」と区別する
 */
function loadTiers() {
  const lines = readFileSync(PLANS_YML, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l === 'tiers:');
  assert.ok(start >= 0, 'plans.yml に tiers: が無い');

  const tiers = [];
  let current = null;

  /** 次の非空・非コメント行を返す (ネスト判定のための先読み)。 */
  const nextMeaningful = (from) => {
    for (let j = from; j < lines.length; j += 1) {
      const t = lines[j].trim();
      if (t !== '' && !t.startsWith('#')) return lines[j];
    }
    return null;
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const item = line.match(/^ {2}- (\w+): (.*)$/);
    if (item) {
      current = {};
      tiers.push(current);
      current[item[1]] = parseScalar(item[2]);
      continue;
    }

    const pair = line.match(/^ {4}(\w+):(.*)$/);
    if (pair) {
      const [, key, rest] = pair;
      const value = rest.replace(/\s+#.*$/, '').trim();

      assert.ok(
        !/^[|>]/.test(value),
        `plans.yml: ${key} がブロックスカラー (${value}) だが、このパーサは非対応。` +
          ' plans.yml を 1 行スカラーに戻すか、パーサを拡張すること。',
      );

      if (value === '') {
        // 値が空 → ネストブロックの開始か、暗黙 null か。次行のインデントで判定する。
        const next = nextMeaningful(i + 1);
        const startsNestedBlock = next !== null && /^ {6}|^ {4}- /.test(next);
        assert.ok(
          startsNestedBlock,
          `plans.yml: ${key} が暗黙 null (値なし) になっている。` +
            ' このパーサは読み取れないので `null` と明示すること。',
        );
        continue; // specs / bullets / cta のネストは計算に不要なので読み飛ばす
      }

      current[key] = parseScalar(value);
      continue;
    }

    // ネストの中身 (6 スペース以上 / 4 スペースの配列要素) は無視
    if (/^ {6}/.test(line) || /^ {4}- /.test(line)) continue;
    // tiers: ブロックの外に出た
    if (!/^ /.test(line)) break;
  }
  return tiers;
}

function parseScalar(raw) {
  const v = raw.replace(/\s+#.*$/, '').trim();
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v.replace(/^"(.*)"$/, '$1');
}

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
  assert.equal(byCode('light').carryover_hours, 10);

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

test('込み時間ちょうどまでは基本料、1 時間でも超えたら候補外', () => {
  // 従量課金は廃止したので、込み時間を金銭で超える手段は無い
  assert.equal(monthlyCost(byCode('light'), 5), 2980);
  assert.equal(monthlyCost(byCode('light'), 6), Number.POSITIVE_INFINITY);
  assert.equal(monthlyCost(byCode('pro'), 40), 9800);
  assert.equal(monthlyCost(byCode('pro'), 41), Number.POSITIVE_INFINITY);
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

test('月 12 時間 (既定値) の適合プランは Pro (月額 9,800 円)', () => {
  // トップの ROI 計算機の既定 = 月 6 本 × 2 時間。noscript の記載と一致させる。
  // 従量課金の廃止で Light (月 5 時間) は 12 時間を賄えず候補から外れる。
  const best = cheapestPlan(paid, 12);
  assert.equal(best.tier.code, 'pro');
  assert.equal(best.cost, 9800);
});

test('既定値の年間削減額が 1,610,400 円になる', () => {
  // 月 6 本 × 1 本 24,000 円の現状コストとの差額。
  const currentYearly = 6 * 24000 * 12;
  const dmYearly = cheapestPlan(paid, 12).cost * 12;
  assert.equal(currentYearly - dmYearly, 1610400);
});

test('作業量が増えると Light → Pro → Enterprise に切り替わる', () => {
  // 切替点は「込み時間」で決まる (超過単価が無くなったため)
  //   5h: Light 2,980                             → Light
  assert.equal(cheapestPlan(paid, 5).tier.code, 'light');
  //   6h: Light は 5 時間までで候補外 / Pro 9,800  → Pro
  assert.equal(cheapestPlan(paid, 6).tier.code, 'pro');
  //  40h: Pro 9,800 (込み時間ちょうど)             → Pro
  assert.equal(cheapestPlan(paid, 40).tier.code, 'pro');
  //  41h: Pro は候補外 / Ent 3 シート 24,000       → Enterprise
  assert.equal(cheapestPlan(paid, 41).tier.code, 'enterprise');
});

test('込み時間ちょうどでは下位プランを選ぶ (境界の丸め事故を防ぐ)', () => {
  assert.equal(cheapestPlan(paid, 5).tier.code, 'light');
  assert.equal(cheapestPlan(paid, 5.000001).tier.code, 'pro');
});

test('内訳文がプランごとの条件をデータから組み立てる', () => {
  assert.equal(
    planBreakdown(byCode('light'), 12),
    '月 5 時間込み ・ 未使用分は翌月繰越（最大 10 時間）',
  );
  assert.equal(planBreakdown(byCode('pro'), 12), '月 40 時間込み');
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
