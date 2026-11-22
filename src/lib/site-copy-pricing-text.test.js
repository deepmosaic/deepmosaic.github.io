// 料金に触れる文が今の料金と合っていること、/docs/#team に Enterprise の内容があることの回帰テスト。
//
//   node --test src/lib/site-copy-pricing-text.test.js
//
//   - FAQ (3 言語) の「上限時間を超えたら」は次の更新日に利用枠が戻ること + Enterprise (お見積り) の案内で、追加の契約と Pro の句が無い。
//   - meta の description 6 ページ (price / subscribe の 3 言語) に Pro と、カードに無い金額を書かない。
//   - JSON-LD の AggregateOffer はお見積りのプランを含めない (highPrice = Hobby)。
//   - llms-full.txt の Enterprise は「お見積り」の見出しで単価を出さない。llms.txt とトップの見出しに数を書かない。
//   - ROI 計算機は既定 5 本 × 2 時間 = 10 時間。同じプランは 1 本までなので、Hobby の 5 時間を超えたら Enterprise (お見積り) の案内になる。
//   - /docs/#team の「Enterprise プランの内容」は plans.yml の enterprise から差し込む。
//
// `_site` は読まない (ビルド出力の検査は e2e/pricing-quote.spec.ts)。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { cheapestPlan, contractsNeeded, formatYen, isQuoteTier, roiFit, roiTiers, selfServeMaxHours } from './pricing.js';
import { loadTiers } from './plans-yml.js';
import { extractFrontMatter, fmScalar } from './front-matter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const TIERS = loadTiers();
/** ROI 計算機に渡すプラン (島と同じ選び方) */
const paidPublic = roiTiers(TIERS);
const byCode = (code) => {
  const t = TIERS.find((x) => x.code === code);
  assert.ok(t, `plans.yml に ${code} が無い`);
  return t;
};

/** Liquid のコメント (`{%- comment -%}…{%- endcomment -%}` と `{% comment %}…`) を落とす */
const stripLiquidComments = (s) => s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

/** FAQ の回答に Pro のプレースホルダが残っていたら落とす */
function assertNoProPlaceholder(text, where) {
  assert.ok(!text.includes('%%PRO_'), `${where} に %%PRO_ のプレースホルダが残っている`);
}

/** 上限時間を超えたときの回答の目印 (超過料金なしの句) */
const OVERAGE_WORD = { ja: '超過料金は発生しません', en: 'no overage charges', 'zh-tw': '超額費用' };

/** 10 件目の回答 (超過料金なしの句を持つ `a:` の行。コメントの行は除く) */
const faqQuotaLine = (rel, lang = 'ja') => {
  const line = read(rel)
    .split('\n')
    .find((l) => /^\s*a: /.test(l) && l.includes(OVERAGE_WORD[lang]));
  assert.ok(line, `${rel} に上限時間を超えたときの回答が無い`);
  return line;
};

const FAQ_FILES = {
  ja: '_data/faq.yml',
  en: '_data/l10n/en/faq.yml',
  'zh-tw': '_data/l10n/zh-tw/faq.yml',
};
const QUOTE_WORD = { ja: /お見積り/, en: /quote/i, 'zh-tw': /報價/ };

// ── 1. FAQ ──────────────────────────────────────────────────────────

test('FAQ (3 言語) に %%PRO_ のプレースホルダが無い', () => {
  for (const rel of Object.values(FAQ_FILES)) assertNoProPlaceholder(read(rel), rel);
});

test('FAQ の検査関数は %%PRO_MAX%% を足した文を落とす (陰性対照)', () => {
  const bad = faqQuotaLine(FAQ_FILES.ja) + '（Pro は最大 %%PRO_MAX%% 契約）';
  assert.throws(() => assertNoProPlaceholder(bad, 'test'));
});

