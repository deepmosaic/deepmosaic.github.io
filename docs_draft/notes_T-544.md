# T-544 docs 04-edit のフェード / トランジションを「効果」のパレットからの DnD に書き直す (site 側)

公開 (push) はリーダーの T-515 と一緒。撮影は desktop の T-542 (`docs_draft/notes_T-542.md`、desktop 6bbc6ba)。
site リポに 1 コミット (push していない = このリポの push は即公開)。

## 変更点

- `_includes/docs/04-edit.html`
  - `#edit-fade` (節 ID 不変): 「全体のフェード」(ルーラーの先頭 / 末尾へ) と「クリップのフェード」(帯の左端 / 右端へ) を
    タイムライン上部の「効果」のパレットからチップをドラッグして置く → ランプ (三角の印) をクリック / Enter で
    サイドバーの「フェード」が開き、「選択中のクリップ」の欄で秒数 (0〜20 秒、フレーム数併記、「外す」) を入れる、に書き直し。
    置いたときの既定 1 秒 (`DEFAULT_FADE_SECONDS`)、キーボードの経路 (チップで Enter / Space = 選択中のクリップの端、
    未選択なら全体)、置けない所 (反対側の端 = `FADE_ZONE_MISMATCH` / トランジションのある端 = `CLIP_FADE_EDGE_REASONS`)、
    クリップのフェードは映像だけ (元の動画のクリップは音声も) で透かし / テキストは暗くならない、全体と重なると両方がかかる
    (積)、プレビューにも反映、を追記。「先頭へ / 末尾へ」は残した (FadeTab に現存)
  - `#edit-transition` (節 ID 不変): 「効果」の「つなぎ」のチップを継ぎ目のバッジへドラッグ (既定 0.5 秒、重なりの斜線の帯) →
    バッジ / 帯のクリック / Enter でサイドバーの「つなぎ」→ 種類と長さ (0.1〜5 秒)、に書き直し。T-536 で撤去した
    「パネル上部のチップ」の記述を削除。キーボードの経路 (選択中のクリップの後ろ、未選択は案内のみ)、空白のある継ぎ目
    (ドラッグ中に置けない表示 → 落としても不変 + 理由、空白は自動で詰めない = T-431)、プレビューの合成 (T-541) と
    **既知の制約「重なりのあいだ後ろのクリップ側はプレビューではモザイクが表示されない (書き出しではかかる)」** を追記
  - `#timeline-edit` の「継ぎ目」の行 (旧 529 行): 「トランジションのチップをドラッグして置くこともできます」→
    「効果」の「つなぎ」のチップをバッジへドラッグ / バッジでサイドバーの「つなぎ」
  - `#edit-sidebar` の「フェード」「トランジション」の行: クリップのフェード / 種類と長さの設定に合わせた。レールは 6 項目のまま
    (`#edit-overview` の「6 項目」も不変)
  - `#edit-overview` の「タイムライン」の行: ツールバー直下の「効果」のパレットに 1 文触れた
  - 冒頭の Liquid コメントに T-544 の経緯
  - ショートカット表は不変 (パレットのキーは `edit-shortcuts.ts` の割当ではない)
  - レビュー指摘 (MEDIUM: 書き直しで 768 → 805 行となり 800 行の上限を越えた) への対応: `#edit-transition` の「外す」の行を
    「種類と長さの変更」の行へ畳み (「なし」で外れます)、表の後ろの 1 文 (トランジションのある端にクリップのフェードは置けない)
    を節の冒頭の段落へ移し、Liquid コメントの T-544 の経緯を 4 行 → 3 行に詰めた。行の縞 (`kv-alt`) は交互のまま付け直し。
    **799 行** (内容と節 ID・テストの契約は不変)
