# T-1625 メモ: docs に「モザイク」(すでにかかっているモザイク) の手順・Desktop / Web の差・制約・所要・結果の見方を書く

## 変更点
- `_includes/docs/03-detect.html`
  - `#detect-options`: 「検出対象」の行に Desktop 版の排他 (局部・顔のチェックとモザイクの初期設定が無効、画面の注記の文) と Web 版は併用できること (`/docs/web/#diff`) を追記。「所要時間の目安」の行に「(モザイクの走査 / 目安 N fps)」を追記。「モザイク」の定義の行 (kv の最後の行のまま) の文末から `#detect-mosaic` へ送る。
  - 新しい節 `#detect-mosaic`「すでにかかっているモザイクを見つけて、かけ直す」(`#detect-options` の直後)。小見出しは 手順 / 結果の見方 / 制約 / 所要の目安。「取り除く機能ではありません。元の映像に戻すことはできません」を 1 文入れた。
  - `#detect`: 進捗の段に「既存のモザイクを検出」(画面に出る段名の引用) が加わることを本文と figcaption に追記。「対応する検出対象を見る」の「3 種類」を「3 種類と「モザイク」」に。
- `_data/docs_toc.yml`: desktop の「読み込みと検出」に `detect-mosaic` を追加 (既存 ID は不変)。
- `_includes/docs/04-edit.html`: `#edit-player` に多角形 (最大 255 点) の点を動かして直せる旨の段落、`#edit-mosaic` のクラス別タブに「モザイク」も出る旨。
- `_includes/docs/web.html` `#diff` の「検出」の行: 「同じ」→「ほぼ同じ」。Web 版は併用、Desktop 版は排他と書いた。
- `_includes/docs/01-intro.html` の作業の流れ: 対象に「すでにかかっているモザイク」を追加 (チュートリアル動画の節は T-1624 の担当なので触っていない)。
- `_includes/docs/06-ops.html` `#trouble` の「読み込みと検出」: 「すでにかかっているモザイクが見つからない場合」を追加。
- `src/lib/site-copy-t1362-f16.test.js`: web の検出の行の assert を「ほぼ同じ」+ 併用 / 排他の文に更新。`#detect-mosaic` の存在 (本文・目次・順序)、小見出し 4 つ、必須語、制約・所要の語、否定文の「取り除」だけを許す語彙ポリシー、旧名 (段名の引用は例外)、固有名詞・内部の語の検査、検出オプションからのリンクと排他の注記の検査を追加。

## 追加・変更したコマンド
なし (`npm test` / `npm run build` / `bundle exec jekyll build --strict_front_matter` / `node scripts/check-docs.mjs`)。

## 注意点・既知の制約
- 節見出しの kicker は spec の例「DETECT MOSAIC」ではなく、同じ章の他の節に揃えて「読み込みと検出」にした (spec は「程度」)。
- 進捗の段名「既存のモザイクを検出」は画面に出る語の引用として残した (engine の段名と揃っていて今回は変えない決定)。アプリ側で改名したら docs とテストの `STEP_NAME_QUOTE` も直す。
- 「同じモザイクが別の ID に割れたら ID を統合…」は既存の編集機能 (web.html の差分表にもある) を案内しただけ。
- Web 版の CPU 経路での取りこぼしの程度 (推測) は書いていない。

## ロールバック
このチケットのコミットを revert する。節 ID `detect-mosaic` は新規追加なので、外すときは目次とテストも同じコミットで戻る。
