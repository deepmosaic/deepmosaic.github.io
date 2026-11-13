# T-2215 (i18n1112 I18N-804) 公式サイトの英中のページのはみ出し・日本語の残り (漏れ) の検査と既存の Playwright の通し

## リーダーへ
- 既存の Playwright 10 本は、期待値を直さずに全部通った (149 passed / 1 skipped = `inquiry-cors`、`E2E_BASE_URL` は付けていない)。§3-1 の (i)〜(iv) に当たるものは無く、既存の spec は変えていない。
- 新しい `e2e/i18n-layout.spec.ts` は 44 test すべて合格 (はみ出しのエラー 0・漏れ 0・横スクロール 0・`<html lang>` 正)。ページ・テンプレート・データ・CSS は変えていない。
- 作業の順: T-2218 のコミットは `git log` に無かった (このチケットが先)。基点は `f54e4a1`。

## 変更点
| ファイル | 中身 |
|---|---|
| `src/lib/i18n-overflow.js` (新規) | 判定の純関数 `diffOverflow`・`diffLeaks`・`judgeLeak`・`pageHasHorizontalScroll`・`jaCounterpart`・`listI18nPages`・`pageSlug`・`parseAllow` と、ブラウザで採る式 `OVERFLOW_PROBE_SOURCE`・`LEAK_PROBE_SOURCE` |
| `src/lib/i18n-overflow.test.js` (新規) | 仕様テスト 24 件 (`npm test` に乗る) |
| `e2e/i18n-layout.spec.ts` (新規) | 台帳の 9 本 (join は 3 状態) × en / zh-tw × desktop (1280×800) / mobile (Pixel 7、ドロワーを開いた状態も) の 44 test + 採取の式の対照 1 test |
| `e2e/i18n-allow.json` (新規) | 許可の一覧。初版は空 (`{ "version": 1, "entries": [] }`) |

## コマンド
```bash
cd D:/deepmosaic-wt/integrate/store1109/deepmosaic.github.io
node --test src/lib/i18n-overflow.test.js                                     # 判定の仕様テスト
npm run build && bundle exec jekyll build                                     # _site を作る
E2E_SKIP_BUILD=1 npx playwright test e2e/i18n-layout.spec.ts                  # はみ出し・漏れ
E2E_SKIP_BUILD=1 DM_I18N_SHOTS=1 npx playwright test e2e/i18n-layout.spec.ts  # + 撮影
```
- 結果: `e2e/.artifacts/i18n/report/<lang>-<slug>-<desktop|mobile>.json` (44 本)。各状態 (`page` / `drawer`) の `sampled` に採取の数、`overflow` / `leaks` に `errors` と `warnings`。
- 撮影: `e2e/.artifacts/i18n/{ja,en,zh-tw}/<slug>-<desktop|mobile>[-drawer].png` (各 33 枚)。ja の対応ページは en の test だけが撮る (並列の書き込みの競合を避ける)。git には入れない (`.gitignore` 済み)。
- **ウェーブ末尾にリーダーにしてほしいこと**: 上の 2 本を回し、画像を `D:/dm-scratch/i18n/shots/site/<lang>/` に写す (W8b の T-2231 が使う)。エラーが出たら持ち主のチケットか I18N-820 (T-2231) に回す。

## 対象にしたページ
- 台帳 `_data/i18n_pages.yml` の 9 本 × 2 言語。`/join/` は `join-code` (`#code=ABCD-EFGH-2345`)・`join-admin` (`#admin`)・`join-invalid` (フラグメント無し) の 3 状態に分けたので、1 言語あたり 11 状態、en 11 / zh-tw 11。幅 2 つで 44 test。
- ja の対応が取れなかったページ: 無し (全部 `jaCounterpart` で戻り、ja のページも 200 で開けた)。
- 対象外: 404・法務 (`/company/terms` ほか)・docs (台帳に無い)。英中のページの中のそれらへのリンク (`hreflang="ja"` のラベルと印) は採取している。

