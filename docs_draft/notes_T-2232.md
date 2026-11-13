# T-2232 (I18N-821) 用語の一貫性を確定する — サイトの分 notes (下書き)

- 担当: サイトの分 (リーダーの別の直列の作業。`D:/dm-scratch/backlog1113/w4c-site-tickets.json` の T-2232)。Role: Implementer → Tester。
- 始めたときの先頭: `a229422 fix: T-2231 公式サイトの英語・繁体字のページの訳の見直し` (ブランチ `backlog1113-site`)。
- 起動の条件: 統合 worktree desktop `e1382df7`・web `155f3e27` に T-2232 あり (ブランチ `backlog1113-integrate`)、作業ツリーが空、T-2231 あり、基点 `D:/dm-scratch/i18n/site-base/B1113/_site/index.html` あり。
  - `git log --oneline --grep "T-2232" --grep "T-2233" --grep "T-2302"` は 1 行 (`a229422`) 出たが、T-2231 のコミット本文の「T-2232 へ申し送り」の文言に当たっただけで、T-2232 のサイトの分のコミットではない。条件の意図 (サイトの分が未着手) は満たすと判断した。T-2233・T-2302 の起動の条件 (`--grep "T-2231" --grep "T-2232"` が 2 行以上) は、このコミットで 2 行以上になる。

## 用語集の写し
- 元: 統合 worktree `D:/deepmosaic-wt/integrate/backlog1113/desktop/src/lib/i18n/glossary.json` (runner の worktree ではない)。`glossary-chars.json` は変わっていないので写していない。
- 中身の差分: corporate・seat_count・save_location・test_run の `kind` が `required`、save_location の `en_forms` に `save folder`・`zh_forms` (`儲存位置`・`儲存資料夾`)、4 語の note。語数は 220 のまま。
- `glossary.json` の LF の sha256: `ef34b50dd1141bccea36814473310df5117e76b19df916631000eb49023eaeae` (`glossary-chars.json` は `72f3938e…` のまま)。
- `glossary.source.json`: `desktop_commit` = `e1382df7b370c3fe084f5bdef4d96c7d1b21965e` (統合ブランチ `backlog1113-integrate` 上の T-2232 の desktop のコミット)、`desktop_ref` = `backlog1113 (T-2232)`、note の末尾に「T-2232 (I18N-821): save_location・seat_count・test_run・corporate を required に (220 語のまま)」。
- 3 者 (統合 worktree の desktop・web とサイト) の `glossary.json` は LF にそろえて一致。

## 期待値を直したテスト
- `src/lib/i18n-site-lang.test.js` 413〜419 行: 題の「法人 が reference」→「法人 が required (T-2232)」、`corporate` の kind の期待値 `'reference'` → `'required'`。ほかの期待値は変えていない。
- 英中の文を固定しているテスト・検査は無かった (`git grep` で旧い文言 0 件を確認) ので、ほかに追従させたものは無い。

## T-2231 の申し送りの処理 (リーダーの決定 3、2026-11-14)
アプリの辞書は統合 worktree desktop (`e1382df7`) の `src/lib/i18n/messages/*.ts`・`platform/*.ts` を読み、引用している画面・メニュー・段の名前を 1 つずつ照らした。

### 直した用語 (9 語・18 か所。英語 10 か所・繁体字 8 か所)
| # | ファイル | 前 | 後 | アプリのキー |
|---|---|---|---|---|
| 1 | `_data/l10n/en/subscribe.yml` faq[3].a (2 か所) | `"Manage plan"` | `"Change plan, number of accounts, or cancel"` | `account_login.menu_portal_label` |
| 2 | `_data/l10n/zh-tw/subscribe.yml` faq[3].a (2 か所) | 「方案管理」 | 「變更方案或數量／取消訂閱」 | 同上 |
| 3 | `en/index.html` 418 行 (処理の段階) | `preparation → preprocessing → detection → analysis` | `Prepare → Preprocess → Detect → Analyze` | `progress.stage_prepare`・`stage_preprocess`・`stage_detect`・`stage_analyze` |
| 4 | `zh-tw/index.html` 418 行 | 前處理 | 前置處理 | `progress.stage_preprocess` |
| 5 | `_data/l10n/zh-tw/faq.yml` 22 行・`_data/l10n/zh-tw/spec.yml` performance_note (説明文の同じ段、2 か所) | 前處理 | 前置處理 | 同上 (トップの段の名前とサイトの中で揃えるため) |
| 6 | `_data/l10n/zh-tw/faq.yml` 22 行・`_data/l10n/zh-tw/spec.yml` 86 行 (GPU 無しの説明、2 か所) | 不進行馬賽克（的）精細化 | 不進行「精修馬賽克」 | `progress.stage_segment` |
| 7 | `_data/l10n/en/faq.yml` 22 行・`_data/l10n/en/spec.yml` 85 行 (同じ 2 か所) | `mosaic refinement is skipped` / `is not performed` | `the "Refine mosaic" stage is skipped` | 同上 |
| 8 | `_data/l10n/en/mosaic.yml` | `Auto pixel size`・`Proportional to divisions` (+ 本文の `number of divisions` → `split count`)・`"Coarsest blocks"`・`Size (bbox expansion ratio)` (5 か所) | `Automatic pixel size`・`Proportional by split count`・`"Coarsest block"`・`Size (box expansion)` | `mosaic.auto_label`・`method_ratio_label`・`max_grains_label`・`size_label` |
| 9 | `_data/l10n/zh-tw/mosaic.yml` | 大小（bbox 擴展率） | 大小（框擴展比例） | `mosaic.size_label` |

