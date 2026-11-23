// Microsoft Store のバッジの見た目の E2E。
//
// ## 何を守るのか
//
// バッジは Microsoft の公式の画像なので、形・縦横比を変えない (`_includes/store-badge-img.html`)。
// 属性 (width / height / class) の検査 (`src/lib/site-store-button.test.js`) では、周りの CSS
// (例: docs の本文の `.rich-prose` の img の枠・角丸・余白) が当たって描かれ方が変わるのを拾えないので、
// ビルド出力 (`_site/`) を実際に描いて、見えているバッジ全部について次を確かめる。
//
// - 幅 ÷ 高さが元の画像の 161 / 44 (±0.01)
// - 高さが 38px (普通のボタン) か 50px (大きいボタン)
// - 枠の線が 0、角丸が 0 (画像の角はそのまま)
// - 包むリンクの高さがバッジと同じ (押せる範囲・フォーカスの枠が下の空白へ広がらない)
// - 包むリンクの外側に明るい 1px の縁 (box-shadow) がある (配布元の dark 版の地と縁は暗い地に溶けるため。`src/app.css` の .store-badge-link)
//
// 対象はバッジを置くページ (トップ・料金・docs のインストールの節) を 3 言語で、2 つの幅。
import { test, expect, type Page } from '@playwright/test';

const PAGES = ['/', '/price/', '/docs/', '/en/', '/en/price/', '/en/docs/', '/zh-tw/', '/zh-tw/price/', '/zh-tw/docs/'];
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '390', width: 390, height: 844 },
];
const RATIO = 161 / 44;
const HEIGHTS = [38, 50];

type Measured = {
  where: string;
  w: number;
  h: number;
  border: number;
  radius: string;
  linkH: number;
  linkShadow: string;
};

async function measureBadges(page: Page): Promise<Measured[]> {
  return page.$$eval('img[src*="/assets/img/store-badge/"]', (imgs) =>
    imgs
      .filter((img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((img) => {
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const link = img.closest('a');
        return {
          where: link?.getAttribute('data-store-button') ?? '(リンクの外)',
          w: r.width,
          h: r.height,
          border:
            parseFloat(cs.borderTopWidth) +
            parseFloat(cs.borderRightWidth) +
            parseFloat(cs.borderBottomWidth) +
            parseFloat(cs.borderLeftWidth),
          radius: cs.borderTopLeftRadius,
          linkH: link ? link.getBoundingClientRect().height : r.height,
          linkShadow: link ? getComputedStyle(link).boxShadow : 'none',
        };
      }),
  );
}

for (const vp of VIEWPORTS) {
  test.describe(`幅 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of PAGES) {
      test(`${path}: 見えているバッジは元の縦横比・高さ 38/50・枠なし・リンクの高さが同じ・外側の明るい縁`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'load' });
        const badges = await measureBadges(page);
        if (path.endsWith('/docs/')) {
          expect(badges.map((b) => b.where), 'docs のインストールの節のバッジ').toContain('docs-install-store');
        }
        expect(badges.length, '見えているバッジが 1 つも無い').toBeGreaterThan(0);
        for (const b of badges) {
          const label = `${path} ${b.where} (${b.w.toFixed(1)}×${b.h.toFixed(1)})`;
          expect(Math.abs(b.w / b.h - RATIO), `${label}: 縦横比`).toBeLessThanOrEqual(0.01);
          expect(HEIGHTS.some((h) => Math.abs(b.h - h) < 0.5), `${label}: 高さ`).toBe(true);
          expect(b.border, `${label}: 枠の線`).toBe(0);
          expect(b.radius, `${label}: 角丸`).toBe('0px');
          expect(Math.abs(b.linkH - b.h), `${label}: リンクの高さ ${b.linkH.toFixed(1)}`).toBeLessThan(1);
          expect(b.linkShadow, `${label}: リンクの外側の明るい縁`).toMatch(/rgba\(255, 255, 255, 0\.7\) 0px 0px 0px 1px/);
        }
      });
    }
  });
}
