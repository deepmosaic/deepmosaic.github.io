# T-1362 公式ドキュメント: 未使用フォルダの一括チェック / ProRes 422 (通常) + 既存のモザイク / 反転 / 業務用の書き出し形式 ([exp] 3 本)

`feat/T-1362` (base `origin/master`) に積むだけで、master には入れない (master への push = GitHub Pages の公開)。
公開は desktop / engine / web のリリースの指示を待つ。

## 変更点 (コミットごと)

1. `docs: T-1362 未使用フォルダの一括チェックの表記と ProRes 422 の説明` (通常)
   - `_includes/docs/03-detect.html` `#import`「ホーム画面のお知らせ」の未使用フォルダの `<li>`: 「一覧を見る」で開くと
     検出結果の無いフォルダにだけチェックが入っていること、「すべてにチェックを入れる」(検出結果のあるフォルダも含む) /
     「すべてのチェックを外す」、「削除」/「キャンセル」(desktop T-1304 / T-1292 の `OrphanFoldersNotice.svelte`)。
     選択モードの「すべて選択」(別機能) は変えていない。
   - `_includes/docs/05-export.html` `#edit-encode` の末尾に ProRes 422 と 422 HQ の違いの段落 (desktop / engine T-1368 の
     リリースノートの下書きから。版の数字は書かない)。`フォーマット` の行は変えていない (F54 の置き場)。
   - `src/lib/site-copy-t1362.test.js` (新規)、このメモ。
2. `docs: T-1362 [exp:f16] 検出オプションの「既存のモザイク」とラベル「既存モザイク」`
   - 03-detect `#detect-options`: `検出対象` の行に 4 つ目「既存のモザイク」(初期値 OFF)、`kv` の末尾に行「既存のモザイク」。
   - 04-edit: `#edit-player` の色の段落に「既存モザイク（紫…）」、`#edit-toolbar` の `ラベル（C）` の行に上段 / 下段の「既存モザイク」。
   - web.html `#diff` の `検出` の行に「既存のモザイク」。
   - `src/lib/site-copy-t1362-f16.test.js` (新規)。
3. `docs: T-1362 [exp:f41] モザイク設定の「反転 (外側にかける)」と Premiere Pro 連携の制限`
   - 04-edit `#edit-mosaic` の `kv` の末尾に行「反転 (外側にかける)」。
   - 05-export `#premiere`「送信と結果」の `<ul>` の後ろに、反転のあるプロジェクトは送信しない段落 (desktop `premiere/invert_guard.rs` の文)。
   - web.html `#diff` の `編集ページ` の行に「（ID 別の反転を含む）」。
   - `src/lib/site-copy-t1362-f41.test.js` (新規)。
4. `docs: T-1362 [exp:f54] 業務用の書き出し形式とタイムコードの記録`
   - 05-export `#edit-encode`: `フォーマット` / `解像度` / `ビットレート` の行の末尾、`kv` の末尾に行「タイムコードの記録」、
     ProRes の段落の後ろに業務用の形式の制約の段落。
   - web.html `#diff` の `書き出し形式` / `タイムコード` の行 (Desktop 版のみ)。
   - `_data/spec.yml` の `書き出し` の末尾に「/ MOV (DV / DNxHR / CineForm)」。
   - `src/lib/site-copy-t1362-f54.test.js` (新規)。

## 追加・変更したコマンド

- なし。テスト 4 本は `npm test` (`node --test`) に自動で含まれる。
- 反復中: `node --test src/lib/site-copy-t1362*.test.js src/lib/docs-*.test.js`

## 実験の 3 本の外し方

```bash
git log -i --grep='\[exp:f16\]' --format=%H origin/master..HEAD | xargs -r git revert --no-edit
git log -i --grep='\[exp:f41\]' --format=%H origin/master..HEAD | xargs -r git revert --no-edit
git log -i --grep='\[exp:f54\]' --format=%H origin/master..HEAD | xargs -r git revert --no-edit
```

