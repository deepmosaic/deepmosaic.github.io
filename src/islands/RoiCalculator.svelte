<script>
  // ROI 計算機 (TICKET-SITE-09)。
  //
  // Claude Design の成果物は React + 独自ランタイムだったが、既にビルドに入っている
  // Svelte 5 で書き直す (React を CDN から実行時ロードする構成は、ローカル完結を売りに
  // する製品サイトとして不自然でもある)。
  //
  // プラン価格は **Jekyll から data-plans で渡す**。成果物は料金カードの markup と
  // 計算ロジックの 2 箇所に価格をハードコードしており、必ず片方だけ更新されて破綻する。
  //
  // 見出しと注記はアイランドの外 (Jekyll 側) に置いてあるので、JS が無効でも
  // 「何の計算機か」は読める。数値部分だけがここで動く。
  //
  // 金額の計算そのものは `src/lib/pricing.js` (DOM 非依存の純関数) に置き、
  // `node --test src/lib/pricing.test.js` で `_data/plans.yml` の実データに対して
  // 回帰を固定している (TICKET-SITE-20)。ここでは表示だけを担う。
  import {
    cheapestPlan,
    formatYen,
    planBreakdown,
    suggestEnterpriseOver,
  } from '../lib/pricing.js';

  let { plans = '[]', defaultCost = '24000', manualMultiplier = '4' } = $props();

  /** @type {import('../lib/pricing.js').Tier[]} */
  const tiers = JSON.parse(plans).filter((p) => p.price > 0);
  const MANUAL_X = Number(manualMultiplier) || 4;

  /** Pro の込み時間。これを超えたら Enterprise の検討を促す (デザイン準拠)。 */
  const SUGGEST_ENTERPRISE_OVER = suggestEnterpriseOver(tiers);

  let videos = $state(6);
  let lengthH = $state(2);
  let costPerVideo = $state(Number(defaultCost) || 24000);

  // 月間の消費時間
  const hoursPerMonth = $derived(videos * lengthH);

  const best = $derived(cheapestPlan(tiers, hoursPerMonth));
  const breakdown = $derived(best ? planBreakdown(best.tier, hoursPerMonth) : '');
  // 込み時間の最大 (Pro) を超えていて、かつシート共有型が選ばれていないときだけ促す
  const suggestEnterprise = $derived(
    best !== null &&
      best.tier.included_basis !== 'pooled' &&
      SUGGEST_ENTERPRISE_OVER > 0 &&
      hoursPerMonth > SUGGEST_ENTERPRISE_OVER,
  );

  const currentYearly = $derived(videos * costPerVideo * 12);
  const dmYearly = $derived(best ? best.cost * 12 : 0);
  const saving = $derived(currentYearly - dmYearly);

  // 作業時間: 手作業は「完成尺 × 係数」、Deepmosaic は「確認作業のみ」。
  // 係数は _data/site.yml の roi.manual_work_multiplier (仮置きであることは
  // Jekyll 側の注記で明示している)。
  const manualHours = $derived(hoursPerMonth * MANUAL_X);

  const yen = formatYen;
  const hours = (n) => (Number.isInteger(n) ? n : n.toFixed(1)) + ' 時間';
</script>

<div class="grid gap-5 md:grid-cols-[1fr_360px]">

  <!-- 入力 -->
  <div class="card p-6">
    <div class="flex flex-col gap-6">

      <div>
        <label for="roi-videos" class="mb-2 block text-[13.5px] font-bold text-ink-body">
          月間の本数
          <output for="roi-videos" class="ml-2 font-mono text-accent-soft">{videos} 本</output>
        </label>
        <input id="roi-videos" type="range" min="1" max="30" step="1"
               bind:value={videos} class="w-full accent-accent">
      </div>

      <div>
        <label for="roi-length" class="mb-2 block text-[13.5px] font-bold text-ink-body">
          1 本の完成尺
          <output for="roi-length" class="ml-2 font-mono text-accent-soft">{lengthH} 時間</output>
        </label>
        <input id="roi-length" type="range" min="0.5" max="3" step="0.5"
               bind:value={lengthH} class="w-full accent-accent">
      </div>

      <div>
        <label for="roi-cost" class="mb-2 block text-[13.5px] font-bold text-ink-body">
          現状の 1 本あたりコスト
          <output for="roi-cost" class="ml-2 font-mono text-accent-soft">{yen(costPerVideo)}</output>
        </label>
        <input id="roi-cost" type="range" min="5000" max="50000" step="1000"
               bind:value={costPerVideo} class="w-full accent-accent"
               aria-describedby="roi-cost-help">
        <p id="roi-cost-help" class="mt-2 text-[12.5px] leading-[1.8] text-ink-4">
          社内で行う場合は「作業時間 × 時給」、外注の場合は発注単価を入れてください。
        </p>
      </div>

    </div>
  </div>

  <!-- 結果 -->
  <div class="card-hi p-6">
    <dl class="flex flex-col gap-4">
      <div>
        <dt class="text-[12.5px] text-hi-ink-3">月間の消費時間</dt>
        <dd class="mt-0.5 font-mono text-[22px] font-bold text-hi-ink">{hours(hoursPerMonth)}</dd>
      </div>
      <div>
        <dt class="text-[12.5px] text-hi-ink-3">適合プラン</dt>
        <dd class="mt-0.5 text-[18px] font-bold text-hi-ink">
          {#if best}{best.tier.name}<span class="ml-1.5 font-mono text-[13px] font-normal text-hi-ink-2">{yen(best.cost)} / 月</span>{:else}—{/if}
        </dd>
        {#if breakdown}
          <p class="mt-1 text-[12px] leading-[1.8] text-hi-ink-3">{breakdown}</p>
        {/if}
        {#if suggestEnterprise}
          <p class="mt-1.5 text-[12px] leading-[1.8] text-hi-ink-3">
            月 {SUGGEST_ENTERPRISE_OVER} 時間を超える運用は複数人での利用が想定されるため、Enterprise もご検討ください。
          </p>
        {/if}
      </div>
      <div class="border-t border-hi-edge pt-4">
        <dt class="text-[12.5px] text-hi-ink-3">現状の年間コスト</dt>
        <dd class="mt-0.5 font-mono text-[15px] text-hi-ink-2">{yen(currentYearly)}</dd>
      </div>
      <div>
        <dt class="text-[12.5px] text-hi-ink-3">Deepmosaic の年間費用</dt>
        <dd class="mt-0.5 font-mono text-[15px] text-hi-ink-2">{yen(dmYearly)}</dd>
      </div>
      <div class="border-t border-hi-edge pt-4">
        <dt class="text-[12.5px] text-hi-ink-3">年間の差額</dt>
        <dd class="mt-0.5 font-mono text-[26px] font-bold {saving > 0 ? 'text-success' : 'text-hi-ink-2'}">
          {saving > 0 ? yen(saving) : yen(0)}
        </dd>
        {#if saving <= 0}
          <p class="mt-1.5 text-[12.5px] leading-[1.8] text-hi-ink-3">
            この作業量では現状のコストの方が低くなります。
          </p>
        {/if}
      </div>
      <div class="border-t border-hi-edge pt-4 text-[12.5px] leading-[1.9] text-hi-ink-3">
        手作業の想定 <span class="font-mono">{hours(manualHours)}</span> / 月<br>
        Deepmosaic は処理中の操作が不要で、完了後の確認作業のみです。
      </div>
    </dl>
  </div>

</div>
