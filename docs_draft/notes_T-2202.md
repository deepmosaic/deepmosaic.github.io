# T-2202 (i18n1112 I18N-704) サイトのデータの訳 2: 動作環境・送信の開示・モザイクの設定・製品の説明

## 変更点の要約
- 新規 8 ファイル: `_data/l10n/{en,zh-tw}/{spec,disclosure,mosaic,entity}.yml` (英語と繁体字中国語 (台湾) の文だけ)。
  ja のデータ (`_data/spec.yml`・`disclosure.yml`・`mosaic.yml`・`entity.yml`) は変えていない。include・ページも変えていない。
- 新規テスト: `src/lib/i18n-site-data-entity.test.js` (31 件)。
- 各ファイルは先頭に `_source` / `_source_hash` を持つ (`node scripts/i18n/accept-site.mjs <file>` で書いた)。

## 欄の一覧 (I18N-707・709〜711 が読む)
Liquid では `site.data.l10n[page.lang].<name>.<欄>` (ja のページでは nil なので `| default:` で元の値)。

### spec.yml (ja と同じ入れ子・同じ件数・同じ順)
| 欄 | 形 | 備考 |
|---|---|---|
| `windows` | `[{key, val}]` 5 件 | `OS`・`GPU` の key は日本語を含まないのでそのまま写した。val の `<br>` はそのまま |
| `macos.status` / `macos.note` | 文字列 | |
| `macos.planned` | `[{key, val}]` 3 件 | |
| `performance_note` | 文字列 | |
| `performance` | `[{key, val}]` 28 件 | **key の GPU の機種名は訳さずに写す** (26 件)。訳したのは日本語を含む 2 件 (GTX 10 / 16 シリーズ・GPU なし) だけ |
| `performance_footnote` | 文字列 | |
| `network` | `[{key, val}]` 3 件 | |
| `formats` | `[{key, val}]` 2 件 | val (形式の一覧) は日本語を含まないのでそのまま写した |

- **I18N-711 への申し送り**: 英中の `/spec/` は `{% include kv-table.html rows=site.data.l10n[page.lang].spec.windows %}` のように
  `kv-table.html rows=site.data.l10n[<lang>].spec.<欄>` で ja と同じ描き方になる (`windows`・`macos.planned`・`performance`・`network`・`formats`)。
  機種名・数値・並びは ja と同じ (テストで固定)。
- `_includes/docs/01-intro.html` の `where: "key", "ストレージ"` は docs (対象外) なので英中の値は関係しない。英中のページで同じ引き方をするなら
  ja のデータで引くこと (英中の key は `Storage` / `儲存空間`)。

### disclosure.yml
| 欄 | 形 |
|---|---|
| `network.sent` | `[{item, note?}]` 8 件 (note の有無は ja と同じ: 5〜8 件目だけ持つ) |
| `network.not_sent` | `[{item, note?}]` 5 件 (4 件目だけ note) |
| `offline_steps` | 文字列の配列 3 件 |
| `weaknesses` | `[{key, val}]` 5 件 (kv-table.html の形) |
| `responsibility`・`accuracy_note` | 文字列 |

### mosaic.yml
| 欄 | 形 |
|---|---|
| `scopes` | `[{key, val}]` 4 件 |
| `priority_note` | 文字列 (`&gt;` の実体参照 3 個はそのまま。`{{ }}` でそのまま出せば ja と同じく `>` に描かれる) |
| `controls` | `[{key, val}]` 7 件 (1 件目の val の `<strong>` 3 組はそのまま) |
| `note` | 文字列 |

### entity.yml (原文は各欄の `ja`、素の文字列の欄はその値)
| 欄 | 形 | 除去の語 |
|---|---|---|
| `one_liner` | 文字列 | 使わない |
| `not_removal_note` | 文字列 | **使わない** (下の §判断) |
| `definition` | 文字列 | 使わない |
| `disambiguation` | 文字列 | 使う (`remove` / `移除`) |
| `can` | 文字列の配列 8 件 | 使わない |
| `cannot` | 文字列の配列 4 件 | 使う (`Removing mosaic` / `去除馬賽克`) |
| `name_origin` | 文字列 | 使わない |
| `oss_distinction` | 文字列 | 使う (`removing mosaic` / `去除馬賽克`) |
| `confusion_reasons` | 文字列の配列 2 件 | en の 2 件目だけ使う (`removing mosaic`) |
| `software_requirements` | 文字列 | (JSON-LD) |
| `keywords` | 文字列 (`, ` 区切り) | (JSON-LD) |

- 持たない欄: `name`・`product_name`・`alternate_names`・`os`・`category`・`subcategory`・`screenshot` (訳さない値。ja のデータを使う)。
- ja の entity.yml では `definition` などが `{ja, en}` の対だが、l10n では**文字列 1 本** (`site.data.l10n[page.lang].entity.definition`)。
  `can` / `cannot` も文字列の配列 (ja は `[{ja, en}]`)。I18N-707 (what-is・can-cannot・cta-download) と I18N-711 (mosaic-removal)・
  JSON-LD の担当は、英中では `E.can[i].ja` の代わりに `L10N.entity.can[i]` を引くこと。

## 判断と仮定
1. **`not_removal_note` に除去の語を使わなかった**: en `It has no feature for taking off mosaic that has already been applied.`、
   zh-tw `不具備去掉既有馬賽克的功能。` (ja の「取り除く」= 本文用の言い換えに合わせた)。したがって **I18N-707 が `data-i18n-allow="mosaic_removal"`
   で包む必要は無い** (包んでも害は無い)。テストは not_removal_note を除去の語を許さない欄として検査する。
2. **設計書 §10.2「entity.yml の既存の en の対は en ではそれを使う」から変えた** (spec と W7-site.md §6 の決定に従った): 既存の `en` の値は
   `genitalia`・`censoring`・`decensor`・`pixelation` など用語集の禁止語・その活用形を含み、ja のページの JSON-LD と llms.txt の材料として ja 側に
   残す (変えていない)。英中の画面と英中の JSON-LD の文は、このチケットが用語集どおりに新しく訳した。can[5] (書き出し) だけは既存の en と
   同じ文になった (禁止語を含まないので問題ない。テストは「禁止語を含む既存の en を写していない」を検査する)。