## 新しい spec の結果 (2026-11-13、`f54e4a1` + この変更、`_site` は全ゲートで作ったもの)
| lang | 幅 | ページ | path | kind | text | 扱い |
|---|---|---|---|---|---|---|
| en | mobile (page / drawer) | `/` | `body>section:nth-of-type(1)>div:nth-of-type(2)>div:nth-of-type(2)>a:nth-of-type(2)` | offscreen | `Try it in your browser (videos up to 10 …` | 警告 `preexisting`。ただし**利用者に見える欠け** (下) |

- **`/` の mobile のボタンの欠け (リーダー行き)**: 実測 (Pixel 7、viewport 412px、レビューでの計測) で、ja の「ブラウザでお試し（10 分までの動画・インストール不要）」のボタンは left −39.9 〜 right 451.9 (幅 約 492px)、en の「Try it in your browser…」は left −51.8 〜 right 463.8 (幅 約 516px)。どちらも祖先の `section.relative.overflow-hidden` に両端を切られていて、横スクロールが出ないのはこの overflow-hidden が隠しているため。**ja のページの CSS の不具合** (ボタンが折り返さず viewport より広い) で、このチケットでは ja のページを変えない規則のため直していない。en は ja より約 24px 多く欠ける (en の文の長さは T-2231 の参考)。zh-tw は文が短く画面の外へ出ていない。
- エラーは 0 件 (はみ出し・漏れ・横スクロール・`<html lang>`)。漏れの採取は各状態で 37 項目以上、陽性対照 (ja の対応ページの文を同じ言語の基準で判定) は各状態で 12 件以上の漏れを出しており、検査は空振りしていない。
- `<details>` は採取の前に全部開く (ja と英中で同じ操作)。`/` は 15 個で配下の漏れの候補 30、`/subscribe/` は 3 個で 6 を採っている (report の `sampled.details` / `leaksInDetails`)。開いても新しいエラー・警告は出なかった。

## レビューの指摘への対応 (Fixer、2026-11-13)
| 指摘 | 対応 |
|---|---|
| はみ出しの陰性対照が無い・node テストの `src.includes('script')` が `noscript` で空振り | e2e に対照の test を 1 本足した (`page.setContent` で clipped / ellipsis / clipped-y / spill / offscreen / no-name、スクロールの容器の中、画面の外の aria-hidden、漏れ 6 種、除外 4 種を置き、kind と漏れを assert)。node テストは `EXCLUDE` のセレクタの一覧を取り出して要素で比べる形にした |
| `/` の mobile の offscreen が利用者に見える欠け | 上の結果の節に実測の幅と、ja の CSS の不具合 (リーダー行き) であることを書いた |
| 漏れの採取が `display:contents`・`<option>`・svg の `<title>` を落とす | `isTextVisible` を足した (要素の箱が無ければ Range の矩形で、`option` は持ち主の `select`、svg の `title` は親の可視で判定)。対照の test で 3 つとも採れることを確かめた |
| ドロワーの待ちが無限のアニメーションで終わらない | `iterations === Infinity` のアニメーションを待ちの対象から外した (ドロワーは portal で body の直下に出るので、島の要素に絞る案は採らなかった) |
| `[data-i18n-switch]` の aria-label が検査に入らない | 部分木の除外 (spec §2-3) はそのままにし、外側の要素自身の aria-label だけを別に採るようにした (対照の test で「表示言語」が漏れとして出ることを確認) |
| 閉じた `<details>` の中身が採られない恐れ | 採取の前に全部開く (上)。report に `details` と `leaksInDetails` を出し、details があるのに 0 なら soft の失敗にした |
| `listI18nPages` が読めない行を黙って捨てる | コメント・空行以外で形に当たらない行は Error (`checks/head.mjs` の parseLedger と同じ制約)。仕様テストを 1 件足した |

