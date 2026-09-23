# T-522 — `optimize-images.mjs --apply` の対象を screenshots に限定し、参照中の PNG を消さない

## 変更点

- **`scripts/optimize-images.mjs`** (CLI、表示と ffmpeg の起動だけ):
  - 既定の対象を `assets/img/` + `assets/img/screenshots/` から **`assets/img/screenshots/` 直下だけ**に変更。
    サイトのルートはスクリプトの位置から求めるので、**どこから実行しても同じ**場所を見る
    (以前は cwd 相対だったため、T-496 は作業フォルダを cwd にして回避していた)。
  - 位置引数でディレクトリを 1 つ明示できる (cwd 基準、サイト外の作業フォルダも可、直下の PNG のみで再帰しない)。
  - 一覧の表示: `[DRY]` = 変換して元 PNG を削除する予定 / `[KEEP]` = 参照元を併記して変換も削除もしない /
    `[SKIP]` = 互換性優先 (従来の `app-icon-128.png` / `logo-font-cropped.png`)。`--apply` 時も `[KEEP]` / `[SKIP]` を出す。
  - 終了コード: 0 正常 / 1 変換に失敗した PNG あり (その PNG は残る) / 2 引数・対象の誤り (何も変更しない)。
    不明なオプション (`--aply` など) とディレクトリの複数指定は exit 2。
- **`src/lib/image-optimize.js`** (新規、判定ロジック):
  - サイトの原稿 (`.html .md .markdown .liquid .yml .yaml .json .xml .txt .css .js .mjs .svelte .webmanifest`) を走査して
    `.png` への参照を集め、対象 PNG が参照されていれば保護する。JSON-LD の絶対 URL (`https://host/…`) /
    JSON の `\/` エスケープ / `srcset` / `url()` / Markdown / クエリ付き / 相対パス / 大文字拡張子 / %エンコードを正規化。
  - 照合は「ルートからの相対パスが一致」または「参照で終わる」(名前だけ・途中からの相対参照も拾う = 同名の別ファイルも
    守る安全側)。
  - 参照に数えないもの: Liquid の `{% comment %}` / HTML の `<!-- -->` の中、`_site` `node_modules` `vendor`
    `assets/dist` `docs_draft` `e2e` `scripts` とドット始まりのディレクトリ、ルートの README / CLAUDE / CHANGELOG /
    package*.json、`*.test.js`、本モジュール自身。`index.html` の hero の Liquid コメントに `edit-player.png` が書かれて
    おり、これを数えると撮り直した PNG が変換されずに残るため。
  - `--apply` は WebP ができた (存在しサイズ > 0) ことを確かめてから元 PNG を消す。変換器が失敗・未出力なら PNG を残して
    次の PNG へ進む。失敗時は**この実行で作られた書きかけの WebP と空 (0 バイト) の WebP を消す** (PNG の隣に壊れた
    `.webp` が残って誤ってコミットされるのを防ぐ。レビュー指摘 MEDIUM)。実行前からあった中身入りの WebP は消さない。
    後始末自体に失敗したらエラー文に併記する。
- **`src/lib/image-optimize.test.js`** (新規、23 件): 引数 / 既定ディレクトリ (cwd 非依存) / 参照抽出 / 一時ディレクトリの
  フィクスチャでの計画 (既定・`assets/img` 明示・名前だけの参照・互換性スキップ・サイト外・存在しない / ファイル指定) /
  `--apply` (差し替えた変換器で成功・例外・未出力・空出力 + 空 WebP の片付け・書きかけ後の例外で WebP を消す・
  実行前からある WebP は残す) / 本リポに対する読み取り専用の CLI dry-run 3 件。
  ffmpeg (外部プロセス) だけを差し替え、FS は実物 (一時ディレクトリ)。
- **`CLAUDE.md` / `README.md`**: 既定の対象・明示ディレクトリ・`[DRY]/[KEEP]/[SKIP]`・参照ガードと数えない場所を追記。

## 追加・変更したコマンド

```bash
node scripts/optimize-images.mjs                  # assets/img/screenshots/ の一覧 (dry-run)
node scripts/optimize-images.mjs --apply          # 同上を変換して元 PNG を削除 (参照中の PNG は残す)
node scripts/optimize-images.mjs <dir> [--apply]  # 対象を明示 (cwd 基準、直下のみ)
npm test                                          # image-optimize.test.js を含む
```

本リポでの実測 (dry-run、変更なし): 既定は screenshots 直下の PNG 0 枚。`assets/img` を明示すると 15 枚中
`[KEEP]` 3 枚 (`logo-font.png` ← `_includes/schema/organization.html`、`app-icon-128.png` ← cta-download / footer、
`logo-font-cropped.png` ← footer / header)、`[DRY]` 12 枚。`assets/img/ico` は favicon 22 枚が `_layouts/default.html` /
`browserconfig.xml` / `manifest.json` の参照で `[KEEP]`。

実 ffmpeg での `--apply` はリポ外の scratchpad で確認: 64×48 の PNG → WebP ができて PNG が消え exit 0。
`FFMPEG=存在しないコマンド` では `[FAIL] … ENOENT`、PNG は残り exit 1。

ゲート (2026-09-23、レビュー指摘の修正後に再実行): `npm test` 286 件 (pass 285 / skip 1 = plan_catalog のライブ検査で既存) / `npm run build` 成功 /
`bundle exec jekyll build --strict_front_matter` 成功 / `node scripts/check-docs.mjs` OK / `node --test scripts/*.test.mjs` は
対象 0 件で exit 0 (テストはリポの規約どおり `src/lib/*.test.js` に置いた)。

## 注意点・既知の制約

- 参照中の PNG は **変換もしない** (変換だけして PNG を残すと、使われない .webp が増えるだけで参照は PNG のまま)。
  WebP にしたいときは先に参照を `.webp` に書き換えてから実行する。
- Liquid で組み立てたパス (`{{ name | append: '.png' }}` など) や外部サイトからの直リンクは検出できない。
  `assets/img/` を明示して `--apply` する前に `[DRY]` の一覧を必ず目で確認する (現状 `Deepmosaic_Desktop.png` など
  12 枚はサイト内から参照が無いため `[DRY]` になる)。
- 既定の対象を screenshots に絞ったので、`assets/img/` 直下の新しい画像を WebP 化するときは `assets/img` を明示する。
- `scripts/` は `_config.yml` の `exclude` に無く、既存の 3 スクリプトは従来どおり `_site/scripts/` に複製される
  (本チケット以前からの挙動で、今回は変えていない)。新規のロジックとテストは `src/lib/` (exclude 済み) に置いた。

## ロールバック

`git revert <T-522 のコミット>`。画像ファイルには触れていないので戻しても資産の変化は無い
(戻すと再びルートでの `--apply` が `assets/img/` 直下を巻き込む点に注意)。
