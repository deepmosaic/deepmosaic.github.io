# T-2308 トップのヒーローのボタンがスマートフォンの幅で切れるのを直す (3 言語)

## 変更点
- `index.html`・`en/index.html`・`zh-tw/index.html` のヒーローの副ボタン (`data-dl="hero-webapp"`) の文を
  `<span>短い名前<span class="hidden sm:inline">（…）</span></span>` にした。640px 未満では「ブラウザでお試し」/
  `Try it in your browser` / `在瀏覽器中試用` だけを出す。
  - 外側の `<span>` は、`.btn-*` の `inline-flex gap-2` で短い名前と括弧の間に 8px の隙間が入らないようにするため
    (広い幅の見た目は前と同じ)。`.btn-*` の `whitespace-nowrap` は変えていない。
  - textContent は前と同じ (計測の link_text は変わらない)。
- 英中の `source_hash` を `node scripts/i18n/accept-site.mjs en/index.html zh-tw/index.html` で書き直した。
- テスト:
  - `src/lib/site-copy-t2308.test.js` (新規): 3 言語で括弧の部分が `hidden sm:inline` に包まれ、外に見えるのが短い名前だけ。
  - `e2e/i18n-layout.spec.ts`: 「mobile (Pixel 7) のボタンの幅 (T-2308)」を追加 (`/`・`/en/`・`/zh-tw/` で見えている `.btn-*` が
    全部 412px の viewport の中に収まる)。台帳の検査でも、トップ (`/`) は警告 `preexisting` を 0 件であることを求めるようにした。
  - 修正前の `_site` で、`/`・`/en/` の新しい検査と `en top (mobile)` の preexisting の検査が落ちることを確認済み
    (zh-tw は文が短く、修正前から収まっていた)。

## ほかのボタンの一覧 (同じ検査、Pixel 7)
- `/`・`/en/`・`/zh-tw/` の見えている `.btn-primary / .btn-secondary / .btn-ghost` は、修正後に全部 412px に収まる。
  はみ出していたのはヒーローの「ブラウザでお試し（…）」だけ (ja・en)。ほかに直したボタンは無い。
- Store のボタン (`store_enabled: true` のとき) は既定 false で出ないため、この検査では見ていない。true にするときは同じ検査を回す。

## 注意点・巻き戻し
- 巻き戻しは 3 ファイルの span を外して `accept-site.mjs` を再実行するだけ。
- ja のページ (index.html) を変えたので、公開の際は英中と同時に出す (source_hash の一致)。