## 既存の Playwright の通し (§3-1)
- `E2E_SKIP_BUILD=1 DM_I18N_SHOTS=1 npx playwright test` (前景で 1 回、4173 は空き) → 149 passed / 1 skipped (`inquiry-cors`、`E2E_BASE_URL` なしで skip)。
- レビューの指摘を直した後に再実行: `E2E_SKIP_BUILD=1 npx playwright test` → 150 passed / 1 skipped (対照の test が 1 本増えた。i18n-layout は 45 passed)。
- 分類: (i) 0 件・(ii) 0 件・(iii) 0 件・(iv) 0 件。直した期待値は無い。

## 置いた仮定・設計書 / spec との違い
- **閉じたドロワーの除外**: 閉じたモバイルのドロワー (`aside aria-hidden="true"` を `translate-x-full` で画面の外に置いたもの) が全ページで `offscreen` になり、英中だけにある印 (`(Japanese)` / `（日文）`) が ja に path の無いエラーになった (検査の誤検出)。allow に足すのではなく、採取の側で「`[aria-hidden="true"]` の配下で、矩形が viewport の左右の外に丸ごとあるもの」を見えていない扱いにした (`isParked`)。開いた状態は mobile の `drawer` で別に採っている。desktop ではドロワーの中を採らない。
- **sr-only** (1px 四方に切り抜いた読み上げ用の文) は、はみ出しの採取からは除き、漏れの採取には含める (読み上げられるため)。
- **`offscreen` の「スクロールの容器に収まっていれば数えない」**: 祖先に `overflow-x: auto|scroll` の要素があり、その容器自体が viewport の中にあれば数えない、と解釈した。
- **allow の `path` と `text` を両方書いた項目**は両方が当たったときだけ当たり (spec の「path か text」を、両方あるときは AND にした。狭い側)。
- **allow は漏れにも効く** (`diffLeaks`)。spec ははみ出しだけを書いているが、漏れの誤検出 (固有名詞など) を reason 付きで外せるようにした。
- **漏れの採取に `document.title` を足した** (`path: 'head>title'`)。spec の属性の一覧には無いが、タブに出る文なので見る。
- **仮名の判定**: ひらがな・カタカナ・長音 (ー) を数え、中黒 (・ U+30FB) は数えない (英中でも記号として使いうる)。en は漢字も数える。
- `judgeLeak` は boolean を返す。`diffOverflow` の 4 番目の引数 `ctx = { page (ja のパス), lang, width }` は allow の当たり判定のために足した。
- 陽性対照と採取数 > 0 の expect を足した (採取が壊れて 0 件になったとき緑にならないように)。はみ出しの側は対照の test (使い捨てのページ) で kind ごとに確かめる。
- **言語の切り替えの aria-label**: spec §2-3 の `[data-i18n-switch]` の部分木の除外は変えず、外側の要素自身の aria-label だけを追加で採る (中の「日本語」のリンクは `lang="ja"` の除外で外れる)。
- **`<details>` を開いて採る**ので、`DM_I18N_SHOTS=1` のスクリーンショットも details が開いた状態で写る。
- 漏れの採取の可視の限界: `<option>` は `select` の可視で見るので、閉じた select の選択肢も「見える」扱い (読み上げ・開いたときに出るため)。`datalist` の option は採らない。

## `playwright.config.ts` の `READ_ONLY_SPECS` への提案
- 入れてよい (外部へは何も送らず、ページを読むだけ)。ただし本番へ向けると英中のページと ja の対応ページで 44 test × 2〜3 回の読み込みになり、`e2e/.artifacts/` に書く。入れるなら公開後の確認の一部として、`playwright.config.ts` の持ち主のチケットで決める (このチケットでは変えていない)。

## ロールバック
- 4 ファイルを消すだけ (ページ・データ・既存の spec・設定は変えていない)。
