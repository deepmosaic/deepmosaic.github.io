# T-231 メモ: スマホのドロワーで料金 / ドキュメントを押すと "false.html" が落ちてくる

## 変更点

- `src/islands/MobileNav.svelte`: `download={!!item.download}` → `download={downloadAttr(item.download)}`。
  `download` は真偽属性ではなく、値は保存時のファイル名。Svelte 5 は `false` を `download="false"` として
  出力するので、同一オリジンのリンク (ホーム / 料金 / ドキュメント / 動作環境) が "false.html" という
  名前の強制ダウンロードになっていた。クロスオリジンの DL 項目 (r2-proxy) は download 属性がブラウザに
  無視されるので動き続け、バグを隠していた。`data-dl` / `target` / `rel` の配線は無変更。
- `src/lib/download-attr.js` (新規): `downloadAttr(flag)` → `''` (DL 項目、サーバのファイル名で保存) か
  `undefined` (属性を付けない)。DOM に触らない純ロジックなので `node --test` で検証できる。
- `src/lib/download-attr.test.js` (新規): 戻り値が `''` | `undefined` 以外にならないことの回帰テスト (3 件)。
- `_includes/docs/02-account.html` (support 節) / `_includes/docs/06-ops.html` (Premiere 節): Google フォームの
  URL で `r55_iIp8` が二重になっていた 2 箇所を `_data/plans.yml` と同じ正規 URL に修正。
  リポジトリ全体を grep して、他の出現箇所 (header / footer / price / company/cookie / plans.yml) は
  元から正しいことを確認済み。
- `.github/workflows/jekyll.yml` の `Verify build output`: 回帰ガードを 2 つ追加 (既存の grep 群と同じ書き方)。
  - `_site/assets/dist/app.js` に `"download",!!` 形 (真偽値を download に渡した minify 後の痕跡) があれば落とす
  - `_site/**/*.html` に `download="true"` / `download="false"` があれば落とす (該当行を 20 行まで表示)

## 追加・変更したコマンド

- コマンドの追加・変更なし。`npm test` は `src/lib/*.test.js` を拾うので新テストは自動で対象。
- ローカルで CI と同じ回帰ガードを見るとき:
  ```bash
  npm run build && bundle exec jekyll build --strict_front_matter
  grep -cE '["'\''`]download["'\''`],!!' assets/dist/app.js     # 0 が正 (修正前は 1)
  grep -rlE 'download="(true|false)"' --include='*.html' _site   # 何も出ないのが正
  ```

## 検証結果 (2026-09-16、ローカル / Windows Git Bash)

| ゲート | 結果 |
|---|---|
| `npm run build` | OK (app.js 56.97 kB) |
| `bundle exec jekyll build --strict_front_matter` | OK |
| `node scripts/check-docs.mjs` | OK (2 ページ, 13 ファイルの深いリンク) |
| `npm test` | 106 件中 105 pass / 1 skip (plan_catalog のライブ検査は鍵なしで skip、従来どおり) |
| `download="false"` / `"true"` in `_site/**/*.html` | 0 件 |
| `"download",!!` in `_site/assets/dist/app.js` | 0 件 (修正前バンドルでは 1 件) |
| `Verify build output` ステップを丸ごとローカル実行 | exit 0。修正前バンドルに差し替えると exit 1、`download="false"` 入り HTML を置いても exit 1 (両ガードとも検出を確認) |

修正前後の `MobileNav.svelte` をサーバ向けにコンパイルして描画した `<a>` (使い捨ての検証、リポジトリには入れていない):

- 前: `<a href="/price" download="false" …>`、DL 項目は `download="true"`、外部項目にも `download="false"`
- 後: `<a href="/price" …>` (属性なし)、DL 項目は `download=""`、外部項目は `target="_blank" rel="noopener noreferrer"` のまま

## 注意点

- 実機確認はスマホの実ブラウザで行う: ハンバーガー → 料金 / ドキュメント / ホーム / 動作環境 がページ遷移し、
  「ダウンロード」はこれまでどおりインストーラが落ちること。iOS Safari と Android Chrome の両方。
- ドロワーは Svelte がクライアント側で描くので、`_site` の HTML には元々 `download="false"` は出ない。
  HTML 側の検査は Liquid 側で同じ書き方をしたときの保険で、バンドル側の検査が本命。
- バンドル検査は minify 後の `` `download`,!! `` という形に依存する。`Boolean(x)` のような書き方は拾えないので、
  `<a download>` の値は `downloadAttr()` を通すのがルール (`src/lib/download-attr.js` の冒頭コメント参照)。
- Google フォームの URL は T-254 で新しい問い合わせページに全置換する予定。本チケットは破損 2 箇所の修正だけ。
  `company/cookie.html` の URL は `?usp=sf_link` が無いが有効な URL なので触っていない。
- `bundle install` / `npm install` は不要 (依存の追加なし)。
- `app.js` は `_layouts/default.html` で `?v={{ site.time }}` が付くので、公開直後から新しいバンドルが配られる (ブラウザキャッシュ待ちは不要)。

## ロールバック観点

- サイトの見た目・データ・ブラウザのストレージには影響なし。コミットを `git revert` すれば戻る。
- Svelte 側の変更だけを戻すと、追加した CI ガードが `Verify build output` で落ちる (それが狙い)。
  戻すならコミット単位で。

## デプロイ時にユーザーが行う手順

1. deepmosaic.github.io で差分を確認してコミット (例: `fix: T-231 スマホのドロワーで同一オリジンのリンクが "false.html" の強制ダウンロードになる`) → `master` へ push
2. GitHub Actions「Deploy Jekyll site to Pages」が緑になることを確認 (`Verify build output` に新ガードが入った状態で通ること)
3. 公開後、スマホ実機でドロワーの 4 リンクが遷移し、ダウンロード項目でインストーラが落ちることを確認
4. 親リポジトリでサブモジュール参照を更新し、`CHANGELOG.md` の T-231 にチェックを入れる
