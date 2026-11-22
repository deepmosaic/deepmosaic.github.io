<script>
  // ROI 計算機。
  //
  // プランは Jekyll から data-plans で受け取る (_data/plans.yml の公開のプラン)。価格をこのファイルに書かない。
  //
  // 見出しと注記はアイランドの外 (Jekyll 側) に置いてあるので、JS が無効でも
  // 「何の計算機か」は読める。数値部分だけがここで動く。
  //
  // 金額の計算とプランの選び方は `src/lib/pricing.js` (DOM 非依存の純関数) に置き、
  // `src/lib/pricing.test.js` と `src/lib/plan-visibility.test.js` で `_data/plans.yml` の実データに対して
  // 固定している。ここでは表示だけを担う。
  import {
    formatYenFor,
    planBreakdown,
    roiFit,
    roiTiers,
    selfServeMaxHours,
  } from '../lib/pricing.js';
  // ページの言語は <html lang> から読む。
  import { pageLang, pick } from '../lib/site-lang.js';

  // 画面の文の 3 言語の表 (ja は今の文字列のまま)。数える単位は en が単数 / 複数、zh-tw が量詞 (部・小時)。
  // 金額は formatYenFor (ja / en `¥1,000`、zh-tw `1,000 日圓`)。
  const TEXT = {
    ja: {
      videosLabel: '月間の本数',
      videosValue: (n) => `${n} 本`,
      lengthLabel: '1 本の完成尺',
      lengthValue: (h) => `${h} 時間`,
      costLabel: '現状の 1 本あたりコスト',
      costHelp: '社内で行う場合は「作業時間 × 時給」、外注の場合は発注単価を入れてください。',
      hoursLabel: '月間の消費時間',
      hoursValue: (h) => h + ' 時間',
      planLabel: '適合プラン',
      perMonth: ' / 月',
      enterpriseHint: (h) => `月 ${h} 時間を超える運用は Hobby の込み時間に収まらないため、法人向けプランの Enterprise をご相談ください。`,
      currentLabel: '現状の年間コスト',
      dmLabel: 'Deepmosaic の年間費用',
      savingLabel: '年間の差額',
      savingNone: 'この作業量では現状のコストの方が低くなります。',
      quoteValue: 'お見積り',
      quoteNone: 'Enterprise はお見積りのため、年間費用と差額は試算していません。',
      manualLabel: '手作業の想定',
      manualNote: 'Deepmosaic は処理中の操作が不要で、完了後の確認作業のみです。',
    },
    en: {
      videosLabel: 'Videos per month',
      videosValue: (n) => `${n} ${n === 1 ? 'video' : 'videos'}`,
      lengthLabel: 'Finished length per video',
      lengthValue: (h) => `${h} ${h === 1 ? 'hour' : 'hours'}`,
      costLabel: 'Current cost per video',
      costHelp: 'For in-house work, enter "work hours × hourly wage". For outsourced work, enter the unit price you pay.',
      hoursLabel: 'Hours used per month',
      hoursValue: (h) => `${h} ${Number(h) === 1 ? 'hour' : 'hours'}`,
      planLabel: 'Best-fit plan',
      perMonth: ' / month',
      enterpriseHint: (h) => `Usage over ${h} hours a month does not fit in the hours included in Hobby, so please ask us about Enterprise, our plan for businesses.`,
      currentLabel: 'Current annual cost',
      dmLabel: 'Annual cost of Deepmosaic',
      savingLabel: 'Annual difference',
      savingNone: 'At this workload, your current cost is lower.',
      quoteValue: 'Custom quote',
      quoteNone: 'Enterprise is priced by custom quote, so the annual cost and difference are not estimated.',
      manualLabel: 'Estimated manual work',
      manualNote: 'Deepmosaic needs no operation while it processes. You only review the results after it finishes.',
    },
    'zh-tw': {
      videosLabel: '每月影片數',
      videosValue: (n) => `${n} 部`,
      lengthLabel: '每部影片的成品長度',
      lengthValue: (h) => `${h} 小時`,
      costLabel: '目前每部影片的成本',
      costHelp: '若在公司內部作業，請輸入「作業時數 × 時薪」；若委外，請輸入委託單價。',
      hoursLabel: '每月使用時數',
      hoursValue: (h) => `${h} 小時`,
      planLabel: '適合的方案',
      perMonth: ' / 月',
      enterpriseHint: (h) => `每月超過 ${h} 小時的使用量超出 Hobby 的內含時數，請洽詢企業方案 Enterprise。`,
      currentLabel: '目前的年度成本',
      dmLabel: 'Deepmosaic 的年度費用',
      savingLabel: '年度差額',
      savingNone: '以此作業量而言，目前的成本較低。',
      quoteValue: '個別報價',
      quoteNone: 'Enterprise 採個別報價，因此不試算年度費用與差額。',
      manualLabel: '手動作業的估計',
      manualNote: 'Deepmosaic 在處理期間不需要操作，只需在完成後確認結果。',
    },
  };
  const lang = pageLang();
  const T = pick(TEXT, lang);

  let {
    plans = '[]',
    defaultCost = '24000',
    defaultVideos = '5',
    defaultLength = '2',
    manualMultiplier = '4',
  } = $props();

  /** @type {import('../lib/pricing.js').Tier[]} */
  const tiers = roiTiers(JSON.parse(plans));
  const MANUAL_X = Number(manualMultiplier) || 4;

  /** 自己申込のプランで賄える最大 (込み時間 × 上限本数の最大)。これを超えたら Enterprise (お見積り) を案内する。 */
  const SUGGEST_ENTERPRISE_OVER = selfServeMaxHours(tiers);

  // 既定の本数と尺は _data/site.yml の roi から data-default-videos / data-default-length で受ける。
  let videos = $state(Number(defaultVideos) || 5);
  let lengthH = $state(Number(defaultLength) || 2);
  let costPerVideo = $state(Number(defaultCost) || 24000);

  // 月間の消費時間
  const hoursPerMonth = $derived(videos * lengthH);

  // お見積りのプラン (Enterprise) は金額の代わりにお見積りの案内を出す (quote: true、cost: null)。料金カードの「お見積り」と揃える
  const best = $derived(roiFit(tiers, hoursPerMonth));
  const isQuote = $derived(best !== null && best.quote);
  const breakdown = $derived(best && !best.quote ? planBreakdown(best.tier, hoursPerMonth, lang) : '');
  const suggestEnterprise = $derived(isQuote && SUGGEST_ENTERPRISE_OVER > 0);

  const currentYearly = $derived(videos * costPerVideo * 12);
  const dmYearly = $derived(best && !best.quote ? best.cost * 12 : 0);
  const saving = $derived(currentYearly - dmYearly);

  // 作業時間: 手作業は「完成尺 × 係数」、Deepmosaic は「確認作業のみ」。
  // 係数は _data/site.yml の roi.manual_work_multiplier (仮置きであることは
  // Jekyll 側の注記で明示している)。
  const manualHours = $derived(hoursPerMonth * MANUAL_X);

  const yen = (n) => formatYenFor(lang, n);
  const hours = (n) => T.hoursValue(Number.isInteger(n) ? n : n.toFixed(1));
