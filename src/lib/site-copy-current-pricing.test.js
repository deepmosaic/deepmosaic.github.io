// docs と公開ページの料金の記述が今の料金と合っていることの仕様テスト。
//
//   node --test src/lib/site-copy-current-pricing.test.js
//
//   今の料金: 公開しているのは HOBBY (tier の id は `light`) だけ (1 アカウント 1 本まで・合計 月 5 時間)。Pro は新規の受付を終了 (契約中の人はそのまま)。
//   Enterprise はお見積り (アカウント数 × 20 時間をプール共有・月ごとの請求書払い)。
//
//   - docs (日本語だけ) の見える文で、Premiere Pro 以外の「Pro」は `02-account.html` の #plan の案内の 1 か所だけ。
//   - docs と docs 以外の公開ページ (ja / en / zh-tw) に、今の料金と合わない語 (Enterprise に付いた金額・アカウント単位の価格・
//     plans.yml に無い契約の本数や月の時間・プランの数) が無い。データとして残す plans.yml の pro の tier だけは除く。
//   - 通貨の付いた金額 (¥1,234・1,234円・1,234 日圓) は、金額を出すプランの価格・税込額とその契約本数ぶん、と資本金だけ。
//
// `_site` は読まない (ビルド出力の検査は e2e/docs-plans.spec.ts)。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { loadTiers } from './plans-yml.js';
import { formatYen } from './pricing.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const PRO_NOTICE = 'Pro は新規の受付を終了しました。ご契約中の方は引き続きご利用いただけます。';

/** Liquid・HTML のコメントと YAML のコメントの行を落とした「見える」文を返す */
function visible(src) {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Premiere Pro 以外の Pro (ProRes・Premiere Pro・Adobe Premiere Pro は当たらない) */
const PRO_WORD = /(?<!Premiere )(?<!Premiere&nbsp;)\bPro\b/g;

/** 今の料金と合わない語の型 (見出し, 正規表現)。数を持つ型は下の PLAN_NUMBER_PATTERNS */
const PLAN_WORD_PATTERNS = [
  ['Pro', PRO_WORD],
  ['Light / Pro', /Light\s?[/／]\s?Pro/g],
  ['Enterprise の金額', /Enterprise[^。．\n<]{0,20}?\d{1,3}(?:,\d{3})+/g],
  ['アカウント単位の価格', /[/／]\s?アカウント/g],
  ['維持管理費用の単位', /維持管理費用\s*[/／]/g],
];

/** 料金の数の型 (見出し, 種類, 正規表現)。数は plans.yml の公開しているプランの値だけを許す (プランの数は書かない) */
const PLAN_NUMBER_PATTERNS = [
  ['契約の本数', 'contracts', /最大\s?([0-9０-９]+)\s?契約/g],
  ['契約の本数', 'contracts', /up to (\d+) subscriptions?/gi],
  ['契約の本数', 'contracts', /最多\s?(\d+)\s?份/g],
  ['月の時間', 'hours', /月\s?([0-9０-９]+)\s?時間/g],
  ['月の時間', 'hours', /(\d+) hours/g],
  ['月の時間', 'hours', /(\d+) 小時/g],
  ['プランの数', 'plans', /([0-9０-９]+)\s?プラン/g],
  ['プランの数', 'plans', /\b(\d+|two|three|four|five) plans\b/gi],
  ['プランの数', 'plans', /(\d+)\s?種方案/g],
];

/** 全角の数字を半角に */
const toAscii = (v) => v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 許す数: 公開しているプランの契約の本数と、込み時間 × 契約の本数 */
function allowedPlanNumbers() {
  const tiers = loadTiers().filter((t) => t.public === true);
  const contracts = new Set();
  const hours = new Set();
  for (const t of tiers) {
    if (t.max_contracts > 1) contracts.add(String(t.max_contracts));
    for (let n = 1; n <= (t.max_contracts ?? 1); n += 1) if (t.included_hours) hours.add(String(t.included_hours * n));
  }
  return { contracts, hours, plans: new Set() };
}

/** 当たった今の料金と合わない語を { word, index, match } の配列で返す */
function findPlanTextHits(text, allowed = allowedPlanNumbers()) {
  const hits = [];
  for (const [word, re] of PLAN_WORD_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) hits.push({ word, index: m.index, match: m[0] });
  }
  for (const [word, kind, re] of PLAN_NUMBER_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      if (!allowed[kind].has(toAscii(m[1]))) hits.push({ word, index: m.index, match: m[0] });
    }
  }
  return hits;
}

