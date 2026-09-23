# T-513 — docs 04-edit にタイムライン編集を書き足す (+8 節 / ショートカット表 27 → 47 行)

## 変更点

- **`_includes/docs/04-edit.html`** (391 → 768 行)
  - 既存の節 (edit-overview … shortcuts) は ID も並びもそのまま。中身の更新:
    - `#edit-overview`: 画面構成にサイドバー (とドロワー) を追加。kv に「サイドバー」「タイムライン」「ツールチップ」(約 0.15 秒で
      説明とショートカットを出す、T-248) の 3 行。
    - `#edit-player`: 検出枠の操作に「連続削除 (消しゴム)」(右ドラッグ、動かさずに離せば従来の右クリックメニュー、T-250) と
      「ID ごと削除 (チップの ✕)」(検出トラックだけ、確認あり、T-249) の 2 行。右クリックメニューに「この ID をすべて削除」。
      bbox の選択 / 追加 / 消しゴムは検出元の区間だけ (T-433) の注記。タイムラインの説明をレーン構成 (テキスト / クリップ / 音声)
      と出力時間基準 (T-434) に、拡大ボタンの位置をツールバー左端に直した。
    - `#edit-scenes`: シーン分割ボタンの位置 (タイムラインのツールバー、拡大・縮小ボタンの右) と、クリップ分割 (Ctrl+Shift+K) との違い。
    - `#shortcuts`: 表を desktop `src/lib/edit-shortcuts.ts` の 1 id = 1 行に作り直し (47 行 = 全 56 − annotation の 9)。各行に
      `data-shortcut="<id>"`。「タイムライン」行が折りたたみ中は効かないこと、Ctrl+Z と Ctrl+Shift+Z の別、Delete の効き先
      (最後に操作した場所、T-438) を箇条書きで追記。
  - 新しい 8 節 (目次の新しい群「タイムライン編集」、kicker も同じ。並びは目次と同じ):
    `#edit-sidebar` (6 項目 + T キー + 左右の配置 + ドロワー幅 240〜520px / ← → 16px / ダブルクリックで 300px) /
    `#timeline-edit` (選択・トリム・分割・リップル削除・並べ替えと移動・空白・継ぎ目・フィルムストリップ、右クリックメニューと
    クリップボード、ラベル付き履歴 (最大 100 件、開き直すと空)、タイムラインの高さ 220〜720px と折りたたみ) /
    `#edit-media` (取り込み・形式と上限・タイムラインに追加・画像クリップ 5 秒 (T-493)・取り込んだ動画クリップは無音・素材の削除、
    取り込んだ素材は検出の対象外) / `#edit-text` (追加・区間・位置 (プレビューでドラッグ / X・Y / プリセット)・大きさ・フォント 5 種と
    太字・色と縁取り、テキストレーン (1 テキスト 1 段、T-492)) / `#edit-watermark` / `#edit-audio` (元音声、音声トラック、音量
    -40〜+12dB、フェード 0〜20 秒、音声レーンと波形) / `#edit-fade` (0〜20 秒、フレーム数表示、先頭へ / 末尾へ) /
    `#edit-transition` (8 種、0.1〜5 秒・既定 0.5 秒、重なる分だけ尺が縮む、空白を挟む継ぎ目には置けない)。
  - 数値・文言は desktop の実装 (desktop HEAD fcbcd03 時点のソース) と T-489〜T-493 の CHANGELOG 行から取った。
- **`_data/docs_toc.yml`**: 群「タイムライン編集」を「編集」の後ろに追加し 8 ID を登録 (追加のみ。既存 37 ID は並びも不変)。
- **`_includes/icon.html`**: lucide 0.460.1 (desktop の node_modules) から 10 個を写した — Scissors / SquareSplitHorizontal / History /
  Images / Type / Stamp / Music / Blend / ArrowLeftRight / PanelRight。`Scissors` は既存の `#edit-scenes` が参照していたのに未定義で、
  空の svg が出ていた (ついでに直った)。
- **`llms.txt`**: `/docs/#timeline-edit` の 1 行を追加 (`check-docs` の深いリンク検査の対象)。
- **`src/lib/docs-edit-timeline.test.js`** (新規 29 件): desktop `EDIT_SHORTCUTS` の写し (47 個、写し元のパスとコミットをコメントに記載) と
  表の ID・分類 (rowspan)・キーを並び順まで突き合わせる / 目次の追加のみ (T-513 前の 37 ID と契約の 20 個) / 8 節が本文と目次に
  同じ順である / 各節が CHANGELOG の機能列挙に触れている / 新しい画像 8 枚を 1 回ずつ alt と寸法付きで参照している。