/** 次の更新日に利用枠が戻る句 */
const RENEWAL_WORD = { ja: '次の更新日に利用枠が戻ります', en: 'restored on the next renewal date', 'zh-tw': '下次續訂日恢復' };
/** 同じプランの追加の契約を案内する句 (契約は 1 本までなので書かない) */
const EXTRA_CONTRACT_WORD = { ja: /追加でご契約|複数契約/, en: /add more subscriptions|additional subscriptions/i, 'zh-tw': /追加訂閱|重複訂閱/ };

test('FAQ の 10 件目は次の更新日に利用枠が戻ることと Enterprise のお見積りを案内し、追加の契約を案内しない', () => {
  for (const [lang, rel] of Object.entries(FAQ_FILES)) {
    const line = faqQuotaLine(rel, lang);
    assert.ok(line.includes(RENEWAL_WORD[lang]), `${rel}: 更新日の案内が無い`);
    assert.match(line, /Enterprise/, `${rel}: Enterprise の案内が無い`);
    assert.match(line, QUOTE_WORD[lang], `${rel}: お見積りの語が無い`);
    assert.doesNotMatch(line, EXTRA_CONTRACT_WORD[lang], `${rel}: 追加の契約を案内している`);
    assert.ok(!line.includes('%%LIGHT_'), `${rel}: 契約の本数のプレースホルダが残っている`);
    assert.ok(!line.includes('Light'), `${rel}: 古いプラン名が残っている`);
  }
});

test('FAQ の 10 件目の検査は追加の契約の句を足した文を拾う (陰性対照)', () => {
  const bad = faqQuotaLine(FAQ_FILES.ja) + '同じプランを追加でご契約いただけます。';
  assert.match(bad, EXTRA_CONTRACT_WORD.ja);
});

test('faq-answer.html のコメントの外に Pro の置換が無い', () => {
  const src = stripLiquidComments(read('_includes/faq-answer.html'));
  assert.ok(!/PRO|fa_pro|"pro"/.test(src), 'Pro の置換が残っている');
  assert.ok(src.includes('%%LIGHT_MAX%%') && src.includes('%%LIGHT_TOTAL%%'), 'Light の置換が無い');
});

// ── 2. ROI の確定文と既定値 ─────────────────────────────────────────

const siteYml = read('_data/site.yml');
const roiNum = (key) => {
  const m = siteYml.match(new RegExp(`^\\s+${key}:\\s*([0-9.]+)`, 'm'));
  assert.ok(m, `site.yml に roi.${key} が無い`);
  return Number(m[1]);
};
const DEFAULT_VIDEOS = roiNum('default_videos_per_month');
const DEFAULT_LENGTH = roiNum('default_length_hours');
const DEFAULT_HOURS = DEFAULT_VIDEOS * DEFAULT_LENGTH;
const TOP_PAGES = { ja: 'index.html', en: 'en/index.html', 'zh-tw': 'zh-tw/index.html' };

/** ROI の島の直後の noscript の本文 */
const roiNoscript = (rel) => {
  const src = read(rel);
  const at = src.indexOf('data-island="roi"');
  assert.ok(at >= 0, `${rel} に ROI の島が無い`);
  const m = src.slice(at).match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(m, `${rel} の ROI に noscript が無い`);
  return m[1];
};

test('ROI の既定は月 5 本 × 2 時間 = 10 時間で、Hobby の込み時間を超えるので Enterprise (お見積り)', () => {
  assert.equal(DEFAULT_VIDEOS, 5);
  assert.equal(DEFAULT_LENGTH, 2);
  assert.equal(DEFAULT_HOURS, 10);
  const fit = roiFit(paidPublic, DEFAULT_HOURS);
  assert.equal(fit.tier.code, 'enterprise');
  assert.equal(fit.cost, null);
  assert.equal(fit.quote, true);
  assert.equal(contractsNeeded(byCode('light'), DEFAULT_HOURS), null);
});

