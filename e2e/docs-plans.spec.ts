// docs の料金の記述 (Pro・Enterprise) のビルド出力の E2E。
//
// ## 何を守るのか
//
// - /docs/ の見える文で、Premiere Pro 以外の「Pro」は契約中の Pro の人への案内の 1 か所だけ。
// - `contract-limits.html` の出力は公開しているプラン (Light) だけで、「Light は最大 2 契約」が #license と #usage の 2 か所に出る。
//   「Pro は最大」と、2 以外の「最大 N 契約」は出ない。
// - /docs/#team のプランの名前は「無料プラン / 有料プラン」で、金額 (桁区切りの数) が無い。
// - /docs/web/ に Premiere Pro 以外の「Pro」が無く、「有料プランと組織（Enterprise）」が 2 か所ある。
//
// 文言・ソースの細かい検査は `src/lib/site-copy-current-pricing.test.js`。ここは Liquid → HTML の継ぎ目だけを見る。判定は文字列の照合だけ。
import { test, expect } from '@playwright/test';

/** Premiere Pro 以外の Pro */
const PRO_WORD = /(?<!Premiere )(?<!Premiere )\bPro\b/g;

const PRO_NOTICE = 'Pro は新規の受付を終了しました';

/** docs の目次と本文を包む要素 (docs のページには main が無い。ヘッダー・フッターを除くため) */
const DOCS_BODY = '[data-island="scrollspy"]';

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin && (url.protocol === 'http:' || url.protocol === 'https:'),
    (route) => route.abort(),
  );
});

/** 文の中の出現数 */
const countOf = (text: string, needle: string): number => text.split(needle).length - 1;

test('/docs/ の Pro は契約中の人への案内の 1 か所だけで、契約数は Light の 2 契約だけ', async ({ page }) => {
  await page.goto('/docs/', { waitUntil: 'domcontentloaded' });
  const text = await page.locator(DOCS_BODY).innerText();

  const hits = [...text.matchAll(PRO_WORD)];
  expect(hits.map((m) => text.slice(Math.max(0, m.index! - 20), m.index! + 20))).toHaveLength(1);
  expect(text.slice(hits[0].index!, hits[0].index! + PRO_NOTICE.length)).toBe(PRO_NOTICE);

  expect(text).not.toContain('Pro は最大');
  expect([...text.matchAll(/最大\s?(\d+)\s?契約/g)].map((m) => m[0]).filter((s) => !/最大\s?2\s?契約/.test(s))).toEqual([]);
  expect(text).not.toContain('Light / Pro');

  for (const id of ['license', 'usage']) {
    await expect(page.locator(`#${id}`)).toContainText('Light は最大 2 契約');
  }
  expect(countOf(text, 'Light は最大 2 契約')).toBeGreaterThanOrEqual(2);
});

test('/docs/#team はプランの名前が無料プラン / 有料プランで、金額が無い', async ({ page }) => {
  await page.goto('/docs/#team', { waitUntil: 'domcontentloaded' });
  const team = await page.locator('#team').innerText();
  expect(team).toContain('無料プランと有料プランでは');
  expect(team).not.toMatch(/\d{1,3}(?:,\d{3})+/);
  expect(team).not.toMatch(/¥/);
});

test('/docs/web/ に Pro が無く、有料プランと組織の免除が 2 か所ある', async ({ page }) => {
  await page.goto('/docs/web/', { waitUntil: 'domcontentloaded' });
  const text = await page.locator(DOCS_BODY).innerText();
  expect([...text.matchAll(PRO_WORD)].map((m) => text.slice(Math.max(0, m.index! - 20), m.index! + 20))).toEqual([]);
  expect(countOf(text, '有料プランと組織（Enterprise）')).toBe(2);
});
