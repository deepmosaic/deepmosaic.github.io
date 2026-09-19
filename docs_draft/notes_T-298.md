# T-298 — site: Enterprise カードを見積ベースへ (維持管理費注記 / 支払方法 / CTA を相談に戻す / docs 導入の流れ / 問い合わせページのカード削除)

実装日: 2026-09-19 / Role: Implementer → Reviewer → Fixer → **Tester (ゲート再実行とコミットまで完了)**

**コミット済み・push / デプロイなし。** ゲートは下記「コマンド」と「ゲート再実行 (Tester)」を参照。

---

## 変更点 (要約)

| ファイル | 変更 |
|---|---|
| `_data/plans.yml` (enterprise) | `price_unit` の直後に新キー **`price_note: "+ 維持管理費用 / 月"`**。`支払方法` の値を **「請求書払い（クレジットカード即時払い・銀行振込）」** に。`cta` を T-263 の「ダウンロードして申し込む」(`kind: download`) から **「導入について相談する」/ `kind: link` / `href: /enterprise/inquiry/` / `external: false`** に巻き戻し、**`secondary_cta` ブロックを削除**。周辺コメントを「Enterprise は見積ベース (dashboard 法人管理 → 支払リンク)、`self_serve` は false のまま」に書き換え |
| `_includes/pricing-cards.html` | 価格ブロックの直後に `{%- if plan.price_note %}<p class="mt-1 text-[12px] leading-[1.7] {{ key_cls }}">…</p>{%- endif %}` (5 行 + コメント)。ヘッダコメントの T-263 記述を更新 (`secondary_cta` を持つプランは現在ゼロ・仕組みは汎用として残置) |
| `.github/workflows/jekyll.yml` | `Verify build output` の `data-dl="enterprise"` ガード (T-263) を撤去し、**`href="/enterprise/inquiry/"` と `維持管理費用` の grep 2 本**に置換。ページ毎の `data-dl` 件数ガードは「1 本以上」判定なので不変 (理由をコメントに追記) |
| `_includes/docs/07-team.html` | 「請求（アカウント数・請求書）」節を **「導入の流れ（お見積り・お支払い）」** に書き換え。`ol` = 導入相談 → 見積書 (会社名・アカウント数・アカウント単価・維持管理費用) → 支払リンク (カード即時払い = 以降定額制 / 請求書払い = 銀行振込 30 日以内) → 組織コードのメール → インストールとログイン (組織コード入力) → メンバー招待。kv **6 行** = お支払い方法 / アカウント数の変更 (増やすのみ・維持管理費用も自動再計算) / 減らせる下限 (お見積り時の数より減らせない・メンバー削除は可) / 決済ポータル (カード払いのみ) / **請求書の表示 / PDF (Fixer で復活)** / お支払いが確認できないとき (チーム全体の Enterprise 機能が停止・入金確認で自動再開)。ヘッダコメントの「自己申込を開いてから公開」を差し替え |
| `enterprise/inquiry/index.html` | 「Enterprise 以外のお問い合わせはこちら」**カードを削除**。ただし**逃がし先そのものは 1 行の注記として残した** (Fixer / レビュー HIGH)。詳細は下の「レビュー指摘の反映」 |
| `e2e/inquiry.spec.ts` | **追加**: 逃がし先 (`/docs#support` と `mailto:support@`) がフォームより**上**に 1 本ずつ出ていることを固定するテスト (Fixer / レビュー HIGH) |
| `src/lib/pricing.test.js` | `enterprise.price_note` が非空文字列であることを固定するテストを追加。CTA は `loadTiers()` が `cta:` を読み飛ばすため検査できない旨と、**CI の `_site/price/index.html` への grep が固定している**旨をコメントで明記 |
| `docs_draft/notes_T-263.md` | 冒頭に「2026-09-19 (T-298): 見積ベースへ方針変更。CTA 巻き戻し」の注意書き。T-263 の「ローンチ切替手順 (self_serve=true)」は将来用に残すが現時点では実行しない、と明記 |

`summary`「メーカー・ポストプロダクション向け。最低 3 アカウント（¥24,000〜）。」は**ユーザー決定により変更なし**。
`_config.yml` / `src/islands/` / `assets/` / `_data/docs_toc.yml` は無変更。節 ID (`team` および既存 20 個) も無変更。

## コマンド (実行済み)

```bash
cd C:/Users/core/scripts/deepmosaic/deepmosaic.github.io
npm test                                                  # node --test 130 件 (pass 129 / skip 1)
npm run build && bundle exec jekyll build --strict_front_matter
node scripts/check-docs.mjs                               # OK (2 ページ / 14 ファイルの深いリンク)
E2E_SKIP_BUILD=1 npm run e2e                              # Playwright 13 passed / 1 skipped (CORS spec は E2E_BASE_URL 時のみ)
                                                          # ↑ Fixer で +1 (逃がし先の位置を固定するテスト)

# CI の Verify build output のうち T-298 が足した 2 本 (手で抽出)
grep -q 'href="/enterprise/inquiry/"' _site/price/index.html
grep -q '維持管理費用'                  _site/price/index.html
! grep -q 'data-dl="enterprise"' _site/price/index.html    # 旧ガードの対象が消えたこと
for p in index.html price/index.html spec/index.html; do grep -c 'data-dl="' "_site/$p"; done   # 9 / 7 / 4 (>0)
```

