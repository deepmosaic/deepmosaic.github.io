# T-330 メモ: docs 07-team の「減らせる下限」を 3 アカウント / 使用中の数に

## 変更点

- `_includes/docs/07-team.html:106`「減らせる下限」の値:
  「**お見積り時のアカウント数より減らすことはできません**（メンバーの削除は行えます）」→
  「**3 アカウント未満・使用中の数未満にはできません**（「使用中」はメンバーが使っているアカウント数です。
  それより減らしたい場合は、先にメンバーを削除してください）」。
  T-328 で Worker の下限が `max(ENTERPRISE_MIN_SEATS(3), plan_catalog.min_seats, used)` になり、
  `seats_floor`（お見積り時のアカウント数）が下限から外れたため。末尾の導入相談への導線は据え置き。
- `_includes/docs/07-team.html:102`「アカウント数の変更」の値: 「**増やせます**」→
  「**増減できます**（減らせる下限は下記）」。同じ表の 2 行下で「減らせる下限」を説明しているのに
  上の行が「増やせるだけ」と読めると矛盾するため、動詞だけ合わせた（金額・プール・上限の説明は無変更）。
- `src/lib/docs-team-seats.test.js`（新規、6 件）: 上記の文言を**実装の下限に固定する**回帰テスト。
  - `.kv-key` が「減らせる下限」の行がちょうど 1 つ（増やしたら検査が素通りするのを防ぐ）
  - その行に出てくる数字が `_data/plans.yml` の `enterprise.min_seats` **だけ**であること
    （docs に数値を手書きせず SSOT から取る。`plan-catalog.js` が plans.yml ↔ Supabase で
    守っている距離の docs 側の一区間）
  - 「使用中」の下限を併記していること
  - 「アカウント数の変更」の行が「増減」と書いてあること（レビュー指摘 LOW への対応。
    この行だけが「増やせます」に戻ると同じ表の 2 行下の「減らせる下限」と矛盾するが、
    当初はこの行を固定するテストが無く再発を検知できなかった。旧文言に一時的に
    書き戻して `node --test` が exit 1 になることを確認済み＝RED を取ってある）
  - `seats_floor` 由来の旧文言（「お見積り時のアカウント数より減らす」）がファイルから消えていること
  - 抽出関数の空振り（存在しないキー → 空配列）＝すり抜け防止の境界

`_data/plans.yml` / `src/lib/` の製品コードは無変更。文言以外の HTML 構造（`.kv` 表）も触っていない。

## 追加・変更したコマンド

- 追加なし。`npm test` は `src/lib/*.test.js` を拾うので新テストは自動で対象になる。
- 実行したゲート:
  ```bash
  npm test                                        # 136 件中 135 pass / 0 fail / 1 skip（skip は要鍵の突き合わせ）
  npm run build && bundle exec jekyll build --strict_front_matter
  node scripts/check-docs.mjs                     # docs check: OK (2 ページ, 14 ファイル)
  ```

## 注意点・既知の制約

- **公開（push）は D 群（T-331〜T-333）と同時**。このリポジトリは push = 本番公開なので、本チケットでは
  master へのコミットまでで止め、push はしていない。
- 下限の正は Worker（`worker-auth0-updater/src/org-manage.ts`）。サイトはその写しなので、
  T-328 が本番デプロイされる前にこのページだけ公開すると「3 まで減らせる」と書いてあるのに
  Worker が `seat_floor` で弾く状態になる。**Worker → サイトの順**を守ること。
- 数値「3」は `_data/plans.yml` の `enterprise.min_seats` と一致していることをテストが見るだけで、
  Supabase `plan_catalog.min_seats` との一致は既存の `scripts/check-plan-catalog.mjs`（要鍵）に任せている。
- docs の節 ID・目次・画像には触れていないため `check-docs.mjs` の契約には影響しない。
- アプリ側（desktop `TeamBillingTab.svelte` の注記）の文言は T-329 の担当。ここでは合わせていない。

## ロールバック

- `git checkout -- _includes/docs/07-team.html && rm src/lib/docs-team-seats.test.js`
  （コミット後なら該当コミットを `git revert`）。文言のみの変更なのでビルド成果物への影響は
  `_site/docs/index.html` の 2 文だけ。T-328 を巻き戻す場合は本チケットも一緒に戻す
  （戻さないと「3 まで減らせる」という実装に無い条件が残る）。
