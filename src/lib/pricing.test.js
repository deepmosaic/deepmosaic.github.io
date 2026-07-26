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
    'overage_per_hour',
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
  assert.equal(byCode('light').overage_per_hour, 800);
  assert.equal(byCode('light').carryover_hours, 10);

  assert.equal(byCode('pro').price, 9800);
  assert.equal(byCode('pro').included_hours, 40);
  assert.equal(byCode('pro').overage_per_hour, 500);

  assert.equal(byCode('enterprise').price, 8000);
  assert.equal(byCode('enterprise').included_hours, 40);
  assert.equal(byCode('enterprise').overage_per_hour, 300);
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

test('込み時間を 1 時間超えると超過単価が 1 時間分だけ乗る', () => {
  assert.equal(monthlyCost(byCode('light'), 6), 2980 + 800);
  assert.equal(monthlyCost(byCode('pro'), 41), 9800 + 500);
});

test('超過不可のプランは選択肢から外れる', () => {
  // Free は overage_per_hour: null。込み時間を超えたら候補にならない
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

test('プールを超えた分はまず超過単価で払う (シートを機械的に足さない)', () => {
  // 旧実装は seats = ceil(hours / 40) だったため超過単価 ¥300 が一度も使われず、
  // 120h → 121h で月額が ¥8,000 跳んでいた (カードの「超過単価」表記と矛盾)。
  const ent = byCode('enterprise');
  assert.deepEqual(bestSeatPlan(ent, 121), { seats: 3, cost: 24000 + 300 });
  assert.deepEqual(bestSeatPlan(ent, 130), { seats: 3, cost: 24000 + 10 * 300 });
});

test('超過が 1 シート分の単価を上回るとシートを足す方が安くなる', () => {
  // 1 シート ¥8,000 で 40 時間。超過 ¥300/時間 なので損益分岐は 8000/300 = 26.67 時間。
  const ent = byCode('enterprise');
  // 120 + 26 = 146h → 3 シート + 26h 超過 = 31,800 < 4 シート 32,000
  assert.deepEqual(bestSeatPlan(ent, 146), { seats: 3, cost: 24000 + 26 * 300 });
  // 120 + 27 = 147h → 3 シート + 27h 超過 = 32,100 > 4 シート 32,000
  assert.deepEqual(bestSeatPlan(ent, 147), { seats: 4, cost: 32000 });
  // 同額 (146.667h) のときは少ないシート数を返す
  assert.equal(bestSeatPlan(ent, 120 + 8000 / 300).seats, 3);
});

test('月 12 時間 (既定値) の適合プランは Light ¥8,580', () => {
  // トップの ROI 計算機の既定 = 月 6 本 × 2 時間。noscript の記載と一致させる。
  const best = cheapestPlan(paid, 12);
  assert.equal(best.tier.code, 'light');
  assert.equal(best.cost, 2980 + 7 * 800); // 8,580
  assert.equal(best.cost, 8580);
});

test('既定値の年間削減額が ¥1,625,040 になる', () => {
  // 月 6 本 × 1 本 ¥24,000 の現状コストとの差額。刷新前の設計判断の固定値。
  const currentYearly = 6 * 24000 * 12;
  const dmYearly = cheapestPlan(paid, 12).cost * 12;
  assert.equal(currentYearly - dmYearly, 1625040);
});

test('作業量が増えると Light → Pro → Enterprise に切り替わる', () => {
  //  5h: Light 2,980 / Pro 9,800            → Light
  assert.equal(cheapestPlan(paid, 5).tier.code, 'light');
  // 14h: Light 2,980+7,200=10,180 / Pro 9,800 → Pro
  assert.equal(cheapestPlan(paid, 14).tier.code, 'pro');
  // 60h: Pro 9,800+10,000=19,800 / Ent 24,000 → まだ Pro
  assert.equal(cheapestPlan(paid, 60).tier.code, 'pro');
  // 80h: Pro 9,800+20,000=29,800 / Ent 24,000 → Enterprise
  assert.equal(cheapestPlan(paid, 80).tier.code, 'enterprise');
});

test('Light と Pro が同額になる境界では plans.yml の順 (Light) を選ぶ', () => {
  // 2980 + (h-5)*800 = 9800 → h = 13.525
  const h = 13.525;
  assert.equal(monthlyCost(byCode('light'), h), monthlyCost(byCode('pro'), h));
  assert.equal(cheapestPlan(paid, h).tier.code, 'light');
});

test('内訳文がプランごとの条件をデータから組み立てる', () => {
  assert.equal(
    planBreakdown(byCode('light'), 12),
    '月 5 時間込み ・ 超過 ¥800 / 時間 ・ 未使用分は翌月繰越（最大 10 時間）',
  );
  assert.equal(planBreakdown(byCode('pro'), 12), '月 40 時間込み ・ 超過 ¥500 / 時間');
  assert.equal(
    planBreakdown(byCode('enterprise'), 12),
    '3 シート（120 時間をプール共有） ・ 超過 ¥300 / 時間',
  );
  // シートを足したほうが安いケースでは内訳のシート数も追従する
  assert.equal(
    planBreakdown(byCode('enterprise'), 147),
    '4 シート（160 時間をプール共有） ・ 超過 ¥300 / 時間',
  );
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
  assert.equal(formatYen(8580), '¥8,580');
  assert.equal(formatYen(1625040), '¥1,625,040');
  assert.equal(formatYen(0), '¥0');
});