> Git Bash から非 ASCII のパターンを `grep -q '維持管理費用'` と直接打つと一致しないことがある
> (シェルの文字コード)。ローカルで確かめるときは `node -e "…includes('維持管理費用')"` か
> `grep -f <パターンファイル>` を使う。**CI (ubuntu / UTF-8) では YAML に書いたままで通る** —
> 同じ workflow に既存の日本語 grep (`取り除く機能はありません` 等) がある。

`scripts/check-plan-catalog.mjs` は `SUPABASE_PROXY_API_KEY` が無いため未実行 (未設定時は skip = exit 0)。
`price_note` は Supabase の列ではないので比較対象外 (`diffPlanCatalog` が見るのは
`max_contracts` / 込み時間 / 月額 / `min_seats` のみ)。

## ゲート再実行 (Tester / 2026-09-19)

Fixer の変更を含む最終状態で全ゲートを回し直した。結果:

| ゲート | 結果 |
|---|---|
| `npm test` (node --test, `src/lib/*.test.js`) | 130 件中 **pass 129 / skip 1 / fail 0** |
| `npm run build` (Vite) → `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter` | エラーなし |
| `node scripts/check-docs.mjs` | OK (2 ページ / 14 ファイルの深いリンク)。節 ID 20 個の契約も維持 |
| CI `Verify build output` のうち T-298 が関係する 9 項目 (node の `includes` で抽出検証) | 全て OK (`/enterprise/inquiry/` / `維持管理費用` / CTA 文言あり、`data-dl="enterprise"` 消滅、ページ毎の `data-dl` は 9 / 7 / 4 で > 0、問い合わせページは逃がし先 1 本 + island + noscript) |
| `E2E_SKIP_BUILD=1 npx playwright test` (chromium) | **13 passed / 1 skipped** (skip は `inquiry-cors` = `E2E_BASE_URL` 指定時のみ実行) |

Tester が追加で直したのは 2 点だけ (どちらもコメント / メモの食い違い):

- `_includes/pricing-cards.html` の `secondary_cta` 分岐のコメントが「Enterprise の
  『導入について相談する』」を**現役の用例**として説明したままだった → T-263 当時の用例であり
  **現在この分岐を使うプランは無い**と書き換え (ヘッダコメントの記述と揃えた)。
- 本メモの HTML 抜粋が `text-ink-3` になっていた → 実装は `text-ink-2` (本文色)。実装に合わせた。

`scripts/check-plan-catalog.mjs` は `SUPABASE_PROXY_API_KEY` 未設定のため設計どおり skip (exit 0)。
`price_note` は Supabase の列ではないので、鍵があっても比較対象外。

## レビュー指摘の反映 (Fixer / 2026-09-19)

### HIGH — 問い合わせページの逃がし先が消える (`enterprise/inquiry/index.html`)

サイト内の「お問い合わせ」は **ヘッダ (モバイルナビの `contact_url`) / フッター /
`docs/02-account` の「ログインできない場合」/ `docs/06-ops` / クッキーポリシー** から
**全部このページに来る**。一方フォームは会社名必須・3 アカウント以上の Enterprise 専用なので、
カードごと消すと非 Enterprise の用件が**行き止まり**になる (代替の案内はページ上に何も残らない)。

**対応**: カード (`.card` の箱) は指示どおり外したまま、**逃がし先を 1 行の注記としてフォームの
直前に残した**。文面はカード時代と同じ 2 経路 — アプリ内「お問い合わせ」の手順 (`/docs#support`) と、
ログインできない場合の `mailto:{{ support_email }}`。

```html
<p class="mb-6 text-[14px] leading-[1.9] text-ink-2">
  Enterprise 以外のご質問・不具合のご報告は、アプリ内の「お問い合わせ」からお送りください（手順）。
  ログインできない場合は support@… までご連絡ください。
</p>
```

**回帰の固定**: `e2e/inquiry.spec.ts` に
「Enterprise 以外の用件で来た人の逃がし先がフォームより上にある (T-298)」を追加。
`a[href="/docs#support"]` と `a[href^="mailto:"]` が **可視で 1 本ずつ**あること、
`compareDocumentPosition` で**島 (`[data-island="inquiry-form"]`) より前**にあることを見る。
`noscript` 内の mailto は JS 有効時に要素化されないので件数には入らない。

> ヘッダ / フッターの「お問い合わせ」自体を一般窓口へ付け替える案もあったが、
> **T-298 の範囲外**(サイト全体の導線変更)なので採らなかった。1 行注記で行き止まりは解消している。

### MEDIUM — docs から「請求書の表示 / PDF」が消えた (`_includes/docs/07-team.html`)

