# T-515 desktop 2.4.0 のリリースに合わせて先取りの注記を外す (site 側)

親 CHANGELOG の T-515 (2026-09-23 節の予約) / T-549 / T-552。desktop 2.4.0 の公開 (T-549) の後に、リーダーが
T-544 (b00c79a) と一緒に push する。**このチケットは b00c79a の上に 1 コミットしただけで、push はしていない**
(このリポの push は即公開)。

## 変更点

- `_includes/docs/01-intro.html`: `#about` の冒頭の先取り注記 (`role="note"`「本ドキュメントは次回のデスクトップ更新
  (v2.4) の内容です。配布中の v2.3.7 では…」) と、それを説明する Liquid コメントを削除。`#about` は T-509 より前と同じく
  節見出しから始まる。冒頭のファイルコメントに撤去の経緯を 2 行
- `_includes/docs/07-team.html`: 断り書きの段落「組織の管理と組織コードでの参加は、次回のデスクトップ更新 (v2.4) から…
  （このページ冒頭の注記）」を削除。T-510 の Liquid コメントの版表記を「desktop 2.4.0」に、撤去の経緯を 2 行に
- `_includes/desktop-next-note.html`: **ファイルごと削除** (トップの機能節に添えていた「Desktop 版では次回の更新 (v2.4)
  から…」の部品、T-512)
- `index.html`: `desktop-next-note.html` の呼び出し 2 箇所 (TIMELINE / MANAGE の節末) を削除、TIMELINE の Liquid
  コメントを更新。**フェードとトランジションのカードに 1 文追加**: 「どちらもタイムライン上部の「効果」のパレットから
  チップをドラッグして置け、フェードはクリップごとの先頭と末尾にもかけられます。」(語は docs 04-edit の `#edit-fade` /
  `#edit-transition` = T-544 と同じ「「効果」のパレット」「チップ」「ドラッグ」「クリップごと」)
- `_includes/docs/web.html`: `#timeline` の「画像クリップ」の行を書き換え。旧「画像を好きな長さのクリップとして
  タイムラインに置く機能（Desktop 版の次回の更新で追加）は、Web 版の書き出しには今後の更新で対応します。それまでは、
  画像の素材は透かしとしてお使いください」→ 新「同じ。画像の素材は好きな長さのクリップとしてタイムラインに置け、
  書き出しにもその長さのまま入ります。透過 PNG の透明な部分は、Web 版の書き出しでは黒になります」
  - **チケットの指示 (括弧書きの削除) より広げた点**: 括弧だけ消すと「Web 版の書き出しには今後の更新で対応します」
    が残るが、web の T-498 (画像クリップのエンコード) は 2026-09-24 に本番反映済み (web アプリ 9b0d2ffc) なので
    それも事実と違う。「同じ。」の行に改め、既知の差 (透過 PNG は web では黒地に α 合成、`app/docs/desktop-parity.md`
    の T-498 の項) を 1 文だけ残した。冒頭の Liquid コメントも「T-498 で対応済み」に
- 節 ID と `_data/docs_toc.yml` は不変

### テスト (反転 / 追加)

- `src/lib/docs-desktop-refresh.test.js`: 「#about の冒頭に先取り注記がある」「role="note" の囲み」の 2 件を
  「#about は節見出しから始まり、先取り注記 (role="note" / 見出し前の段落) が残っていない」と
  「docs の全章 (web.html を含む) の表示文字列に `次回のデスクトップ更新` / `配布中の v\d` / `Desktop 版では次回の更新` /
  `次回の更新で追加` / `このページ冒頭の注記` が無い」に反転。`stripComments` とその自己検査を追加
  (07-team の「次回更新日」= 請求の更新日は拾わない形にしてある)
- `src/lib/docs-team-org.test.js`: 「01-intro の先取り注記と同じ版で断ってある」を「07-team に `次回のデスクトップ更新` /
  `このページ冒頭の注記` / `配布中の v\d` が残っていない」に反転。`prereleaseVersions` を削除
- `src/lib/top-page-features.test.js`: 「機能節に desktop-next-note を添えてある」を
  「`_includes/desktop-next-note.html` が存在せず、index.html と読み込む部品のどれも include していない」と
  「index.html + 読み込む部品の表示文字列に先取りの断り書きが無い」に反転。新規「フェードとトランジションのカードが
  「効果」/ チップ / ドラッグ / クリップごと に触れている」(補助 `cardOf` + 自己検査)。`prereleaseVersions` を削除