test('トップの noscript (3 言語) は roiFit と同じ結論 (Hobby の込み時間を超えたらお見積り) の確定値を書く', () => {
  const hobby = byCode('light');
  assert.equal(roiFit(paidPublic, DEFAULT_HOURS).quote, true);
  const ja = roiNoscript(TOP_PAGES.ja);
  for (const s of [formatYen(hobby.price), `月 ${hobby.included_hours} 時間`, `月 ${DEFAULT_VIDEOS} 本 × ${DEFAULT_LENGTH} 時間`, 'Hobby', '法人向けプラン']) {
    assert.ok(ja.includes(s), `ja の noscript に「${s}」が無い`);
  }
  assert.match(ja, /Enterprise（お見積り）/);
  assert.ok(!ja.includes('契約（'), 'ja の noscript に複数の契約の句が残っている');
  const en = roiNoscript(TOP_PAGES.en);
  assert.ok(en.includes(formatYen(hobby.price)), 'en の noscript に ¥2,980 が無い');
  assert.ok(en.includes('Hobby'), 'en の noscript に Hobby が無い');
  assert.ok(!/subscriptions/.test(en), 'en の noscript に複数の契約の句が残っている');
  assert.match(en, /quote/i);
  const zh = roiNoscript(TOP_PAGES['zh-tw']);
  assert.ok(zh.includes('2,980 日圓'), 'zh-tw の noscript に 2,980 日圓 が無い');
  assert.ok(zh.includes('Hobby'), 'zh-tw の noscript に Hobby が無い');
  assert.match(zh, /報價/);
  for (const [lang, rel] of Object.entries(TOP_PAGES)) {
    const n = roiNoscript(rel);
    assert.ok(!n.includes('Light'), `${lang}: 古いプラン名が残っている`);
    // 数は既定の本数・尺と、Hobby の込み時間・月額だけ
    const allowed = new Set([String(DEFAULT_VIDEOS), String(DEFAULT_LENGTH), String(hobby.included_hours), formatYen(hobby.price).slice(1)]);
    const odd = (n.replace(/\{\{[^}]*\}\}|\{%[^%]*%\}|<[^>]*>/g, '').match(/\d{1,3}(?:,\d{3})+|\d+/g) ?? []).filter((v) => !allowed.has(v));
    assert.deepEqual(odd, [], `${lang}: 試算と合わない数がある`);
  }
});

