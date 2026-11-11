# T-2094: 公式サイトの docs を desktop / web 2.13 の変更に合わせる (login1111、未公開の統合ブランチ `store1109-integrate`)

正本 (画面の文言は一字一句同じ): desktop `src/lib/auth/login-entry.ts` (authButtonsFor / switchOfferFor / CODE_METHOD_NOTE)、
`src/lib/team/wording.ts` (ORG_CODE_SHARE_WARNING / ENTERPRISE_ENTRY_LABEL)、`src/lib/components/AuthDialog.svelte`、
`src/lib/components/menu-model.ts` (help.about = 「ライセンス」)、web `app/src/lib/components/LoginGate.svelte`、サイトの `join/index.html` (T-2090)。
参照した notes: desktop の `docs_draft/notes_T-2082.md` / `notes_T-2084.md` / `notes_T-2087.md` / `notes_T-2092.md` / `notes_T-2093.md`、`docs/deep-link.md`
(`notes_T-2088.md` は統合 worktree に無かったので飛ばした)。

## 変更点
- `_includes/docs/02-account.html` #license「ログインする」: 3 つの入口 (「メールアドレスではじめる」/「パスワードで登録済みの方はこちら」/
  「エンタープライズプランの方はこちら」) の表。コード方式 = メールに届く 6 桁の確認コード・パスワード不要・初めての方はここ。
  「2.13 から入口は 3 つ、『新規登録』『ログイン』の 2 択とメール欄は廃止、既存の利用者はパスワードのまま
  (パスワードで登録したアドレスはコード側からは入れない)」の段落。「別のアカウントでログイン」の案内を削除し、ログアウト → ログインに。
- `_includes/docs/06-ops.html`
  - #trouble「ログインとプラン」: 待ちのやり直しを新しい入口名に。「確認コードのメールが届かない場合」(迷惑メール・数分待って再送信・
    パスワードの方には届かない → 待っている画面の「パスワードでログインする」/「パスワードで登録済みの方はこちら」) と
    「パスワードを忘れた場合（パスワードで登録済みの方）」を追加。
  - #licenses: 「ヘルプ ▸ このアプリについて」→「ヘルプ ▸ ライセンス」、一覧は行を押すと中身が開く旨。ffmpeg の NOTICE の案内とコメントも。
- `_includes/docs/01-intro.html` #layout: メニューバー「ヘルプ」の行を「ライセンス」に (行を押すと開く)、「2.12.1 より前」→「2.13 より前」、
  プロフィールメニューの説明の項目名。
- `_includes/docs/07-team.html`: 招待の「(または新規登録)」→「初めての方は『メールアドレスではじめる』から登録」、組織コードの入口を
  「エンタープライズプランの方はこちら」に、注意書きを ORG_CODE_SHARE_WARNING と同文に、新しい小見出し「案内メールのリンクから参加する」
  (リンク →「Deepmosaic を開く」の「アプリで開く」→ 組織コード入りのログイン画面 → ログイン。管理者はコードを入力しない。開かないときはコピーして貼り付け)、
  導入の流れの手順 6 に「管理者は組織コードを入力しません」。
- `_includes/docs/web.html`: 始め方の手順 1 を新しい入口に、#team の組織コードでの参加を「エンタープライズプランの方はこちら」→「組織コードを添えてログイン」(LoginGate の実文言)。
- `subscribe/index.html` STEP 2 と `_data/subscribe.yml` の FAQ: 「新規登録」→「メールアドレスではじめる」(Web 版のログイン画面の変更に追従。料金・条件は変えていない)。
- 版の表記 `2.12.1` → `2.13`: `_includes/docs/01-intro.html`、`_data/spec.yml` のコメント、テストのコメント・名前 (`site-copy-help1111` / `site-copy-t1900` / `site-copy-t1917` / `spec-requirements`)。
- テスト: 新規 `src/lib/site-copy-t2094.test.js` (14 件。変更前の原稿に当てると 13 件が落ちることを確認済み)。
  `site-copy-help1111.test.js` の「このアプリについて」の期待値を「ライセンス」に。

## ゲート
- `npm test` 708 件 (pass 707 / skip 1 は既存)。変更前は 694 件 (pass 693 / skip 1)。
- `npm run build && bundle exec jekyll build --strict_front_matter` 成功、`node scripts/check-docs.mjs` OK、`_site/llms*.txt` / `robots.txt` の先頭は素通し。
- `E2E_SKIP_BUILD=1 npx playwright test` 59 件 (pass 58 / skip 1 は既存)。

## 公開の順序
- **desktop / web 2.13 の公開と同時** (統合ブランチ `store1109-integrate` の他の変更と一緒に master へ。push はリーダー / ユーザー)。
  早く出すと 2.12 の画面 (「ログイン」「新規登録」の 2 択) と食い違い、遅れると 2.13 の画面に旧い案内が残る。
- 「案内メールのリンクから参加する」は、req1111 が案内メールに `/join/#code=…` / `/join/#admin` のリンクを入れるのと同時に効く。
  メールにリンクが入らないまま公開する場合はこの小見出しを外す (またはリンクの入ったメールの送信開始まで公開を待つ)。

## 差し替えが要るスクリーンショット (このチケットでは画像を作っていない)
- docs にログイン画面 (AuthDialog / Web の LoginGate) のスクリーンショットは無い。足すなら desktop の撮影 (`scripts/e2e/screenshots.mjs`) に
  3 段のログイン画面を登録してから (位置の目印: `07-team.html` の「ログインダイアログの「組織コード」欄」の HTML コメント)。
- `assets/img/screenshots/profile-menu.webp` (01-intro #layout): T-1928 の notes のとおり撮り直しが要る (2.13 のプロフィールメニュー)。
  このチケットの変更では新たな食い違いは増えていない。
- メニューバー「ヘルプ ▸ ライセンス」とライセンス一覧 (行だけの一覧) のスクリーンショットは docs に無い (足すなら撮影に登録してから)。

## 仮定
- `docs_draft/notes_T-1928_T-1929.md` の「2.12.1」は当時の記録なので直していない (CLAUDE.md の「過去の記録は変えない」)。
- 「パスワードを忘れた場合」の再設定は Auth0 の認証画面で行える前提 (desktop `docs/store/review-account.md`: パスワードの再設定はそのまま使える)。
- 「再送信」は Auth0 のコードの画面で行う前提 (画面の文言そのものは書いていない)。
- 管理者用のリンク (`#admin`) と組織コード入りのリンク (`#code=`) の両方が案内メールに入る前提で、文章はどちらにも当てはまるように書いた。

## ロールバック
このコミットを revert する (画像・データの移行は無い)。
