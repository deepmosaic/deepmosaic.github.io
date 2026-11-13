# T-2306 申し込みページ・料金カード・docs のプランの文を両方の配布に合う形に (backlog1113)

## 変更点
- 文の内容 (ja / en / zh-TW): 「アプリのプロフィールメニュー（Windows 版をダウンロードしてお使いの方）、またはこのページから Web 版のアカウントで申し込める。
  どちらで申し込んでも同じアカウントで Desktop 版と Web 版の両方で使える」。
  - `subscribe/index.html` (description・冒頭の段落・コメント)、`index.html` の料金節の sub、`price/index.html` の冒頭、`llms.txt` の /subscribe/ の行、
    `_includes/docs/02-account.html` の `#plan`。
  - 英中: `en|zh-tw/subscribe/index.html`・`en|zh-tw/price/index.html`・`en|zh-tw/index.html`・`_data/l10n/{en,zh-tw}/subscribe.yml`。`accept-site.mjs` で source_hash を書き直した。
- docs `#plan`: 公開中 (origin/master) のアプリのプロフィールメニューからの手順 4 行を戻し (語は「サインイン」)、その前に両方の配布の 1 段落、後に Web 版 (/subscribe/) での申し込みの 1 段落。
  Store 版のアプリに購入画面が無いことは T-2305 の `docs/store-edition.html` (store_enabled が true のときだけ) にあるので `#plan` には書かない。
- Store 版についての文は `store_enabled` が true のときだけ:
  - 新しい部品 `_includes/store-subscribe-note.html` (目印 `data-store-note="subscribe"`)。文は `_data/subscribe.yml` の `store_note` と英中の `store_note`。3 言語の /subscribe/ の冒頭の段落の下に置く。
  - FAQ: `_data/subscribe.yml` の faq を 4 件に (新しい「アプリから申し込めますか？」を先頭に、Store 版の FAQ は `store_only: true`)。英中も同じ位置に `store_only: true`。
    `_includes/faq.html` と `_includes/schema/faq.html` が同じ条件 (`unless store_enabled` → `where_exp: "i", "i.store_only != true"`) で外すので、表示と FAQPage の JSON-LD は食い違わない。
  - FAQ「プランの変更や解約はどこで行いますか？」に「Windows 版をダウンロードしてお使いの方は、アプリのプロフィールメニューの「プラン管理」からも行えます」を足した (公開中の docs #plan の手順と同じ内容)。
- 料金カードの「申し込む」(`_data/plans.yml` の `subscribe`、`_includes/pricing-cards.html`) は変えていない。/subscribe/ も残す。
- 検査: `scripts/i18n/checks/store.mjs` に申し込みのページの分を足した (false: 目印がどこにも無く、/subscribe/ (3 言語) に `Microsoft Store` の語が無い。
  true: /subscribe/ ごとに目印 1 つ、Store の FAQ が表示 (<details>) と FAQPage の JSON-LD の両方にある、ほかのページに目印が無い)。
  `node scripts/check-store-toggle.mjs` (true の出力) も合格 (/subscribe/ の FAQ は true で 4 件、false で 3 件)。

## テストの期待値を変えたもの (理由)
- `src/lib/site-copy-t1922.test.js` (spec が書き直してよいと書いたもの): Store だけを前提にした文の固定を、両方の配布に合う文 + Store の文は部品と store_only だけ、に書き直し。T-2306 の節の検査を追加。
- `src/lib/site-store-button-t2304.test.js`: checks/store.mjs の単体の模型に申し込みのページを足し、検出のケースを 6 つ追加 (弱めていない)。
- `src/lib/i18n-site-data-plans.test.js` (spec の一覧に無いが必要): subscribe の faq の件数を 3 → 4 に、欄を「ja の同じ位置の項目と同じ欄 (store_only を含む)」に、
  l10n の subscribe.yml のキーに `store_note` を足した。store_only の位置が ja と同じこと・store_note に Microsoft Store があることを新たに検査する (条件は増やしただけ)。

## ゲート
- `npm test` 1335 件 (pass 1332 / fail 0 / skip 3)
- `npm run build && bundle exec jekyll build --strict_front_matter` OK
- `node scripts/i18n/check-site.mjs _site` OK (12 モジュール)、`node scripts/check-store-toggle.mjs` OK
- `node scripts/check-docs.mjs` OK
- `E2E_SKIP_BUILD=1 npx playwright test` 150 passed / 1 skipped
- ja-identity: 基点 W7t は T-2303 より前なので全ページのヘッダーが違う。代わりに T-2305 のコミットの出力 (`D:/dm-scratch/backlog1113/base-T-2305/_site`) と比べ、
  違うのは `docs/index.html`・`index.html`・`price/index.html`・`subscribe/index.html`・`llms.txt` の 5 つだけ (spec の対象どおり)。

## 注意点・申し送り
- Store のページを公開して `store_enabled: true` にすると、/subscribe/ に Store 版の 1 文と FAQ が 1 件増える (FAQ は 4 件)。
- 「アプリのプロフィールメニューから申し込める」はサイト配布版 (インストーラ) のアプリの動き。Store 版のアプリは購入画面を出さない前提 (desktop T-1898 / isStoreBuild())。
  2.14 の desktop の実装と食い違いが無いかは、リーダーがウェーブ末尾で確かめること。
- 巻き戻し: このコミットを revert すれば T-2305 の状態に戻る (データ・部品・検査が 1 コミットにまとまっている)。
