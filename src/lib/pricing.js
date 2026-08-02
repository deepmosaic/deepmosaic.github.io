// 料金の計算ロジック (TICKET-SITE-20)。
//
// ROI 計算機 (`src/islands/RoiCalculator.svelte`) から切り出した純関数。DOM に一切
// 触らないので `node --test src/lib/pricing.test.js` でそのまま検証できる
// (テストのために jsdom / vitest を持ち込まない)。
//
// プランの定義そのものは `_data/plans.yml` が SSOT で、Jekyll が `data-plans` 属性に
// JSON として流し込む。この配列の要素がここでの `tier` になる。
//
// `included_basis` の意味:
//   cumulative — 累計 (Free)。リセットされない
//   monthly    — 月次 (Light / Pro)
//   pooled     — シート共有 (Enterprise)。シート数 × `included_hours` をプールする
//   unlimited  — 無制限 (旧 Pro のグランドファザリング枠)

/**
 * @typedef {object} Tier
 * @property {string}      code
 * @property {string}      name
 * @property {number}      price              1 ユーザー / 1 シートあたりの月額
 * @property {number|null} included_hours     pooled では 1 シートあたりの時間
 * @property {string}      included_basis
 * @property {number}      [min_seats]        pooled の最低シート数
 * @property {number}      [max_contracts]    同一プランを何本まで契約できるか (既定 1)
 * @property {number}      [trial_days]
 */

/** `¥1,234` 形式。 */
export const formatYen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');

/**
 * 同一プランの契約可能本数。
 *
 * **0 や欠落を 0 に倒すと「1 本も契約できない」になる**ので必ず 1 以上に丸める。
 * 上限の真の SSOT は Supabase `plan_catalog.max_contracts` で、`_data/plans.yml` は
 * その写し (乖離は CI の `scripts/check-plan-catalog.mjs` が検知する)。
 *
 * @param {Tier} tier
 * @returns {number}
 */
export function contractLimit(tier) {
  const n = Number(tier.max_contracts);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * 込み時間を賄うのに必要な契約本数。上限を超えるなら null (そのプランでは賄えない)。
 *
 * @param {Tier} tier
 * @param {number} hours
 * @returns {number|null}
 */
export function contractsNeeded(tier, hours) {
  if (!tier.included_hours) return null;
  const need = Math.max(1, Math.ceil(hours / tier.included_hours));
  return need <= contractLimit(tier) ? need : null;
}

/**
 * シート共有型プランを最も安く使えるシート数と、そのときの月額。
 *
 * **従量課金 (超過課金) は廃止したので、プールを超えた分を金銭で払う選択肢は無い。**
 * したがって必要シート数は「プールが消費時間を賄える最小のシート数」で一意に決まる
 * (`min_seats` を下限とする)。
 *
 * なお **シート数は本来「同時に使う人数」で決まる**ので、ここで時間から求めた値は
 * 「時間だけを見た場合の下限」である。実際の見積もりでは人数のほうが支配的になりうる。
 *
 * @param {Tier} tier
 * @param {number} hours 月間の消費時間
 * @returns {{seats: number, cost: number}}
 */
export function bestSeatPlan(tier, hours) {
  const perSeat = tier.included_hours || 1;
  const minSeats = Math.max(1, tier.min_seats ?? 1);
  const h = Math.max(0, hours);
  // プールが消費時間を賄える最小シート数。min_seats を下回らせない
  const seats = Math.max(minSeats, Math.ceil(h / perSeat));
  return { seats, cost: tier.price * seats };
}

/**
 * そのプランを 1 ヶ月使ったときの月額。
 *
 * **従量課金は廃止したので、込み時間を超えたら金銭で埋める手段が無い。** 込み時間を
 * 超えるプランは選択肢から外すため `Number.POSITIVE_INFINITY` を返す
 * (呼び出し側が `Number.isFinite` で弾く)。
 *
 * **同じプランを複数本契約できる** (Light ×3 / Pro ×2)。込み時間を超えたら
 * 本数を積んで賄い、上限本数でも足りなければそのプランは候補から外す。
 * 本数を増やしても単価は変わらない (割引なし) ので費用は本数に比例する。
 *
 * 上限本数は `plan_catalog.max_contracts` が真の SSOT。ここでは `_data/plans.yml` の
 * 写しを読むだけで、**数値をこのファイルに書かない**。
 *
 * @param {Tier} tier
 * @param {number} hours
 * @returns {number}
 */
export function monthlyCost(tier, hours) {
  // 無制限 (グランドファザリング枠) は基本料のみ
  if (tier.included_basis === 'unlimited' || tier.included_hours === null) return tier.price;

  if (tier.included_basis === 'pooled') return bestSeatPlan(tier, hours).cost;

  const contracts = contractsNeeded(tier, hours);
  if (contracts === null) return Number.POSITIVE_INFINITY;
  return tier.price * contracts;
}

/**
 * 月間の消費時間から最も安いプランを選ぶ。同額なら配列の順 (= plans.yml の順) を保つ。
 *
 * @param {Tier[]} tiers 有料プランのみを渡す (Free は price 0 で常に最安になる)
 * @param {number} hours
 * @returns {{tier: Tier, cost: number}|null}
 */
export function cheapestPlan(tiers, hours) {
  const options = tiers
    .map((tier) => ({ tier, cost: monthlyCost(tier, hours) }))
    .filter((o) => Number.isFinite(o.cost));
  if (options.length === 0) return null;
  return options.reduce((best, o) => (o.cost < best.cost ? o : best), options[0]);
}

/**
 * 適合プランの内訳文。**文言はデータから組む** — プランごとに固定文を持たせると
 * `_data/plans.yml` の改定で必ず片方だけ古くなる。
 *
 * @param {Tier} tier
 * @param {number} hours
 * @returns {string}
 */
export function planBreakdown(tier, hours) {
  const parts = [];
  if (tier.included_basis === 'pooled') {
    const { seats } = bestSeatPlan(tier, hours);
    parts.push(`${seats} シート（${seats * tier.included_hours} 時間をプール共有）`);
  } else if (tier.included_basis === 'cumulative') {
    parts.push(`累計 ${tier.included_hours} 時間`);
  } else if (tier.included_basis === 'unlimited' || tier.included_hours === null) {
    parts.push('無制限');
  } else {
    const contracts = contractsNeeded(tier, hours) ?? 1;
    parts.push(
      contracts > 1
        ? `${contracts} 契約（月 ${tier.included_hours * contracts} 時間込み）`
        : `月 ${tier.included_hours} 時間込み`,
    );
  }
  if (tier.trial_days > 0) parts.push(`${tier.trial_days} 日間無料トライアルあり`);
  return parts.join(' ・ ');
}

/**
 * 月次プランのうち最大の込み時間。これを超えたら Enterprise の検討を促す (デザイン準拠)。
 *
 * @param {Tier[]} tiers
 * @returns {number} 月次プランが無ければ 0
 */
export function suggestEnterpriseOver(tiers) {
  const monthly = tiers
    .filter((t) => t.included_basis === 'monthly')
    .map((t) => t.included_hours ?? 0);
  return monthly.length === 0 ? 0 : Math.max(...monthly);
}
