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
 * @property {number|null} overage_per_hour   null は超過不可
 * @property {number}      [min_seats]        pooled の最低シート数
 * @property {number|null} [carryover_hours]  未使用分の翌月繰越上限
 * @property {number}      [trial_days]
 */

/** `¥1,234` 形式。 */
export const formatYen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');

/**
 * シート共有型プランを最も安く使えるシート数と、そのときの月額。
 *
 * **シート数は「作業時間」ではなく「同時に使う人数」で決まる**ので、時間から
 * `ceil(hours / included_hours)` で機械的に決めてはいけない。プールを超えた分は
 * 超過単価で払えるため、
 *
 *   - 少ないシート + 超過課金
 *   - 多いシート + 超過なし
 *
 * のどちらが安いかは超過単価と 1 シート単価の比で変わる (このプランなら
 * ¥300/時間 × 40 時間 = ¥12,000 > ¥8,000 なので、40 時間ぶん超えるならシートを
 * 足したほうが安い)。よって `min_seats` から「超過ゼロになるシート数」までを
 * 全部試して最小を採る。
 *
 * 旧実装は `ceil(hours / included_hours)` でシート数を決めていたため
 * `seats * included_hours >= hours` が常に成立し、**超過単価が一度も使われず**
 * プール境界 (3 シート = 120 時間) の 1 時間超えで月額が ¥8,000 跳ぶ計算になっていた
 * (カードに「超過単価 ¥300 / 時間」と書いているのに使われない矛盾)。
 *
 * @param {Tier} tier
 * @param {number} hours 月間の消費時間
 * @returns {{seats: number, cost: number}}
 */
export function bestSeatPlan(tier, hours) {
  const perSeat = tier.included_hours || 1;
  const minSeats = Math.max(1, tier.min_seats ?? 1);
  const h = Math.max(0, hours);
  // 超過ゼロにできるシート数 (これ以上増やしても基本料が増えるだけ)
  const maxSeats = Math.max(minSeats, Math.ceil(h / perSeat));

  let bestSeats = minSeats;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let seats = minSeats; seats <= maxSeats; seats += 1) {
    const over = Math.max(0, h - seats * perSeat);
    if (over > 0 && !tier.overage_per_hour) continue; // 超過不可なら候補外
    const cost = tier.price * seats + over * (tier.overage_per_hour ?? 0);
    if (cost < bestCost) {
      bestCost = cost;
      bestSeats = seats;
    }
  }
  return { seats: bestSeats, cost: bestCost };
}

/**
 * そのプランを 1 ヶ月使ったときの総額 (基本料 + 超過)。
 *
 * 超過が発生するのに超過単価が無いプランは選択肢から外したいので
 * `Number.POSITIVE_INFINITY` を返す (呼び出し側が `Number.isFinite` で弾く)。
 *
 * @param {Tier} tier
 * @param {number} hours
 * @returns {number}
 */
export function monthlyCost(tier, hours) {
  // 無制限 (グランドファザリング枠) は基本料のみ
  if (tier.included_basis === 'unlimited' || tier.included_hours === null) return tier.price;

  if (tier.included_basis === 'pooled') return bestSeatPlan(tier, hours).cost;

  const over = Math.max(0, hours - tier.included_hours);
  if (over === 0) return tier.price;
  if (!tier.overage_per_hour) return Number.POSITIVE_INFINITY;
  return tier.price + over * tier.overage_per_hour;
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
    parts.push(`月 ${tier.included_hours} 時間込み`);
  }
  if (tier.overage_per_hour) parts.push(`超過 ${formatYen(tier.overage_per_hour)} / 時間`);
  if (tier.carryover_hours) parts.push(`未使用分は翌月繰越（最大 ${tier.carryover_hours} 時間）`);
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
