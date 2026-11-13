# T-2322 notes: front matter が YAML として読めるかを npm test で見る

## 変更点
- 新規 `src/lib/front-matter.js`: `extractFrontMatter` / `lintFrontMatter` / `listFrontMatterFiles` / `fmScalar`。
  YAML の依存は足さない (package.json に yaml / js-yaml は無い)。サイトの front matter が使う形 (トップレベルの `key: 値`、
  値なしの `key:` の下の `- 値`、1 行の plain / "…" / '…'、コメント行) だけを許し、それ以外の行は「読めない形」として返す。
- 新規 `src/lib/front-matter.test.js`: 不正な見本 (文字列) が落ちること、正しい形が通ること、サイトの front matter を持つ全 41 ファイル
  (ja・en・zh-tw・`_layouts/default.html`・`llms.txt` など。`_site`・`src`・`scripts`・`e2e`・`docs_draft`・`node_modules`・`_layouts` 以外の `_` フォルダは対象外) が通ること、
  `fmScalar` が引用符つきの値 (`"…: …"`・`'…: …'`) の引用符を外すこと・英語のトップの description を引用符なしで返すこと。
- `src/lib/i18n-site-{product,support,top-en,top-zh}.test.js`: 同じ中身の `fmScalar` の写し 4 つを `./front-matter.js` の import に (挙動は同じ)。
- サイトの `CLAUDE.md` のゲートの節に 1 行。

## 見る / 見ない
- 見る: 引用符なしの値の中の `: ` / `:`+タブ / 末尾の `:`、値の先頭の `@` `` ` `` `*` `&` `!` `%` `|` `>` `[` `{` `#` と `- ` `? ` `: `、
  引用符の閉じ忘れ・閉じた後の余り・"…" の不正なエスケープ、タブのインデント、`key:value`、親の無い配列・インデントのずれ・キーでも配列でもない行。
- 見ない: plain の値の途中の ` #` (値が切れるが Jekyll は落ちない)、キーの重複、`true` / 数値に読まれる値。複数行の値・入れ子のマッピングは使っていないので「読めない形」として落とす (使うようになったら検査を広げる)。

## 今のページ
- 全 41 ファイルが新しい検査を通った (落ちたページは無し)。

## コマンド
- `node --test src/lib/front-matter.test.js` (`npm test` に含まれる)