- 訳が長くなった所 (subscribe の FAQ の答え) は本文の段落で、はみ出しの心配は無い (Playwright の i18n-layout も合格)。CSS は変えていない。

### 照らして一致していたもの (変えていない)
- en: `Set pixel size`・`Pixel size`・`By class` / `By ID` / `By scene` / `All`・`By size range`・`Confidence threshold`・`Sharp colors`・検出対象の `"Mosaic"`・join の `Organization sign-in` / `Organization code` / `Sign in` / `Have an organization code? (business)`・`"Sign in"` (subscribe の FAQ)。
- zh-TW: `設定像素大小`・`自動像素大小`・`依大小範圍`・`依分割數等比`・`最粗的馬賽克格`・`信賴度臨界值`・`銳利色彩`・`全部 / 依類別 / 依 ID / 依場景`・`「馬賽克」`・`登入`・`組織登入`・`組織代碼`。
- `"Open in app"` / 「以應用程式開啟」・`"Subscribe"` / 「訂閱」・`"Estimated manual work"` はサイト自身のボタン・表の名前 (アプリの画面の引用ではない)。

### 直さなかったもの (理由)
- 説明文の「精細化」/ `mosaic refinement` (spec の performance_note、トップの比較画像の alt、llms.txt): 段の名前の引用ではなく、形に沿わせる処理の説明。
- `"Areas to review"` / 「需要確認的部分」(spec の performance_footnote): ja「確認が必要な箇所」がアプリの画面の名前そのものではない (近いのは `detection_log.review_chip` の「要確認」= `Needs review` / `需要確認`)。英中は ja の意味どおりなので残した。ja を画面の名前に合わせるなら別チケット。
- T-2231 の繁体字の残りの候補 (`faq.yml` の「通訊內容揭露」「不擅長的情況與限制事項」、`inquiry_form.yml` の件名 `Inquiry`): アプリの画面の引用ではない (サイトの節の名前・メールの件名) ので T-2232 の範囲外。

## リーダーへ (別チケットにする)
- **ja の「プラン管理」はアプリのメニューの名前と違う** (直していない。ja は変えない決定)。アプリの ja: 有料のときの項目 `account_login.menu_portal_label` = 「プラン・本数の変更 / 解約」、無料のときの項目 `account_login.menu_change_plan_label` = 「プランを変更する」(en `Change plan` / zh `變更方案`。docs の「プランを変更する」は一致)。ja の該当の場所:
  - `_data/subscribe.yml` 33 行 (FAQ の答え、「プラン管理」2 か所。英中は今回アプリの名前に揃えたので、ja だけ食い違う)
  - `company/asct.html` 81 行 (特定商取引法に基づく表記の解約の方法)
  - `_includes/docs/01-intro.html` 179 行 (プロフィールメニューの項目の並び)
  - `_includes/docs/02-account.html` 84 行・88 行・131 行
  - `_includes/docs/07-team.html` 55 行
  - (参考) テストのコメント・期待値: `src/lib/site-copy-t1037.test.js` 8 行 (コメント)、`src/lib/site-copy-t1922.test.js` 187〜188 行 (`アプリ内のプラン管理からお手続き` が無いことの検査。直しても影響しない)
- push の後に、`desktop_commit` (`e1382df7b370c3fe084f5bdef4d96c7d1b21965e`) が main で同じ sha か (`git -C <desktop> branch -r --contains e1382df7b370c3fe084f5bdef4d96c7d1b21965e` に `origin/main` が出る) を確かめる。違えば main 上の sha に直す 1 コミットを足す。
- 英中の新しい用語 (段の名前・メニューの名前) を固定する仕様テストはサイトに足していない (touches の外)。アプリの辞書とサイトの引用の照合を自動化するなら別チケットで。

## ゲート (コミットの前に 1 回、1 本ずつ。ログは `D:/dm-scratch/backlog1113/logs/w4c-site/t2232-g*.log`)
| ゲート | 結果 |
|---|---|
| 用語集の 3 者の照合 (統合 desktop・統合 web・サイト) | 合格 (一致) |
| `npm test` | 合格 (pass 1347・fail 0・skipped 3) |
| `npm run build && bundle exec jekyll build --strict_front_matter` | 合格 |
| `node scripts/i18n/check-site.mjs _site` | 合格 (12 モジュール) |
| `node scripts/check-docs.mjs` | 合格 |
| `node scripts/check-store-toggle.mjs` | 合格 |
| `E2E_SKIP_BUILD=1 npx playwright test` | 合格 (155 passed・1 skipped) |
| `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/B1113/_site _site` | 合格 (終了コード 0、17 files、差分 0) |

## ロールバック
- desktop・web・サイトの T-2232 の 3 コミットを一緒に戻す (用語集の 3 者が食い違うと、サイトの `npm test` の sha の照合と 3 者の一致の検査が落ちる)。サイトだけ戻すと英中の用語が T-2231 の時点 (Manage plan・前處理 など) に戻る。