- 画像 (`assets/img/screenshots/`、T-542 の撮影 desktop/screenshots の PNG 2026-09-25 07:02 から):
  `edit-fade.webp` / `edit-transition.webp` を差し替え、`edit-effects.webp` を新規 (#edit-fade に配置)。3 枚とも 1280×800 で
  `--fix-dims` の書き換えは無し。alt は実際の絵 (パレット・ランプ・帯、印のクリックで開いたタブと値) を説明する文に
- 新テスト `src/lib/docs-edit-effects.test.js` (21 件): 上の契約 (落とし先 3 種 / 印のクリック → サイドバー / 置けない所 /
  既定秒と範囲 / キーボード / 撤去済みのパネルのチップを書かない / 3 枚の参照・alt の語・実ファイルの寸法)
- `_data/docs_toc.yml` は不変 (ID もラベルも変えていない)。`docs-edit-timeline.test.js` (T-513) の節の順・語の検査も通る

## 追加・変更したコマンド

新規コマンドは無し。実行した手順:

```bash
cp ../desktop/screenshots/{edit-fade,edit-transition,edit-effects}.png assets/img/screenshots/
node scripts/optimize-images.mjs            # [DRY] 3 枚 / 保護 0 枚
node scripts/optimize-images.mjs --apply    # PNG 1079 KB → WebP 175 KB (元 PNG は削除)
node scripts/check-docs.mjs --fix-dims      # all <img> width/height already match
npm test && npm run build && bundle exec jekyll build --strict_front_matter && node scripts/check-docs.mjs
node --test src/lib/docs-edit-effects.test.js
```

ゲート (2026-09-25): `npm test` 307 件 (pass 306 / skip 1 = plan_catalog のライブ検査で既存) / `npm run build` 成功 /
`bundle exec jekyll build --strict_front_matter` 成功 / `node scripts/check-docs.mjs` OK (2 ページ、15 ファイルの深いリンク)。

## 陽性対照の記録

新テストを原稿を直す前 (HEAD 2d1f766 の 04-edit.html + 旧 2 枚、edit-effects.webp 無し) に実行: **21 件中 18 件 FAIL**
(PASS は読み取り部品の自己検査 1 件と、既存 2 枚の寸法一致 2 件だけ)。直した後は 21 / 21 PASS。

## 画像の記録

| 画像 | 元 PNG (sha256 先頭 16) | WebP (sha256 先頭 16 / バイト) | 旧 WebP |
|---|---|---|---|
| edit-fade | 350e1eea288188f3 | 0e57711e32538fa3 / 63746 | 3d18394f744a54cf / 55286 |
| edit-transition | 1e9fa8dc83ec1ec7 | 688979851b223058 / 57888 | 210b2b65f59a2405 / 57998 |
| edit-effects | 58894fb5ce1f98a6 | c1f0885a350ba3db / 57424 | (新規) |

WebP は復号して目視 (edit-effects): パレット 10 チップ・ルーラー両端のランプ・先頭クリップの左下のランプ・継ぎ目の帯が写る。
edit-fade = FadeTab (全体 1 / 1.5 秒、選択中のクリップ = 検出元の動画のフェードイン 1 秒、フェードアウトは次の継ぎ目の
トランジションで disabled + 理由)、edit-transition = TransitionTab (1 つ目の継ぎ目 ディゾルブ 0.5 秒 / 2 つ目 なし、
案内文に「効果」)。

## 注意点・既知の制約

- 公開は T-515 (リーダー) と一緒。このリポの push は即公開なので push していない。desktop 2.4.0 の配布前に公開すると、
  配布中の 2.3.7 には「効果」のパレットもクリップのフェードも無い (T-509 の先取り注記が 01-intro にある間はそれで説明される。
  T-515 が注記を外すのは 2.4.0 公開と同時)
- 「プレビューでは後ろのクリップの側にモザイクが表示されない」は desktop CLAUDE.md T-541 の既知の制約をそのまま書いた。
  製品側で直したら docs のこの 1 文とテストの「プレビュー」の行を見直す
- `index.html:339-340` (トップのタイムライン機能節「フェードとトランジション」) と `_includes/docs/web.html` は本チケットの範囲外で
  触っていない (index.html は T-515 が同じファイルを触るため)。クリップごとのフェードをトップにも書くなら別チケット
- 画像の中の動画 ID 表示は撮影ごとに変わる — 本文は ID に触れていない

## ロールバック

`_includes/docs/04-edit.html` と 2 枚の WebP を HEAD (2d1f766) に戻し、`assets/img/screenshots/edit-effects.webp` と
`src/lib/docs-edit-effects.test.js` を削除すればよい。寸法は不変。
