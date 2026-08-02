// Supabase `plan_catalog` と `_data/plans.yml` の突き合わせ (TICKET-SITE-CONTRACT-SSOT / 案B)。
//
// ## なぜ要るか
//
// `max_contracts` / 込み時間 / 月額の **真の SSOT は Supabase の `plan_catalog`**。
// 静的サイトは Supabase を読めないので `_data/plans.yml` に写しを置いている。
// 写しである以上いつか必ず乖離する。乖離したまま公開すると
// **実在しない契約条件を広告する**ことになるので、人手のレビューではなく機械で検知する。
//
// サイト内の重複は案C で `_data/plans.yml` の 1 箇所に潰した。ここで守るのは
// **その 1 箇所と本番 DB の距離**であって、サイト内の一貫性ではない。
//
// ## ⚠️ デプロイを外部サービスに人質に取らせない
//
// 取得できなかった (鍵が無い / ネットワーク断 / 5xx / 鍵が無効) ときは **必ず素通し**する。
// Supabase や Worker が落ちている間サイトを更新できない、という状態を作らないため。
// **落とすのは「取得に成功して、値が食い違ったとき」だけ。**
//
// ## 単位の対応
//
//   plans.yml `included_hours` × 60 ⇔ plan_catalog `included_minutes`
//                                     (シート課金プランは `included_minutes_per_seat`)
//   plans.yml `price`              ⇔ plan_catalog `monthly_price_jpy`
//   plans.yml `max_contracts`      ⇔ plan_catalog `max_contracts`
//   plans.yml `min_seats`          ⇔ plan_catalog `min_seats`
//
// **比較は「分」で行う。** 時間に割ってから比べると 300 / 60 のように割り切れない値
// (例: 90 分) で浮動小数の誤差が入り、一致しているのに落ちる / 逆に見逃す。
//
// ## 合計時間を比べない理由
//
// サイトが出す「最大 3 契約（月 15 時間まで）」の 15 は `included_hours × max_contracts`
// の導出値で、どこにも手書きされていない。元の 2 つが合っていれば必ず合う。

/** Worker の live カタログ。`livemode` は**必ず明示する** (Worker の既定は live だが依存しない)。 */
export const CATALOG_URL =
  'https://deepmosaic-supabase-proxy.deepmosaic.workers.dev/plan-catalog?livemode=true';

/** 突き合わせに使う HTTP タイムアウト (ms)。CI を待たせないこと優先。 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * plan_catalog 1 行の実効的な込み時間 (分)。
 *
 * シート課金プラン (Enterprise) は `included_minutes` が null で
 * `included_minutes_per_seat` に 1 シートあたりの値が入る。plans.yml の
 * `included_hours` も「1 シートあたり」なので、そのまま突き合わせられる。
 *
 * @param {Record<string, unknown>} plan
 * @returns {number|null|undefined} null = 無制限 / undefined = 列が無い
 */
export function catalogIncludedMinutes(plan) {
  const per = plan.included_minutes;
  const perSeat = plan.included_minutes_per_seat;
  if (per === undefined && perSeat === undefined) return undefined;
  if (typeof per === 'number') return per;
  if (typeof perSeat === 'number') return perSeat;
  return null; // どちらも null → 無制限 (pro_legacy_unlimited)
}

/**
 * plans.yml の 1 tier の込み時間 (分)。
 *
 * @param {Record<string, unknown>} tier
 * @returns {number|null|undefined} null = 無制限 / undefined = キーが無い
 */
export function siteIncludedMinutes(tier) {
  const h = tier.included_hours;
  if (h === undefined) return undefined;
  if (h === null) return null;
  return h * 60;
}

/**
 * 1 項目を突き合わせて errors / warnings に積む。
 *
 * **列やキーが「無い」ときは warning に留める。** スキーマ名の変更や Worker の
 * 一時的な仕様差で公開が止まるのは割に合わない。落とすのは
 * 「両方に値があって、その値が違う」ときだけ。
 */
function compareField(out, code, column, label, unit, siteValue, catalogValue) {
  if (catalogValue === undefined) {
    out.warnings.push(
      `${code}: plan_catalog に ${column} が無い — この項目の突き合わせを飛ばした (スキーマ変更の可能性)`,
    );
    return;
  }
  if (siteValue === undefined) {
    out.warnings.push(
      `${code}: _data/plans.yml に対応するキーが無い — ${column} の突き合わせを飛ばした`,
    );
    return;
  }
  if (siteValue !== catalogValue) {
    out.errors.push(
      `${code}: ${label}が食い違っている — サイト ${fmt(siteValue, unit)} / Supabase ${fmt(catalogValue, unit)}` +
        ` (plan_catalog.${column} が正。_data/plans.yml を直すこと)`,
    );
  }
}

/** `null` は単位を付けない (「無制限 分」にならないように)。 */
const fmt = (v, unit) => (v === null ? '無制限' : `${v} ${unit}`);