3. **`lintValue` の禁止語は単語の境界で当てるため `genitalia`・`censoring`・`pixelation` を拾わない** (`genital`・`censor`・`pixelate` の
   活用形が漏れる)。このテストでは語幹で当てる `BODY_WORDS_RE` を足して全欄で検査した。`site-lint.mjs` (I18N-702 の持ち物) は直していない。
   **W8 (I-86) で用語集の forbidden.en に活用形 (`genitalia`・`censoring`・`pixelation`・`decensoring`) を足すか、語幹の当て方にする候補**。
4. **zh-tw の「・推估」「・實測」を「，推估」「，實測」にした**: spec の例は `…・推估` だが、`・` (U+30FB、カタカナの中黒) は lang-text の仮名の範囲
   (U+3040–U+30FF) に当たる。台湾の書き方として読点で区切った。en は spec どおり `, estimated` / `, measured`。
5. **数字の検査**: `performance` の val は数字の多重集合を ja の同じ行と比べた (en は語順で `6 min for a 10-min video` と並びが入れ替わるので、
   並びではなく多重集合)。加えて、レビューの指摘で (倍率, 10 分の動画での分) の組を書式から抜いて ja の同じ行と 1 対 1 で比べる
   検査を足した (分と動画の長さの入れ替えを捕まえる。ja の分 = 倍率 × 10 も確かめる。組を持たないのは「10〜25 倍」の 1 行だけ)。他の文は数字の集合 (`2026-10〜11` → en `2026-10 to 2026-11` で 2026 が 2 回出るため)。
6. **en の `formats` の key**: 当初 `Import` にしたが、レビューの指摘 (COMMON §4 の「用語集の訳語を変えない」・en の offline_steps の `Load a video`
   とそろわない) で用語集どおり `Load` / `Export` の対に直した。zh-tw は用語集どおり `載入` / `匯出`。
7. **cannot[3]「審査・検閲基準」**: `censorship` は禁止語なので en は `review or screening standards`、zh-tw は `審核或審查標準`。
8. **confusion_reasons の 2 件目**は日本語の語についての説明として訳した (en `In Japanese, the term for "mosaic processing" can mean either adding
   or removing mosaic.`、zh-tw `在日文中，「馬賽克處理」一詞同時可指「加上」與「拿掉」馬賽克兩個方向。`)。英中の文に日本語の字は入れていない。
9. 末尾の句点: ja の表のセルは句点なしが多いが、en・zh-tw は完全な文を句点で終える規則 (設計書 §12.3) に従った。名詞句・断片
   (`About 0.6× …, estimated`、`Accuracy decreases`、can / cannot の項目) には付けていない。
10. **アプリの画面の名前** (アプリの辞書にまだ英中の文が無いので自分で訳した。**W8 でアプリの辞書と突き合わせること**):
    | ja (アプリの語) | en | zh-tw | 出る所 |
    |---|---|---|---|
    | 確認が必要な箇所 | Areas to review | 需要確認的部分 | spec.performance_footnote |
    | ピクセルサイズを設定 (画面) | Set pixel size | 設定像素大小 | mosaic.controls[0] |
    | ピクセルサイズ自動 | Auto pixel size | 自動像素大小 | mosaic.controls[0] |
    | 固定 | Fixed | 固定 | mosaic.controls[0] |
    | 最も粗い粒 | Coarsest blocks | 最粗的格 | mosaic.controls[2] |
    | 全て / クラス別 / ID別 / シーン別 | All / By class / By ID / By scene | 全部 / 依類別 / 依 ID / 依場景 | mosaic.scopes・priority_note |
    | 大きさの範囲ごと / 分割数で比例 | By size range / Proportional to divisions | 依大小範圍 / 依分割數等比 | mosaic.controls |
    | 信頼度しきい値 | Confidence threshold | 信賴度門檻 | mosaic.controls |
    | シャープカラー | Sharp colors | 銳利色彩 | mosaic.controls |

## 用語集の追加の候補 (W8 の I-86 へ)
| ja | en | zh-tw | 備考 |
|---|---|---|---|
| (モザイクの) 精緻化 | mosaic refinement | 馬賽克精細化 | I18N-703 の faq と同じ訳にそろえた |
| ふちのなじませ | edge feather | 邊緣羽化 | 用語集の「エッジぼかし」と同じ設定。サイトの mosaic.yml は key がエッジぼかし・val がふちのなじませ |
| 拡張率 (bbox) | expansion ratio | 擴展率 | |
| 端末識別子 | device identifier | 裝置識別碼 | |
| ハッシュ値 | hash value | 雜湊值 | |
| 信頼度 | confidence | 信賴度 | |
| 粒度 | block size | 馬賽克格的大小 | 用語集の「粒」= block / 馬賽克格 から |
| 実測 / 推定 | measured / estimated | 實測 / 推估 | 動作環境の表 |
| 動作記録 | operation records | 運作記錄 | |
| 焼き込み | burn in / burned-in | 燒錄 | 703 の faq と同じ |
| 連携 (Premiere Pro) | integration | 整合 | |
| ライセンス認証トークン | license authentication token | 授權驗證權杖 | |
| 遮蔽 | occlusion | 遮蔽 | |

## 追加したテスト・コマンド
- `node --test src/lib/i18n-site-data-entity.test.js` (31 件): 構造 (葉のパスが ja と同じ)・件数・機種名の写し・数字・タグと実体参照・
  「実測 / 推定」・entity の欄・既存の en を写していない・lintValue と除去の語 (許すのは 4 欄だけ)・身体 / 検閲の語・誤認の訂正 (付ける側の語)・
  `_source_hash`・住所と SAM。
- 自分で壊して捕まえることを確かめた (機種名を書き換える・分を変える・not_removal_note に `remove mosaic` を入れる・`&gt;` を `>` にする → 6 件失敗)。

## ゲートの結果 (Implementer の時点)
- `node --test src/lib/i18n-site-data-entity.test.js`: 31 / 31 合格。
- 全ゲート: `npm test` 833 件中 831 合格・失敗 0 / `npm run build` / `bundle exec jekyll build --strict_front_matter` / `check-docs` OK /
  `ja-identity` OK (17 files) / `check-site` OK (2 モジュール)。