test('ROI の島 (3 言語) は既定の本数と尺を data 属性で渡し、島は props から読む', () => {
  for (const rel of Object.values(TOP_PAGES)) {
    const src = read(rel);
    assert.ok(src.includes('data-default-videos="{{ S.roi.default_videos_per_month }}"'), `${rel}: data-default-videos が無い`);
    assert.ok(src.includes('data-default-length="{{ S.roi.default_length_hours }}"'), `${rel}: data-default-length が無い`);
  }
  const svelte = read('src/islands/RoiCalculator.svelte');
  assert.ok(!svelte.includes('$state(6)'), 'RoiCalculator.svelte に $state(6) が残っている');
  assert.match(svelte, /defaultVideos/);
  assert.match(svelte, /defaultLength/);
  assert.match(svelte, /roiFit\(/);
});

// ── 3. roiFit / selfServeMaxHours / isQuoteTier ─────────────────────

test('selfServeMaxHours は公開の有料 tier で 5 (Hobby×1)、空なら 0', () => {
  assert.equal(selfServeMaxHours(paidPublic), 5);
  assert.equal(selfServeMaxHours([]), 0);
  assert.equal(selfServeMaxHours([byCode('enterprise')]), 0);
});

test('roiFit の境界値: 5 時間までは Hobby、超えたらお見積り', () => {
  const cases = [
    [0.5, 'light', 2980],
    [5, 'light', 2980],
  ];
  for (const [h, code, cost] of cases) {
    const fit = roiFit(paidPublic, h);
    assert.equal(fit.tier.code, code, `${h} 時間`);
    assert.equal(fit.cost, cost, `${h} 時間`);
    assert.equal(fit.quote, false, `${h} 時間`);
  }
  for (const h of [5.000001, 10, 10.5, 100]) {
    const fit = roiFit(paidPublic, h);
    assert.equal(fit.tier.code, 'enterprise', `${h} 時間`);
    assert.equal(fit.cost, null, `${h} 時間`);
    assert.equal(fit.quote, true, `${h} 時間`);
  }
});

test('roiFit の失敗系: 空なら null、お見積りの tier が無く賄えなければ null', () => {
  assert.equal(roiFit([], 1), null);
  assert.equal(roiFit([byCode('light')], 6), null);
});

test('isQuoteTier は空でない quote_label のときだけ true', () => {
  assert.equal(isQuoteTier(byCode('enterprise')), true);
  assert.equal(isQuoteTier(byCode('light')), false);
  assert.equal(isQuoteTier({ quote_label: '' }), false);
  assert.equal(isQuoteTier({ quote_label: null }), false);
});

test('cheapestPlan は月次プランで賄えない時間でアカウント共有型を選ぶ (仮の単価)', () => {
  const priced = [byCode('light'), { ...byCode('pro'), price: 7000 }, { ...byCode('enterprise'), price: 4000 }];
  assert.equal(cheapestPlan(priced, 41).tier.code, 'enterprise');
});

// ── 4. meta の description ──────────────────────────────────────────

const DESC_PAGES = {
  price: { ja: 'price/index.html', en: 'en/price/index.html', 'zh-tw': 'zh-tw/price/index.html' },
  subscribe: { ja: 'subscribe/index.html', en: 'en/subscribe/index.html', 'zh-tw': 'zh-tw/subscribe/index.html' },
};
const description = (rel) => {
  const fm = extractFrontMatter(read(rel));
  assert.ok(fm !== null, `${rel} に front matter が無い`);
  const d = fmScalar(fm, 'description');
  assert.ok(d, `${rel} に description が無い`);
  return d;
};

/** 金額を出すプラン (公開でお見積りでない) の価格・税込額の表示形 */
const SHOWN_AMOUNTS = TIERS.filter((t) => t.public === true && !isQuoteTier(t)).flatMap((t) => [t.price_display, t.price_incl_display]).filter(Boolean);

test('price / subscribe の 3 言語の description に Pro が無く、金額は金額を出すプランのものだけ', () => {
  assert.ok(SHOWN_AMOUNTS.includes(byCode('light').price_display), '陽性対照: Light の金額が読めていない');
  let seen = 0;
  for (const pages of Object.values(DESC_PAGES)) {
    for (const rel of Object.values(pages)) {
      const d = description(rel);
      for (const a of d.match(/\d{1,3}(?:,\d{3})+/g) ?? []) {
        seen += 1;
        assert.ok(SHOWN_AMOUNTS.includes(a), `${rel}: カードに無い金額 ${a}`);
      }
      assert.ok(!/\bPro\b/.test(d), `${rel}: Pro`);
    }
  }
  assert.ok(seen > 0, '陽性対照: description の金額が読めていない');
});

test('price の 3 言語の description に Hobby の金額とお見積りがあり、契約の本数を書かない', () => {
  for (const [lang, rel] of Object.entries(DESC_PAGES.price)) {
    const d = description(rel);
    assert.ok(d.includes(byCode('light').price_display), `${rel}: Hobby の金額が無い`);
    assert.ok(d.includes('Hobby') && !d.includes('Light'), `${rel}: プラン名が Hobby でない`);
    assert.match(d, QUOTE_WORD[lang], `${rel}: お見積りの語が無い`);
    assert.doesNotMatch(d, /契約まで|subscriptions per account|份訂閱/, `${rel}: 契約の本数が残っている`);
  }
});

test('subscribe の 3 言語にプロフィールメニューの句が残る', () => {
  const words = { ja: 'プロフィールメニュー', en: 'profile menu', 'zh-tw': '個人資料選單' };
  for (const [lang, rel] of Object.entries(DESC_PAGES.subscribe)) {
    assert.ok(read(rel).includes(words[lang]), `${rel}: ${words[lang]} が無い`);
  }
});

// ── 5. JSON-LD ──────────────────────────────────────────────────────

test('SoftwareApplication の offers はお見積りの tier を外し、最高額は Hobby', () => {
  const src = read('_includes/schema/software-application.html');
  const line = src.split('\n').find((l) => l.includes('assign public_plans'));
  assert.ok(line, 'public_plans の assign が無い');
  assert.match(line, /where:\s*"public",\s*true/);
  assert.match(line, /quote_label\s*==\s*nil/);
  const offered = TIERS.filter((t) => t.public && !isQuoteTier(t));
  for (const t of offered) assert.equal(typeof t.price, 'number', `${t.code}: price が無い`);
  const high = Math.max(...offered.map((t) => t.price));
  assert.equal(high, byCode('light').price);
  assert.equal(offered.length, 2);
});

// ── 6. llms-full.txt / llms.txt ─────────────────────────────────────

test('llms-full.txt の料金の節はお見積りの tier で単価・税込を出さない', () => {
  const src = read('llms-full.txt');
  const start = src.indexOf('{% if t.quote_label %}');
  assert.ok(start >= 0, 'quote_label の分岐が無い');
  const end = src.indexOf('{% else %}', start);
  assert.ok(end > start, 'quote_label の分岐の else が無い');
  const branch = src.slice(start, end);
  assert.ok(branch.includes('t.quote_label') && branch.includes('t.quote_note'));
  assert.ok(!branch.includes('price_display'), '分岐の中で price_display を出している');
  assert.ok(!branch.includes('price_incl_display'), '分岐の中で price_incl_display を出している');
  assert.match(src, /t\.note_title \}\}: \{\{ t\.note \}\}/);
});

