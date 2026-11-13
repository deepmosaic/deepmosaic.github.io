# T-2316 日本語のページの「プラン管理」をアプリの実際のメニューの名前に合わせる

## 背景
- アプリ (desktop / Web 版) のアカウントメニューに「プラン管理」という項目は無い。英語・繁体字のページは T-2232 (5001542) でアプリの名前に揃え済みで、日本語だけが食い違っていた (`docs_draft/notes_T-2232.md` の申し送り)。
- アプリの辞書 (統合ブランチ desktop `src/lib/i18n/messages/account_login.ts`、読むだけ) の ja の値:
  - 有料プランのとき `account_login.menu_portal_label` = 「プラン・本数の変更 / 解約」(en `Change plan, number of accounts, or cancel` / zh-TW `變更方案或數量／取消訂閱`)
  - 無料プランのとき `account_login.menu_change_plan_label` = 「プランを変更する」(en `Change plan` / zh-TW `變更方案`)
  - Enterprise の組織 `account_login.menu_team_label` = 「組織」

## 直した文 (項目の名前だけ。文の意味・手順・法務上の内容は不変)
| 場所 | 前 | 後 | 判断 |
|---|---|---|---|
| `_data/subscribe.yml` FAQ「プランの変更や解約はどこで行いますか？」(2 か所) | …プロフィールメニューの「プラン管理」から行います（…アプリのプロフィールメニューの「プラン管理」からも行えます） | 「プラン・本数の変更 / 解約」(2 か所) | 変更・解約・支払い方法 = 有料プランの操作。英中 (T-2232 後) と同じ名前 |
| `company/asct.html` 解約条件 | アプリのプロフィールメニューの「プラン管理」から開く決済ポータルで解約できます | 「プラン・本数の変更 / 解約」から開く決済ポータルで解約できます | 解約 = 有料プランの操作。解約の方法・期間・請求の停止・返金の文は不変。`_data/legal.yml` の版・最終更新日は変えない。英中版のページは無い |
| `_includes/docs/01-intro.html` プロフィールメニュー (右上) の項目の並び | プランを変更する（無料プランのとき）または プラン管理（有料プランのとき） | プランを変更する（無料プランのとき）または プラン・本数の変更 / 解約（有料プランのとき） | 無料・有料の両方の項目の名前 |
| `_includes/docs/02-account.html` #plan 手順 2 | 有料プランのときは「プラン管理」を選ぶと、ブラウザで決済ポータルが開きます | 有料プランのときは「プラン・本数の変更 / 解約」を選ぶと… | 有料プランの操作 |
| `_includes/docs/02-account.html` #plan Web 版の段落 | 支払い方法の変更・プランの変更・解約は、Web 版の…プロフィールメニューの「プラン管理」からも行えます | 「プラン・本数の変更 / 解約」からも行えます | 有料プランの操作 (Web 版も同じキー。英中の subscribe FAQ も Web 版を同じ名前で書いている) |
| `_includes/docs/02-account.html` #account 手順 1 | 有料プランを契約中の場合は、先に「プラン管理」から解約してください | 先に「プラン・本数の変更 / 解約」から解約してください | 有料プランの解約 |
| `_includes/docs/07-team.html` #team | Free / Light / Pro では「プランを変更する」「プラン管理」が並ぶ位置に「組織」が表示されます | Free / Light / Pro では「プランを変更する」（Free）または「プラン・本数の変更 / 解約」（Light / Pro）が表示される位置に「組織」が表示されます | 両方に当たる文なので両方を書いた。「組織」は辞書の `menu_team_label` と一致 |

- 英中: `_data/l10n/{en,zh-tw}/subscribe.yml` の FAQ は既に `menu_portal_label` の訳で同じ意味。文は変えず `node scripts/i18n/accept-site.mjs _data/l10n/en/subscribe.yml _data/l10n/zh-tw/subscribe.yml` で `_source_hash` だけ受け入れた。docs と asct は英中の対象外。
- 直さなかったもの: `CHANGELOG.md`・過去の `docs_draft/notes_*.md` の記述 (履歴)、`src/lib/site-copy-t1037.test.js` 8 行 (T-1037 の経緯のコメント)、`src/lib/site-copy-t1922.test.js` 187〜188 行 (`アプリ内のプラン管理からお手続き` が無いことの検査。今回の直しで弱まらない)。

## テスト
- 新規 `src/lib/site-copy-t2316.test.js` (4 件): 対象 5 ファイルに「プラン管理」がメニュー項目として残っていない / 直した文が辞書の ja の値 (テスト内の定数) を使う / asct の解約の手続きの文が不変。実装前に 4 件すべての失敗を確認 (ログ `D:/dm-scratch/backlog1113/logs/T-2316/red.log`)。

## ゲート (ログ `D:/dm-scratch/backlog1113/logs/T-2316/`)
| ゲート | 結果 |
|---|---|
| `npm test` | 合格 (1358 件、pass 1355 / fail 0 / skip 3) |
| `npm run build && bundle exec jekyll build --strict_front_matter` | 合格 |
| `node scripts/i18n/check-site.mjs _site` | 合格 |
| `node scripts/check-docs.mjs` | 合格 |
| `node scripts/check-store-toggle.mjs` | 合格 |
| `E2E_SKIP_BUILD=1 npx playwright test` | 合格 (155 passed / 1 skipped) |
| `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/B1113/_site _site` | 終了コード 1 (意図どおり)。差分のファイルは `company/asct.html`・`docs/index.html`・`subscribe/index.html` の 3 つだけ。`docs/index.html` の差分は T-2302 の表示言語の 1 文と今回の 5 文だけ (行ごとに確認) |

## ロールバック
- このコミットを revert すれば元の文と `_source_hash` に戻る。