- `src/lib/docs-web-refresh.test.js`: 「画像クリップは今後の対応だと断ってある (T-498 まで)」を
  「`同じ。` で始まり書き出しに触れ、`今後の更新` / `次回の更新` / `それまでは` が無い」に反転

## 陽性対照の記録

テストを先に書き換え、原稿を直す前のツリー (HEAD b00c79a のまま) で 4 ファイルを実行: **50 件中 7 件 FAIL** =
反転 / 追加した 7 件すべて。

| テスト | 修正前の失敗メッセージ |
|---|---|
| 01-intro の #about は節見出しから始まり… | `#about の見出しより前に段落が残っている (先取り注記の撤去漏れ)` |
| docs のどの章にも…断り書きが残っていない | `01-intro.html に先取りの断り書きが残っている: /次回のデスクトップ更新/ / /配布中の v\d/` |
| 組織の機能に「次回のデスクトップ更新から」の断り書きが… | `07-team に先取りの断り書きが残っている: 次回のデスクトップ更新 / このページ冒頭の注記` |
| 画像クリップは Web 版でも同じように書き出せる… | `Desktop 版と同じだと書かれていない: 画像を好きな長さの…（Desktop 版の次回の更新で追加）は…` |
| フェードとトランジションのカードは「効果」… | `触れていない語: 「効果」 / チップ / ドラッグ / クリップごと` |
| desktop-next-note の部品は無く… | `_includes/desktop-next-note.html が残っている` |
| トップ…の表示文字列に…断り書きが無い | `_includes/desktop-next-note.html: /次回の更新 \(v[\d.]+\)/ / …/配布中の v\d/ / …/Desktop 版では次回の更新/` |

原稿を直した後は 50 / 50 PASS。

## 残骸の検索

```bash
grep -rnE "v2\.3\.7|次回のデスクトップ更新|desktop-next-note|次回の更新で追加" . \
  --exclude-dir={node_modules,_site,.git,docs_draft} | grep -v "^./CHANGELOG.md"
```

残るのは `src/lib/*.test.js` の「無いこと」を確かめる検査の文字列と経緯のコメントだけ
(`src/lib/inquiry-validate.test.js` の `appVersion: '2.3.7'` は問い合わせ検証のフィクスチャで無関係)。
ビルド後の `_site/` (html / txt) には `次回のデスクトップ更新` / `次回の更新 (v` / `配布中の v2` / `次回の更新で追加` /
`今後の更新で対応` が 1 件も無いことも確認した。T-516 (お問い合わせ (一般) の項目削除、39cc74e) は origin/master に
入っている (公開済み)。

## 追加・変更したコマンド

新規コマンドは無し。ゲート:

```bash
npm test && npm run build && bundle exec jekyll build --strict_front_matter && node scripts/check-docs.mjs
```

2026-09-25: `npm test` 310 件 (pass 309 / skip 1 = plan_catalog のライブ検査で既存) / `npm run build` 成功 /
`jekyll build --strict_front_matter` 成功 / `check-docs` OK (2 ページ、15 ファイルの深いリンク)。

## 注意点・既知の制約

- **公開の順序**: desktop 2.4.0 が `/release-status` で front 2.4.0 になってから push すること。先に出すと、配布中の
  2.3.7 に無い機能 (タイムライン編集 / フォルダとタグ / 組織) を断り書きなしで案内することになる
- トップの TIMELINE の Liquid コメントは「操作の細部 (キー・メニュー名) は書かない」方針だが、「効果」のパレットの
  名前はチケットの指示で入れた (コメントに経緯を追記済み)
- web.html の「画像クリップ」は web の本番 (9b0d2ffc 以降) が前提。web を T-498 より前に戻すときはこの行も戻す

## ロールバック

原稿・部品の削除・テストの反転は 1 コミットにまとめてあるので、`git revert <T-515 の sha>` で注記と部品
(`_includes/desktop-next-note.html`) とテストが同時に戻る。push 前なら T-544 (b00c79a) を残したまま
このコミットだけを落とせる。公開後に desktop 2.4.0 を取り下げる場合も revert で同じ状態に戻る。