test('llms.txt の料金の 2 行にプランの数を書かない', () => {
  const lines = read('llms.txt').split('\n');
  const summary = lines.find((l) => l.startsWith('- 料金 / Pricing:'));
  const link = lines.find((l) => l.startsWith('- [料金 / Pricing]'));
  for (const l of [summary, link]) {
    assert.ok(l, 'llms.txt に料金の行が無い');
    assert.ok(!/[0-9０-９]\s?プラン/.test(l) && !/\b(two|three|four|five)\b/i.test(l), `数が残っている: ${l}`);
  }
});

// ── 7. トップの見出し ───────────────────────────────────────────────

test('トップ (3 言語) の PRICING の見出しに数字が無い', () => {
  for (const rel of Object.values(TOP_PAGES)) {
    const m = read(rel).match(/kicker="PRICING" title="([^"]*)"/);
    assert.ok(m, `${rel} に PRICING の見出しが無い`);
    assert.ok(!/[0-9０-９]/.test(m[1]), `${rel}: ${m[1]}`);
  }
});

// ── 8. /docs/#team ──────────────────────────────────────────────────

test('/docs/#team の「Enterprise プランの内容」は plans.yml の enterprise から差し込む', () => {
  const src = read('_includes/docs/07-team.html');
  const head = '<h3 class="mt-6 text-[16px] font-bold text-ink">Enterprise プランの内容</h3>';
  const start = src.indexOf(head);
  assert.ok(start >= 0, 'h3「Enterprise プランの内容」が無い');
  const end = src.indexOf('<h3', start + head.length);
  assert.ok(end > start, '次の h3 が無い');
  const section = stripLiquidComments(src.slice(start + head.length, end));
  for (const expr of ['ent.quote_label', 'ent.quote_note', 'ent.note_title', 'ent.note }}', 'ent.specs']) {
    assert.ok(section.includes(expr), `${expr} を差し込んでいない`);
  }
  for (const literal of ['お見積り', '20 時間', '維持管理費用', '請求書払い']) {
    assert.ok(!section.includes(literal), `直書きの「${literal}」がある`);
  }
  assert.ok(!/\d{1,3}(?:,\d{3})+/.test(section), '直書きの金額がある');
  assert.ok(section.includes('href="/enterprise/inquiry/"'), '導入相談へのリンクが無い');
  assert.ok(!/\sid=/.test(section), '新しい id がある');
  // 「導入の流れ」の直前に置く
  assert.ok(src.indexOf('導入の流れ（お見積り・お支払い）') > start);
});