- どれか 1 本だけを外しても他の 2 本と衝突しない置き場にしてある (同じ行・隣の行を 2 本で触らない。web.html の
  `#diff` は `検出` / `編集ページ` / `書き出し形式`・`タイムコード` の行で、間に 3 行以上ある)。
- 確かめ方 (再実行できる手順):

```bash
cd D:/deepmosaic-wt/T-1362/deepmosaic.github.io
for f in f16 f41 f54; do
  git switch -q -c tmp/revert-$f feat/T-1362
  git log -i --grep="\[exp:$f\]" --format=%H origin/master..HEAD | xargs -r git revert --no-edit || { echo "衝突: $f"; git revert --abort; }
  npm test >/dev/null && echo "OK: $f を外して npm test が通る"
  git switch -q feat/T-1362 && git branch -D tmp/revert-$f
done
git switch -q -c tmp/revert-all feat/T-1362
git log -i -E --grep='\[exp:f(16|41|54)\]' --format=%H origin/master..HEAD | xargs -r git revert --no-edit
git diff --stat "$(git log -1 --format=%H --grep='^docs: T-1362 未使用' feat/T-1362)" HEAD   # 空であること
git switch -q feat/T-1362 && git branch -D tmp/revert-all
```

## master に入れるとき (リーダー、リリースの指示の後)

1. 公開する desktop / engine / web の版が出た後に、`feat/T-1362` を最新の `origin/master` に rebase する。
2. リリースに含めない機能のコミットは上の `git revert` (または rebase で drop) で外してから入れる
   (リリースしない機能を master に入れない = site `CLAUDE.md`「未実装・無効の機能は書かない」)。
3. 1 本目 (一括チェック・ProRes) は、T-1304 (desktop) と T-1368 (desktop + sidecar) の両方が公開された後に入れる。
4. スクリーンショットの撮り直しは公開の判断のときに別に行う (このチケットでは画像を足していない)。

## 注意点・既知の制約

- 画像・新しい `<section id>`・目次の変更は無い。新しい `kv-row` は各 `kv` の末尾で、`kv-alt` は直前の行と交互。
- 公開面に固有名詞 (guard_tokens / SAM / YOLO / モデル名 / 形式の持ち主の社名) と「実験」「フラグ」「開発ビルド」、
  版の数字は足していない。F16 の文に「除去」「解除」「取り除」「復元」は無い。各テストの陽性対照で検査の空振りを防いでいる。
- アプリのツールチップの「実験中の機能」は写していない。
- web.html の `検出` の行の「WebGPU の shader-f16」は既存の文で、触っていない (F16 のテストもこの行の固有名詞は見ない)。

## spec との違い

- アプリの文言 (統合 worktree `integrate/req1018b` の desktop / web) は spec §3 のとおりで、食い違いは無かった。
- 未使用フォルダの `<li>` に「（検出結果のあるフォルダは、登録が失われた完了済みのプロジェクトのことがあるので、必要なものだけ自分で選んでください）」と
  「（「キャンセル」では何も削除しません）」を足した (spec §3.1 (a) の箇条の内容。例文には無かった)。
- F54 の制約の段落では DNxHR の 3 形式をまとめて「「MOV (DNxHR …)」」と書いた。
- F54 の制約の段落に、spec §3.4 に無い CineForm の高さの下限「高さが 32 以上」を足した (desktop `encode/pro_export.rs` の
  `CINEFORM_MIN_HEIGHT` と `err_cineform_height`。レビューの指摘)。
- Implementer はコミットしていない (workflow の指示)。4 本への分け方は上の「変更点」のとおりで、hunk の分け方は
  リーダー / FixCommit が `git add -p` で行う (同じファイルの中でも各コミットの hunk は 3 行以上離れている)。

## ロールバック

- 実験の 3 本は上の手順で個別に revert。1 本目も `git revert` 1 回で戻る (03-detect の `<li>` 1 行、05-export の段落 1 つ、テスト、このメモ)。