アプリ側 (`desktop/src/lib/components/team/TeamBillingTab.svelte`) に請求書一覧は**現存**する。
T-313 で Customer Portal はカード払い限定になったが、**請求書一覧は請求書払いでも表示される**
(「請求書は下の一覧から開けます」)。docs から落ちると実機能が文書化されない状態になるため、
kv 行を復活させた。一覧の列は実装に合わせて **請求日・請求書番号・金額・支払い状況**
(旧文の「対象期間」は実装に無い)、行の操作は「表示」(ブラウザ) と「PDF」(保存)、
**カード / 請求書払いのどちらでも確認できる**ことを明記。

### MEDIUM — `plans.yml` の spec 行「請求 / 月末締め翌月請求」

**未対応 (意図的)**。チケットが指定した変更対象は `支払方法` の値のみで、請求サイクルの文言は
事業判断 (設計書 A2 でも「要判断」)。勝手に書き換えると実在しない条件を広告することになるため、
下の「残課題」に残してリーダー判断に回す。

## 注意点

- **CTA の固定はデータ側ではなくビルド出力側。** `src/lib/plans-yml.js` の極小パーサは
  `cta:` のネストを読み飛ばすので、`pricing.test.js` からは CTA を検査できない。相談導線が
  静かに消えないことは `.github/workflows/jekyll.yml` の grep が唯一の砦 — **この 2 本を消さないこと**。
- **`data-dl="enterprise"` はもう出力されない。** GA4 の `link_id` に `enterprise` が来なくなるので、
  Enterprise の反応は `/enterprise/inquiry/` の到達 (と Worker の `/inquiry` 受信数) で見る。
- **`self_serve` は false のまま。** サイトだけ申込ボタンに戻すと `seat-based plan requires contact`
  (400) になるので、戻すときは T-263 の切替順序 (sandbox → live → Worker → サイト) に従うこと。
  desktop / web 側のフラグ固定は T-299。
- 維持管理費用の**金額は書いていない** (会社ごとのお見積り)。金額を書くと検査対象外の数値が
  サイトにだけ残り、`check-plan-catalog.mjs` の網にも掛からない。
- docs の「導入の流れ」は dashboard の法人管理 (見積 → 支払リンク → 組織コード自動送信 → unpaid で
  自動凍結) の仕様に合わせてある。**dashboard 側の実装 (別チケット) が変わったら 07-team.html も直す。**
- 問い合わせページの逃がし先は**カードから 1 行の注記に変わった**だけで、経路
  (`/docs#support` / `support@`) は維持している。**この 1 行を消すと非 Enterprise の
  問い合わせが行き止まりになる** — 消すなら先にヘッダ / フッターの「お問い合わせ」を
  一般窓口へ付け替えること (`e2e/inquiry.spec.ts` が落ちて気付ける)。

## 残課題 / 申し送り

- [ ] `plans.yml` enterprise の spec 行 **「請求 / 月末締め翌月請求」** は今回触っていない。
      見積 + 支払リンク (カードは即時払い・請求書は 30 日以内) と厳密には整合しないので、
      文言の是非はリーダー判断 (設計書 A2 でも「要判断」扱い)。
- [x] docs の **「請求書の表示 / PDF」** は Fixer で復活済み (実装に現存する機能のため)。
      **「増やせる上限」** の行は戻していない — 趣旨は「アカウント数の変更」の行
      (「上限を超える数は保存できません」) に畳み込み済み。
- [ ] `docs/06-ops.html` / `docs/02-account.html` の「問い合わせフォーム」リンクは
      引き続き `/enterprise/inquiry/` を指す。**一般窓口のページを別に作るか否か**は
      別チケット (今は問い合わせページの 1 行注記で受けている)。
- [ ] `docs_draft/notes_T-252.md` は「支払方法 = クレジットカード・請求書払い・銀行振込」を
      前提に書かれている (ビルド対象外の作業メモなので今回は未更新)。
- [ ] push はしない (サイトの push = 即公開)。公開時は未 push の 6 コミット (T-254〜T-292) と
      同時に出るため、`/docs/#team` と `/enterprise/inquiry/` の公開可否をリーダーが判断すること。

## ロールバック

`git revert` 1 コミットで戻る (site の 9 ファイルのみ。うち 2 つは `docs_draft/` の作業メモ)。部分的に戻す場合:

- CTA だけ T-263 に戻す → `plans.yml` の `cta` を `kind: download` + `secondary_cta` 復活 →
  `jekyll.yml` のガードも `data-dl="enterprise"` に戻す (**セットで戻さないと CI が落ちる**)
- 注記だけ外す → `plans.yml` の `price_note` を削除 → `jekyll.yml` の `維持管理費用` grep と
  `pricing.test.js` の T-298 テストも同時に外す
- 問い合わせページの 1 行注記を外す → `e2e/inquiry.spec.ts` の T-298 テストも同時に外す
  (**外す前にヘッダ / フッターの「お問い合わせ」の行き先を決めること**)