- 写し元のパス: チケット文面の `desktop/src/lib/edit/edit-shortcuts.ts` は実在せず、実体は `desktop/src/lib/edit-shortcuts.ts`
  (最終変更 04b4cff = T-438)。Tester が desktop b05fc03 の `EDIT_SHORTCUTS` を node で読み込み、group が
  'アノテーション' の 9 個を除いた 47 個とテストの `EDIT_SHORTCUTS_FIXTURE` を ID・分類・keys・並び順まで突き合わせて完全一致を確認した。
- 数値の再確認 (desktop b05fc03): ドロワー幅 `DRAWER_W_MIN/MAX/STEP` = 240 / 520 / 16、タイムラインの高さ
  `TIMELINE_H_MIN/MAX/STEP` = 220 / 720 / 16・`PLAYER_MIN_H` = 200、`TIMELINE_HISTORY_LIMIT` = 100、素材の上限
  `MAX_ASSET_BYTES` = 2GiB / 200MiB / 50MiB、`TEXT_FONT_FAMILIES` = 5 種、サイドバー 6 項目のアイコンと「つなぎ」表記、
  <kbd>T</kbd> が直前の設定項目 (初期値 watermark) を開くこと、クリップの貼り付け先 (`pasteClipIndex`) は本文と一致。

## 追加・変更したコマンド

新規コマンドは無し。ゲート:

```bash
npm test && npm run build && bundle exec jekyll build --strict_front_matter
node scripts/check-docs.mjs   # T-496 の到着までは下記 8 枚の「画像ファイルが無い」だけで exit 1
```

写しと desktop の突き合わせ (一回きり、scratchpad のスクリプト) は 56 個中 annotation 以外の 47 個が完全一致。

ゲートの実走結果 (2026-09-23): `npm test` 263 件 (pass 262 / skip 1 = plan_catalog のライブ検査で既存) / `npm run build` 成功 /
`bundle exec jekyll build --strict_front_matter` 成功 / `node scripts/check-docs.mjs` は下記 8 枚の「画像ファイルが無い」の 8 件だけ
(他の検査はすべて通過)。

## T-496 で届く画像 (check-docs が今だけ落ちる 8 枚)

`assets/img/screenshots/` の次のファイル名 (T-495 の撮影ハーネスの名前):

1. `edit-sidebar-media.webp` — `#edit-sidebar` (サイドバー + メディアのドロワー)
2. `edit-timeline-clips.webp` — `#timeline-edit` (クリップレーン、分割・空白・素材、上下のテキスト / 音声レーン)
3. `edit-timeline-menu.webp` — `#timeline-edit` (タイムラインの右クリックメニュー)
4. `edit-text.webp` — `#edit-text`
5. `edit-watermark.webp` — `#edit-watermark`
6. `edit-audio.webp` — `#edit-audio` (音声パネル + 波形)
7. `edit-fade.webp` — `#edit-fade`
8. `edit-transition.webp` — `#edit-transition`

`<img>` の width / height は仮の 1280×800。撮影後に `node scripts/check-docs.mjs --fix-dims` で実寸に揃える。
T-495 の一覧にある `edit-history-menu` は本文 (履歴の説明) だけにして画像を置いていない (8 枚に収めるため)。
使うなら `#timeline-edit` の「取り消しと履歴」に `<figure>` を 1 つ足し、テストの `NEW_SCREENSHOTS` にも足す。

## 注意点・既知の制約

- 画像クリップ (T-493)、分割の継ぎ目のカットの印 (T-489)、テキスト 1 つにつき 1 段 (T-492) は desktop 側が未実装 (A チェーン)。
  01-intro の先取り注記 (v2.4) の範囲として先に書いた。どれかが v2.4 から外れたら該当の文を直すこと。
- ショートカットの割当を desktop で変えたら、`src/lib/docs-edit-timeline.test.js` の `EDIT_SHORTCUTS_FIXTURE` と表を同時に直す
  (テストは desktop リポを読まない = site 単体で CI が回る。写しが古いと desktop と食い違ったまま緑になる点は制約)。
- 目視: `_site/` をローカル配信して 1280px / 375px で撮影し、横スクロール 0px を確認 (未着の画像は alt の枠だけ出る)。

## ロールバック

この 5 ファイルを戻すだけ (`git checkout <前のコミット> -- _includes/docs/04-edit.html _data/docs_toc.yml _includes/icon.html llms.txt`
と新しいテストの削除)。新しい節 ID への外部参照は llms.txt の 1 行だけ。