- `git diff --stat` と `--ignore-cr-at-eol` は一致 (追跡中のファイルの変更なし、新規 10 ファイルだけ)。新規ファイルは作業ツリーでは CRLF だが、
  core.autocrlf=true により index には LF で入る (git hash-object で確認済み)。

## ウェーブ末尾の E2E で確かめること
- このチケットは画面に出していない (データだけ)。I18N-707・709〜711 が描いた後に、英中の `/spec/` の GPU の表 (機種名が ja と同じ・28 行)、
  トップの MOSAIC / PRIVACY / DISCLOSURE の表、`/mosaic-removal/` と can-cannot の表を目で見ること。

## sync
- 共有ファイル (web / desktop) は触っていない。

## ロールバックの観点
- 新規ファイルだけなので revert で消えるだけ。ただし I18N-707・709〜711 がこの欄を引いていると、英中のページで `| default:` の ja の値が出る
  (英中の画面に日本語が出て lang-text の検査が落ちる)。それらのチケットより先に revert しない。

## 直したいが直さなかった ja の文
- `_data/mosaic.yml` の controls[4]: key は「エッジぼかし」、val は「ふちのなじませ」と、同じ設定を 2 つの語で書いている。
- `_data/entity.yml` の冒頭のコメント「英語ページ (/en/) は作らない」は i18n1112 で古くなった (コメントなので表示は変わらない)。

## 対訳表 (日本語を含む ja の値だけ。機種名・形式の一覧などの写しは除く)

#### spec.yml

