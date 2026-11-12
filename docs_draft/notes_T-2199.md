# T-2199 (i18n1112 作業キー I18N-701) サイトの多言語化の土台と検査の道具

## 変更点
- 名前空間 / l10n: なし (画面の文は変えていない)。
- `_config.yml`: defaults の `path: ""` の `values` に `lang: ja` を 1 行。`exclude` に `scripts/i18n`。`path: "en"` 系の defaults は置いていない (Jekyll の前方一致で `enterprise/` に当たるため)。
- `scripts/i18n/` (新規、依存なし・ESM):
  - `ja-identity.mjs` — `normalizeJaHtml` / `listJaHtml` / `compareSites` を export、CLI あり
  - `source-hash.mjs` — `normalizeSource` / `sourceHash` / `readFrontMatter` / `readYmlScalar` / `checkTranslatedSources`
  - `accept-site.mjs` — `acceptFile` を export、CLI あり
  - `parity.mjs` — `structureOf` / `compareStructure`
  - `check-site.mjs` — `runChecks` / `makeContext` を export、CLI あり
  - `is-main.mjs` — `isMain(import.meta.url)`。CLI の 3 本 (ja-identity / check-site / accept-site) が直接起動されたかを、`process.argv[1]` と自分のパスを両方 realpath にして比べる (レビュー指摘で追加)
  - `checks/ja-lang.mjs` — 最初の検査のモジュール
  - `build-site-base.sh` — 基点の `_site` を作る (リーダー用。このチケットでは実行していない)
- `.github/workflows/jekyll.yml`: Verify build output の `check-plan-catalog.mjs` の前に `node scripts/i18n/check-site.mjs _site || fail=1` (+ コメント 1 行)。ja-identity は基点が要るので CI に載せていない。
- `CLAUDE.md` (サイト): 「### i18n」を書き直し (URL・page.lang・辞書・l10n・直書きを残す規則・検査の道具とコマンド・対象外)。ディレクトリの表に `_data/lang/`・`_data/l10n/`・`en/` / `zh-tw/`・`scripts/i18n/` を足した。
- テスト: `src/lib/i18n-site-tools.test.js` (35 件、`npm test` の glob が拾う)。

## 道具のコマンドと終了コード
| コマンド | 0 | 1 | 2 |
|---|---|---|---|
| `node scripts/i18n/ja-identity.mjs <基点の _site> <今の _site>` | 一致 (`ja-identity: OK (<n> files)`) | ファイルの増減か内容の違い (ファイルごとに最初に違う行の前後 3 行) | 引数不足・ディレクトリが無い |
| `node scripts/i18n/check-site.mjs [_site] [--checks <dir>] [--root <dir>]` | エラー 0 件 (`check-site: OK (<m> モジュール)`) | 1 件以上 (`[<モジュール名>] <文>` を 1 行ずつ + 件数) | siteDir / checks のディレクトリが無い |
| `node scripts/i18n/accept-site.mjs <ファイル…>` | 全部書いた | `source:` / `_source:` が無い・実在しない | 引数が無い |
| `bash scripts/i18n/build-site-base.sh <commit> <出力>` | 作れた | 一時 worktree の場所が既にある・ビルド失敗 | 引数の数が違う |

- check-site のモジュールが例外を投げたら `[<名前>] 検査が例外で止まった: …` の 1 件として数える。`default` が関数でなくても 1 件。
- `--checks` / `--root` と accept-site の env `I18N_SITE_ROOT` はテスト用 (既定は `scripts/i18n/checks/` とリポの root)。

## normalizeJaHtml で消す物 (後のチケットの実装者向け)
1. CRLF → LF
2. `.css?v=<数字>` / `.js?v=<数字>` → `?v=0` (他のクエリは消さない)
3. `<link … hreflang=…>` のタグ (属性の順は問わない)
4. `<meta property="og:locale:alternate" …>` のタグ
5. `data-i18n-switch` 属性を持つ要素 (同じタグ名の入れ子を数えて閉じタグまで。void 要素 (`link`・`meta`・`img`・`input`・`br` ほか) と自己閉じはタグだけ。`data-i18n-switch-foo` のような別名は消さない)

- 3〜5 は「タグ / 要素を消し、消した結果その行が空白だけになったら行ごと消す」。spec の「行を削る」より厳しい (同じ行に他のタグがあれば、そのタグは比較に残る)。**同じ行に他の要素と並べて hreflang の link や切り替えの要素を出すと、前後の空白が残って差分になる**ので、layout では 1 行 1 タグで出すこと (設計書 §10.3 の例どおり)。
- 空行の増減・空白 1 つ・属性の順の違いは差分として残る (陰性対照のテストあり)。
- 比較はバイト列 (latin1 で読む) で行い、差分の表示だけ UTF-8 に戻す。

## source_hash の正規化
- CRLF → LF、html は `{% comment %}…{% endcomment %}` (`{%- -%}` も) と `<!-- -->` を除く、yml は `#` で始まる行 (前の空白は許す) を除く、行末の空白を除く、**空白だけの行も除く** (コメントを除いて空いた行で hash が変わらないように。spec に無い追加。ja の空行だけの変更では英中の更新を求めない)、末尾の改行を 1 つ。
- 拡張子 `.yml` / `.yaml` は yml、それ以外は html として正規化する。
- accept-site は値を `"…"` で囲んで書く (64 桁の hex が `1e5…` のように YAML の数に読まれないように)。
- yml の `#` 行の除去は、ブロックスカラー (`|`) の中の `#` で始まる行も除く (素朴な実装の制約。hash が鈍くなるだけで誤検出はしない)。