/**
 * `_data/plans.yml` の tiers と plan_catalog の行を突き合わせる。
 *
 * @param {Record<string, unknown>[]} tiers plans.yml の tiers
 * @param {Record<string, unknown>[]} plans plan_catalog の行
 * @returns {{errors: string[], warnings: string[], compared: number}}
 */
export function diffPlanCatalog(tiers, plans) {
  const out = { errors: [], warnings: [], compared: 0 };
  const byCode = new Map(plans.map((p) => [p.plan_code, p]));

  for (const tier of tiers) {
    const plan = byCode.get(tier.code);
    if (!plan) {
      // サイトにあって DB に無い = 申し込めないプランを広告している。これは落とす。
      out.errors.push(
        `${tier.code}: _data/plans.yml に載っているが plan_catalog (live) に存在しない — 実在しないプランを広告している`,
      );
      continue;
    }
    out.compared += 1;
    compareField(
      out,
      tier.code,
      'max_contracts',
      '契約本数の上限',
      '契約',
      tier.max_contracts,
      plan.max_contracts,
    );
    compareField(
      out,
      tier.code,
      'included_minutes',
      '込み時間',
      '分',
      siteIncludedMinutes(tier),
      catalogIncludedMinutes(plan),
    );
    compareField(
      out,
      tier.code,
      'monthly_price_jpy',
      '月額',
      '円',
      tier.price,
      plan.monthly_price_jpy,
    );
    // min_seats は pooled プランだけが持つ。片方に無ければ compareField が warning にする
    if (tier.min_seats !== undefined) {
      compareField(out, tier.code, 'min_seats', '最低シート数', 'シート', tier.min_seats, plan.min_seats);
    }
  }

  // DB にあってサイトに無いのは **落とさない**。グランドファザリング枠のように
  // 意図的に載せないプランがあるため (`pro_legacy_unlimited` は is_public=false)。
  // ただし公開扱いの新プランが載っていないのは見落としの可能性が高いので知らせる。
  for (const plan of plans) {
    if (plan.is_public !== true) continue;
    if (tiers.some((t) => t.code === plan.plan_code)) continue;
    out.warnings.push(
      `${plan.plan_code}: plan_catalog では is_public=true だがサイトに載っていない (意図的なら無視してよい)`,
    );
  }

  return out;
}

/**
 * Worker から plan_catalog を取る。
 *
 * **例外を投げない。** 呼び出し側が「落とす / 素通しする」を `status` で判断できるよう、
 * 失敗も戻り値で返す。`message` に **API キーを絶対に含めない**こと。
 *
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {string} [opts.url]
 * @param {number} [opts.timeoutMs]
 * @param {typeof fetch} [opts.fetchImpl] テスト用の差し替え
 * @returns {Promise<{status:'ok', plans: Record<string, unknown>[]}
 *                 | {status:'no-key'|'auth'|'http'|'network'|'shape', message: string}>}
 */
export async function fetchPlanCatalog(opts = {}) {
  const {
    apiKey = '',
    url = CATALOG_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = opts;

  if (!apiKey) {
    return {
      status: 'no-key',
      message:
        'SUPABASE_PROXY_API_KEY が未設定のため plan_catalog との突き合わせを飛ばした' +
        ' (GitHub Secrets に登録すると有効になる)',
    };
  }

  let res;
  try {
    res = await fetchImpl(url, {
      headers: { 'X-API-Key': apiKey, 'User-Agent': 'deepmosaic-site-ci/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { status: 'network', message: `plan-catalog に到達できない: ${e.message}` };
  }

  if (res.status === 401 || res.status === 403) {
    // 鍵の取り違え / 失効。**デプロイは止めない**が、放置すると監視が死んだまま
    // 緑が続くので、メッセージで「監視が効いていない」と分かるようにする。
    return {
      status: 'auth',
      message:
        `plan-catalog が HTTP ${res.status} を返した — SUPABASE_PROXY_API_KEY が無効か失効している。` +
        ' 突き合わせは行われていない (乖離を検知できない状態)',
    };
  }
  if (!res.ok) return { status: 'http', message: `plan-catalog が HTTP ${res.status} を返した` };

  let body;
  try {
    body = await res.json();
  } catch (e) {
    return { status: 'shape', message: `plan-catalog のレスポンスが JSON として読めない: ${e.message}` };
  }
  if (!body || !Array.isArray(body.plans)) {
    return { status: 'shape', message: 'plan-catalog のレスポンスに plans 配列が無い' };
  }
  if (body.plans.length === 0) {
    return { status: 'shape', message: 'plan-catalog が 0 件を返した — 比較できない' };
  }
  // live を要求したのに sandbox が返ってきたら比較しない (sandbox は値が別物になりうる)
  if (body.livemode !== true) {
    return {
      status: 'shape',
      message: `plan-catalog が livemode=${JSON.stringify(body.livemode)} を返した — live を要求したので比較しない`,
    };
  }
  return { status: 'ok', plans: body.plans };
}
