# T-1968 メモ: md 幅のヘッダーに「法人様」、導入相談ページの表記を「御社」に

req1111 のリリース前検査の指摘 9 (MEDIUM) と LOW (site-visual) の修正。

## 変更点

| 場所 | 変更 |
|---|---|
| `_includes/header.html` 行の `<div>` | `gap-4 lg:gap-7` → `gap-3 lg:gap-7` (md の間だけ 4px 詰める) |
| `_includes/header.html` ダウンロードのボタン (`data-dl="header"`) | `md:px-3 lg:px-4` を追加。文言を `<span><span class="hidden lg:inline">無料で</span>ダウンロード</span>` に (md は「ダウンロード」、lg 以上は「無料でダウンロード」)。href / `download` / `data-dl` は不変 |
| `_includes/header.html` 法人向けのボタン | `hidden lg:inline-flex` → `hidden md:inline-flex` (+ `md:-ml-1 md:px-3 lg:-ml-4 lg:px-4`)。`aria-label="法人様はこちら"` を追加。文言を `<span>法人様<span class="hidden lg:inline">はこちら</span></span>` に。アイコン (Building2) は全幅 |
| `_includes/header.html` 冒頭の Liquid コメント | 上の理由を追記 |
| `enterprise/inquiry/index.html` | front matter の `description` とリード文 (h1 直後の p) の「自社システムへの導入のご相談」→「御社のシステム・サービスへの導入のご相談」。フォームの placeholder (`src/islands/InquiryForm.svelte`) は利用者が書く欄の例なので「自社」のまま |
| `e2e/header-enterprise.spec.ts` | 「1024px 未満では隠れる」を廃止。768〜1023px は「法人様」で見え、導入相談へのリンクで一番右、767px 以下はヘッダーのボタンが隠れてドロワーに項目、320 / 767 / 768 / 800 / 900 / 1023 / 1024 / 1280px ではみ出し・折り返し・重なり無し |
| `e2e/enterprise-integration.spec.ts`、`src/lib/site-copy-t1941.test.js` | リード文・description の期待値を「御社」に。「自社」が無いことも見る |

## 注意点・既知の制約

- 短い表示は「足す部分を lg 以上で出す」形にした。そのため `textContent` は全幅で「無料でダウンロード」「法人様はこちら」のまま
  (`src/main.js` が GA4 の `link_text` に `a.textContent` を入れる。計測の値は変わらない)。
- 外側の `<span>` は必須: `.btn-*` は `inline-flex gap-2` なので、テキストと span が別の flex 項目になると文字の途中に 8px 空く。
- 768px の余白は Noto Sans JP 読み込み後の実寸で 14px (外部フォントを遮断した試作の 40px より狭い)。ナビやボタンの文言を
  md で長くすると、すぐにはみ出す。`e2e/header-enterprise.spec.ts` の 768px のケースが検出する。
- noscript 版のナビは従来どおり `md:hidden` の中 (md 以上では JS 無しでもヘッダーのボタンが出るので導線はある)。
- スクリーンショット: `D:/dm-scratch/req1111/verify/site/after-header-<幅>.png` (767 / 768 / 800 / 900 / 1023 / 1024 / 1280)。

## コマンド

```bash
npm test && npm run build && bundle exec jekyll build --strict_front_matter && node scripts/check-docs.mjs && npm run e2e
```

## ロールバック

`_includes/header.html` と `enterprise/inquiry/index.html` を戻し、テスト 3 本も戻す。
