# T-2304 Store のボタンを切り替え 1 か所で出せるようにする

backlog1113 W5。ブランチ `backlog1113-site` (T-2303 f3e50f4 の上)。

## 変更点
- `_data/site.yml` に `distribution: { store_enabled: false }` を足した (`web_app.enabled` と同じ書き方。コメントに「Store のページが公開されたら true にする」)。
- 新しい部品 `_includes/store-button.html`: `store_enabled` が true のときだけ副ボタン (`btn-secondary`) を 1 つ出す。false のときは何も出さない
  (if の外に出力が無く、末尾の `-%}` で改行も残さない)。**切り替えを読むのはこの部品だけ** (置き場所のページは条件を書かない)。
  - href は `https://apps.microsoft.com/detail/{{ app_store_product_id }}` (`_data/lang/<lang>.json` から。ID は直書きしない)。ファイル DL ではないので `download` 属性なし、
    `target="_blank" rel="noopener noreferrer"`、アイコンは ExternalLink。掲載ページの URL は `attribution.js` の `UNDECORATED_HOSTS` で utm を付けない (既存)。
  - 文: ja「Microsoft Store で入手」(直書き)、en `Get it from Microsoft Store`・zh-TW `從 Microsoft Store 取得` (`_data/l10n/{en,zh-tw}/parts.yml` の新しいキー `st_label`)。
  - 目印 `data-store-button="<dl>"` (出し分けの検査用) と `data-dl="<dl>"` (計測)。**計測しないページ (`page.no_tracking`、/join/) では data-dl を出さない**
    (spec の T-2304 は join-store の data-dl、T-2307 は「/join/ は計測しないので data-dl を付けない」。安全側で、識別子は data-store-button にだけ載せた。
    main.js も no_tracking のページでは計測しないので実害は無いが、`site-copy-t2090`・`i18n-site-support` の「data-dl を置かない」とも揃う)。
  - 引数: `dl` (必須)・`size="large"`・`wrap` (包む div の class。false のときは包みも出ない)。
- 置き場所 (`{%- include store-button.html … %}`。前の空白を詰めたので false の出力は T-2303 とバイト単位で同じ):
  - ヒーロー: `index.html`・`en/index.html`・`zh-tw/index.html` の DL ボタンの直後 (Web 版の前)、`hero-store`、`btn-lg`。
  - DL の CTA: `_includes/cta-download.html` (トップ / 料金 / 動作環境 × 3 言語)、`cta-store`、`btn-lg`。
  - docs: `_includes/docs/01-intro.html` の #install の DL ボタンの下、`docs-install-store` (docs は ja だけ)。
  - /join/: 3 言語の「アプリをまだ入れていない方」の段落の下、`join-store` (文の書き換えは T-2307)。
  - ヘッダー・ドロワー・フッターには置かない。
- 英中のページ (`en|zh-tw/index.html`・`en|zh-tw/join/index.html`) の `source_hash` を `accept-site.mjs` で書き直した。

## 検査 (追加したコマンド)
- `scripts/i18n/checks/store.mjs` (check-site のモジュール。`node scripts/i18n/check-site.mjs _site` で自動で回る):
  - false (既定): サイト全体の出力に `data-store-button` と `href="…apps.microsoft.com…"` が無い。法務文書 (`company/privacy`・`company/cookie`、英中も) は対象外。
    `ms-windows-store:` のリンク (docs の #install に今ある) はこの検査の対象外 (T-2305 が #install を直す。T-2305 の後に足してもよい)。
  - true: 4 か所 × 言語 (13 ページ、docs は ja だけ) に 1 つずつ、href・文・download 属性なし・data-dl (join は無し)、置き場所以外に無い。
- `node scripts/check-store-toggle.mjs [--keep]`: `_data` を `.store-toggle-data/` (リポの中、先頭が `.` なので出力に入らない、`.gitignore` 済み) に写し、
  写しの site.yml だけを true にして `--config _config.yml,<一時の設定 data_dir: .store-toggle-data>` で OS の一時フォルダにビルドし、
  check-site の全モジュール (store だけ true として) を当てる。本物の `_data`・`_site` は触らない。終わったら写しと出力を消す。
  Jekyll の `site.data` は `--config` では上書きできないため (データは `data_dir` から読む) この形にした。所要は数秒。
- CI (`.github/workflows/jekyll.yml` の Verify build output) に `node scripts/check-store-toggle.mjs || fail=1` を足した。
- テスト `src/lib/site-store-button-t2304.test.js` (11 件): 切り替えの位置と既定値、部品の形、parts の文、置き場所、ヘッダー類に無いこと、
  検査モジュールの陽性対照 / 陰性対照 (作った _site の模型)、トグルの書き換え。
- `src/lib/site-copy-t1917.test.js`: 「parts.yml に Store の文を出さない」から `st_label` の行を除いた (Store のボタンの文。spec の許可の範囲)。

## ゲート
- `npm test`: 1325 件 (pass 1322 / skipped 3 / fail 0)
- `npm run build && bundle exec jekyll build --strict_front_matter`: 成功
- `node scripts/i18n/check-site.mjs _site`: OK (12 モジュール)
- `node scripts/check-docs.mjs`: OK
- `E2E_SKIP_BUILD=1 npx playwright test`: 150 passed / 1 skipped
- `node scripts/check-store-toggle.mjs`: OK (true の出力の 13 ページ、ほかの check-site のモジュールも合格)
- false の出力は T-2303 (f3e50f4) の出力と比べて ja は `ja-identity` OK (17 files)、英中も `?v=` を除いてバイト一致 (出力は変わらない)。

## 巻き戻し
- このコミットを revert すれば部品・切り替え・検査が消える。false の間は出力が変わらないので、公開済みのページへの影響は無い。

## リーダーへの申し送り
- Store のページが公開されたら `_data/site.yml` の `store_enabled` を true にするだけ (トップ・料金・動作環境・docs・/join/ の 3 言語に出る)。
  そのときに掲載ページの URL (`https://apps.microsoft.com/detail/9PDKMKWHN9RW`) が開けることを手で確かめる。
- true にしたときのスマートフォンの幅 (412px) のヒーローのボタンの並びは T-2308 の検査の対象外 (false で検査する)。true にする前に一度見る。
