# T-1656 サイトの無料期間 (7 日) の記述 (req1031)

## 変更点

Free プランに「初めて起動した日から 7 日間」の無料期間が付いた (desktop / web / SQL は T-1639〜T-1655)。
累計の上限 (登録なし 30 分 / 登録あり 2 時間 / 1 台の PC で合計 2 時間) は不変で、日数と累計のどちらか早い方で終わる。

| 箇所 | 変更 |
|---|---|
| `_data/plans.yml` (free) | `free_window_days: 7` を追加、bullets を 5 本に (7 日間 / どちらか早い方 / 1 台の PC で 2 時間 (維持) / カード不要 / 終了後も編集・書き出し可) |
| `_data/faq.yml`「無料で使えますか？」 | 7 日間・どちらか早い方を追記。「別途の無料トライアル期間は設けていません」は無料期間と矛盾するので削除 |
| `_includes/docs/02-account.html` | 先頭に「初めて起動した日から N 日間」、「N 日間か累計の上限のどちらか早い方」、ul の無料行、「上限に達したとき」に無料期間の終了を追加、kv-row「無料期間の表示」を新設。トライアル期間の文は FAQ と同じ理由で削除 |
| `_includes/docs/01-intro.html` | フッターの「残り時間」に「無料プランでは残り日数も併記」 |
| `_includes/docs/03-detect.html` | ダイアログの条件に「無料期間の終了」 |
| `_includes/docs/06-ops.html` | 「無料期間」の項目を追加 (`free_plan` の assign を足した) |
| `_includes/docs/web.html` | Web 版も Desktop 版と共通の無料期間である旨 |
| `llms.txt` | 料金の行に日数 (日英)。`llms-full.txt` は plans.yml の bullets を射影するので変更不要 |
| `index.html` / `_includes/cta-download.html` | 「初回起動から N 日間」 |
| `price/index.html` | front matter の description の古い「累計 5 時間」を「初回起動から 7 日間・累計 2 時間」に (Liquid 不可なので直書き) |
| `_data/disclosure.yml` | 送信内容に「無料枠の利用開始日時」 |
| `company/privacy.html` 10 項 | 利用開始日時の収集と、日数の計算の目的を追記。版は据え置き、最終更新日だけ 2026-10-31 |
| `src/lib/plan-catalog.js` | `free_window_days` を `plan_catalog.free_window_days` と突き合わせる (tier が持つときだけ、列が無ければ warning) |
| テスト | 新 `site-copy-t1656.test.js`、`plan-catalog.test.js` に 1 件、`site-copy-t1572` / `t1444` の最終更新日の固定を「2026-10-28 以降」に緩め、10 項の目的の文を新旧どちらも許す形に |

終了後の挙動 (進行中の検出・既存プロジェクトの編集・書き出しは止めない) の根拠は COMMON のリーダー設計判断 9
(「期限切れでも進行中の検出・既存プロジェクトの編集・書き出しは止めない (今の累計到達と同じ)」)。

## 追加・変更したコマンド

なし (`node --test src/lib/site-copy-t1656.test.js` が増えただけで、`npm test` に含まれる)。

## 注意点・既知の制約

- 日数を直書きしているのは plans.yml の bullets・FAQ・price の description の 3 箇所。日数を変えるときは一緒に直す (site-copy-t1656 が 7 を固定しているのでテストも)。
- 利用規約 (`company/terms.html`)・EULA・`_data/legal.yml` は触っていない (ユーザー決定: 再同意を出さない)。
- 06-ops / 料金ページの「送るのは …のみです」の列挙 (t964 が固定) には利用開始日時を足していない。送信内容の一覧 (disclosure.yml) とプライバシーポリシー 10 項には載せた。
- `plan-catalog` のライブ突き合わせは、本番の migration (T-1639) と Worker の `/plan-catalog` が `free_window_days` を返すまでは warning (`::warning::`) が 1 件出る。デプロイは止まらない。
- 「5 時間」の grep で残るのは Light プランの込み時間 (`月 5 時間`) と index.html のコメントの「15 時間」で、無料枠の記述ではない。

## ロールバック

このチケットのコミットを revert する。plans.yml の `free_window_days` を消すと plan-catalog の突き合わせは自動で飛ぶ。