| 欄 | ja | en | zh-tw |
|---|---|---|---|
| windows.0.val | Microsoft Windows 10 / 11（64 ビット） | Microsoft Windows 10 / 11 (64-bit) | Microsoft Windows 10 / 11（64 位元） |
| windows.1.key | メモリ | Memory | 記憶體 |
| windows.1.val | 8GB 以上（16GB 推奨） | 8 GB or more (16 GB recommended) | 8 GB 以上（建議 16 GB） |
| windows.2.val | NVIDIA GeForce RTX 3000 シリーズ以上 (CUDA 対応) + 最新ドライバ<br>RTX 3000 シリーズ未満の GPU は動作未確認です。GPU が無い場合も CPU モードで動作しますが、処理速度は大幅に低下します | NVIDIA GeForce RTX 3000 series or higher (CUDA-capable) + latest driver<br>Operation has not been verified on GPUs below the RTX 3000 series. Without a GPU, the app still runs in CPU mode, but processing is much slower. | NVIDIA GeForce RTX 3000 系列以上（支援 CUDA）+ 最新驅動程式<br>低於 RTX 3000 系列的 GPU 尚未確認能否運作。沒有 GPU 時也能以 CPU 模式運作，但處理速度會大幅下降。 |
| windows.3.key | ドライバ | Driver | 驅動程式 |
| windows.3.val | NVENC ハードウェアエンコードを使う場合は 570 以上 | Version 570 or later to use NVENC hardware encoding | 使用 NVENC 硬體編碼時，需要 570 以上的版本 |
| windows.4.key | ストレージ | Storage | 儲存空間 |
| windows.4.val | 初回セットアップで AI モデル等に 10GB程度 | About 10 GB for AI models and other data during initial setup | 初始設定時，AI 模型等資料約需 10 GB |
| macos.status | 開発中 | In development | 開發中 |
| macos.note | macOS 版は開発中です。提供時期は未定で、先行案内も現時点ではお受けしていません。Windows 版のみのご提供となります。 | The macOS version is in development. Its release date has not been decided, and we are not accepting requests for advance notice at this time. Only the Windows version is available. | macOS 版正在開發中。推出時間未定，目前也不受理搶先通知的登記。目前僅提供 Windows 版。 |
| macos.planned.0.key | 対応予定 OS | Planned OS | 預計支援的作業系統 |
| macos.planned.0.val | macOS 13 (Ventura) 以降 | macOS 13 (Ventura) or later | macOS 13（Ventura）以上版本 |
| macos.planned.1.key | 対応予定 CPU | Planned CPU | 預計支援的 CPU |
| macos.planned.1.val | Apple Silicon (M1 以降)。Intel Mac は対象外の見込み | Apple Silicon (M1 or later). Intel Macs are not expected to be supported | Apple Silicon（M1 以上）。Intel Mac 預計不在支援範圍內 |
| macos.planned.2.key | Premiere Pro 連携 | Premiere Pro integration | Premiere Pro 整合 |
| macos.planned.2.val | 初回リリースでは Windows 版のみの機能になる見込みです | In the first release, this is expected to be a Windows-only feature. | 首次發行時，預計僅為 Windows 版的功能。 |
| performance_note | 下記は、1080p・30fps の動画を検出するのに「動画の長さの何倍の時間がかかるか」の目安です（検出の開始から完了まで。形に沿ったモザイクの精緻化を含み、書き出しは含みません）。「実測」は本番環境の 2026-10〜11 の中央値、「推定」は実測に合わせた計算式と各 GPU の公称性能から求めた値で、±30% 程度の幅があります。60fps の動画は最大で約 2 倍かかり、顔の数など素材の内容によっても変わります。また、GPU を使う場合も動画の読み込み・前処理・解析は CPU で行うため、処理時間は CPU の性能にも依存します（特に上位の GPU ほど CPU の影響が大きくなります）。 | The figures below are a guide to how many times the video length it takes to detect a 1080p, 30 fps video (from the start to the end of detection, including mosaic refinement that follows the shape of objects, excluding export). "Measured" values are medians from the production environment for 2026-10 to 2026-11, and "estimated" values are calculated from a formula fitted to the measured values and the rated performance of each GPU, with a margin of about ±30%. A 60 fps video can take up to about 2 times as long, and the time also varies with the content of the media, such as the number of faces. Even when a GPU is used, video loading, preprocessing, and analysis run on the CPU, so processing time also depends on CPU performance (the higher-end the GPU, the greater the effect of the CPU). | 以下為偵測 1080p、30 fps 的影片時，「所需時間約為影片長度幾倍」的參考值（從偵測開始到完成，包含沿著物體形狀的馬賽克精細化，不含匯出）。「實測」為正式環境 2026 年 10～11 月的中位數，「推估」為依據配合實測值所訂的計算公式與各 GPU 的標稱效能求得的值，約有 ±30% 的誤差。60 fps 的影片最多約需 2 倍的時間，也會因臉部數量等素材內容而不同。此外，即使使用 GPU，影片的載入、前處理與分析仍由 CPU 進行，因此處理時間也取決於 CPU 的效能（GPU 等級越高，CPU 的影響越大）。 |
| performance.0.val | 動画長の約 0.6 倍（10 分の動画で約 6 分）・推定 | About 0.6× the video length (about 6 min for a 10-min video), estimated | 約影片長度的 0.6 倍（10 分鐘的影片約 6 分鐘），推估 |
| performance.1.val | 動画長の約 1.0 倍（10 分の動画で約 10 分）・推定 | About 1.0× the video length (about 10 min for a 10-min video), estimated | 約影片長度的 1.0 倍（10 分鐘的影片約 10 分鐘），推估 |
| performance.2.val | 動画長の約 1.1 倍（10 分の動画で約 11 分）・実測 | About 1.1× the video length (about 11 min for a 10-min video), measured | 約影片長度的 1.1 倍（10 分鐘的影片約 11 分鐘），實測 |
| performance.3.val | 動画長の約 1.5 倍（10 分の動画で約 15 分）・推定 | About 1.5× the video length (about 15 min for a 10-min video), estimated | 約影片長度的 1.5 倍（10 分鐘的影片約 15 分鐘），推估 |
| performance.4.val | 動画長の約 1.9 倍（10 分の動画で約 19 分）・推定 | About 1.9× the video length (about 19 min for a 10-min video), estimated | 約影片長度的 1.9 倍（10 分鐘的影片約 19 分鐘），推估 |
| performance.5.val | 動画長の約 2.1 倍（10 分の動画で約 21 分）・推定 | About 2.1× the video length (about 21 min for a 10-min video), estimated | 約影片長度的 2.1 倍（10 分鐘的影片約 21 分鐘），推估 |
| performance.6.val | 動画長の約 2.9 倍（10 分の動画で約 29 分）・推定 | About 2.9× the video length (about 29 min for a 10-min video), estimated | 約影片長度的 2.9 倍（10 分鐘的影片約 29 分鐘），推估 |
| performance.7.val | 動画長の約 0.8 倍（10 分の動画で約 8 分）・推定 | About 0.8× the video length (about 8 min for a 10-min video), estimated | 約影片長度的 0.8 倍（10 分鐘的影片約 8 分鐘），推估 |
| performance.8.val | 動画長の約 1.1 倍（10 分の動画で約 11 分）・推定 | About 1.1× the video length (about 11 min for a 10-min video), estimated | 約影片長度的 1.1 倍（10 分鐘的影片約 11 分鐘），推估 |
| performance.9.val | 動画長の約 1.2 倍（10 分の動画で約 12 分）・推定 | About 1.2× the video length (about 12 min for a 10-min video), estimated | 約影片長度的 1.2 倍（10 分鐘的影片約 12 分鐘），推估 |
| performance.10.val | 動画長の約 1.3 倍（10 分の動画で約 13 分）・推定 | About 1.3× the video length (about 13 min for a 10-min video), estimated | 約影片長度的 1.3 倍（10 分鐘的影片約 13 分鐘），推估 |
| performance.11.val | 動画長の約 1.3 倍（10 分の動画で約 13 分）・実測 | About 1.3× the video length (about 13 min for a 10-min video), measured | 約影片長度的 1.3 倍（10 分鐘的影片約 13 分鐘），實測 |
| performance.12.val | 動画長の約 1.6 倍（10 分の動画で約 16 分）・推定 | About 1.6× the video length (about 16 min for a 10-min video), estimated | 約影片長度的 1.6 倍（10 分鐘的影片約 16 分鐘），推估 |
| performance.13.val | 動画長の約 1.7 倍（10 分の動画で約 17 分）・推定 | About 1.7× the video length (about 17 min for a 10-min video), estimated | 約影片長度的 1.7 倍（10 分鐘的影片約 17 分鐘），推估 |
| performance.14.val | 動画長の約 2.4 倍（10 分の動画で約 24 分）・推定 | About 2.4× the video length (about 24 min for a 10-min video), estimated | 約影片長度的 2.4 倍（10 分鐘的影片約 24 分鐘），推估 |
| performance.15.val | 動画長の約 3.0 倍（10 分の動画で約 30 分）・推定 | About 3.0× the video length (about 30 min for a 10-min video), estimated | 約影片長度的 3.0 倍（10 分鐘的影片約 30 分鐘），推估 |
| performance.16.val | 動画長の約 1.2 倍（10 分の動画で約 12 分）・推定 | About 1.2× the video length (about 12 min for a 10-min video), estimated | 約影片長度的 1.2 倍（10 分鐘的影片約 12 分鐘），推估 |
| performance.17.val | 動画長の約 1.4 倍（10 分の動画で約 14 分）・推定 | About 1.4× the video length (about 14 min for a 10-min video), estimated | 約影片長度的 1.4 倍（10 分鐘的影片約 14 分鐘），推估 |
| performance.18.val | 動画長の約 2.1 倍（10 分の動画で約 21 分）・実測 | About 2.1× the video length (about 21 min for a 10-min video), measured | 約影片長度的 2.1 倍（10 分鐘的影片約 21 分鐘），實測 |
| performance.19.val | 動画長の約 2.1 倍（10 分の動画で約 21 分）・推定 | About 2.1× the video length (about 21 min for a 10-min video), estimated | 約影片長度的 2.1 倍（10 分鐘的影片約 21 分鐘），推估 |
| performance.20.val | 動画長の約 2.3 倍（10 分の動画で約 23 分）・推定 | About 2.3× the video length (about 23 min for a 10-min video), estimated | 約影片長度的 2.3 倍（10 分鐘的影片約 23 分鐘），推估 |
| performance.21.val | 動画長の約 2.8 倍（10 分の動画で約 28 分）・実測 | About 2.8× the video length (about 28 min for a 10-min video), measured | 約影片長度的 2.8 倍（10 分鐘的影片約 28 分鐘），實測 |
| performance.22.val | 動画長の約 4.1 倍（10 分の動画で約 41 分）・推定 | About 4.1× the video length (about 41 min for a 10-min video), estimated | 約影片長度的 4.1 倍（10 分鐘的影片約 41 分鐘），推估 |
| performance.23.val | 動画長の約 2.2 倍（10 分の動画で約 22 分）・推定 | About 2.2× the video length (about 22 min for a 10-min video), estimated | 約影片長度的 2.2 倍（10 分鐘的影片約 22 分鐘），推估 |
| performance.24.val | 動画長の約 3.0 倍（10 分の動画で約 30 分）・推定 | About 3.0× the video length (about 30 min for a 10-min video), estimated | 約影片長度的 3.0 倍（10 分鐘的影片約 30 分鐘），推估 |
| performance.25.val | 動画長の約 4.0 倍（10 分の動画で約 40 分）・推定 | About 4.0× the video length (about 40 min for a 10-min video), estimated | 約影片長度的 4.0 倍（10 分鐘的影片約 40 分鐘），推估 |
| performance.26.key | NVIDIA GeForce GTX 1060 / 1660 など（GTX 10 / 16 シリーズ） | NVIDIA GeForce GTX 1060 / 1660, etc. (GTX 10 / 16 series) | NVIDIA GeForce GTX 1060 / 1660 等（GTX 10 / 16 系列） |
| performance.26.val | 動画長の約 10〜25 倍・実測。長尺の処理には適しません | About 10–25× the video length, measured. Not suitable for processing long videos. | 約影片長度的 10～25 倍，實測。不適合處理較長的影片。 |
| performance.27.key | GPU なし（CPU のみ） | No GPU (CPU only) | 無 GPU（僅使用 CPU） |
| performance.27.val | 動画長の約 2.9 倍（10 分の動画で約 29 分）・実測。軽量モデルで検出し、モザイクの精緻化は行いません。CPU の性能で大きく変わります | About 2.9× the video length (about 29 min for a 10-min video), measured. Detection uses the lightweight model, and mosaic refinement is not performed. Varies greatly with CPU performance. | 約影片長度的 2.9 倍（10 分鐘的影片約 29 分鐘），實測。以輕量模型偵測，不進行馬賽克精細化。處理速度會因 CPU 的效能而有很大差異。 |
| performance_footnote | 記載の無い GPU は、性能が近い機種の値を目安にしてください。ノート PC 向けの GPU は同じ名前のデスクトップ向けより遅くなります。処理中はアプリを操作する必要がなく、完了後に「確認が必要な箇所」から作業を再開できます。 | For GPUs not listed, use the value for a model with similar performance as a guide. GPUs for laptops are slower than the desktop GPUs with the same name. You don't need to operate the app during processing, and once it finishes, you can resume work from "Areas to review". | 未列出的 GPU，請參考效能相近機型的值。筆記型電腦用的 GPU 會比同名的桌上型電腦用 GPU 慢。處理期間不需要操作應用程式，完成後可從「需要確認的部分」繼續作業。 |
| network.0.key | 初回セットアップ | Initial setup | 初始設定 |
| network.0.val | AI モデル等のデータのダウンロードに通信が必要です（NVIDIA 製 GPU を搭載したパソコンでは、GPU 高速化用の NVIDIA 製のコンポーネントも自動でダウンロードします） | A network connection is required to download AI models and other data (on PCs with an NVIDIA GPU, NVIDIA components for GPU acceleration are also downloaded automatically). | 下載 AI 模型等資料時需要網路連線（搭載 NVIDIA GPU 的電腦，也會自動下載用於 GPU 加速的 NVIDIA 元件）。 |
| network.1.key | 検出・編集・書き出し | Detection, editing, and export | 偵測、編輯、匯出 |
| network.1.val | 通信は不要です。ネットワークを切断した状態でも動作します | No network connection is required. The app works even when disconnected from the network. | 不需要網路連線。在中斷網路的狀態下也能運作。 |
| network.2.key | ライセンス確認 | License check | 授權確認 |
| network.2.val | 起動時にプランの確認を行います | Your plan is checked when the app launches. | 啟動時會確認方案。 |
| formats.0.key | 読み込み | Load | 載入 |
| formats.1.key | 書き出し | Export | 匯出 |

