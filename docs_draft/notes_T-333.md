# notes_T-333: 動作環境の文言 (ランタイム行 / 10GB程度 / 実行ファイル等) と Enterprise の支払方法

ユーザー指定の文言修正 4 件。データ (`_data/*.yml`) が単一真実源なので、編集したのは
データとその手書きの写し (docs 第 6 章) だけで、ページ側の HTML は触っていない。

## 変更点

| ファイル | 変更 |
|---|---|
| `_data/spec.yml` | 動作環境 (windows) の **「ランタイム」行 (Microsoft Edge WebView2) を撤去**。インストーラが自動導入するもので、ユーザーが事前に用意する条件ではないため (撤去した理由は同ファイルのコメントに残した)。ストレージ行の容量を「約 10GB」→ **「10GB程度」**。network の初回セットアップを「AI モデル等のダウンロード…」→ **「実行ファイル等のダウンロードに通信が必要です」** (取得物は AI モデルだけでなく検出エンジン等の実行ファイルを含む) |
| `_data/entity.yml` | `software_requirements` (JSON-LD `softwareRequirements`) の「ストレージ約 10GB」→「ストレージ 10GB程度」 |
| `_includes/docs/06-ops.html` | 保存先の表 (`:57`) とアンインストール (`:75`) の「約 10GB」→「10GB程度」 |
| `_data/plans.yml` | Enterprise の `specs` の支払方法を「請求書払い（クレジットカード即時払い・銀行振込）」→ **「クレジットカード払い、請求書払い（銀行振込）」**。T-298 のコメントを T-333 の理由に差し替え |
| `src/lib/plans-yml.js` | `loadSpecs(code)` を追加 (プランの `specs:` を `{label, value}` で読む)。`loadTiers` は specs を読み飛ばすため。**plans.yml を読むコードはこのモジュールを通す**という同ファイルの約束に従い、テスト側に別パーサを作らなかった |
| `src/lib/spec-requirements.test.js` (新) | 動作環境の文言の回帰テスト 8 件 |
| `src/lib/plans-payment.test.js` (新) | 支払方法の行の回帰テスト 7 件 |
| `README.md` | `npm test` の期待件数を 159 件 (158 pass / 1 skip) に更新 |

## テスト (TDD: 先に 8 件 RED を確認してから実装)

- `spec-requirements.test.js`
  - パーサの空振り検査 (節が無ければ空配列) と `windows` の読み取り
  - 動作環境の表に「ランタイム」行が無い / WebView2 を必要条件として挙げていない
  - ストレージ行はちょうど 1 つで容量は `nnGB程度` (「約 nnGB」を禁止)
  - **`_data/entity.yml` と `_includes/docs/06-ops.html` (2 箇所) が `spec.yml` と同じ容量表記を使う** —
    容量は 3 ファイルに手書きされており、片方だけ直すと実在しない条件を広告することになる
    (`docs-team-seats.test.js` が docs で守っているのと同じ構図)
  - network の初回セットアップの文言
- `plans-payment.test.js`
  - `loadSpecs` の空振り検査と読み取り
  - light / pro / enterprise に「支払方法」の行がちょうど 1 つずつ (T-252 の契約)
  - Enterprise の値 = 指定文言、カード払いが請求書払いより先に並ぶ

## 追加・変更したコマンド

新規コマンドは無し。ゲートは既存のもの:

```bash
npm test                        # 159 件中 158 pass / 1 skip (skip は SUPABASE_PROXY_API_KEY 未設定時の設計どおり)
npm run build && bundle exec jekyll build --strict_front_matter
node scripts/check-docs.mjs     # docs check: OK (2 ページ, 15 ファイル)
```

ビルド出力での確認 (実施済み):

- `_site/spec/index.html` — 表は OS / メモリ / GPU / ドライバ / ストレージ の 5 行 (ランタイム行なし)、
  「10GB程度」「実行ファイル等のダウンロードに通信が必要です」
- `_site/price/index.html` — 「クレジットカード払い、請求書払い（銀行振込）」、CI が固定している「維持管理費用」は健在
- `_site/docs/index.html` / `_site/llms-full.txt` — 「10GB程度」。`_site` 全体に「約 10GB」は残っていない

## 注意点・既知の制約

- **`_data/entity.yml` の `software_requirements` には WebView2 の記載が残っている** (計画どおり、
  変更対象は容量表記のみ)。したがって `/spec/` は、表には WebView2 を出さず JSON-LD には出す状態になる。
  docs 第 1 章「インストール」にも「動作には WebView2 ランタイムが必要（Windows 10/11 には標準搭載）」が
  残っているので事実関係は矛盾しないが、同ファイルのコメント
  「software_requirements は `_data/spec.yml` の windows と食い違わせないこと」の観点では
  **JSON-LD からも落とすかどうかはリーダーの判断が要る** (落とす場合は 1 語の削除で済む)。
- ストレージ行の文言は docs 第 1 章の初回セットアップの本文に `{{ spec_storage.val }}` として
  そのまま埋め込まれる。文末に句点を足すと本文が壊れるので、行の形 (「…に 10GB程度」) を保つこと。
- 「10GB程度」は**この表記のまま**をユーザーが指定している (リポジトリの通例である
  「約 10GB」/ 数字前後の半角スペースとは揃わないが、テストがこの形を固定している)。
- 公開は push で行われる (T-332 と同じ束)。本チケットではコミットしていない。

## ロールバック

- データのみの変更なので `git revert <commit>` で戻る (ビルド生成物への影響は `_site/` の再生成だけ)。
- 文言だけ戻したい場合は `_data/spec.yml` / `_data/entity.yml` / `_data/plans.yml` /
  `_includes/docs/06-ops.html` の 4 ファイルを `git checkout <前のコミット> -- …` で戻し、
  合わせて `src/lib/spec-requirements.test.js` / `src/lib/plans-payment.test.js` を外す
  (テストが旧文言を落とすため)。`src/lib/plans-yml.js` の `loadSpecs` は追加のみなので残してよい。
