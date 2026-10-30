# T-1624 メモ: トップに「すでにかかっているモザイクを見つけて、かけ直す」の節

## 変更点
- `index.html`
  - RELIABILITY の後・MOSAIC の前に `<!-- EXISTING MOSAIC -->` の節 (`id="existing-mosaic"`) を追加。
    section-title (kicker「EXISTING MOSAIC」)、否定文 (枠付きの 1 行、比較画像より上)、画像 2 枚 (`<figure>` 2 つ、
    MOSAIC 節の shape-compare と同じ組み方)、素材の表記「素材: 当社のサンプル動画（顔にモザイクを焼いたもの）」、
    要点カード 3 つ、Desktop 版・Web 版の両方で使える旨と `/docs/#detect-mosaic` へのリンク。
    背景は RELIABILITY (無地) と MOSAIC (bg-surface-alt) の間なので、無地 + `border-t` で区切った。
  - hero の figcaption に「。すでにかかっているモザイクの位置も見つけられます（詳しく → #existing-mosaic）」。
    画像 `detectable-objects.webp` と alt は変えていない (画像の内容は 3 種のまま = alt は事実どおり)。
  - front matter の description: 「検出対象は男性器・女性器・人間の顔、すでにかかっているモザイクの位置」。
    否定句「モザイクの除去・解除はできません」の位置は変えていない (前半は無変更。半角を 0.5 として先頭から約 41 全角、
    テストの `^description:.{0,60}除去` も通る)。
- `assets/img/samples/mosaic-detect-1-found.webp` / `mosaic-detect-2-reapplied.webp` (1280x720、各 約 50 KB)
  - 元: `~/Downloads/tutorial/mosaic-detected.png` / `mosaic-id-settings.png` (1920x1080) を ffmpeg の lanczos で
    1280x720 に縮め、`node scripts/optimize-images.mjs assets/img/samples --apply` で WebP (q82) にした (PNG は削除済み)。
  - 2 枚目の中身は「ID 別」タブに推定した粒 (最小セル = 最大セル = 10 px) が入っている画面。ファイル名の `reapplied` は spec の指定どおり。
    alt / figcaption は「かけ直した結果」とは書いていない。
- `_data/entity.yml` の can に 1 項目 (ja / en)。cannot は無変更。`_includes/can-cannot.html` 経由でトップと /mosaic-removal/ の
  両方に出ることを `_site` で確認 (JSON-LD の featureList にも入る)。
- `_data/faq.yml`: 「モザイクを除去することはできますか？」の直後に「すでにモザイクがかかっている動画はどうなりますか？」。
  先頭 2 件の固定は崩していない。ビルド後の `<details>` 15 個 = FAQPage の Question 15 個。
- `_data/lang/ja.json` の `meta_desc` (JSON-LD の description、description を持たないページの既定値) の検出対象の列挙にも
  「と、すでにかかっているモザイクの位置（上からかけ直します）」を足した (spec 8 の grep で該当した列挙)。
- `llms.txt` / `llms-full.txt`: 検出対象に「すでにかかっているモザイクの位置 (上からかけ直す。取り除くことはできない) /
  mosaics already present in the footage (re-applied over, never removed)」。動画の行に ④ の URL を足し、「Desktop 版 4 本」に。
  動画の URL は既存の 1 行に足した (`site-copy-t972.test.js` が「動画の行は 1 行」を固定しているため、別行にはしない)。
- `_includes/docs/01-intro.html`: ③ の後・Web 版の前に ④ モザイク検出編の `<video>` (figcaption「…（字幕のみ、約 1 分半）」、
  実尺 98.3 秒)。コメントに T-1624 の 1 行。
- テスト: `src/lib/top-page-features.test.js` に 4 件 (節の位置と id / 画像 2 枚の実在・WebP・寸法・lazy・出典 /
  否定文・要点・docs へのリンク・禁止語 / description・hero・can・FAQ・llms)。`src/lib/site-copy-t972.test.js` の VIDEOS に 4 本目。

## 古い「3 種類」の grep (index.html / _includes/*.html (docs 以外) / _data/*.yml / _data/lang)
| 場所 | 対応 |
|---|---|
| index.html:11 description | 直した |
| index.html:47 hero の alt | 画像の内容 (3 種の図) どおりなので変えない |
| index.html:48 hero の figcaption | 直した |
| index.html の WORKFLOW「表示形式は 3 種類」 | 検出対象ではないので対象外 |
| _data/entity.yml can[0]「局部・男性顔・女性顔を検出し追跡」 | 別項目を足したので変えない |
| _data/mosaic.yml「局部・男性顔・女性顔など、検出クラスごと」 | 「など」で限っていないので変えない |
| _data/lang/ja.json meta_desc | 直した |

## 追加・変更したコマンド
なし (`node scripts/optimize-images.mjs assets/img/samples --apply` を 1 回使っただけ)。

## 確認
- `npm test` 552 pass / 0 fail、`npm run build`、`JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter`、
  `node scripts/check-docs.mjs` (OK) が通る。check-docs は寸法が合っていたので `--fix-dims` は不要だった。
- `.github/workflows/jekyll.yml` の固定文言 (`モザイクをかける` / `取り除く機能はありません` / `disambiguatingDescription`) は
  `_site/index.html` に残っている。FAQ の details と Question の数も一致 (15 / 15)。
- 改行の反転なし (`git diff --stat` と `--ignore-cr-at-eol` が同じ)。

## 注意点・既知の制約
- 画像はアプリの画面の縮小版なので、下端のステータスバーに GPU 名 (RTX 3070 Ti) と例示のパス・アカウント (`user@example…`、
  `C:\Users\user\deepmosaic\demo`) が小さく写っている。実在のユーザー名ではない。気になるなら撮り直すか下端を切る。
- `npm run e2e` は未実行 (リーダーが統合後に 1 回)。

## ロールバック
この commit を revert する (画像 2 枚も一緒に消える)。データ (entity / faq / ja.json / llms) と index.html は互いに独立しているので、
部分的に戻すときは top-page-features.test.js の T-1624 のテスト 4 件と site-copy-t972.test.js の 4 本目も合わせて戻す。