#### disclosure.yml

| 欄 | ja | en | zh-tw |
|---|---|---|---|
| network.sent.0.item | ライセンス認証トークン | License authentication token | 授權驗證權杖 |
| network.sent.1.item | バージョン確認 | Version check | 版本確認 |
| network.sent.2.item | 初回のAIモデルダウンロード | Initial AI model download | 首次下載 AI 模型 |
| network.sent.3.item | 使用量（動画の秒数） | Usage (seconds of video) | 使用量（影片的秒數） |
| network.sent.4.item | ファイルのハッシュ値 | File hash values | 檔案的雜湊值 |
| network.sent.4.note | ファイル名は復元できません | File names cannot be recovered from them. | 無法從中還原檔案名稱。 |
| network.sent.5.item | 端末識別子（ハッシュ化した値） | Device identifier (hashed value) | 裝置識別碼（經雜湊處理的值） |
| network.sent.5.note | 無料枠の管理のため。識別子からは端末や個人を特定できません（ログイン中はアカウントと結び付けます） | Used to manage the free allowance. The identifier cannot be used to identify the device or the person (while you are signed in, it is linked to your account). | 用於管理免費額度。無法從識別碼辨識出裝置或個人（登入期間會與帳號連結）。 |
| network.sent.6.item | 無料枠の利用開始日時 | Date and time you started using the free allowance | 開始使用免費額度的日期與時間 |
| network.sent.6.note | 無料期間（初めて起動した日からの日数）の管理のため。端末ごと・アカウントごとに記録します | Used to manage the free period (the number of days since the app was first launched). Recorded per device and per account. | 用於管理免費期間（從首次啟動那天起算的天數）。依裝置及帳號分別記錄。 |
| network.sent.7.item | エラー情報・処理時間などの動作記録 | Operation records such as error information and processing times | 錯誤資訊、處理時間等運作記錄 |
| network.sent.7.note | 使用許諾契約書・利用規約への同意時にご案内します | Explained when you agree to the End User License Agreement and the Terms of Service. | 會在您同意使用者授權合約與服務條款時說明。 |
| network.not_sent.0.item | 映像・音声 | Video and audio | 影像與音訊 |
| network.not_sent.1.item | フレーム画像・サムネイル | Frame images and thumbnails | 影格圖片與縮圖 |
| network.not_sent.2.item | 検出結果の座標 | Coordinates of detection results | 偵測結果的座標 |
| network.not_sent.3.item | ファイル名 | File names | 檔案名稱 |
| network.not_sent.3.note | ハッシュ値のみを送信します | Only hash values are sent. | 僅傳送雜湊值。 |
| network.not_sent.4.item | プロジェクト情報・作品タイトル | Project information and work titles | 專案資訊與作品標題 |
| offline_steps.0 | 初回セットアップを完了させる（AIモデルのダウンロードにのみ通信が必要です） | Complete the initial setup (a network connection is needed only to download the AI models) | 完成初始設定（僅下載 AI 模型時需要網路連線） |
| offline_steps.1 | LANケーブルを抜く、または Wi-Fi をオフにする | Unplug the LAN cable or turn off Wi-Fi | 拔除網路線，或關閉 Wi-Fi |
| offline_steps.2 | 動画の読み込み・検出・編集・書き出しを実行する | Load a video, then run detection, editing, and export | 執行影片的載入、偵測、編輯與匯出 |
| weaknesses.0.key | 極端な逆光・低照度 | Extreme backlight or low light | 極端逆光、低照度 |
| weaknesses.0.val | 精度が低下します | Accuracy decreases | 精確度會下降 |
| weaknesses.1.key | 激しいブレ・高速なカメラワーク | Heavy shake or fast camera movement | 劇烈晃動、快速的運鏡 |
| weaknesses.1.val | 精度が低下します | Accuracy decreases | 精確度會下降 |
| weaknesses.2.key | 部分的な遮蔽（手・衣服・小道具） | Partial occlusion (hands, clothing, props) | 部分遮蔽（手、衣物、道具） |
| weaknesses.2.val | 検出が途切れることがあります | Detection may be interrupted | 偵測可能會中斷 |
| weaknesses.3.key | 特殊なアングル・学習データに乏しい構図 | Unusual angles or compositions with little training data | 特殊角度、訓練資料較少的構圖 |
| weaknesses.3.val | 精度が低下します | Accuracy decreases | 精確度會下降 |
| weaknesses.4.key | アニメーション・3DCG作品 | Animation and 3DCG works | 動畫、3DCG 作品 |
| weaknesses.4.val | 実写より精度が下がります | Accuracy is lower than for live-action footage | 精確度會低於真人實拍 |
| responsibility | 最終的な確認と表現に関する責任は制作者に帰属します。本ソフトウェアは確認作業の効率化を目的としたものであり、審査通過を保証するものではありません。 | Responsibility for the final check and for how the content is expressed rests with the creator. This software is intended to make review work more efficient and does not guarantee that your content will pass review. | 最終確認與表現內容的責任歸屬於製作者。本軟體的目的在於提升確認作業的效率，並不保證能通過審查。 |
| accuracy_note | 検出率の実測値は、計測条件（テストデータの時間数・シーン数）とあわせて公開します。数値が確定するまでは、断定的な精度表記を行いません。 | Measured detection rates will be published together with the measurement conditions (the number of hours and scenes in the test data). Until the figures are finalized, we do not make definitive claims about accuracy. | 偵測率的實測值將連同測量條件（測試資料的時數與場景數）一併公開。在數值確定之前，不會做出斷定性的精確度標示。 |