/** 当たった今の料金と合わない語 (見出し) の配列を返す */
function findPlanTextWords(text) {
  return findPlanTextHits(text).map((h) => h.word);
}

/** 通貨の付いた金額 (¥1,234 / ¥ 1,234 / 1,234円 / 1,234 円 / 1,234 日圓) */
const CURRENCY_AMOUNT = /¥\s?(\d{1,3}(?:,\d{3})+)|(\d{1,3}(?:,\d{3})+)\s?(?:円|日圓)/g;

/** 資本金 (会社概要) */
const CAPITAL = '1,000,000';

/** 許す金額: 金額を出すプランの価格・税込額と、その契約本数ぶんの合計 */
function allowedAmounts() {
  const out = new Set([CAPITAL]);
  for (const t of loadTiers().filter((x) => x.public === true && !x.quote_label && x.price > 0)) {
    out.add(t.price_display);
    if (t.price_incl_display) out.add(t.price_incl_display);
    for (let n = 1; n <= (t.max_contracts ?? 1); n += 1) out.add(formatYen(t.price * n).slice(1));
  }
  return out;
}

/** 許していない通貨の付いた金額の一覧 */
function findUnlistedAmounts(text, allowed) {
  const out = [];
  for (const m of text.matchAll(CURRENCY_AMOUNT)) {
    const v = m[1] ?? m[2];
    if (!allowed.has(v)) out.push({ index: m.index, match: m[0] });
  }
  return out;
}

/** `<section id="<id>"` から次の `</section>` まで */
function sectionOf(src, id) {
  const start = src.indexOf(`<section id="${id}"`);
  assert.ok(start >= 0, `section #${id} が無い`);
  const end = src.indexOf('</section>', start);
  assert.ok(end > start, `section #${id} の終わりが無い`);
  return src.slice(start, end);
}

/** タグを落として空白を詰めた文 */
const textOf = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

/** docs の対象 (`_includes/docs/*.html` の全部と docs の 2 ページ) */
function docsFiles() {
  const inc = readdirSync(join(ROOT, '_includes/docs'))
    .filter((n) => n.endsWith('.html'))
    .map((n) => `_includes/docs/${n}`);
  return [...inc, 'docs/index.html', 'docs/web/index.html'];
}

// ---- 道具の対照 ----

test('findPlanTextWords: 今の料金と合わない語を拾う (陰性対照)', () => {
  const samples = [
    '個人向けプラン（Light / Pro）',
    'Pro 月額1,234円',
    'Enterprise 1アカウント月額1,234円',
    'Enterprise ¥1,234',
    '¥1,234 / アカウント',
    '+ 維持管理費用 / 年',
    'Light は最大 9 契約',
    'Light は最大 ９ 契約',
    '月 7 時間まで',
    '7 hours per month',
    '每月 7 小時',
    '作業量に合わせて選べる4プラン',
    '4 plans to match your workload',
    'four plans',
    '依作業量選擇的 4 種方案',
    'Light: up to 9 subscriptions',
    '最多 9 份',
  ];
  for (const s of samples) {
    assert.ok(findPlanTextWords(s).length >= 1, `拾わない: ${s}`);
  }
});

test('allowedPlanNumbers: 公開しているプランの契約の本数と込み時間 × 本数 (プランの数は許さない)', () => {
  const a = allowedPlanNumbers();
  // 公開しているプランはどれも 1 本までなので、契約の本数は 1 つも許さない
  assert.deepEqual([...a.contracts].sort(), []);
  assert.deepEqual([...a.hours].sort((x, y) => x - y), ['2', '5', '20']);
  assert.equal(a.plans.size, 0);
});

