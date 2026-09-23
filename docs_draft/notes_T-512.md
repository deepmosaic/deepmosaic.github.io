# T-512 — トップページにタイムライン編集 / ホーム画面のフォルダとタグ / 組織の機能節、アノテーション記述の削除

## 変更点

- **`index.html`**
  - 新しい節 2 つを MOSAIC と PRIVACY の間に追加 (背景の交互 = MOSAIC 色付き → TIMELINE 無地 → MANAGE 色付き → PRIVACY 無地を維持)。
    - `<!-- TIMELINE -->`「書き出す前に、タイムラインで仕上げる」: 6 枚のカード (カットと並べ替え / 素材を追加 (画像は好きな長さ) /
      テキストと透かし (書体 5 種と太字) / BGM と音量 / フェードとトランジション / モザイクはそのまま (取り込んだ素材は検出対象外))。
      既存アイコンのみ使用。画像は置いていない — 既存の `edit-timeline.webp` は検出区間の帯 (旧タイムライン) で内容が合わないため。
      T-496 の新規撮影 (`edit-timeline-clips`) が届いたら差し込める。
    - `<!-- MANAGE -->`「動画の整理も、組織での利用も」: 左 = `home.webp` + フォルダとタグの 3 項目、右 = 組織 (Enterprise) の 5 項目 +
      `/docs/#team` と `/enterprise/inquiry/` へのリンク。`home.webp` は T-496 が同じ名前で撮り直すので、alt は撮り直し前後どちらでも
      合う書き方 (「左のサイドバーで一覧を絞り込み、右に処理済みの動画のカードが並ぶ」)。人数・金額は書かない。
  - RELIABILITY: section-title の sub からアノテーションモードの文 (T-246 で無効化済み) を削除し、「検出が途切れたフレームへの
    ジャンプ」に置換。Liquid コメントの「T-203 でアノテーションモードに」も経緯の記述に書き換え (= 2 箇所)。
  - hero 画像 (`edit-player-mosaic.webp`、`fetchpriority="high"`) は**変更なし** (T-496 が上書き)。
- **`_includes/desktop-next-note.html`** (新規): 機能節に添える 1 行
  「※ {features}は、Desktop 版では次回の更新 (v2.4) からご利用いただけます（配布中の v2.3.7 には含まれません）」。
  3 機能とも v2.3.7 (2026-09-05 の tag) に無いことを確認済み (EditSidebar / HomeSidebar / timeline/model.ts / TeamWindow が未収録)。
  トップは「無料でダウンロード」の直後に読まれるので、docs 01-intro の先取り注記と同じ版表記で断る。**T-515 で外す**。
- **`enterprise/inquiry/index.html`**: 「込み時間をチームで共有」→「組織で共有」(サイトの表示文字列に残っていた最後の「チーム」)。
- TRUST BAR / FAQ (`_data/faq.yml`) には元々「チーム」が無かったので文言の変更は無し。代わりにテストで固定した。
- **`src/lib/top-page-features.test.js`** (新規 8 件): TIMELINE 節が 10 語 (トリム・分割・並べ替え・空白・画像・テキスト・透かし・
  BGM・フェード・トランジション) + モザイクに触れる / MANAGE 節 (フォルダ・タグ・組織・Enterprise・招待・組織コード・請求書、
  2 リンク) / 新しい画像は実在 + alt / width / height / lazy / 注記の版が 01-intro と一致し両節で使われる / RELIABILITY と
  トップ全体の表示文字列にアノテーションが無い / hero のファイル名と fetchpriority / トップの本文・部品 (index.html が include する
  全部品)・TRUST BAR・FAQ などのデータ 6 ファイル・導入相談ページに「チーム」が無い。

## 追加・変更したコマンド

新規コマンドは無し。ゲートは T-510 と同じ。見た目はローカル配信 (`E2E_PORT=4391 node e2e/lib/serve.mjs`) + Chrome で
1280px と狭幅を確認 (横スクロール無し)。

## 注意点・既知の制約

- 注記部品 `desktop-next-note.html` はチケットの記述に無い追加 (配布版に無い機能をトップで紹介するため)。不要なら部品と 2 箇所の
  呼び出し、テスト 1 件を外せばよい。
- `home.webp` は現状 T-383 時点の旧 HOME (撤去済みバナーが写っている)。T-496 の撮り直しまで古い絵が出る (公開 T-514 は T-496 の後)。

## ロールバック

このコミットを revert (index.html・部品 1 つ・導入相談ページの 1 語・テストのみ)。