#### mosaic.yml

| 欄 | ja | en | zh-tw |
|---|---|---|---|
| scopes.0.key | 全て | All | 全部 |
| scopes.0.val | プロジェクト全体の既定値 | Defaults for the whole project | 整個專案的預設值 |
| scopes.1.key | クラス別 | By class | 依類別 |
| scopes.1.val | 身体のプライバシー部位・男性顔・女性顔など、検出クラスごと | Per detection class, such as body areas, male faces, and female faces | 依偵測類別設定，例如身體部位、男性臉部、女性臉部 |
| scopes.2.key | ID別 | By ID | 依 ID |
| scopes.2.val | 追跡された個々の対象ごと | Per individual tracked target | 依每個被追蹤的對象設定 |
| scopes.3.key | シーン別 | By scene | 依場景 |
| scopes.3.val | カット単位 | Per cut | 以鏡頭為單位 |
| priority_note | 優先順位は ID別 &gt; クラス別 &gt; シーン別 &gt; 全て。狭い範囲の設定が優先されます。オーバライド中の範囲には表示が出て、個別にクリアできます。 | The order of priority is By ID &gt; By class &gt; By scene &gt; All. Settings for a narrower scope take precedence. A scope with an override shows an indicator, and you can clear each one individually. | 優先順序為依 ID &gt; 依類別 &gt; 依場景 &gt; 全部。範圍越小的設定越優先。正在覆寫的範圍會顯示標示，並可個別清除。 |
| controls.0.key | ピクセルサイズ | Pixel size | 像素大小 |
| controls.0.val | 「ピクセルサイズを設定」の画面で、プレビューとグラフを見ながら決めます。粒の大きさは<strong>画面の幅に並ぶ粒の数</strong>で表すので、動画の解像度が違っても同じ見た目になります。<strong>固定</strong>（既定は幅に 53 粒）はすべての対象で同じ粒です。<strong>ピクセルサイズ自動</strong>を ON にすると、対象物の大きさで粒を変えられます | Set it on the "Set pixel size" screen while checking the preview and the graph. Block size is expressed as the <strong>number of blocks across the screen width</strong>, so it looks the same even if the video resolution differs. <strong>Fixed</strong> (default: 53 blocks across the width) uses the same blocks for every target. Turn on <strong>Auto pixel size</strong> to change the blocks according to the size of the target. | 在「設定像素大小」畫面中，一邊查看預覽與圖表一邊決定。馬賽克格的大小以<strong>畫面寬度上排列的格數</strong>來代表，因此即使影片的解析度不同，看起來也一樣。<strong>固定</strong>（預設為寬度 53 格）會讓所有對象使用相同的馬賽克格。開啟<strong>自動像素大小</strong>後，即可依對象的大小改變馬賽克格。 |
| controls.1.key | 大きさの範囲ごと | By size range | 依大小範圍 |
| controls.1.val | 対象物の大きさ（画面幅に対する割合）の範囲ごとに、幅に並ぶ粒の数を決めます（1〜6 範囲）。カット内・同一 ID 内で粒度は一定です | For each range of target size (as a proportion of the screen width), set the number of blocks across the width (1–6 ranges). The block size stays the same within a cut and within the same ID. | 依對象大小（相對於畫面寬度的比例）的範圍，分別決定寬度上排列的格數（1～6 個範圍）。在同一鏡頭內、同一 ID 內，馬賽克格的大小保持一致。 |
| controls.2.key | 分割数で比例 | Proportional to divisions | 依分割數等比 |
| controls.2.val | 対象物の大きさを分割数（8〜64）で割った粒にします。「最も粗い粒」（幅に N 粒以上）で粗さの限度を付けられます。カット内・同一 ID 内で粒度は一定です | Uses blocks equal to the target size divided by the number of divisions (8–64). You can limit how coarse the blocks get with "Coarsest blocks" (N or more blocks across the width). The block size stays the same within a cut and within the same ID. | 以對象大小除以分割數（8～64）的值作為馬賽克格的大小。可用「最粗的格」（寬度 N 格以上）限制粗細的上限。在同一鏡頭內、同一 ID 內，馬賽克格的大小保持一致。 |
| controls.3.key | サイズ（bbox 拡張率） | Size (bbox expansion ratio) | 大小（bbox 擴展率） |
| controls.3.val | 検出枠を中心から拡大・縮小してモザイク範囲を調整します（0.5x〜2x）。ギリギリを狙わない運用を選べます | Enlarges or shrinks the detection box from its center to adjust the mosaic area (0.5x–2x). You can choose to keep a margin instead of cutting it close. | 從中心放大或縮小偵測框，以調整馬賽克範圍（0.5x～2x）。可選擇不貼著邊緣、保留餘裕的做法。 |
| controls.4.key | 種類・不透明度・エッジぼかし | Type, opacity, and edge feather | 類型、不透明度、邊緣羽化 |
| controls.4.val | モザイク（ブロック状）/ ぼかし（ガウスぼかし）の切替、不透明度（0〜100%・既定 100% で完全に覆う）、ふちのなじませ（0〜64px） | Switch between mosaic (blocks) and blur (Gaussian blur), opacity (0–100%; the default of 100% covers completely), and edge feather (0–64 px) | 切換馬賽克（方塊狀）/ 模糊（高斯模糊）、不透明度（0～100%，預設 100% 為完全覆蓋）、邊緣羽化（0～64 px） |
| controls.5.key | 信頼度しきい値 | Confidence threshold | 信賴度門檻 |
| controls.5.val | 指定した信頼度以上の検出だけを表示・モザイク対象にします（0〜100%） | Only detections at or above the specified confidence are shown and get mosaic applied (0–100%). | 僅顯示信賴度達指定值以上的偵測結果，並套用馬賽克（0～100%）。 |
| controls.6.key | シャープカラー | Sharp colors | 銳利色彩 |
| controls.6.val | 粒の色を領域平均ではなく 1 点サンプリングにします（Premiere Pro の Sharp Colors 相当、既定 OFF） | Takes the block color from 1 sampled point instead of the average of the area (equivalent to Sharp Colors in Premiere Pro; off by default). | 馬賽克格的顏色不取區域平均，而改用 1 個點取樣（相當於 Premiere Pro 的 Sharp Colors，預設關閉）。 |
| note | 設定は各項目の右端のボタンで既定値に戻せます。パネルはドラッグで自由な位置に移動でき、開いたまま編集を続けられます。 | Each setting can be reset to its default with the button at its right end. You can drag the panel to any position and keep editing with it open. | 各項設定可用該項目右端的按鈕恢復為預設值。面板可拖曳到任意位置，並可在開啟的狀態下繼續編輯。 |