test('findPlanTextWords: 今の文は拾わない (陽性対照)', () => {
  const samples = [
    'Adobe Premiere Pro 25.3 以降',
    'Premiere Pro 連携',
    'H.265・ProRes・DNxHR',
    'HOBBY は月 5 時間',
    'HOBBY: 5 hours / month',
    '2 hours in total',
    'アカウント数 × 20 時間をプール共有',
    '表示形式は 3 種類から選択',
    'Adobe Premiere&nbsp;Pro',
  ];
  for (const s of samples) {
    assert.deepEqual(findPlanTextWords(s), [], `誤検出: ${s}`);
  }
});

test('findUnlistedAmounts: 許した金額は通し、それ以外の通貨の付いた金額を拾う (陽性対照・陰性対照)', () => {
  const allowed = allowedAmounts();
  assert.ok(allowed.has('2,980') && allowed.has('3,278') && allowed.has(CAPITAL), [...allowed].join(' '));
  // 同じプランは 1 本までなので、2 本ぶんの合計は許さない
  assert.ok(!allowed.has('5,960'), [...allowed].join(' '));
  for (const s of ['月額2,980円', '¥2,980 / month', '2,980 日圓', '¥ 3,278', '資本金 ¥1,000,000', '79,139,232 枚', '100,000 images']) {
    assert.deepEqual(findUnlistedAmounts(s, allowed), [], `誤検出: ${s}`);
  }
  for (const s of ['月額1,234円', '¥1,234', '¥ 12,345 / アカウント', '1,234 日圓', '1,234 円', '¥5,960 / month']) {
    assert.equal(findUnlistedAmounts(s, allowed).length, 1, `拾わない: ${s}`);
  }
});

test('visible: コメントの中の「Light / Pro」は落ちる (Liquid・HTML・YAML)', () => {
  const src = [
    '{%- comment -%}有料 (Light / Pro){%- endcomment -%}',
    '{% comment %}Light / Pro{% endcomment %}',
    '<!-- Light / Pro -->',
    '  # Light / Pro の行',
    '見える文',
  ].join('\n');
  const v = visible(src);
  assert.deepEqual(findPlanTextWords(v), []);
  assert.ok(v.includes('見える文'));
});

// ---- docs ----

test('docs: Premiere Pro 以外の Pro は #plan の案内の 1 か所だけ', () => {
  const hits = [];
  for (const rel of docsFiles()) {
    const text = visible(read(rel));
    for (const m of text.matchAll(PRO_WORD)) hits.push({ rel, index: m.index, text });
  }
  assert.equal(hits.length, 1, `Pro の出現: ${hits.map((h) => `${h.rel}@${h.index}: ${h.text.slice(h.index - 30, h.index + 30)}`).join(' | ')}`);
  const [hit] = hits;
  assert.equal(hit.rel, '_includes/docs/02-account.html');
  const plan = sectionOf(hit.text, 'plan');
  const planStart = hit.text.indexOf('<section id="plan"');
  assert.ok(hit.index > planStart && hit.index < planStart + plan.length, 'Pro が #plan の外にある');
  const pStart = hit.text.lastIndexOf('<p>', hit.index);
  const pEnd = hit.text.indexOf('</p>', hit.index);
  assert.ok(textOf(hit.text.slice(pStart, pEnd)).includes(PRO_NOTICE), '案内の段落の文が違う');
});

