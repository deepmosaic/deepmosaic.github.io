# T-496 — docs 用スクリーンショットの全量撮り直しと webp 化

## 変更点

- **`assets/img/screenshots/`**: 既存 38 枚をすべて撮り直しで差し替え、T-513 が参照する新規 8 枚を追加 (計 46 枚)。
  - 新規 8 枚: `edit-sidebar-media` / `edit-timeline-clips` / `edit-timeline-menu` / `edit-text` / `edit-watermark` /
    `edit-audio` / `edit-fade` / `edit-transition` (.webp)。これで `check-docs` の「画像ファイルが無い」8 件が解消。
  - 撮影は desktop HEAD 4b9d36c (T-495 のハーネス) + 撮影ハーネスの修正 (desktop の T-496 のコミット、下記「注意点」) で、
    既定素材 `tutorial.mp4` (非露骨の街頭映像) と `--with-encode`。
  - 撮影 49 枚のうちサイトが使わない 3 枚 (`home-sidebar` / `home-outside` / `edit-history-menu`) は入れていない
    (参照の無い画像を公開しない)。`edit-light.webp` は本文から参照されていないが既存ファイルなので同名で差し替えた。
  - 合計 1.6MB (PNG 11.4MB → WebP 1.6MB、quality 82)。
  - 編集ページの絵はタイムラインの高さを中身に合わせて撮った (desktop の修正 2.)。edit-overview / edit-player /
    edit-player-mosaic (hero) にクラスの行 (女性顔と区間の帯) が、edit-timeline にクラスの行を展開した ID の行が写り、
    alt・figcaption の説明と一致する。
- **`_includes/docs/04-edit.html` / `05-export.html`**: `check-docs --fix-dims` による `<img>` の width / height の実寸同期 7 箇所
  (edit-player 1256×898 → 1188×987、edit-hud-off / edit-context-menu / edit-zoom 1246×534 → 1188×410、
  edit-timeline 1256×183 → 1188×305、edit-toolbar 711×42 → 723×43、encode-progress 1080×870 → 720×580)。
  T-304 の左サイドバーでプレイヤーの幅が縮み、タイムラインを中身の高さにしたぶんプレイヤーの高さも変わった。
  新規 8 枚は T-513 の仮寸法 1280×800 が実寸と一致していたので書き換えなし。
- **`index.html`**: hero (`edit-player-mosaic.webp`) の width / height を 1256×898 → 1188×987 に手で同期
  (`--fix-dims` は `_includes/docs/*.html` しか書き換えない)。他の 3 枚 (edit-overview / edit-mosaic / home) は 1280×800 のまま一致。
  全 HTML の `<img src="/assets/img/screenshots/…">` 48 箇所で属性の寸法と WebP の実寸が一致することを別途確認した。

## 追加・変更したコマンド

新規コマンドは無し。実行した手順:

```bash
# desktop (アプリが起動していないことを tasklist で確認してから。--kill-existing は使っていない)
node scripts/e2e/screenshots.mjs --with-encode --timeout-scale 2 --out <scratchpad>/t496-shots5
#   → exit 0 / 撮影 49 枚 / MISS 0 / SKIP = edit-sam (機能フラグ OFF) ・dashboard (管理者のみ) ・team-window (組織アカウントのみ)
#   → ~/.deepmosaic は撮影前と一致 (config.json の sha256 / project_folder / LKG / restore-pending)

# site: サイトが持つ名前 (既存 38 + 参照 8) の PNG だけを作業フォルダの assets/img/screenshots/ に置き、
#       その作業フォルダを cwd にして本リポの optimize-images.mjs --apply を実行 → できた .webp をここへコピー
node scripts/check-docs.mjs --fix-dims
npm test && npm run build && bundle exec jekyll build --strict_front_matter && node scripts/check-docs.mjs
```

ゲートの実走結果 (2026-09-23): `npm test` 263 件 (pass 262 / skip 1 = plan_catalog のライブ検査で既存) / `npm run build` 成功 /
`bundle exec jekyll build --strict_front_matter` 成功 / `node scripts/check-docs.mjs` OK (2 ページ、15 ファイルの深いリンク)。

## 注意点・既知の制約

- **`optimize-images.mjs --apply` をリポのルートで実行しないこと (今回は作業フォルダで実行した)。** 対象に `assets/img/` 直下も
  入っており、今は PNG が 13 枚ある (うち `logo-font.png` は `_includes/schema/organization.html` の JSON-LD が参照)。
  ルートで `--apply` すると無関係の 13 枚が WebP 化されて元 PNG が消え、JSON-LD のロゴが 404 になる。
  スクリプトの対象を `--dir` 等で絞る修正は別チケットで (本チケットは画像と寸法だけ)。
- 撮影ハーネスの修正 (desktop、T-496 のコミット): 旧ハーネスのままだと 6 枚が MISS (exit 1) で、MISS を直した後も
  編集ページの絵にクラスの行が写らなかった。
  1. 「開始」の後の一括実行モーダルの待ちの間に 10 秒素材の DETECT 段が終わり detect / queue / detect-cancel を撮り逃す
     → /detection へ遷移した時点で待ちを打ち切る
  2. T-248 の Tooltip 化で native `title` が外れ、「エンコード」ボタンと bbox / モザイクの切替ボタンが見つからない
     → edit-encode / encode-timecode / edit-player-mosaic (= トップの hero) が撮れない
  3. 撮影機の `dm-timeline-h` (下限 220) のまま撮ると、T-489〜T-493 で増えたレーンの下にクラスの行が隠れる
     → 撮る間だけタイムラインの高さを中身に合わせる。edit-timeline はクラスの行の展開が効いていなかった (男性顔 / 女性顔の
       行は開く前に aria-expanded が付かない) のも直した
  詳細は desktop の `docs_draft/notes_T-496.md`。
- **写り込む製品側の問題 (撮り直しが要る)**:
  - `edit-audio.webp` の音声レーンの帯に**波形が出ていない** (desktop の CSP が素材の fetch を拒否する既存不具合、T-519)。
    04-edit.html の alt「音声レーンの帯に波形が描かれている状態」と figcaption「音声パネルと音声レーンの波形」は画像と
    食い違っている。本チケットでは本文を変えていない (T-513 の記述で、波形は製品の仕様どおり)。T-519 の後に
    `--only=edit-audio` で撮り直すか、公開 (T-514) までに alt を直すかはリーダー判断。
  - ドロワーを開いた 6 枚 (edit-sidebar-media / edit-text / edit-watermark / edit-audio / edit-fade / edit-transition) は
    プレイヤーの操作列が重なって写る (T-520)。T-520 の後に撮り直すのが望ましい。
- 撮影時のアカウントは Free (組織未所属・管理者でない) のため team-window / dashboard は撮れない (サイトは参照していない)。
  07-team の team-window はコメントのプレースホルダのまま。
- 画面下部のステータスバーに撮影機の GPU 名 (RTX 3070 Ti) と「残りの検出可能時間」「71% 使用済み」、demo フォルダのパス
  (`C:\Users\core\deepmosaic\demo`) が写る (従来の撮影と同じ)。メールアドレスはハーネスが `user@example…` に伏せている。
- 本チケットはコミットまで (公開 = push は T-514 のリーダー作業)。

## ロールバック

`git checkout <T-496 の前のコミット> -- assets/img/screenshots _includes/docs/04-edit.html _includes/docs/05-export.html index.html`
と新規 8 枚の削除。ただし新規 8 枚を消すと T-513 の本文の画像が再び無くなり `check-docs` が落ちる。
