# T-509 — docs 01-intro / 03-detect / 05-export / 06-ops を次回のデスクトップ更新 (v2.4) に合わせる

2026-09-23 のユーザー決定で docs を desktop のリリースより先に公開する (配布中は v2.3.7)。
そのための先取り注記と、撤去・無効化・追加された機能の記述の更新。

## 変更点

- **`_includes/docs/01-intro.html`** — `#about` の中、節見出しより前に先取り注記
  (`<p role="note">`、`border-l-[3px] border-warning bg-panel` = トップの注意書きと同じ部品):
  「本ドキュメントは次回のデスクトップ更新 (v2.4) の内容です。配布中の v2.3.7 では一部の機能と表記が異なります。」
  `#about` の**中**に置いたのは、アプリ内ヘルプが `/docs#about` へ深いリンクで来たときにも読まれるようにするため。
  **T-515 (desktop リリース時) で外す** — そのとき `src/lib/docs-desktop-refresh.test.js` の注記 2 件も直す。
- **`_includes/docs/03-detect.html`**
  - `#import`「プロジェクトフォルダ」: 撤去済みバナー (「他のプロジェクトフォルダに N 件…」「表示する」、T-411 で撤去)
    の説明を、左サイドバーの**「他のフォルダ」行** (件数つき、0 件なら非表示、同じ一覧で表示) に置換。
    その動画は**フォルダとタグが使えない** (サイドバーのフォルダへのドラッグも不可) こと、カードのメニュー
    (右クリックでも開く) の「このプロジェクトフォルダに切り替える」で直せることを追記 (desktop の
    `list-pipeline.ts::NOT_CLASSIFIABLE_REASON` / `VideoCardMenu.svelte` の文言に合わせた)。
  - `#detect-options`: **残りの検出可能時間が動画の全長より少ないと開始前に止まる** (T-277) 段落を追加。
    文面の例はアプリの `videoTooLongMessage` と同じ形「残り検出可能時間 (1時間30分) では 120分の動画を
    検出できません。プランをご確認ください」。範囲を絞っても全長で数える (T-276) ので範囲指定では回避できない旨も。
- **`_includes/docs/05-export.html`**
  - `#project-io` エクスポート: zip の中身に「タイムライン編集で追加した素材（動画・音声・画像）」(T-266)。
  - `#project-io`「編集内容を取り込む」: zip の素材のうち手元に無いものを置き換えの前に補う (手元の素材は
    消えない) — Rust `merge_assets_sync` の挙動 (同名同サイズはスキップ、無い物だけ書く、編集の置換より先)。
  - `#review`: **アノテーションモードの項目を削除** (T-246 で `ANNOTATION_MODE_ENABLED=false`)。節と他の
    確認手段 (欠落フレーム / 空白のみ再生 / モザイク適用プレビュー / 人物ギャラリー …) は残す (`review` は
    LEGACY_DOCS_IDS の契約)。Liquid コメントも無効化の経緯に書き換え。
- **`_includes/docs/06-ops.html`**
  - `#data` プロジェクトフォルダ: 素材はサブフォルダの `assets` にコピーされ、書き出しにも含まれる (T-266)。
  - `#trouble`「「開始」が押せない場合」: 残り時間 < 全長のケース (T-277) を追記。
  - `#trouble`「検出したのにホーム画面に出てこない場合」: バナーの案内をサイドバーの「他のフォルダ」行に置換。
- **`src/lib/docs-desktop-refresh.test.js` (新規)** — 回帰テスト 14 件 (node:test / AAA / 読み取りはファイル内で完結):
  先取り注記が `#about` の見出しより前・`role="note"` の囲みにある / 撤去済みバナーの文言がどの章にも無い /
  03・06 が「他のフォルダ」行を案内 (分類不可と切り替えの導線つき) / 「最近追加した動画」がどの章にも無い /
  「アノテーション」がどの章にも無い / `#review` に他の確認手段が残っている / 05 の zip に素材 /
  「編集内容を取り込む」が素材に触れる / 03・06 に T-277 の開始前停止。補助関数 (`sectionOf` /
  `subsectionOf` / `listItemOf`) が無い ID・見出し・項目で null を返すことも固定 (すり抜け防止)。

**節 ID は 1 つも変えていない** (legacy 20 ID + layout / theme / batch / queue / timecode / encode-progress /
project-io / data / web / team)。目次 (`_data/docs_toc.yml`) も不変。

### 「最近追加した動画」「未分類」の行について

CHANGELOG は「行の記述を削除」だが、**変更前の docs にこの 2 行の記述は元から無かった** (HOME のサイドバー
自体が docs に書かれていなかった)。削除対象が無いので、再混入を防ぐテスト (「最近追加した動画」が
どの章にも無い) だけを足した。「未分類」はグループ見出しと移動先として desktop に残る語なので、
語そのものの禁止はしていない。

## 追加・変更したコマンド

新規コマンドは無し。実行したゲート:

```bash
cd deepmosaic.github.io
npm test                                          # 201 件 (pass 200 / skip 1)
npm run build                                     # Vite (RoiCalculator.svelte の既存警告のみ)
bundle exec jekyll build --strict_front_matter
node scripts/check-docs.mjs                       # docs check: OK (2 ページ, 15 ファイルの深いリンクを検査)
```

## 注意点・既知の制約

- 画像は差し替えていない (T-496 の撮り直しの担当)。`home.webp` 等は旧 HOME のままの可能性がある。
- 03-detect「動画カードの操作」のメニュー項目の表 (5 項目) は今回の範囲外 (T-509 の行に無い) で未更新。
- 04-edit (T-513)、07-team (T-510)、web.html (T-511)、トップページのアノテーション記述 (T-512) は別チケット。
- 先取り注記の外し忘れ防止: T-515 で注記を外すと `docs-desktop-refresh.test.js` の 2 件が落ちるので、
  そのときテストも「注記が無い」側に書き換える。

## ロールバック

このコミットを revert するだけ (docs の文面とテストのみ。ID・目次・画像は触っていない)。
