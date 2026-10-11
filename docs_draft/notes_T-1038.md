# T-1038 法務文書の横断テストと最終更新日の統一

## 変更点
- 新規 `src/lib/site-copy-t1038.test.js` (8 テスト)。固定するもの:
  1. ヘルパー (`lastUpdated` / `frontMatter` / `parseFlatYaml` / `hrefsOf`) の陽性対照と陰性対照
  2. 版の一致: `_data/legal.yml` の `version` = eula の最終更新日 = terms の最終更新日 = `2026-10-12` (定数)
  3. 6 ページ (about / terms / privacy / cookie / eula / asct) の最終更新日が ISO・`>= 2026-10-12`・全ページ同じ値 (件数 6 を assert)
  4. permalink が `/company/<slug>` (`.html` 無し・末尾スラッシュ無し)、slug = ファイル名
  5. フッターの `/company/` リンクが about → terms → privacy → cookie → eula → asct の順で、すべて実在する permalink
  6. 相互リンク (eula → terms / privacy、terms → eula、privacy → cookie、cookie → privacy、asct → eula / terms)、
     旧形式 `/company/*.html` の禁止、`/company/` への href のリンク切れ無し
  7. llms.txt の `## Optional` 節に 6 本
- 最終更新日: 6 ページとも T-1032〜T-1037 の時点で `2026-10-12` にそろっていたため、**ページの変更は無し**。
  検出力の確認として asct の日付を一時的に 2026-10-11 にずらすと 3 のテストが赤になることを確かめ、元に戻した。

## 追加・変更したコマンド
- `node --test src/lib/site-copy-t1038.test.js` (`npm test` に含まれる)

## legal_version の契約と他リポの対応箇所
- サイト: `_data/legal.yml` の `version` = `company/eula.html` / `company/terms.html` の最終更新日 (本テストが固定)
- desktop: `src/lib/legal/version.ts` の `LEGAL_VERSION`、`src-tauri/installer/eula.txt` の 2 行目
- web: 同意画面の verbatim (版の文字列)
- dashboard: `company.ts` の ADDRESS は サイトの `_data/company.yml` (T-1032) からの転記
- 改定時はこれらを同時に変える。リポをまたぐ一致は各リポのテストが持つ。

## ビルド出力の確認結果 (2026-10-11、worktree で実施)
- `npm test`: 464 pass / 0 fail / 1 skip。`npm run build` 成功。`bundle exec jekyll build --strict_front_matter` 成功。
- `_site/company/eula.html` 存在: OK
- 住所 `〒141-0021 東京都品川区上大崎3丁目14番34号プラスワン402`: asct 1 / about 1 / privacy 1
- `"postalCode": "141-0021"` in `_site/index.html`: 1
- `_site/llms.txt` の 1 行目: `# Deepmosaic`、`robots.txt` に `Sitemap: ` 行: OK
- `_site/index.html` の `/company/` href: about / asct / cookie / eula / privacy / terms の 6 本
- `E2E_SKIP_BUILD=1 npm run e2e`: 19 passed / 1 skipped

## 注意点・既知の制約
- privacy の 3-3 と無料枠の段落は「使用許諾契約書」「利用規約」に言及しているがリンクは無い。
  spec の禁止事項 (日付以外の本文を変えない) によりリンクは足していない。テストは privacy → cookie のみ必須とした。
  **要対応 (任意)**: privacy から `/company/eula` `/company/terms` へリンクするかはリーダー判断。
- asct / cookie の最終更新日の `<p>` の書式 (asct は素の `<p>`) は統一していない (任意項目のため最小差分を優先)。

## リーダーへの申し送り
- `feat/T-1038` を `integrate/legal-site` に統合 → master へ ff → push (公開)。
- 公開後、`https://www.deepmosaic.co.jp/company/eula` の表示、asct の住所、フッターの並びを目視確認。
- 巻き戻しは master を `33d06f3` に戻す。

## ロールバック
- 本チケット単独ではテストファイル 1 本と本 notes の追加のみ。削除で戻る。