test('docs: 今の料金と合わない語が無い (#plan の案内の Pro だけを除く)', () => {
  const offenders = [];
  for (const rel of docsFiles()) {
    const text = visible(read(rel));
    for (const h of findPlanTextHits(text)) {
      const isNotice = h.word === 'Pro' && rel === '_includes/docs/02-account.html' && text.slice(h.index, h.index + PRO_NOTICE.length) === PRO_NOTICE;
      if (!isNotice) offenders.push(`${rel}: ${h.match} … ${text.slice(Math.max(0, h.index - 30), h.index + 30)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('docs: 「維持管理費用」は見積書の記載事項の <li> の中だけ', () => {
  for (const rel of docsFiles()) {
    const text = visible(read(rel));
    let i = text.indexOf('維持管理費用');
    while (i >= 0) {
      assert.equal(rel, '_includes/docs/07-team.html', `${rel} に維持管理費用がある`);
      const liStart = text.lastIndexOf('<li>', i);
      const liEnd = text.indexOf('</li>', i);
      assert.ok(liStart >= 0 && liEnd > i, '維持管理費用が <li> の中に無い');
      assert.ok(text.slice(liStart, liEnd).includes('お見積書をお送りします'), '見積書の <li> の外に維持管理費用がある');
      assert.ok(text.lastIndexOf('</li>', i) < liStart, '維持管理費用が <li> の外にある');
      i = text.indexOf('維持管理費用', i + 1);
    }
  }
});

test('docs #license: 個人向けプラン（HOBBY）はクレジットカード、Enterprise は請求書による銀行振込', () => {
  const lic = visible(sectionOf(read('_includes/docs/02-account.html'), 'license'));
  const text = textOf(lic);
  assert.ok(text.includes('個人向けプラン（HOBBY）のお支払いはクレジットカードです'), text);
  assert.ok(text.includes('次の更新日に利用枠が戻ります'), '利用枠を使い切ったときの案内が無い');
  assert.ok(!text.includes('追加でご契約'), '追加の契約の案内が残っている');
  assert.ok(text.includes('請求書による銀行振込'));
  assert.match(lic, /href="#team"/);
  assert.doesNotMatch(text, PRO_WORD);
});

test('docs #plan: カードの月額は HOBBY の説明で、Enterprise は金額がお見積り', () => {
  const text = textOf(visible(sectionOf(read('_includes/docs/02-account.html'), 'plan')));
  assert.ok(!text.includes('各プランのカードに月額'), '各プランのカードに月額 が残っている');
  assert.ok(text.includes('HOBBY のカードには月額'));
  assert.ok(text.includes('お見積り'));
  assert.ok(text.includes('同じプランの契約は 1 アカウントにつき 1 つまでです'));
  assert.ok(!text.includes('「契約アカウント数」を選べます'));
  assert.ok(text.includes(PRO_NOTICE));
});

test('docs #team: プランの名前は無料プラン / 有料プランで、Light / Pro が無い', () => {
  const text = textOf(visible(sectionOf(read('_includes/docs/07-team.html'), 'team')));
  assert.ok(text.includes('無料プランと有料プランでは'), text.slice(0, 400));
  assert.ok(!/Light\s?\/\s?Pro/.test(text));
  assert.doesNotMatch(text, PRO_WORD);
});

test('docs/web: #about と #requirements に「有料プランと組織（Enterprise）」がある', () => {
  const src = visible(read('_includes/docs/web.html'));
  for (const id of ['about', 'requirements']) {
    assert.ok(textOf(sectionOf(src, id)).includes('有料プランと組織（Enterprise）'), `#${id}`);
  }
});

// ---- docs 以外の公開ページ (ja / en / zh-tw) ----

const PAGE_DIRS = ['price', 'spec', 'subscribe', 'enterprise', 'join', 'company', 'contact'];
const ROOT_PAGES = ['index.html', 'mosaic-removal.html', '404.html'];

function walk(relDir, pred) {
  const abs = join(ROOT, relDir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...walk(relative(ROOT, p).replace(/\\/g, '/'), pred));
    else if (pred(name)) out.push(relative(ROOT, p).replace(/\\/g, '/'));
  }
  return out;
}

function publicFiles() {
  const html = (n) => n.endsWith('.html');
  const files = [];
  for (const prefix of ['', 'en/', 'zh-tw/']) {
    for (const f of ROOT_PAGES) if (existsSync(join(ROOT, prefix + f))) files.push(prefix + f);
    for (const d of PAGE_DIRS) files.push(...walk(prefix + d, html));
  }
  files.push(...walk('_includes', html).filter((f) => !f.startsWith('_includes/docs/')));
  files.push(...walk('_layouts', html));
  files.push(...walk('_data', (n) => n.endsWith('.yml')));
  files.push(...walk('_data/lang', (n) => n.endsWith('.json')));
  files.push('llms.txt', 'llms-full.txt');
  return [...new Set(files)];
}

/** `_data/plans.yml`: pro の tier の範囲を落とす (込み時間の突き合わせのため残すデータ) */
function dropPlansYmlData(src) {
  const lines = src.split('\n');
  const out = [];
  let tier = null;
  for (const line of lines) {
    const m = line.match(/^ {2}- code: (\S+)/);
    if (m) tier = m[1];
    else if (/^\S/.test(line)) tier = null;
    if (tier === 'pro') continue;
    out.push(line);
  }
  return out.join('\n');
}

/** `_data/l10n/{en,zh-tw}/plans.yml`: tiers の下の `pro:` の欄を落とす (i18n-site-data-plans.test.js が要求する) */
function dropL10nPro(src) {
  const lines = src.split('\n');
  const out = [];
  let inPro = false;
  for (const line of lines) {
    if (/^ {2}pro:\s*$/.test(line)) { inPro = true; continue; }
    if (inPro && (/^ {0,2}\S/.test(line))) inPro = false;
    if (inPro) continue;
    out.push(line);
  }
  return out.join('\n');
}

function publicVisible(rel) {
  let src = read(rel);
  if (rel === '_data/plans.yml') src = dropPlansYmlData(src);
  if (/^_data\/l10n\/(en|zh-tw)\/plans\.yml$/.test(rel)) src = dropL10nPro(src);
  return visible(src);
}

test('docs 以外の公開ページの対象にページ・部品・データ・llms が入っている', () => {
  const files = publicFiles();
  for (const f of ['index.html', 'en/index.html', 'zh-tw/index.html', 'price/index.html', '_data/plans.yml', '_data/l10n/en/plans.yml', '_data/lang/en.json', 'llms-full.txt', '_includes/pricing-cards.html']) {
    assert.ok(files.includes(f), `対象に ${f} が無い`);
  }
});

test('除外はファイルごとではなくキーの範囲 (plans.yml の light と enterprise の名前は残る)', () => {
  const plans = dropPlansYmlData(read('_data/plans.yml'));
  assert.match(plans, /- code: light/);
  assert.match(plans, /- code: enterprise/);
  assert.doesNotMatch(plans, /- code: pro/);
  assert.match(plans, /quote_label:/);
  const l10n = dropL10nPro(read('_data/l10n/en/plans.yml'));
  assert.match(l10n, /^ {2}light:/m);
  assert.match(l10n, /^ {2}enterprise:/m);
  assert.doesNotMatch(l10n, /^ {2}pro:/m);
});

test('docs と公開ページ (ja / en / zh-tw) の通貨の付いた金額は許したものだけ', () => {
  const allowed = allowedAmounts();
  const offenders = [];
  let seen = 0;
  for (const rel of [...new Set([...docsFiles(), ...publicFiles()])]) {
    const text = publicVisible(rel);
    seen += [...text.matchAll(CURRENCY_AMOUNT)].length;
    for (const h of findUnlistedAmounts(text, allowed)) {
      offenders.push(`${rel}: ${h.match} … ${text.slice(Math.max(0, h.index - 30), h.index + 30).replace(/\n/g, ' ')}`);
    }
  }
  assert.ok(seen > 0, '陽性対照: 金額が読めていない');
  assert.deepEqual(offenders, []);
});

test('docs 以外の公開ページ (ja / en / zh-tw) に今の料金と合わない語が無い', () => {
  const offenders = [];
  for (const rel of publicFiles()) {
    const text = publicVisible(rel);
    for (const h of findPlanTextHits(text)) {
      offenders.push(`${rel}: ${h.match} … ${text.slice(Math.max(0, h.index - 30), h.index + 30).replace(/\n/g, ' ')}`);
    }
  }
  assert.deepEqual(offenders, []);
});