## 置いた仮定 / spec との食い違い
- `checkTranslatedSources(root)` (英中のファイルの規則) は spec では node テストの中の検査だが、fixture でも同じ検査を回すため `source-hash.mjs` の関数にした。テストはリポの root と fixture の両方に掛けている。
- ja-lang の検査は `<html>` タグが無い .html もエラーにする (今の 17 本は全部持っている)。
- `build-site-base.sh` は `JEKYLL_ENV` を付けないことを確実にするため `unset JEKYLL_ENV` してからビルドする。一時 worktree は `trap` で必ず消す。親の `.gitattributes` が無いリポなので、`core.autocrlf=true` の checkout ではこの .sh が CRLF で出る可能性がある (このリポには `.gitattributes` が無く、足すのはこのチケットの範囲外)。CRLF で出たら `bash` が `set -euo pipefail\r` で落ちるので、リーダーは `sed -i 's/\r$//'` した写しで実行するか、`.gitattributes` に `*.sh text eol=lf` を足すチケットを立てること。
- CI の `jekyll.yml` の変更は COMMON §9 の「`ci.yml` の変更禁止」と食い違うが、spec が明示しているので spec を優先した (1 行 + コメント 1 行だけ)。

## 既存の件 (直していない)
- `_site/scripts/` に既存の `check-docs.mjs`・`check-plan-catalog.mjs`・`optimize-images.mjs` が出て配信されている (`_config.yml` の exclude に `scripts` が無い)。spec の指示どおり `scripts/i18n` だけを除外し、既存の分は直していない。
- `npm test` の skipped 1 件は既存 (このチケットのテストに skip は無い)。

## 基点の _site と ja-identity の結果
- 基点 `D:/dm-scratch/i18n/site-base/W7/_site` (コミット 10678af、リーダー作成) あり。作り直していない。
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site` → `ja-identity: OK (17 files)` (`lang: ja` の既定と exclude の追加で ja の出力は変わっていない)。
- `node scripts/i18n/check-site.mjs _site` → `check-site: OK (1 モジュール)`。

## ゲートの結果 (2026-11-12)
- `node --test src/lib/i18n-site-tools.test.js` → 35 pass / 0 fail (RED は実装前にモジュール不在で失敗を確認)
- `npm test` → 746 件 (pass 745 / fail 0 / skipped 1 = 既存)
- `npm run build && bundle exec jekyll build --strict_front_matter` → 成功
- `node scripts/check-docs.mjs` → OK
- ja-identity → OK (17 files) / check-site → OK
- `git diff --stat` と `--ignore-cr-at-eol` の行数は一致

## レビューの指摘への対応
- [MEDIUM] CLI の起動判定がジャンクション / シンボリックリンク越しで外れ、検査せずに exit 0 になる → `scripts/i18n/is-main.mjs` の `isMain` (realpath どうしを比べる。win32 は大文字小文字を無視) に置き換えた (3 本とも)。ジャンクション越しに `check-site.mjs <無いディレクトリ>`・引数なしの `ja-identity.mjs`・`accept-site.mjs` が exit 2 になることをテストに追加 (リンクを作れない環境では skip)。
- [MEDIUM] `build-site-base.sh` に相対パスの出力先を渡すと出力が一時 worktree ごと消える → 引数を受けた直後に `mkdir -p` して絶対パスへ直す (Git Bash の `pwd` は `/d/...` で Windows の Ruby が読めないため `pwd -W` を優先)。テストに「`cd "$src"` より前に絶対パスにしている」照合を追加。スクリプト自体は spec どおり実行していない (変換の部分だけを一時ディレクトリで確かめた)。
- [LOW] jekyll.yml の 2 行を既存の plan_catalog のコメントの上 (T-286 の for ループの `done` の直後) へ移した。
- [LOW] CLAUDE.md: ディレクトリの表の `_data/` を「YAML データ」だけに、レビューのチェックリストの i18n の項目を新しい規則に、l10n の持ち主を T 番号付きで要約 (plans・faq・subscribe = T-2201 / spec・disclosure・mosaic・entity = T-2202 / nav = T-2204 / parts = T-2205 / inquiry_form = T-2206)。
- [LOW] `.gitattributes` が無く .sh が CRLF で出うる件 → このチケットでは変えない。**リーダーへ: `.gitattributes` に `*.sh text eol=lf` を足すチケットの起票を推奨** (上の「置いた仮定」にも記載)。
- [LOW] ja-identity が .html だけを比べ、llms*.txt・robots.txt・feed.xml は機械で守られていない → spec (§10.7) どおりなので変えない。**リーダーの判断事項**: 後のチケットか check-site のモジュールで基点と比べるか (feed.xml は `<updated>` を正規化)。

## ウェーブ末尾の E2E で確かめること
- このチケットは画面を変えていない。既存の Playwright 45 件が通ること (ja の出力が不変であること) だけ。

## ロールバックの観点
- W7 の後のチケット (I18N-702〜713) は全部この道具 (ja-identity・check-site・parity・source_hash・`page.lang` の既定) に依存する。revert すると後のチケットのテストとゲートが動かない。
- `_config.yml` の `lang: ja` を外すと、後のチケットの `page.lang` の分岐 (ja のページで nil) が崩れる。