</script>

<div class="grid gap-5 md:grid-cols-[1fr_360px]">

  <!-- 入力 -->
  <div class="card p-6">
    <div class="flex flex-col gap-6">

      <div>
        <label for="roi-videos" class="mb-2 block text-[13.5px] font-bold text-ink-body">
          {T.videosLabel}
          <output for="roi-videos" class="ml-2 font-mono text-accent-soft">{T.videosValue(videos)}</output>
        </label>
        <input id="roi-videos" type="range" min="1" max="30" step="1"
               bind:value={videos} class="w-full accent-accent">
      </div>

      <div>
        <label for="roi-length" class="mb-2 block text-[13.5px] font-bold text-ink-body">
          {T.lengthLabel}
          <output for="roi-length" class="ml-2 font-mono text-accent-soft">{T.lengthValue(lengthH)}</output>
        </label>
        <input id="roi-length" type="range" min="0.5" max="3" step="0.5"
               bind:value={lengthH} class="w-full accent-accent">
      </div>

      <div>
        <label for="roi-cost" class="mb-2 block text-[13.5px] font-bold text-ink-body">
          {T.costLabel}
          <output for="roi-cost" class="ml-2 font-mono text-accent-soft">{yen(costPerVideo)}</output>
        </label>
        <input id="roi-cost" type="range" min="5000" max="50000" step="1000"
               bind:value={costPerVideo} class="w-full accent-accent"
               aria-describedby="roi-cost-help">
        <p id="roi-cost-help" class="mt-2 text-[12.5px] leading-[1.8] text-ink-4">
          {T.costHelp}
        </p>
      </div>

    </div>
  </div>

  <!-- 結果 -->
  <div class="card-hi p-6">
    <dl class="flex flex-col gap-4">
      <div>
        <dt class="text-[12.5px] text-hi-ink-3">{T.hoursLabel}</dt>
        <dd class="mt-0.5 font-mono text-[22px] font-bold text-hi-ink">{hours(hoursPerMonth)}</dd>
      </div>
      <div>
        <dt class="text-[12.5px] text-hi-ink-3">{T.planLabel}</dt>
        <dd class="mt-0.5 text-[18px] font-bold text-hi-ink">
          {#if isQuote}{best.tier.name}<span class="ml-1.5 text-[13px] font-normal text-hi-ink-2">{T.quoteValue}</span>{:else if best}{best.tier.name}<span class="ml-1.5 font-mono text-[13px] font-normal text-hi-ink-2">{yen(best.cost)}{T.perMonth}</span>{:else}—{/if}
        </dd>
        {#if breakdown}
          <p class="mt-1 text-[12px] leading-[1.8] text-hi-ink-3">{breakdown}</p>
        {/if}
        {#if suggestEnterprise}
          <p class="mt-1.5 text-[12px] leading-[1.8] text-hi-ink-3">
            {T.enterpriseHint(SUGGEST_ENTERPRISE_OVER)}
          </p>
        {/if}
      </div>
      <div class="border-t border-hi-edge pt-4">
        <dt class="text-[12.5px] text-hi-ink-3">{T.currentLabel}</dt>
        <dd class="mt-0.5 font-mono text-[15px] text-hi-ink-2">{yen(currentYearly)}</dd>
      </div>
      <div>
        <dt class="text-[12.5px] text-hi-ink-3">{T.dmLabel}</dt>
        <dd class="mt-0.5 text-[15px] text-hi-ink-2 {isQuote ? '' : 'font-mono'}">{isQuote ? T.quoteValue : yen(dmYearly)}</dd>
      </div>
      <div class="border-t border-hi-edge pt-4">
        <dt class="text-[12.5px] text-hi-ink-3">{T.savingLabel}</dt>
        {#if isQuote}
          <dd class="mt-0.5 font-mono text-[26px] font-bold text-hi-ink-2">—</dd>
          <p class="mt-1.5 text-[12.5px] leading-[1.8] text-hi-ink-3">
            {T.quoteNone}
          </p>
        {:else}
          <dd class="mt-0.5 font-mono text-[26px] font-bold {saving > 0 ? 'text-success' : 'text-hi-ink-2'}">
            {saving > 0 ? yen(saving) : yen(0)}
          </dd>
        {/if}
        {#if !isQuote && saving <= 0}
          <p class="mt-1.5 text-[12.5px] leading-[1.8] text-hi-ink-3">
            {T.savingNone}
          </p>
        {/if}
      </div>
      <div class="border-t border-hi-edge pt-4 text-[12.5px] leading-[1.9] text-hi-ink-3">
        {T.manualLabel} <span class="font-mono">{hours(manualHours)}</span>{T.perMonth}<br>
        {T.manualNote}
      </div>
    </dl>
  </div>

</div>
