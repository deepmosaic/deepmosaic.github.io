# T-2302 公開する版の表示言語を 3 言語に戻す (サイトの分)

- spec: `D:/dm-scratch/backlog1113/spec/T-2302.md` (「リーダーの改訂 2」の (2)・(3)、本文の「やること」6)。
- desktop / web の分は統合ブランチ `backlog1113-integrate` に入っている (desktop 01938c88・web ef887607)。サイトのコミットはそれとは別。
- 作業の前のサイトのブランチ `backlog1113-site` の先頭: 21f0e42 (T-2233 のサイトの分。その下に T-2232 = 5001542・T-2231 = a229422)。
  決定 §1 の順「T-2231 → T-2232 → T-2233 → T-2302」のとおり。

## 変えたもの
- `_includes/docs/01-intro.html` 77 行 (`#install` の「インストーラの言語」の kv-val。kv-key・行の class・並びは変えていない)。サイトの ja を意図して変える唯一の箇所。
  - 前: `日本語（言語の選択画面は出ません）。アプリも日本語 UI です`
  - 後: `日本語（言語の選択画面は出ません）。アプリの画面は日本語・英語・繁体字中国語に対応しています。初めて起動したときは Windows の表示言語に合わせて選ばれ（日本語・英語・中国語以外は英語）、画面右上のプロフィールメニューで切り替えられます`
  - 根拠: インストーラ (NSIS) は日本語のまま。言語の決め方は desktop `src/lib/i18n/resolve.ts` (`zh-*` は繁体字、それ以外は英語)、切り替えは `ProfileDropdown.svelte` の言語の行。docs はこのメニューを「プロフィールメニュー（右上）」と呼ぶ (`02-account.html`)。
- `src/lib/site-copy-t2302.test.js` (新規、`npm test` で回る): `#install` に 3 言語・初回は Windows の表示言語・プロフィールメニューで切り替えの文があり、「アプリも日本語 UI です」と「ログイン」が無い。インストーラの言語の文は残る。01-intro 全体に「日本語 UI」が無い。ヘルパーの陽性・陰性対照。実装の前に 2 件が落ちることを確かめた。

## 書かなかったこと
- 2.12 以前から更新した人 (保存値 null) は日本語のまま、2.13 で初めて入れた人 (保存値 auto) は 2.14 で OS の言語になる (リーダーの決定 2 の A) は docs に書いていない (「初めて起動したとき」の文で足りる)。

## 英中のページの対応: 無し
- docs (`_includes/docs`) は日本語だけで英中の版が無い。
- 英中のトップと `_data/l10n/{en,zh-tw}` に「アプリは日本語の UI だけ」の意味の記述は無い (git grep で確かめた)。ある近い記述は次のどれかで、変えない:
  - スクリーンショットの注記 `(Japanese UI)` / `（日文介面）` (画像が日本語の画面を写しているという事実)。
  - 問い合わせの返信が日本語 (`en/contact`・`en/enterprise/inquiry` と zh-tw の同じページ)、説明文書が日本語 (`zh-tw/spec`・`zh-tw/price` の「查看說明文件（日文）」)、`entity.yml` の用語の説明。
- `check-site.mjs _site` は OK (source_hash の古いファイル 0 件) → `accept-site.mjs` は使っていない。

## ゲート (ログは `D:/dm-scratch/backlog1113/logs/w4c-site/T-2302-*.log`)
- quick: `node --test src/lib/site-copy-t2302.test.js src/lib/site-copy-t2305.test.js` 16/16。
- `npm test` 1351 pass / 0 fail、`npm run build && bundle exec jekyll build --strict_front_matter` OK、`check-site.mjs _site` OK、`check-docs.mjs` OK、`check-store-toggle.mjs` OK、`E2E_SKIP_BUILD=1 npx playwright test` 155 passed / 1 skipped。
- ja-identity (基点 `D:/dm-scratch/i18n/site-base/B1113/_site`): 終了コード 1、差分は `docs/index.html` の 1 件だけ (385 行目 = 上の 1 文) → 合格。
  ```
  ja-identity: 内容が違う: docs/index.html
    (385 行目から違う)
  ja-identity: NG (1 件の差分 / 基点 17 files)
  ```

## リーダーへ
- これ以降のサイトのチケットの ja-identity は、この差分 (docs/index.html) が常に出る。公開 (サイトの push) の後、または次に ja を見るチケットの前に、基点 `B1113` をこのコミット以降から作り直す (または差分が docs/index.html のこの 1 文だけなら合格、と読み替える)。
- 公開は 2.14 のアプリ (3 言語) と同じ日に。サイトだけ先に出すと、2.13 の利用者が読む docs と画面が食い違う。

## ロールバック
- このコミットを revert すれば 01-intro の文は「アプリも日本語 UI です」に戻る (テストも同時に消える)。desktop / web の T-2302 とは別に revert する。
