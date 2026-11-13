# T-2307 `/join/` の「アプリをまだ入れていない方」をダウンロードの案内に

backlog1113 W5。ブランチ `backlog1113-site` (T-2306 b2a881e の上)。

## 変更点
- `join/index.html`・`en/join/index.html`・`zh-tw/join/index.html` の「アプリをまだ入れていない方」:
  - リンク先を Windows 版のダウンロード (`site.data.lang.ja.app_download_link` = インストーラ) にした。Liquid の変数名は `store_url` → `download_url`。
  - 文: ja「Deepmosaic（Windows 版）をダウンロードしてインストールしてください。」、en "Download Deepmosaic (Windows version) and install it."、
    zh-TW「請下載 Deepmosaic（Windows 版）並安裝。」(リンクは ja「Deepmosaic（Windows 版）をダウンロード」/ en "Download Deepmosaic (Windows version)" / zh-TW「下載 Deepmosaic（Windows 版）」)。
    続く「入れた後に、もう一度このページの『アプリで開く』を押してください。」(英中も) は変えていない。
  - 属性: `download` (ファイル DL。`download-button.html` と同じ)・`target="_blank" rel="noopener noreferrer"` (従来どおり)。計測しないページなので `data-dl` は付けない。
  - 目印を `data-join-store` → `data-join-download` に改名した (リンク先がもう Store ではないため)。`src/main.js` はこの目印を使っていない。
  - その下の `{% include store-button.html dl="join-store" wrap="mt-4" %}` (T-2304) はそのまま。`store_enabled` が true のときだけ Store のボタンが出る。
- 英中の `source_hash` を `accept-site.mjs` で書き直した。
- `#code=…`・`#admin` の動き、`src/lib/join-hash.js`、noindex・sitemap: false・no-referrer・no_tracking は変えていない。

## テスト・検査の変更
- `src/lib/site-copy-t2090.test.js`: 「Microsoft Store へのリンク」の期待値を、ダウンロードへのリンク (文・href の式・download・別タブ・data-dl なし・Store の文が無い・Store のボタンの部品が文の後ろ) に書き直した。
- `src/lib/i18n-site-support.test.js`: 英中の join の同じ検査を書き直し (リンクの文を言語ごとに固定)、`pages-support` の模型と陰性対照の目印を `data-join-download` に。
- `scripts/i18n/checks/pages-support.mjs`: join の構造の目印 `data-join-store` → `data-join-download` (改名に合わせただけ。検査は弱めていない)。
- `e2e/join.spec.ts`: 3 言語の /join/ で、リンクの文・href・download・別タブ・data-dl なし・既定で Store のボタンと apps.microsoft.com へのリンクが無いことを見る (1 件 → 3 件)。

## ゲート
- `npm test`: 1335 件 (pass 1332 / skipped 3 / fail 0)
- `npm run build && bundle exec jekyll build --strict_front_matter`: 成功
- `node scripts/i18n/check-site.mjs _site`: OK (12 モジュール)
- `node scripts/check-docs.mjs`: OK
- `E2E_SKIP_BUILD=1 npx playwright test`: 152 passed / 1 skipped
- `node scripts/check-store-toggle.mjs`: OK
- ja-identity: T-2306 (b2a881e) の出力を基点にすると、変わった ja のファイルは `join/index.html` だけ。英中は /join/ 以外は `?v=` の違いだけ。
  (リーダーの基点 `D:/dm-scratch/i18n/site-base/W7t/_site` は T-2303 より前なので、ヘッダーの DL などで全ページが違うと出る)

## 巻き戻し
- このコミットを revert すれば Store へのリンクの文に戻る (T-2303 の後なのでリンク先はインストーラのまま)。

## リーダーへの申し送り
- 法人の案内メールの本文に /join/ の文を引用している所があれば、新しい文 (Windows 版をダウンロード) と合うか確かめる (サイトの外のため未確認)。
