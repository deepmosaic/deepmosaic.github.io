// 料金カード 2 枚の幅と中央寄せの E2E。
//
// ## 何を守るのか
//
// - 幅 1024px 以上: カード 1 枚の幅 = 3 列の grid の 1 列ぶん ((grid の親の内幅 - 2 × gap) / 3)、2 枚と間のかたまりが中央、
//   2 枚の高さがそろう。カードの中の文が折り返してもカードの外へはみ出さない (ja / en / zh-TW × トップと /price/)。
// - 768〜1023px は 2 列でコンテナいっぱい、768px 未満は縦積み (今のまま)。
// - `DM_PRICING_SHOTS_DIR` があるときだけ、幅 1280・1440 でカードの節を画像で保存する (確認用。リポには置かない)。
//
// 分岐のクラスの固定は `src/lib/site-copy-pricing-grid.test.js`。
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GAP = 20; // gap-5 = 1.25rem
const PAGES = [
  { path: '/', lang: 'ja', kind: 'top' },
  { path: '/price/', lang: 'ja', kind: 'price' },
  { path: '/en/', lang: 'en', kind: 'top' },
  { path: '/en/price/', lang: 'en', kind: 'price' },
  { path: '/zh-tw/', lang: 'zh-tw', kind: 'top' },
  { path: '/zh-tw/price/', lang: 'zh-tw', kind: 'price' },
] as const;
const WIDE = [1024, 1280, 1440];
const SHOT_WIDTHS = [1280, 1440];
const SHOTS_DIR = process.env.DM_PRICING_SHOTS_DIR;

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin && (url.protocol === 'http:' || url.protocol === 'https:'),
    (route) => route.abort(),
  );
});

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Layout = { inner: Box; cards: Box[]; pageOverflow: number };

/** 料金カードの節の grid の親 (コンテナ) の内側の箱と、カードの箱。 */
async function measure(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const section = document.querySelector('section:has(.plan-card-featured)');
    const grid = section?.querySelector(':scope .plan-card-featured')?.parentElement;
    const parent = grid?.parentElement;
    if (!grid || !parent) throw new Error('料金カードの grid が見つからない');
    const box = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
    const pr = parent.getBoundingClientRect();
    const ps = getComputedStyle(parent);
    const pl = parseFloat(ps.paddingLeft);
    const prr = parseFloat(ps.paddingRight);
    const inner = { ...box(pr), left: pr.left + pl, right: pr.right - prr, width: pr.width - pl - prr };
    const cards = [...grid.children].map((c) => box(c.getBoundingClientRect()));
    return { inner, cards, pageOverflow: document.documentElement.scrollWidth - window.innerWidth };
  });
}

/** カードの子孫で、自分の箱からはみ出す・カードの padding の内に収まらない要素。 */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const grid = document.querySelector('section:has(.plan-card-featured) .plan-card-featured')?.parentElement;
    for (const card of grid ? [...grid.children] : []) {
      const cr = card.getBoundingClientRect();
      const limit = cr.right - parseFloat(getComputedStyle(card).paddingRight) + 1;
      for (const el of card.querySelectorAll<HTMLElement>('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const label = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
        if (el.scrollWidth > el.clientWidth + 1) out.push(`${label} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
        if (r.right > limit) out.push(`${label} right ${r.right.toFixed(1)} > ${limit.toFixed(1)}`);
      }
    }
    return out;
  });
}

for (const { path, lang, kind } of PAGES) {
  for (const width of WIDE) {
    test(`${path} 幅 ${width}: カード 2 枚が 3 列ぶんの幅で中央、高さがそろい、はみ出さない`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const { inner, cards, pageOverflow } = await measure(page);
      expect(cards).toHaveLength(2);
      const col = (inner.width - 2 * GAP) / 3;
      for (const c of cards) expect(Math.abs(c.width - col)).toBeLessThanOrEqual(1);
      if (width >= 1280) for (const c of cards) expect(Math.abs(c.width - 360)).toBeLessThanOrEqual(1);
      const leftGap = cards[0].left - inner.left;
      const rightGap = inner.right - cards[1].right;
      expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
      expect(Math.abs(cards[0].height - cards[1].height)).toBeLessThanOrEqual(1);
      expect(pageOverflow).toBeLessThanOrEqual(0);
      expect(await overflowing(page)).toEqual([]);

      if (SHOTS_DIR && SHOT_WIDTHS.includes(width)) {
        mkdirSync(SHOTS_DIR, { recursive: true });
        await page.locator('section:has(.plan-card-featured)').screenshot({
          path: join(SHOTS_DIR, `${lang}-${kind}-${width}.png`),
        });
      }
    });
  }
}

for (const path of ['/', '/price/']) {
  for (const width of [768, 1023]) {
    test(`${path} 幅 ${width}: 2 列でコンテナいっぱい`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const { inner, cards } = await measure(page);
      expect(cards).toHaveLength(2);
      const col = (inner.width - GAP) / 2;
      for (const c of cards) expect(Math.abs(c.width - col)).toBeLessThanOrEqual(1);
      expect(Math.abs(cards[0].top - cards[1].top)).toBeLessThanOrEqual(1);
    });
  }

  for (const width of [412, 767]) {
    test(`${path} 幅 ${width}: 縦積み`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const { inner, cards } = await measure(page);
      expect(cards).toHaveLength(2);
      for (const c of cards) expect(Math.abs(c.width - inner.width)).toBeLessThanOrEqual(1);
      expect(cards[1].top).toBeGreaterThan(cards[0].bottom);
    });
  }
}