#### entity.yml

| 欄 | ja | en | zh-tw |
|---|---|---|---|
| one_liner | Deepmosaic は、動画内の対象を AI が検出してモザイクをかける Windows 向けデスクトップアプリです。 | Deepmosaic is a desktop app for Windows in which AI detects targets in a video and applies mosaic to them. | Deepmosaic 是一款由 AI 偵測影片中的對象並套用馬賽克的 Windows 桌面應用程式。 |
| not_removal_note | モザイクをかける（付加する）ためのソフトです。すでに入っているモザイクを取り除く機能はありません。 | This software is for applying (adding) mosaic. It has no feature for taking off mosaic that has already been applied. | 這是用來套用（加上）馬賽克的軟體。不具備去掉既有馬賽克的功能。 |
| definition | Deepmosaic は、動画に映った対象（身体のプライバシー部位・顔）を AI が自動検出し、その領域にモザイクをかける Windows デスクトップアプリケーションです。モザイクを除去・復元する機能はありません。 | Deepmosaic is a Windows desktop application in which AI automatically detects targets in a video (body areas and faces) and applies mosaic to those areas. It has no feature for taking off mosaic or restoring the original footage. | Deepmosaic 是一款由 AI 自動偵測影片中的對象（身體部位、臉部），並對該範圍套用馬賽克的 Windows 桌面應用程式。不具備去掉或還原馬賽克的功能。 |
| disambiguation | Deepmosaic はモザイクを付加（追加）するソフトウェアです。モザイクの除去・解除・復元はできません。 | Deepmosaic is software that applies (adds) mosaic. It cannot remove or undo mosaic, or restore the original footage. | Deepmosaic 是為影片加上（新增）馬賽克的軟體。無法移除、解除或還原馬賽克。 |
| can.0 | 動画内の身体のプライバシー部位・男性顔・女性顔を AI が自動検出し、フレーム間で追跡する | Automatically detect body areas, male faces, and female faces in a video with AI, and track them across frames | 由 AI 自動偵測影片中的身體部位、男性臉部、女性臉部，並在影格之間追蹤 |
| can.1 | 検出した領域にモザイク（ブロック状）またはぼかしをかける | Apply mosaic (blocks) or blur to the detected areas | 對偵測到的範圍套用馬賽克（方塊狀）或模糊 |
| can.2 | 素材にすでにかかっているモザイクの位置と範囲を見つけ、その上から新しいモザイクをかけ直す | Find the position and extent of mosaic already present in the footage, and apply new mosaic over it again | 找出素材中既有馬賽克的位置與範圍，並在其上重新套用新的馬賽克 |
| can.3 | 粒度・不透明度・ふちのなじませ・検出枠の拡張率を設定で固定する | Fix the block size, opacity, edge feather, and detection box expansion ratio in settings | 在設定中固定馬賽克格的大小、不透明度、邊緣羽化與偵測框的擴展率 |
| can.4 | 検出結果を人が確認・修正する（検出枠の追加・削除・移動、信頼度によるフィルタ） | Have a person review and correct the detection results (add, delete, and move detection boxes; filter by confidence) | 由人工確認與修正偵測結果（新增、刪除、移動偵測框，依信賴度篩選） |
| can.5 | モザイクを焼き込んだ動画を書き出す（MP4 / MOV / WebM / MKV / AVI、NVENC 対応） | Export a video with the mosaic burned in (MP4 / MOV / WebM / MKV / AVI, NVENC supported) | 匯出已燒錄馬賽克的影片（MP4 / MOV / WebM / MKV / AVI，支援 NVENC） |
| can.6 | 検出したモザイク情報を Adobe Premiere Pro のプロジェクトへインポートする | Import the detected mosaic information into an Adobe Premiere Pro project | 將偵測到的馬賽克資訊匯入 Adobe Premiere Pro 的專案 |
| can.7 | 映像を外部に送信せず、すべてお使いの PC 内で処理する | Process everything on your PC without sending the video outside | 不將影像傳送到外部，所有處理都在您的電腦上完成 |
| cannot.0 | すでにモザイクがかかった映像から、モザイクを取り除くこと | Removing mosaic from footage that already has mosaic applied | 從已套用馬賽克的影像中去除馬賽克 |
| cannot.1 | モザイクの下にある元の映像を復元・推定すること | Restoring or inferring the original footage beneath the mosaic | 還原或推測馬賽克下方的原始影像 |
| cannot.2 | 顔の入れ替え（deepfake）や、人物の生成 | Face swapping (deepfakes) or generating people | 換臉（deepfake）或生成人物 |
| cannot.3 | 審査・検閲基準への適合を保証すること | Guaranteeing compliance with review or screening standards | 保證符合審核或審查標準 |
| name_origin | 名称は Deep Learning（ディープラーニング）と Mosaic（モザイク）に由来し、「ディープラーニングでモザイクをかける」という意味です。deepfake や復元系の技術とは関係ありません。 | The name comes from Deep Learning and Mosaic, meaning "applying mosaic with deep learning." It has nothing to do with deepfake or restoration technologies. | 名稱源自 Deep Learning（深度學習）與 Mosaic（馬賽克），意思是「以深度學習套用馬賽克」。與 deepfake 或還原類的技術無關。 |
| oss_distinction | Deepmosaic は、オープンソースで公開されている「DeepMosaics」（モザイクを取り除く用途などで知られるツール）とは別の製品です。名前が似ていますが、開発元も機能も関係がありません。 | Deepmosaic is a separate product from "DeepMosaics", which is published as open source (a tool known for uses such as removing mosaic). Despite the similar names, they are unrelated in both developer and features. | Deepmosaic 與以開放原始碼公開的「DeepMosaics」（以去除馬賽克等用途而聞名的工具）是不同的產品。雖然名稱相似，但開發者與功能都毫無關係。 |
| confusion_reasons.0 | 製品名に「mosaic」を含むため、名称の似たツールと同じ種類のソフトだと受け取られやすいこと | Because the product name contains "mosaic," it is easily taken to be the same kind of software as tools with similar names. | 由於產品名稱含有「mosaic」，容易被認為與名稱相似的工具屬於同類軟體。 |
| confusion_reasons.1 | 日本語の「モザイク処理」が、モザイクを「かける」と「外す」の両方向を指す語であること | In Japanese, the term for "mosaic processing" can mean either adding or removing mosaic. | 在日文中，「馬賽克處理」一詞同時可指「加上」與「拿掉」馬賽克兩個方向。 |
| software_requirements | Windows 10 / 11（64 ビット）、メモリ 8GB 以上（16GB 推奨）、NVIDIA GeForce RTX 3000 シリーズ以上を推奨、ストレージ 10GB程度 | Windows 10 / 11 (64-bit), 8 GB or more of memory (16 GB recommended), NVIDIA GeForce RTX 3000 series or higher recommended, about 10 GB of storage | Windows 10 / 11（64 位元）、記憶體 8 GB 以上（建議 16 GB）、建議使用 NVIDIA GeForce RTX 3000 系列以上、儲存空間約 10 GB |
| keywords | 動画 モザイク 自動, 顔 モザイク 自動, モザイク 加工 ソフト, モザイク 焼き込み, Adobe Premiere Pro 連携 | automatic video mosaic, automatic face mosaic, software for adding mosaic, burned-in mosaic, Adobe Premiere Pro integration | 影片 馬賽克 自動, 臉部 馬賽克 自動, 馬賽克 加工 軟體, 馬賽克 燒錄, Adobe Premiere Pro 整合 |

## レビューの指摘への対応 (Fixer)
- MEDIUM: テストの BODY_WORDS_RE.en に生のバックスペース (0x08) が 10 個入り、private / nude / nudity / explicit / intimate / nsfw が
  どの文にも当たらなかった → `\b` (バックスラッシュ + b) に直し、陽性対照 (`private body areas`・`NSFW`・`nude`) を足した。制御文字 0 を確認。
  (原因の推測: ツール経由でスクリプトを書くと `\\b` が `\b` に縮み、JS の文字列で 0x08 になる。Fixer でも同じ現象が起きた。)
- LOW: performance の (倍率, 分) の組の検査を追加 (判断 5)。
- LOW: formats[0].key を `Load` に (判断 6)。
- LOW: entity の definition / disambiguation の「復元」を `restoring the original footage` / `restore the original footage` に
  (`restore mosaic` は「モザイクをかけ直す」とも読めるため)。definition は除去の連語を使わない欄のまま。
- LOW: 引用の句読点を引用符の外へ (`"Areas to review".`・`"DeepMosaics",`)。T-2201 の faq.yml の `"DeepMosaics,"` は
  このチケットの範囲外なので触っていない (**W8 で同じ形にそろえること**)。
- LOW: keywords の `mosaic editing software` → `software for adding mosaic` (ja が方向の曖昧な語を外した意図に合わせる)。
- LOW: zh-tw の priority_note の「為 依」の空白を削除。
- LOW: notes の改行コードの記述を訂正 (上のゲートの結果)。
