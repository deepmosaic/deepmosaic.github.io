# CHANGELOG

## 2026-08-15 - Feature: 「ブラウザで試す」で即ログイン画面へ (TICKET-SITE-38)

`web_app.url` を `https://app.deepmosaic.co.jp/?login=1` に変更。Web 版側 (web T-031) の
自動ログイン導線により、未認証ユーザーはクリック直後に Auth0 のログイン画面へ進み、
認証済みユーザーは Auth0 を経由せずそのままアプリに入る。`decorateDownloadUrl` は
既存クエリを温存して dm/utm を追記する契約のため流入計測とも共存する (テスト変更なし)。

## 2026-08-15 - Fix: Free 上限 6h→5h をサイトにも反映する (T-013 のサイト側)

**公開サイトが「累計 6 時間」と案内し続けていたのに、サーバーは既に 5 時間で止めていた。**
T-013 (front 側のチケット) が Supabase の `plan_catalog.included_minutes` を 360→300 に
適用済みで、サイトの `_data/plans.yml` だけが取り残されていた。

**このためサイトのデプロイが全て止まっていた。** CI の `plan-catalog.test.js` が本番 Supabase と
突き合わせて落ちるため (`free: 込み時間が食い違っている — サイト 360 分 / Supabase 300 分`)、
T-007 / T-008 の変更も公開されていなかった。**このテストはローカルでは skip される**
(本番へアクセスできないため) ので、手元では気づけない。

- [x] `_data/plans.yml`: `included_hours: 6` → `5`。コメントに Supabase が正である旨と
      CI で突き合わせている旨を明記
- [x] `_data/plans.yml` の bullet / `_data/faq.yml` / `price/index.html` の meta description の
      「6 時間」を 5 時間に。**未ログインの 3 時間も併記**した — アプリ側は
      `ANONYMOUS_USAGE_LIMIT_SECONDS` = 3h / `FREE_USAGE_LIMIT_SECONDS` = 5h で、
      ダウンロード後そのまま 3 時間使え、無料登録で 5 時間に増える
- [x] `docs/index.html`: 数値を直書きしていたので `_data/plans.yml` から引くよう変更
      (同ファイル内の「契約本数を直書きしない」方針と揃えた)。あわせて
      **「アプリの利用にはログインが必要です」を実態に合わせて修正** — 未ログインでも
      3 時間使えるので、この一文は誤りだった
- [x] `src/lib/pricing.test.js`: 6h 固定の期待値 2 件を修正。片方は**データから読む**形にして
      次の改定で落ちないようにした
- [x] 本番の `plan_catalog` (livemode) と `_data/plans.yml` を全プラン突き合わせて一致を確認
      (free 5h / light 5h / pro 40h / enterprise 40h)

`_includes/cta-download.html` は元から `free_plan.included_hours` を参照していたので自動追従。

## 2026-08-15 - Change: 初回接触 (first-touch) と計測実行マーカーを送る (T-008)

保存していた流入元は **last non-direct** (`mergeAttribution`)。「最後にどこから来たか」は
分かるが「そもそもどこで知ったか」が残らない。ダッシュボードで見たいのは後者なので、
**別のキーで別に持つ** — 同じ record の一部だけを first にすると 2 つの思想が混ざる。

### 変更

- `src/lib/attribution.js`
  - `FIRST_TTL_MS` (180 日、last-touch の 30 日より長い) / `firstTouchFromLanding` /
    `serializeFirst` / `parseFirstEnvelope` / `sanitizeLandingPath` を追加
  - **`firstTouchFromLanding` は `attributionFromLanding` と違って `null` を返さない。**
    流入元が取れない (＝直接アクセス) 場合も「最初に着いたページ」は残す価値があり、
    直接アクセスが first-touch であることそのものが事実
  - `decorateDownloadUrl(href, record, first)` が `fref` / `futm_source` / `lp` を載せる
  - **`dm=1` は record が null でも必ず付ける。** これが無いと Worker 側で
    「JS が走ったうえで流入元が無かった (= 真の直接アクセス)」と「JS が走らなかった」を
    区別できない
- `src/main.js`: `dm_attr_first` キー。**一度書いたら上書きしない** (それが first-touch の定義)
- `src/islands/MobileNav.svelte`: `data-dl-first` でエンベロープごと受け取り、
  受け側でも期限と中身を再検証する
- `sanitizeLandingPath`: **パスのみ**。クエリと fragment は受け取らない (検索語や
  個人情報が乗りうる)。`..` を含むもの、`//` で始まるもの (プロトコル相対 URL に化ける)、
  許可文字以外は破棄。**Worker 側でも同じ検証をする** — あちらは認証不要で誰でも叩けるため

### `dm=0` を素の href に焼き込まなかった理由

JS 無効時に「計測が走らなかった」と明示できる利点はあるが、DL URL の単一管理点
(`_data/lang/ja.json`) は JSON-LD の `downloadUrl` にも使われており、構造化データが
計測用クエリ付きの URL を指すことになる。**「付いていない = 不明」で必要な区別は足りる**
ので採らなかった (CI の「クエリ焼き込み禁止」ガードもそのまま維持できる)。

### テスト

12 件を追加。`decorateDownloadUrl` の「record が null なら 1 文字も変えない」は契約が
変わったので、`dm=1` だけが付くことを固定するテストへ書き換えた。

## 2026-08-15 - Change: 流入元の保持を sessionStorage から localStorage 30 日へ (T-007)

チケット一覧と背景は `dashboard/CHANGELOG.md` の「流入経路の是正 / device 重複 /
Windows 10 初回離脱 (T-001〜T-010)」に集約。

### 何が問題だったか

流入元を **sessionStorage に置いていたのでタブを閉じた時点で消えていた**。
「Google で見つけて、後日ダウンロードする」経路が全部 direct として記録される。
ダッシュボード側の実測でも、ダウンロード 129 件のうち 25 件が「参照元なし」だった。

### 変更

- `src/lib/attribution.js`: 保存層のエンベロープ `serializeStored` /
  `parseStoredEnvelope` を新設 (`ATTR_TTL_MS = 30 日`)。`now` は引数で受けるので
  この module は純関数のまま
- `src/main.js`: 読み書きを localStorage へ。読みは **1 リリースだけ sessionStorage に
  フォールバック**して、リリースをまたいだセッションの流入元を落とさない
- **`mergeAttribution` の last non-direct 方針は変えていない。** あのコメントの主張は
  「どの接点を採るか」であって「どれだけ覚えているか」ではなく、TTL 延長とは衝突しない。
  誤読防止の注記を追記した (first-touch が要るなら別項目で持つ = T-008)
- `serializeAttribution` / `parseStoredAttribution` は**無変更**。あれは `data-dl-attr` の
  ワイヤ形式で `MobileNav.svelte` が受ける側にいる (保存層とは別物)
- 期限切れの判定は `exp <= now`。`exp` が無い / 数値でないエンベロープは信用しない
  (開発者ツールで `exp` を消せば無期限、という抜け道を作らない)
- `company/cookie.html`: ローカルストレージの節を追加 (用途・保存内容・30 日・削除方法)
- テスト 9 件を追加。既存 70 件は**無変更で通る** (`mergeAttribution` を触っていない証拠)

### 限界 (言い切らないこと)

- **Safari の ITP はスクリプトが書いた localStorage を 7 日で削除する。** 30 日が効くのは
  Chrome / Edge / Firefox だけ
- JS 無効・バンドル読み込み失敗時は従来どおり `?ref=` が付かない。
  **`<head>` にインラインの最小計測を置く案は採らなかった** — sanitize を含む同じ処理を
  2 箇所に持つことになり、それは T-002 で直したばかりの不具合 (同じ規則の二重実装が
  片方だけずれる) と同じ形になる。素の href に焼き込める静的な値は T-008 の `dm=0` で扱う

## 2026-08-08 - Change: 料金カード直下の告知を削除 + `/price/` リード文を全幅に

### `rollout_note` を空にした

料金カード直下に出ていた告知（「上限時間の適用は順次開始します。…現在ご利用中の
お客様の条件は変わりません。」）を削除。`_data/plans.yml` の `rollout_note: ""` で、
`_includes/pricing-cards.html` の `{% if rollout_note != "" %}` が段落ごと落とす。
**トップと `/price/` の両方が同じ include を通るので 1 行で両方消える。**

同じ内容は次の 2 箇所が引き続き書いているので、**開示が消えたわけではない**。

| 出し先 | 内容 |
|---|---|
| `_data/faq.yml`「上限に達したらどうなりますか」 | 超過料金なし / 適用は順次 / 追加契約の本数 |
| `docs/index.html`（`/docs/#plan`） | 上と同じ + 適用開始までインポート無制限 |

つまり告知は 3 重に置かれていて、料金カード直下がその 3 つ目だった。
2026-08-02 (9) で Pro カードの `note` を「`rollout_note` と重複」として消したのと
同じ整理の続き。

- `llms-full.txt` の出力も条件付きにした。空文字を素で書き出すと `## 5.` の手前だけ
  空行が 2 本になる。**前後の空行を `if` の内側に入れる**ことで、空のとき / 注記が
  ある場合の両方で空行 1 本に揃うのを実際にビルドして確認した
- `_data/plans.yml` と `index.html` のコメントを更新。「上限時間が未強制である事実の
  開示先」が `rollout_note` から FAQ と `/docs/` に移ったことを書いた
- ⚠️ 文面はアプリ `PlanSelectDialog.svelte` の注記と一字一句同じにしてあった。
  **アプリ側の注記はそのまま**なので、復活させるときは突き合わせること

### `/price/` のリード文を全幅に

`max-w-[680px]` を外した。コンテナが `max-w-[1120px]` なので **61% の位置で
折り返して右側が大きく空いていた**。3 文あるぶん折り返しが 3 行に及んで目立つ。
モバイル（390px）は `w-[92%]` が効いているので影響なし。

`/spec/` の同じリード文は `max-w-[640px]` のままにした。あちらはコンテナ自体が
`max-w-[880px]` で、比率が 73% と差が小さいため。

2026-08-02 (4) で見出しを「粒度と隠蔽率を設定で固定できる」→「柔軟な編集機能」に
変えた際、**本文が「カット内・同一 ID 内で粒度が一定に保たれます」のままで見出しと
逆を向いていた**。あわせてアイコンも `Ruler`（定規 = 固定のメタファー）のままだった。

- 本文を「設定できる項目そのものを並べる」形に書き直した。
  出典は `_data/mosaic.yml` の `controls` / `scopes`

  > モザイク／ぼかしの切替、粒度、検出枠の拡張率、ふちのなじませを調整できます。
  > 設定は全体・クラス別・追跡 ID 別・シーン別の 4 段階で上書きできます。

- アイコンを `Ruler` → `Grid3x3`（モザイクの粒を想起させる 3×3 グリッド）に変更。
  `Grid3x3` は `_includes/icon.html` に実装済みで、トップページでは未使用だった

### 3 列目との守備範囲の重複も解消した

| 列 | 役割 |
|---|---|
| 2 列目「柔軟な編集機能」 | **モザイクの見た目**をどこまで細かく決められるか |
| 3 列目「確認と修正の道具が揃っている」 | **AI の検出結果**をどう直せるか |

書き換え前は 2 列目の本文が「粒度の一定さ」（＝設定の話でも修正の話でもない）で、
どちらの列とも噛み合っていなかった。役割を明示するコメントを `index.html` に残した。

「カット内・同一 ID 内で粒度が一定」という事実自体は MOSAIC 節のタブ
（`_data/mosaic.yml` の `controls`）が引き続き説明しているので、TRUST BAR から
外しても情報は落ちない（ビルド出力で残存を確認済み）。

## 2026-08-02 (9) - Change: 注記 2 件の削除 + 「シート」→「アカウント」

### 削除した注記 2 件

- **既存 Pro（無制限）据え置きの注記** — `_data/plans.yml` の `grandfather_note`。
  出し先だった `_includes/pricing-cards.html` の `grandfather` パラメータ、
  `/price/` 側の受け渡し（`{% include pricing-cards.html grandfather=true %}`）、
  `llms-full.txt` の出力行も**同時に撤去**した。データだけ消すと配管が死んで残る。
  ⚠️ front の `from_legacy_plan_name`（既存の有料文字列を無制限に倒す実装）は
  **そのまま生きている**。消したのは告知であって据え置きの挙動ではない
- **Pro カードの `note`**（「上限に達しても進行中の処理は停止しません。超過料金は
  発生しません。」）— 同じ内容を `rollout_note` がカード下に出しており重複していた。
  `pricing-cards.html` の `{% if plan.note %}` は汎用の仕組みとして残す

### 「シート」→「アカウント」

**変えたのは人が読む文字列だけ。内部の識別子は据え置く。**

| 変更 | 箇所 |
|---|---|
| `price_unit` | `/ シート・月` → `/ アカウント・月` |
| Enterprise の `summary` | 最低 3 シート → 最低 3 アカウント |
| Enterprise の specs | シート数 × 40 時間 → アカウント数 × 40 時間 |
| `/price/` の `description` | Enterprise 1シート → 1アカウント |
| ROI 計算機の内訳文 (`pricing.js`) | `3 シート（120 時間をプール共有）` → `3 アカウント（…）` |
| `pricing.test.js` | 上記に対応する期待値 2 件 |

⚠️ **`min_seats` / `seats` / `bestSeatPlan` といった識別子は変更していない。**
`min_seats` は Supabase `plan_catalog.min_seats` の**列名と対応**しており、
CI（`scripts/check-plan-catalog.mjs`）が同名で突き合わせる。キーを変えると
突き合わせが壊れる。`_data/plans.yml` と `src/lib/pricing.js` の該当箇所に
その旨のコメントを入れた。

`src/lib/plan-catalog.js` のエラーメッセージ（「最低シート数が食い違っている」）も
そのまま。これは CI の開発者向け出力で、ユーザーには見えない。

検証: npm test 71 passed / 0 failed（skip 1 は `SUPABASE_PROXY_API_KEY` 未設定時の
ライブ検査で意図的）。ビルド出力に削除した 2 文の残存ゼロ、ユーザーに見える面の
「シート」の残存ゼロ（`assets/dist/app.js` も含めて 0 件）。

## 2026-08-02 (9) - Feature: `_data/plans.yml` と Supabase `plan_catalog` の乖離を CI が検知する (TICKET-SITE-CONTRACT-SSOT / 案B)

契約本数の上限 (`max_contracts`) / 込み時間 / 月額の **真の SSOT は Supabase の
`plan_catalog`**。静的サイトは Supabase を読めないので `_data/plans.yml` に写しを置いて
いる。写しである以上いつか必ず乖離し、乖離したまま公開すると **実在しない契約条件を
広告する**ことになる。人手のレビューに頼らず機械で気付けるようにした。

同じバッチの案C（サイト内に散っていた `max_contracts` の手書き 5 箇所を
`_data/plans.yml` の 1 箇所へ集約）と対になる。**C で重複を 1 点に絞り、B でその 1 点を
機械監視する** — 重複を最小化してから守る、という順序。

### 追加・変更したファイル

- `scripts/check-plan-catalog.mjs` — Worker の `GET /plan-catalog?livemode=true` を叩いて
  `_data/plans.yml` と突き合わせる CLI
- `src/lib/plan-catalog.js` — 突き合わせの純ロジック + fetch ラッパ。**例外を投げず**
  `status` で失敗種別を返す（呼び出し側が「落とす / 素通しする」を判断できるように）
- `src/lib/plan-catalog.test.js` — 上記の回帰テスト。`npm test` の glob
  (`node --test src/lib/*.test.js`) に自動で乗るので `package.json` は変更なし
- `src/lib/plans-yml.js` — plans.yml の極小パーサ。**`pricing.test.js` の中にあったものを
  切り出した**。読み手を 2 つ持つと「片方だけ直して片方が古い」が起き、このチケットが
  潰そうとしている構図そのものになるため。`pricing.test.js` は import に置き換え
  （`assert.ok` → `throw new Error` に変えただけで、検出する記法も文面も同じ）
- `.github/workflows/jekyll.yml` — 既存の `Verify build output` ステップの末尾で
  `node scripts/check-plan-catalog.mjs || fail=1` を呼ぶ。**新規ステップを足さず既存に
  寄せた**のは、ずれを検知しても他の検査結果をまとめて出してから終わらせるため
  （`fail` 変数に集約する既存の作法をそのまま使う）
- `_data/plans.yml` — `max_contracts` のキー凡例に、突き合わせを行うスクリプト名と
  「到達できないときは素通しする」という方針を追記（コメントのみ・値は変更なし）

### ⚠️ デプロイを外部サービスの可用性に人質に取らせない

終了コードの方針:

| 状況 | 挙動 |
|---|---|
| シークレット未設定 | `::warning::` → **exit 0** |
| ネットワーク断 / タイムアウト（10 秒） | `::warning::` → **exit 0** |
| 5xx | `::warning::` → **exit 0** |
| 401 / 403（鍵が無効・失効） | `::warning::` → **exit 0**（監視が効いていないと分かる文面にする） |
| sandbox が返った / 0 件 / 形が違う | `::warning::` → **exit 0** |
| catalog に列が無い | `::warning::` → その項目だけ飛ばして続行 |
| **取得に成功して値が食い違った** | `::error::` → **exit 1** |

Supabase や Worker が落ちている間サイトを更新できない、という状態は作らない。
**落とすのは「取得できて、食い違ったとき」だけ。**

### 突き合わせる項目と単位

| `_data/plans.yml` | `plan_catalog` |
|---|---|
| `included_hours` × 60 | `included_minutes`（シート課金は `included_minutes_per_seat`） |
| `price` | `monthly_price_jpy` |
| `max_contracts` | `max_contracts` |
| `min_seats` | `min_seats` |

**比較は「分」で行う。** 時間に割ってから比べると割り切れない値で浮動小数の誤差が入り、
一致しているのに落ちる／逆に見逃す。

**合計時間（Light 15h / Pro 80h）は突き合わせない。** `included_hours × max_contracts` の
導出値でどこにも手書きされていないため、元の 2 つが合っていれば必ず合う。

サイトに載っているのに catalog に無いプランは **落とす**（申し込めないプランの広告）。
逆に catalog にあってサイトに無いプランは **落とさない** — `pro_legacy_unlimited` の
ような `is_public=false` の枠があるため。`is_public=true` のときだけ warning を出す。

### シークレットは未登録（要対応）

`gh secret list` で確認したところ `deepmosaic/deepmosaic.github.io` にリポジトリ
シークレットは 1 件も無い。**`SUPABASE_PROXY_API_KEY` を登録するまでこの検査は毎回
skip される**（CI は緑のまま＝デプロイは止まらないが、乖離も検知できない）。
登録して初めて監視が効く。値は Worker `deepmosaic-supabase-proxy` の `PROXY_API_KEY`。

### 採らなかった案

**案A（ビルド時に catalog を取得して `_data/` を生成）** — 却下。サイトのデプロイが
Supabase の可用性に縛られる。フォールバック値を置けば回避できるが、**それはまさに
今潰そうとしている重複そのもの**で自己矛盾する。加えてビルド結果が実行時刻に依存し、
再現性が失われる。

**案B 単独** — 不十分。ドリフトは検知できるが **サイト内の重複 5 箇所はそのまま残る**。
1 箇所直して 4 箇所忘れる事故は CI が赤くなるまで気付けず、直す手間も 5 倍のまま。

**案C 単独** — 不十分。サイト内の重複は消えるが、**Supabase とサイトの乖離**
（いちばん恐れている「実在しない条件を広告する」事故）を検知できない。

### 検証（ローカル）

実鍵を使わずにスタブサーバ（`127.0.0.1:8791`、live の `plan_catalog_seed.sql` と同じ行を
返す）を立て、ダミーの `SUPABASE_PROXY_API_KEY` と `PLAN_CATALOG_URL` の上書きで
全分岐を通した。`PLAN_CATALOG_URL` は **このローカル検証専用**で CI では設定しない。

- 一致 → exit 0 ／ `max_contracts` をずらす → exit 1 ／ 込み時間をずらす → exit 1
- 401 / 503 / 到達不能 / sandbox / 0 件 / 列なし → いずれも `::warning::` で exit 0
- `_data/plans.yml` の Light を `max_contracts: 3` → `4` に改ざんして CLI と `npm test`
  の両方が落ちることを確認し、md5 照合で元に戻した
- 鍵なしで CI の `Verify build output` ステップ全体を再現 → exit 0（緑のまま）
- スタブが一致しないときは同ステップが exit 1 になることも確認

なお **MODE=ok（live seed どおりの値）で一致した**ので、現在の `_data/plans.yml` が
本番 `plan_catalog` と揃っていること自体もこの検証で裏が取れている。

## 2026-08-02 (8) - Feature: ヒーロー画像をモザイク適用済みに差し替え (TICKET-SITE-35)

**誤認対策で唯一やり残していた項目。** 移行前のヒーロー（LCP 要素・ページ最大面積）は
`edit-player.webp` で、素の映像に検出枠が重なっただけの絵だった。「AI が顔を見つけた。
映像は素のまま」という画が最上部にあると、「Deepmosaic はモザイクを *除去* するソフト」
という誤認を訂正するどころか強化してしまう。**文言だけの対策には天井がある**ため、
絵そのものを差し替えた。

- `assets/img/screenshots/edit-player-mosaic.webp` を追加（1256×898 / 40KB）。
  front の撮影ハーネスが `edit-player.png` と同アングルでモザイク適用プレビューを
  ON にして撮ったもの
- `index.html` — ヒーローの `src` を差し替え、alt を暫定版（「枠の内側にモザイクを
  かける」）から確定版（「モザイクがかかった状態をプレビュー」）へ
- `docs/index.html` は **bbox 版のまま据え置き**。「プレイヤーとタイムライン」節は
  検出枠そのものの説明なので bbox 版が正しい。用途が違うので 2 枚持つ

寸法が旧画像と同一（1256×898）なので `width` / `height` の変更は不要だった（CLS 影響なし）。

### ⚠️ `scripts/optimize-images.mjs` を素で流すと巻き添えが出る

CLAUDE.md は「スクショをコピーしたら必ず `node scripts/optimize-images.mjs --apply` を
通すこと」と書いているが、**このスクリプトは `assets/img` と
`assets/img/screenshots` の PNG を全部変換して元 PNG を削除する**。今回そのまま流したら、
目的のスクショ 1 枚に加えて**既存の PNG 13 枚が WebP 化され、PNG が消えた**。

とくに `assets/img/logo-font.png` は `_includes/schema/organization.html` の
Organization ロゴ URL として参照されているため、消すと JSON-LD のロゴが 404 になる。
巻き添え分は `git checkout -- assets/img/` で戻した。

**1 枚だけ変換したいときはスクリプトを使わず ffmpeg を直接叩くこと:**

```
ffmpeg -i assets/img/screenshots/<name>.png -c:v libwebp -quality 82 \
       -compression_level 6 assets/img/screenshots/<name>.webp
```

（スクリプト側に「対象を絞る引数」を足すのが本筋。未対応）

## 2026-08-02 (7) - Change: Pro の実効単価「¥245 / 時間」の表記を削除

込み時間 40 時間を**使い切った場合**の単価で、実際にそこまで使うユーザーは限られる。
最良ケースの数値を代表値のように見せることになるので外した
（「検証できる数値だけを出す」という `_data/site.yml` の原則と同じ考え方）。

- `_data/plans.yml` — Pro の `summary` から「込み時間まで使った場合の実効単価は
  ¥245 / 時間です。」を削除
- `index.html` — ROI 計算機の noscript フォールバックから
  「1 時間あたりに直すと約 ¥817、込み時間の 40 時間まで使えば ¥245 / 時間まで
  下がります。」の 1 文を削除

ROI 計算機の JS 側には時間単価の表示が無いことを確認済み（`src/` に該当なし）。

## 2026-08-02 (6) - Change: 複数契約を「準備中」から提供開始の表記へ + 最大契約数を明示

**「準備中です」は実態と合わなくなっていたので外した。** 判断の根拠は
`worker-auth0-updater/src/checkout.ts` が Checkout セッションに
`adjustable_quantity[enabled]=true` / `maximum = 上限 - 既存契約数` を付けていること。
Worker をデプロイした時点で、**出荷済み v2.1.0 のアプリからでも Stripe の決済画面上で
本数を増やせる**。アプリ内の本数セレクタ（`PlanSelectDialog`）は UX 改善であって
ゲートではないため、アプリの再出荷を待つ必要がなかった。

⚠️ **ただし注記そのものは残す。**「上限時間の適用は順次開始します」の部分は生きている
（上限時間はアプリ側でまだ強制されていない）。注記を空にできるのは上限の適用開始後。

- `_data/plans.yml` — `rollout_note` を提供開始の文面へ。アプリ
  `PlanSelectDialog.svelte` の注記と**一字一句同じ**にしてある
- `_data/faq.yml` — 「上限時間を超えたら」の回答から「準備中」を外し、本数を明記。
  この回答は FAQPage の JSON-LD として検索結果にも出る
- `docs/index.html` — 同じ文面が **2 箇所にハードコード**されていたので両方差し替え
  （`plans.yml` を参照しておらず、片方だけ直すと食い違う構造）
- `_data/plans.yml` — Light / Pro の `specs` に「追加契約」行を追加
  （Light: 最大 3 契約・月 15 時間まで / Pro: 最大 2 契約・月 80 時間まで）

### ⚠️ 最大契約数はここが「二重管理」になる

**本数の正 (SSOT) は Supabase `plan_catalog.max_contracts`。** front の
`src/lib/plan/contract-options.ts` は「**コードに数値をハードコードしてはならない**」と
明記しており、アプリは catalog から本数を引いている。しかし**サイトは静的サイトで
Supabase を読めないため、`_data/plans.yml` と `_data/faq.yml` だけが手動の複製になる**。

Supabase の `max_contracts` を変更したら、必ずこの 2 ファイルも直すこと。
現行値は light=3 / pro=2 / enterprise=1 / free=1
（`docs/supabase/plan_catalog_seed.sql`）。Enterprise はシート単価で自己申込を
塞いでいるため複数契約の対象外。

## 2026-08-02 (5) - Change: 未使用分の翌月繰越を撤去

**繰越は不要と判断したので、サイトから表示と計算ロジックを消した。** 対象は Light の
「未使用分は翌月繰越（最大 10 時間）」だけ (Pro / Enterprise は元から繰越なし)。
Supabase `plan_catalog.carryover_max_minutes` は **sandbox / live とも 0 に更新済み**で、
非ゼロが 0 件であることを検証クエリで確認してある。

- `_data/plans.yml` — Light の `carryover_hours` を 10 → null (**キーは残す**)。
  `specs` から「未使用分 | 翌月繰越（最大 10 時間）」の行を削除。
  ヘッダの「上限時間・繰越はまだ強制されていない」から繰越を外す
- `src/lib/pricing.js` — `Tier` の typedef から `carryover_hours` を削除。
  `planBreakdown` の繰越行を撤去
- `src/lib/pricing.test.js` — 内訳文の期待値を `'月 5 時間込み'` に更新し、
  **繰越が復活していないことの回帰テスト**を追加 (従量課金の回帰固定と同じ趣旨)

**⚠️ DB の列は落としていない。** 出荷済み v2.1.0 の Rust は `carryover_max_minutes: i32` を
非 Option で受けているため、列を物理削除すると `GET /plan-catalog` のパースが失敗して
**プランカタログ全体が組み込みフォールバックに倒れる**。従量課金の撤去と同じく
「値を無効化し、列は残置してコメントで廃止を明記」の方針を取る。
新しい Rust から `carryover_max_minutes` フィールドを外すのは安全 (serde は未知フィールドを既定で無視する)。

`index.html` / `price/index.html` / `docs/index.html` / `_data/faq.yml` には元から繰越の記述が
無いことを grep で確認済み。ROI 計算機の推奨プラン・金額は変わらない
(Light は月 5 時間で候補外になる境界が繰越と無関係なため)。

## 2026-08-02 (4) - Change: 「粒度と隠蔽率を設定で固定できる」を「柔軟な編集機能」へ

トップページの 2 箇所（TRUST BAR の 2 列目の h2、MOSAIC セクションのタイトル）。
同一文言が 2 箇所に出ていたので両方を差し替えた。

⚠️ 見出しだけを変えたので、以下が未整合のまま残っている。コピーの意図が固まったら直すこと。

- TRUST BAR 2 列目の本文が「…カット内・同一 ID 内で**粒度が一定に保たれます**」のままで、
  「柔軟」と読み合わせると逆を向いて見える
- 同列のアイコンが `Ruler`（定規 = 固定のメタファー）のまま
- TRUST BAR 3 列目が「確認と修正の道具が揃っている」なので、守備範囲が重なる

## 2026-08-02 (3) - Change: 従量課金 (超過課金) の全面廃止をサイトに反映 (TICKET-OVERAGE-REMOVE)

**実在しない料金を広告している状態だった。** 製品側で従量課金を廃止し、Supabase の
`plan_catalog` から超過単価・Stripe 価格 ID・メーター名を null 化、Stripe の従量 price 3 本を
archive、メーター `deepmosaic_overage_minutes` を deactivate 済み。にもかかわらずサイトは
「超過単価 Light ¥800 / Pro ¥500 / Enterprise ¥300」を掲載し続けていた。FAQ は FAQPage の
JSON-LD としても出力されるため、構造化データにまで誤った価格が載っていた。

- `_data/plans.yml` — 全プランの `overage_per_hour` を null 化。`specs` から「超過単価」の行を
  3 つとも削除。Pro の `note` を「超過料金は発生しません」に。`rollout_note` を新告知文へ
- `_data/faq.yml` — 「上限を超えたら」の回答から超過単価を全除去
- `index.html` — ROI 計算機の noscript 試算「Light ¥8,580 (月 5 時間込み + 超過 7 時間 × ¥800)」は
  超過が無くなった時点で成立しないため、月 12 時間は Pro (月 40 時間込み) で ¥9,800 固定に差し替え
- `price/index.html` / `docs/index.html` — description と告知文から超過単価を除去
- `llms.txt` — 索引の「3 プランと超過単価」→「3 プランと込み時間」
- `src/lib/pricing.js` — `overage_per_hour` を前提にした分岐を撤去。`bestSeatPlan` は
  「プールを賄える最小シート数」で一意に決まるようになった
- `src/lib/pricing.test.js` — 期待値を新体系へ更新し、**従量課金が復活していないことの回帰テスト**を追加

**告知文はアプリ内 (`PlanSelectDialog`) と一字一句同一にしている。**
代替となる「同じプランを複数本契約する方式」(Light ×3 / Pro ×2) は**未実装**のため、
「準備中です」と書く。断定すると未実装機能の広告になる。

**既知の副作用** — ROI 計算機の推奨が変わる。月 12 時間の既定値は Light ¥8,580 → **Pro ¥9,800**、
年間削減額は ¥1,625,040 → **¥1,610,400**。また **Pro の込み時間 40 時間を 1 時間でも超えると
Enterprise (3 シート ¥24,000) に跳ぶ**。本来ここは Pro×2 (¥19,600) が該当するが未実装のため、
複数契約の実装後に `monthlyCost` を更新すること (該当箇所に NOTE を残してある)。

## 2026-08-02 (2) - Feature: ダウンロードの流入経路を引き継ぐ (TICKET-SITE-37)

**実測で 2 つとも壊れていた。** `?utm_source=x` で着地して DL を押しても、
`app_downloads` に記録されるのは:

- `utm_source` / `utm_medium` / `utm_campaign` … **全部 NULL**
  （別ページを経由すると URL から消えるため）
- `referrer` … **`https://www.deepmosaic.co.jp/`**（自サイトのオリジンのみ）

後者が特に致命的で、GitHub Pages 配信では `Referrer-Policy` を指定する手段が無く、
既定の `strict-origin-when-cross-origin` ではクロスオリジンの worker へ自オリジンしか
送られない。**つまりヘッダ経由では「どこから来たか」が永久に取れない。**

- [x] **TICKET-SITE-37**: 着地時に拾って DL リンクへ載せ直す
  - `src/lib/attribution.js` を新設（純関数のみ。DOM / sessionStorage に触らないので
    `node --test` でそのまま検証できる。テスト 23 件）
  - `src/main.js` の `initDownloadTracking()` が唯一の impure な部分。
    着地時に `utm_*` と**外部**参照元を `sessionStorage.dm_attr` へ置き、
    `a[data-dl]` の href に載せる
  - **`data-dl` が計測の目印。** 全 DL ボタン（hero / header / footer / cta /
    料金カード 3 種 / モバイルドロワー）に付けた。値は GA4 の `link_id` になる
  - **書き換えは読み込み時が主。** クリック委譲だけだと中クリック・右クリックの
    「リンクのアドレスをコピー」・ステータスバー表示・D&D で utm が全部落ちる。
    クリック側は後から生えた `<a>` の保険と GA4 送信のためだけに使う
  - **モバイルドロワーの DL リンクは Svelte が後から描画する**ので、
    `main.js` が mount 前に `data-dl-attr` を書き込み、`MobileNav.svelte` が
    同じ純関数で href を組む（Svelte のスケジューリングに依存しない）
  - **last non-direct。** utm も外部参照元も無い着地では上書きしない。
    項目ごとにマージせず record ごと差し替える（片方だけ更新すると
    「`utm_source=twitter` なのに `ref=google`」という無い経路ができる）
  - GA4 に `file_download` を手動送信。拡張計測の同名イベントは ON だが、
    現行 URL は**拡張子が無いので自動発火しない** → 二重にならない。
    パラメータ名は公式に揃えたのでカスタムディメンション登録は不要
  - **JS が動いたときの上乗せに限る。** 素の href は Liquid が出したままなので、
    JS 無効・バンドル読み込み失敗・広告ブロッカーでも DL は今までどおり落ちる
  - セキュリティ: 値の出所は着地 URL のクエリ = 攻撃者が自由に作れる。
    許可リストで弾き、worker と同じ上限で切り、`URL` + `searchParams.set()` でしか
    組み立てない（文字列連結だと `#` 以降が fragment になり `&` の注入も通る。
    `a.href = <クエリ由来の値>` は `javascript:` すり替えが成立する）。
    セレクタを `a[data-dl]` に限定して、問い合わせフォーム等への漏洩も防ぐ
  - CI に回帰ガードを 3 つ追加（`data-dl` の存在 / バンドルの配線 / 素の href に
    クエリを焼き込んでいないこと）
  - **worker 側 (`front/worker-r2-proxy`) にも最小の変更が要った** — TICKET-DASHV7-5 参照

### レビュー指摘の反映

- **重複排除が 500ms の固定バケットだった。** 境界をまたぐと同一操作が 2 回送られ、
  逆に 500ms 以内の正当な 2 回目を取りこぼす。直近の送信時刻を保持する方式に変更
- **CI ガードが `set -euo pipefail` の下で落ちていた。** `grep -o` が 0 件で exit 1 を
  返し、`pipefail` 経由で代入コマンドごとスクリプトが終了する。つまり
  **`data-dl` が消えたときこそ**診断メッセージが出ないまま生の shell エラーになる。
  `|| true` で件数を受け取る方式に変更（**既存の FAQ 件数チェックにも同じ穴があった**ので併せて修正）
- **末尾ドット付きの自ホスト**（`https://www.deepmosaic.co.jp./x`）が同一オリジン判定を
  外れ、サイト内回遊が「外部からの流入」として正規の経路を上書きしうる状態だった。
  正規化してから比較する

### 検証（ローカルのビルド出力に対して実測）

- 着地 → 別ページへ回遊 → DL リンク 8 本すべてに utm が載る。未装飾は 0 本
- 外部オリジンから流入 → `ref` に相手の origin だけが入る。**サイト内回遊では上書きされない**
- `click` と `auxclick` の両方を投げても GA4 は **1 回だけ**送られる
- 他のリンク（問い合わせ / GitHub）に utm が漏れていない
- 実クリックがエンドツーエンドで届いた（`app_downloads.referrer` に外部 origin が記録された）

## 2026-08-02 - Feature: 「モザイク除去アプリ」という誤認の是正 (SEO / AI 認識)

「モザイクを **除去** するアプリ」だと誤認して DL・利用するユーザーが後を絶たない、
という報告を受けての対応。検索エンジンと AI（ChatGPT / Claude / Perplexity /
AI Overviews）の双方に、製品の **方向**（モザイクを付加する側）を認識させる。

調査の結論: 原因は「誤誘導する文言がある」ことではない。**「除去」「解除」
「uncensor」は製品説明文脈に 1 件も存在しなかった**。問題は逆で、
**方向を明示している箇所がほぼ無かった**こと。サイトの主要動詞は「モザイク処理」
「モザイク作業」で、日本語としてかける／外すの両方向を指す。h1 も `<title>` も
方向が空白で、FAQ 10 件に「除去できますか」は無かった。

### Phase 0 — 遮断の解除

- [x] TICKET-SITE-24: Cloudflare の AI クローラ遮断と Managed robots.txt を解除（運用作業・リポジトリ変更なし）

### Phase 1 — 単一真実源

- [x] TICKET-SITE-25: `_data/entity.yml` 新設（製品定義・できること／できないこと・分類）

### Phase 2 — 人が読む面

- [x] TICKET-SITE-26: HERO に kicker を追加 + `hero.sub` をカテゴリ宣言に + `_includes/what-is.html` 新設
- [x] TICKET-SITE-27: FAQ に誤認訂正の Q&A を 3 件追加（10 → 13 件）
- [x] TICKET-SITE-28: DL ボタン直下の注記行 + `/price/` `/spec/` のリード文に製品カテゴリ
- [x] TICKET-SITE-29: `/mosaic-removal/` 新設 + フッター導線 + `_includes/can-cannot.html` 抽出
- [x] TICKET-SITE-30: `/docs/` の定義文に否定を追記 + 「透けます」を書き換え

### Phase 3 — 機械が読む面

- [x] TICKET-SITE-31: head の是正（`seo_title` 導入 / title サフィックス / meta robots / keywords・hreflang 削除 / 404 の description）
- [x] TICKET-SITE-32: JSON-LD 強化（`@id` / `disambiguatingDescription` / `featureList`）
- [x] TICKET-SITE-33: `llms.txt` / `llms-full.txt` 新設 + `robots.txt` に方針を明文化 + `assets/robots.txt` 削除

### Phase 4 — 画像

- [x] TICKET-SITE-34: 画像 alt を方向が伝わる文面へ（+ alt と実画像の不一致・`company/about.html` の欠陥を修正）
- [ ] TICKET-SITE-35: ヒーロー画像をモザイク適用済みのキャプチャへ差し替え（front の撮影ハーネスは対応済み・撮影は未実施）

### Phase 5 — 回帰防止

- [x] TICKET-SITE-36: CI に素通しファイルの HTML 化検知と主要文言のガードを追加 + CLAUDE.md 更新

---

### TICKET-SITE-24 の記録 — Cloudflare（2026-08-02 実施・リポジトリ変更なし）

**この対応の中で唯一「確実に効く」施策**だったので、まず実測から入った。UA を変えて
本番に GET したところ、GPTBot / ClaudeBot / CCBot / OAI-SearchBot / Claude-SearchBot /
PerplexityBot / ChatGPT-User / Amazonbot / meta-externalagent が**すべて 403**、
Googlebot / bingbot だけが 200 という状態だった。

原因は Cloudflare 側の **2 つの独立した設定**で、片方だけ切っても解決しなかった。

1. **AI Crawl Control → シグナル →「管理された robots.txt」がオン**
   origin の robots.txt に `Content-Signal: search=yes,ai-train=no,use=reference` と
   Amazonbot / Applebot-Extended / Bytespider / CCBot / ClaudeBot /
   CloudflareBrowserRenderingCrawler / Google-Extended / GPTBot / meta-externalagent の
   `Disallow: /` を注入していた。→ **オフにした**
2. **セキュリティ → 設定 →「AI ボットをブロック（9月15日に廃止予定）」が
   「すべてのページでブロック」** ← **403 の実体はこちら**
   Cloudflare 管理ルールが AI ボットの UA に 403 を返していた。
   → **「ブロックしない（クローラーを許可する）」に変更して保存**

新しい「AI ボット ポリシー」（検索 / エージェント / トレーニング）は 3 つとも
最初から「許可」だったが、2026-09-15 までは**レガシー設定のほうが有効**なので、
新ポリシー側を見ているだけでは原因にたどり着けない。

AI Crawl Control のクローラ一覧では 15 件が個別ブロック状態
（ClaudeBot / GPTBot / CCBot / Claude-User / Amazonbot / Bytespider /
meta-externalagent / PetalBot / Anchor Browser / Arquivo / FacebookBot /
Google-CloudVertexBot / Novellum / TikTok Spider / Timpibot）だったが、
**個別トグルは `disabled` で操作できなかった**。上記 2 つを解除したところ
32 件すべてが自動的に解除された。個別トグルはレガシー設定の従属表示だったと考えられる。

**当初の診断の訂正**: 「ChatGPT / Claude / Perplexity はサイトを一度も読めていない」と
書いたが、これは言い過ぎだった。ダッシュボードの実績値では Claude-SearchBot 許可 14 /
ChatGPT-User 許可 3 / Applebot 許可 3 と、**回答系のボットは部分的に通っていた**。
完全に 0 件だったのは **学習系（ClaudeBot / GPTBot / CCBot は許可済み 0）**。
curl での 403 は、検証されていない IP から UA を詐称したために管理ルールに
捕まったもので、正規 IP の検証済みボットとは挙動が異なっていた。

解除後の実測: 上記 14 UA すべてが 200。`/robots.txt` から `Content-Signal` と
`Disallow` が消えたことも確認。

⚠️ Bytespider / PetalBot / TikTok Spider / Anchor Browser / Novellum / Timpibot は
**誤認訂正には寄与しない**（これらの回答に Deepmosaic が出てくることはまず無い）。
帯域が気になるなら AI Crawl Control で個別に再ブロックしてよい。

### 語彙ポリシー（この対応の中核となる判断）

「除去」という語を **置く面と置かない面を厳密に分ける**。打ち消しコピー自体が
「モザイク 除去」クエリとの関連度を上げ、**より多くの誤認流入を呼び込む逆効果**を
持つため。

| 面 | 「除去／解除」 | 理由 |
|---|---|---|
| `<title>` / h1 / kicker / トップ本文 | 置かない（「取り除く」で言い換え） | ランキング要因。汚すと除去クラスタへ引き寄せられる |
| トップの `meta description` | 置く（1 句） | ランキング要因ではなくスニペット専用。SERP でゼロコスト濾過できる |
| `_data/faq.yml` の質問文 | 1 件だけ置く | ユーザー自身が Ctrl+F / 検索窓に打つ語に一致させる価値が上回る |
| `/mosaic-removal/` | ここに集中 | 封じ込めシンク。**他社ツールへのリンクは張らない**（トピック関連性を渡すため） |
| JSON-LD / `llms.txt` | 置く | 検索順位に無関係な面 |

「モザイク除去」ヘッドタームを正面から狙わないのも同じ理由。あの SERP は
無修正化ツールのクラスタで、そこへ入ると Deepmosaic というエンティティが
そのクラスタへ引き寄せられる。9 ページ・被リンク僅少のブランドサイトでは
**リスクだけ取ってリターンが出ない**。`/mosaic-removal/` はブランド修飾の
ロングテール（`deepmosaic 除去` 等）だけを取りにいく。

### TICKET-SITE-25 の記録 — `_data/entity.yml`

訂正文はトップ本文 / JSON-LD の `disambiguatingDescription` / `llms.txt` / FAQ /
`/mosaic-removal/` の 5 面に出す必要があるが、**文面が食い違うと訂正として
機能しない**。単一真実源を切った。

採用した定義文の構造は「主語 → 動作 → 対象 → カテゴリ」で 1 文目を自己完結させ、
否定を独立した 2 文目にする形。**どこで切られても誤認が生じない**のが狙いで、
1 文目だけ抜き出されても製品が確定し、2 文目だけ抜き出されても主語が残る。

> Deepmosaic は、動画に映った対象（局部・顔）を AI が自動検出し、その領域に
> モザイクをかける Windows デスクトップアプリケーションです。モザイクを
> 除去・復元する機能はありません。

検討して**採らなかった**案:

- 「Deepmosaic はモザイクを『かける』ソフトです。モザイク除去ソフトではありません。…」
  — 2 文目で「モザイク除去ソフト」という文字列が**製品名の直後**に来る。断片引用で
  共起だけが残る危険があり、SERP タイトルにも出やすい
- 「モザイク処理を AI で自動化する〜」を 1 文目にする案 — 「モザイク処理」は
  方向を含まないので、1 文目だけでは誤認が残る（現行サイトの失敗そのもの）

### TICKET-SITE-26 の記録 — h1 を変えなかった理由

h1「モザイク作業を／最終確認だけに。」は TICKET-SITE-06 で根拠付きで決めた
ブランドコピーなので温存し、直前に kicker を 1 行足して方向を補う形にした。
h1 自体を「モザイクをかける作業を」に変える案も検討したが、コピーの決定を
SEO の都合で上書きしないことを優先した。`section-title.html:10` が既に
`kicker` の概念を持っているのでデザイン言語としても整合する。

`hero.sub` は第 1 文を差し替えた。移行前は「AIが全編を検出してトラッキングし」で
終わっており、**検出した後に何をするのか（モザイクをかける）が書かれていなかった**。
LLM は先頭付近の自己完結した文を製品定義として抜き出すため、ここが空白だと
誤認が訂正されない。

`_includes/what-is.html` は hero の定義文を**繰り返さず**、できること／できないことの
列挙に専念する。表・箇条書き・対比は LLM が最も抽出しやすい形式で、「できないこと」を
独立した見出し付きリストにすることで「モザイク除去はできるか」という質問に
**回答可能な塊**が本文中に生まれる。

### TICKET-SITE-27 の記録 — FAQ の配置順

先頭 2 件（「どのようなソフトですか」→「除去できますか」）は**配列の位置そのものが
設計判断**。表示の 1・2 番目になると同時に FAQPage JSON-LD の `mainEntity[0]/[1]` に
なり、LLM は前方の要素を優先的に拾う。肯定 → 否定の順にしたのは、否定から始めると
ページが弁明調になるため。

`_includes/faq.html`（表示）と `_includes/schema/faq.html`（JSON-LD）が
`_data/faq.yml` の同一データ源から生成されるので、**YAML に足すだけで両方に反映**
された。include 側は無改修。TICKET-SITE-05 で作った構造の配当。
`Accordion.svelte` も `querySelectorAll('details')` で件数非依存なのでアイランド側も無改修。

### TICKET-SITE-28 の記録 — 打ち消しをどこに置くか

**採用**: ヒーロー CTA 直下の注記行 / `cta-download.html` の注記行 /
`/price/` `/spec/` のリード文 / FAQ。`cta-download.html` は トップ末尾・`/price/`・
`/spec/` の 3 箇所で展開されるので、**1 箇所の変更で 3 つの DL ボタンを塞げる**。

注記行は既存の ✓ 付き 3 項目 flex 行には**混ぜていない**。利点リストに否定文が
並ぶと読み手が引っかかるため、✓ なしの独立行にして「事実の但し書き」として読ませる。

**不採用**とその理由:

- h1 上のバッジ — TICKET-SITE-18 でレビュー指摘により削除済みの形式。同じ位置に
  同じ形で戻すのはその判断を無効化する。kicker があれば同じことを 2 回言うだけになる
- 独立した打ち消しセクション — 誤認ユーザーはヒーローで DL するので下部の
  セクションには到達しない。かつ「除去」語の露出面積が最大になる
- DL ボタン押下前の確認ダイアログ — 全訪問者に摩擦を課す一方、誤認ユーザーは
  「はい」を押すだけで通過率が高い。JS 無効時は素通りで中途半端
- フッター — TICKET-SITE-19 で会社説明ブロックを削除済み。全ページ共通なので
  `/company/privacy` 等にも出て、誤認削減に寄与しないページを冗長にする

### TICKET-SITE-29 の記録 — `/mosaic-removal/`

「モザイク除去」ヘッドタームを狙いにいくページではない。**サイト内で「除去」という
語を 1 URL に集中させるシンク**であり、SERP のタイトルに「モザイク除去ソフトでは
ありません」と出して**クリック前に自己判定させる**のが主目的。

設計上の縛りを 3 つ、ファイル冒頭のコメントにも残した:

- **`noindex` を付けない。** 付けたらインターセプトが成立しない
- **他社ツールへのリンクを張らない。** 「除去したい人はこちらへ」と親切心で外部
  リンクを張ると無修正化クラスタへトピック関連性を渡してしまい、封じ込め設計が崩れる
- **ダウンロードボタンを置かない。** 誤認して来た人を DL へ誘導するのは目的に反する

配置はリポジトリ直下の `mosaic-removal.html` + `permalink: /mosaic-removal/`。
`src/app.css:11` の `@source "../*.html"` が直下の .html を既に走査しているため、
新ディレクトリを作る場合に必要な `@source` 追加が要らない（`/spec/` 新設時は
TICKET-SITE-01 で追加が必要だった）。

`can` / `cannot` の 2 カラム markup はトップの「Deepmosaic とは」と共通なので
`_includes/can-cannot.html` に抽出した。

**フッターのアンカーテキストに「除去」が入る件**（＝全 11 ページに 1 回ずつ出る）は
意図的。ビルド出力で確認した分布は以下で、`<title>` / `<h1>` / 本文への混入は無い:

| ページ | 「除去」出現 | 内訳 |
|---|---|---|
| `/mosaic-removal/` | 10 | シンク本体 |
| `/`（トップ） | 3 | FAQ 質問文（表示 + JSON-LD）+ フッター |
| その他 9 ページ | 各 1 | フッターのアンカーのみ |

フッター内リンクはボイラープレートとして強く減点される位置であり、かつ
**アンカーテキストは「このURLがモザイク除去について書かれたページだ」という
関連度をシンク側へ渡す**ので、封じ込め設計と矛盾しない。

### TICKET-SITE-30 の記録 — `/docs/` の「透けます」

`docs/index.html` の不透明度の説明「モザイク/ぼかしの濃さ（0〜100%）。**下げると
元の映像が透けます**」は、意味としては正しいが**単独で抜粋されると「モザイクを
透かせる機能がある」と誤読され得る**、サイト内で唯一の表現だった。意味を保ったまま
「値を下げるほど隠蔽が弱くなる」に言い換え、既存の確定語彙（隠蔽率）に寄せた。
あわせて運用上の既定（通常は 100%）を明示している。

同じ設定をトップの MOSAIC タブでも説明しているため、`_data/mosaic.yml` の
「濃さ」も「不透明度」に統一した。

### TICKET-SITE-31 の記録 — head

**`seo_title` の分離**: `title` はパンくず JSON-LD と可視パンくずが使うので、SEO 用の
文字列と兼用できない。`seo_title` があればそれを丸ごと使い、無ければ
`title｜<共通サフィックス>` を組む（従来動作の後方互換）。

共通サフィックスを「Deepmosaic - AI動画モザイク処理ソフト」→
「Deepmosaic - 動画にモザイクをかけるAIソフト」に変更。移行前のトップは全角約 34 文字で、
**切り詰められたうえ方向が不明**という二重の欠陥だった。ビルド後の全 11 ページの
`<title>` を全角換算で測って 30 文字以内に収めてある（最長は `/spec/` の 26.5）。

**削除したもの**:

- `keywords` メタと `_data/lang/ja.json` の `keywords_seo` — Google は 2009 年に無視を
  公言、Bing はスパム材料になりうると明言。加えて元の値は「モザイク編集ソフト」
  「AI モザイク処理」など**方向を含まない語**ばかりで、目的に逆行していた。方向を
  絞った語は JSON-LD の `keywords`（`_data/entity.yml`）へ移した
- `hreflang`（ja / x-default の 2 行）— 別言語版が実在せず、同一 URL への自己参照は
  Google に無視されるノイズ。英語版を出すときに実在の代替 URL を伴って復活させる

**追加したもの**: `max-snippet:-1, max-image-preview:large, max-video-preview:-1`
（AI Overviews は検索インデックスのスニペットを使うので、上限が外れると引用余地が広がる）、
`twitter:title` / `twitter:description` / `og:image:alt` / `twitter:image:alt`、
`page.og_image` の受け皿（将来「モザイク適用前 → 適用後」の OG 画像を出すため）。

⚠️ **`noarchive` / `nocache` は追加しないこと。** Microsoft はこの 2 つを Bing Chat /
Copilot での生成 AI 利用の可否として扱っており、入れた瞬間に Copilot から消える。
`_layouts/default.html` と `robots.txt` の両方にこの注意を書いてある。

`_data/lang/ja.json` の `meta_desc` も第 1 文を「モザイク処理を AI で自動化する」から
「対象を AI が自動検出してモザイクをかける」に差し替えた。この値は JSON-LD の
`description` に入る。

### TICKET-SITE-32 の記録 — JSON-LD

`@id` を付けたのが構造上いちばん効く。この include は `/` `/price/` `/spec/` の
3 ページで展開されるが、`@id` が無いと **匿名ノードが 3 つ**できてクローラは同じアプリだと
判断できない。ID を固定すると 3 ページの記述が 1 エンティティにマージされ、
`publisher` から Organization の `@id` を参照してグラフが繋がる。

`disambiguatingDescription` は schema.org の Thing プロパティで、定義が「似た項目と
区別するための短い説明」。**今回の課題への直球**。日英を連結して入れている
（LLM は言語をまたいで読むので分けるより取りこぼしが少ない）。
`description`（マーケ用要約）とは schema.org の定義どおり役割を分け、片方に寄せていない。

⚠️ ただし `disambiguatingDescription` は Google のリッチリザルトには**使われない**
（効果不明）。JSON-LD を読む LLM に対する低コストな保険という位置づけで、これで誤認が
直ると考えないこと。

**意図的に入れなかったもの**:

- `aggregateRating` — レビュー実体が無い。捏造は Google のスパムポリシー違反であり、
  「検証できる数値だけを出す」（`_data/site.yml`）の原則にも反する
- `softwareVersion` — DL URL が `/download/latest/windows` 固定で単一真実源が無く、
  ハードコードすると必ず腐る
- `Product` との多重型 — Google の商品リッチリザルトは `aggregateRating` を要求するので
  表示面は増えず、Search Console に警告が積むだけ
- `WebSite` + `SearchAction` — サイト内検索が無いので、動作しない URL テンプレートを
  宣言することになる（虚偽の構造化データ）

`sameAs` は `https://github.com/deepmosaic` のみ。API で Organization の実在を確認済み
（このリポジトリのホスト元）。**`x.com/deepmosaic` は生存を確認する手段が無かったので
入れていない** — head の `twitter:site` は `@deepmosaic` を宣言しているので、
目視確認できたら `_includes/schema/organization.html` に追加すること。

ビルド出力の JSON-LD 19 ブロック全てを `JSON.parse` に通して構文エラーゼロを確認した。

### TICKET-SITE-33 の記録 — `llms.txt` / `robots.txt`

**`llms.txt` / `llms-full.txt`**: どちらも front matter の `layout: null` が必須
（`_config.yml` の `defaults` が `layout: default` を当てるため。TICKET-SITE-15 で
robots.txt が HTML 化した事故と同じ原因）。`.txt` は kramdown の `markdown_ext` に
含まれないので Markdown 変換はされず、`_config.yml` の変更も不要。

`llms-full.txt` は **`_data/*.yml` の射影だけで組む**。ページ本文は Tailwind クラス入りの
HTML で忠実な Markdown 化ができず、手書きすれば `_data` と二重管理になって必ず腐る。
`_data` の値には表示用の `<br>` と実体参照 `&gt;` が混ざっているので、
`replace: '<br>' → strip_html → 実体参照のデコード` の順で通している
（`strip_html` は実体参照をデコードしないため、これを忘れると `&gt;` が残る。実際に残った）。

⚠️ **`llms.txt` の実効性は「効果不明」。** 2026 年の計測では llms.txt ファイルの大半が
AI から 1 度もリクエストされておらず、Google は「Search には不要」と明記、OpenAI の
クローラ文書は言及していない。維持コストがほぼゼロなので置く、という位置づけ。
**誤認訂正の主戦場は TICKET-SITE-24（Cloudflare の遮断解除）と HTML 本文。**

**`robots.txt` はディレクティブを変更していない**（`User-agent: * / Allow: /` のまま）。
個別ボットの明示 `Allow` ブロックを**あえて書いていない**のは、robots.txt が
「最も限定的にマッチした User-agent グループ 1 つだけ」を適用し、名前付きグループが
`*` を**置き換える**ため。個別ブロックを書くと、将来 `*` に Disallow を足したときに
明示したボットだけがすり抜ける。全部 Allow の現状では機能差がゼロなので、事故の種だけが
残る。方針と各ボットの分類（回答用 / 学習用）はコメントに記録した。

`assets/robots.txt`（`User-Agent: * / Disallow:` だけの残骸）を削除。robots.txt は
オリジン直下でしか読まれないので誰にも読まれておらず、将来「どっちが正か」を迷わせるだけだった。

### TICKET-SITE-34 の記録 — 画像 alt

**事実と異なる alt は書かない**方針で、実画像を 1 枚ずつ開いて確認してから書き直した。

- `pr_image.webp`（`index.html`）— **トップで唯一モザイクが実写されている画像**
  （Premiere Pro のプログラムモニタで 2 人の顔にモザイク）。alt にもそう書いた。
  画像検索・スクリーンリーダー・AI クローラのいずれにも「付加する側」を伝えられる面
- `edit-overview.webp` — 旧 alt「右側にモザイク設定パネルが開いている」は**実画像と
  一致していなかった**（パネルは開いていない）。既存バグの修正を兼ねる
- ヒーローの `edit-player.webp` — 素の映像＋検出枠しか写っていないので、
  「枠の内側にモザイクをかける」と**枠の意味**を書いた。事実と矛盾させずに方向を伝える
  暫定案で、TICKET-SITE-35 の画像差し替え後に確定版へ更新する

あわせて `company/about.html` で見つかった既存の不具合を 3 点直した:

1. `<img src="bcu30.webp" width="200px">` に `alt` が無く、`width` の値に単位が付いていた
   （HTML の width 属性は整数のみでブラウザは無視する）。実寸 468x912 を入れ、
   表示サイズは inline style で指定して CLS を防いだ
2. 2 本の `target="_blank"` に `rel="noopener noreferrer"` が無かった
   （CLAUDE.md の security-reviewer 観点に挙がっている項目）
3. 「創業メンバー」節が**空の `<img >` と空の `<p></p>` だけ**で、公開ページに画像の
   破損アイコンが出ていた。中身が無いので節ごと削除した。付随して Materialize 時代の
   `row` / `col s2` グリッドクラスも消えた（Materialize は撤去済みでスタイルが
   当たっていなかった）

### TICKET-SITE-36 の記録 — CI ガード

`Build with Jekyll` に `--strict_front_matter` を足し、その後に `Verify build output` を
追加した。検査するのは 2 系統:

1. **素通しファイルの HTML 化検知** — `_config.yml` の `defaults` が全ページに
   `layout: default` を当てるため、`layout: null` を落とすと robots.txt / llms.txt /
   llms-full.txt が HTML でラップされる。**ビルドは成功するので、検査しないと無言で壊れる。**
   TICKET-SITE-15 で実際に踏んでいる
2. **誤認訂正の文言が消えていないこと** — トップの方向文言 / 注記 /
   `disambiguatingDescription` / `/mosaic-removal/` の存在 / FAQ の表示件数と
   FAQPage JSON-LD の件数一致

`CLAUDE.md` も更新した。**ゲート検証コマンドとして書かれていた
`--strict_variables` は Jekyll 4.4 の CLI に存在せず、実行すると invalid option で落ちる**
（＝これまで誰も実行できていなかった）。`_config.yml` の Liquid オプションとして
有効化することはできるが、`page.noindex` / `page.schemas` / `page.seo_title` など
**未定義キーの分岐を全て例外にする**ため、このサイトの設計とは両立しない。
ゲートは `--strict_front_matter` のみに修正した。

### 積み残し

- ⚠️ **本番にデプロイされているのは刷新前のサイト。** 2026-08-02 時点で `master` は
  origin より 15 コミット先行しており、`/spec/` `/mosaic-removal/` `/llms.txt` は
  すべて 404、トップの `<title>` も「AIで動画編集を一段上のレベルに」のまま。
  **AI クローラの遮断は解除できたが、今クロールされるのは古いサイト。**
  push するまでこの対応の効果は出ない
- TICKET-SITE-35 のヒーロー画像差し替えは、front の撮影ハーネス側の対応
  （`edit-player-mosaic.png` の追加）まで完了。撮影の実行は未実施
- `docs/index.html` の画像 8 枚に `width` / `height` が無い（既存。CLS の観点で
  CLAUDE.md の規約に反しているが、今回の誤認是正とは独立したトピックなので分離した）
- `_data/lang/en.json` は旧 deepmosaic.xyz 時代の残骸で参照ゼロ。
  `_data/lang/ja.json` にも未参照キーが多数残っている
- `_includes/schema/organization.html` の `sameAs` に `x.com/deepmosaic` を入れていない
  （生存を確認する手段が無かった）。目視確認できたら追加すること

## 2026-07-26 (2) - Fix: 刷新後のレビュー指摘の反映 + 料金プランをデザイン準拠へ

ユーザーレビューによる指摘 5 件。うち 4 件は文言・表記の削除で、1 件 (料金プラン) は
Phase 2 に予約していた `TICKET-SITE-20` の前倒し。

- [x] TICKET-SITE-17: セクションタイトルの読点を除去 (計 7 箇所)
- [x] TICKET-SITE-18: HERO の「セットアップ後はオフラインで動作」バッジを削除
- [x] TICKET-SITE-19: フッターの会社概要ブロック (説明文・社名・住所・メール) を削除
- [x] TICKET-SITE-20: 料金プランを新デザイン準拠の 3 プラン + Free 帯に刷新
- [x] TICKET-SITE-21: 特商法ページから郵便番号・所在地・電話番号の行を削除
- [x] TICKET-SITE-22: 登録デバイス表記を「同時起動 1 台」に統一
- [x] TICKET-SITE-23: 無料トライアルの表記を全廃 + Pro に「最も選ばれています」バッジ

> 予約 ID の変更: 当初 `TICKET-SITE-20` は「`/price/` 3 プラン刷新 (課金実装がゲート)」、
> `TICKET-SITE-21` は「`free.hours` 6→3 切替」として Phase 2 に予約していた。
> 20 は前倒しでここで消化し、21 は特商法ページの修正に振り替えた。
> Free 6→3 の切替は front 側の `FREE_USAGE_LIMIT_SECONDS` 変更と同時に行う。

### TICKET-SITE-17 — 読点の除去

対象 7 箇所 (`index.html` の front matter title / `_data/site.yml` の `hero.headline_lead` /
RELIABILITY・MOSAIC・INTEGRATION の `section-title` / PRIVACY の h3 / `spec/index.html` の CTA 見出し)。

`company/privacy.html` と `company/terms.html` の条文見出し (「通知・公表または同意取得の方法、
利用中止要請の方法」等) は **対象外**。あれは列挙の読点で、体言止めの区切りとして入れている
セクションタイトルの読点とは役割が違う。

### TICKET-SITE-19 / 21 — 住所・電話番号の削除

フッターの会社概要ブロックと、特商法ページの「郵便番号 / 所在地 / 電話番号」の 3 行を削除した。
`_includes/schema/organization.html` (JSON-LD) には元々住所・電話番号を持たせていないので、
構造化データ側に表記が残ることはない。

⚠️ **特定商取引法の表示義務との関係は要確認。** 通信販売の広告では「販売業者の氏名 (名称)・
住所・電話番号」が表示義務の対象とされており、消費者庁の運用では省略可能な項目に含まれない
と理解している。加えて決済事業者の審査でこの 3 項目を求められることが多い。削除自体は
指示どおり実施したが、公開前に判断を確認すること。残す場合の代替として「請求があれば
遅滞なく開示する」旨を明記する方式がある。

### TICKET-SITE-20 — 料金プランの刷新

新デザイン (`.dc.html` L422-490 / L629-692) 準拠。**有料 3 プランをカードで並べ、Free は
その下の横帯**にする (4 枚並べるとカードが細くなり仕様行が読めない)。振り分けは
`_data/plans.yml` の `display: card | strip`。

| | 月額 (税別) | 込み時間 | 超過単価 | その他 |
|---|---|---|---|---|
| Light | ¥2,980 | 月 5 時間 | ¥800/時間 | 未使用分は翌月繰越 (最大 10 時間) |
| Pro (featured) | ¥9,800 | 月 40 時間 | ¥500/時間 | 「最も選ばれています」バッジ |
| Enterprise | ¥8,000 / シート | シート数 × 40 時間をプール共有 | ¥300/時間 | 最低 3 シート・請求書払い |
| Free (帯) | ¥0 | 累計 6 時間 | — | クレジットカード不要 |

いずれのプランも **同時起動は 1 台** (TICKET-SITE-22)。デザインの「2 台（同時起動 1 台）」は
登録 2 台がアプリ側で未実装 (device_lock は単一端末 + takeover) なので、実装済みの
「同時起動 1 台」だけを書く。`rollout_note` の対象からも外した。

**無料トライアルは全廃** (TICKET-SITE-23)。クレジットカードを登録しなければ全員が Free
プランとして使えるので、試用期間を別に用意する意味がない (再トライアルの穴も作らない)。
`plans.yml` の `trial_days` は全プラン 0 で、`trial_days > 0` 駆動だったバッジは
データ駆動の `badge` フィールドに置き換えた (Pro = 「最も選ばれています」)。
サイト側の表記は `docs/`・`faq.yml`・カード・CTA からすべて外した。
**アプリ側の機能としての 7 日トライアル削除は front リポジトリ側の作業**
(`auth/env.rs::TRIAL_DAYS` / `auth/license.rs` / `src/lib/license.ts` / Stripe /
Supabase)。front の CHANGELOG を参照。

変更したファイル: `_data/plans.yml` (SSOT) / `_includes/pricing-cards.html` /
`_includes/download-button.html` (`variant` 追加) / `index.html` (PRICING 節・noscript・比較表) /
`price/index.html` (全面書き換え) / `docs/index.html` / `_data/faq.yml` /
`src/islands/RoiCalculator.svelte` / `src/lib/pricing.js` (新規) / `src/lib/pricing.test.js` (新規)。

**デザインからあえて変えた点** (いずれも「実在しないものは出さない」既存方針の維持):

1. **Free の込み時間は 6 時間のまま** — デザインの既定は 3 だが、アプリの
   `auth/env.rs::FREE_USAGE_LIMIT_SECONDS` は 6h を強制している。3 と書くと実挙動と食い違う
2. **「時間の計測ルール」表は移植しない** — デザインの 7 行のうち「同一ファイルの再処理は
   非計上」「インポート前の金額提示」「月額上限キャップ」「決済失敗時の 7 日猶予」は
   アプリ側で未実装。実装済みの計測仕様だけを `/docs/#usage` から参照させる形にした
3. **Enterprise の CTA は「デモに申し込む」→「導入について相談する」** — 予約基盤が無いため
   「申し込む」は約束になる (Phase 1 の削除方針を踏襲)
4. **リード文はサイト上での申し込みを約束せず、アプリ内手続きへ誘導する** — デザインの
   「上限時間と超過単価をすべて明記しています…」の代わりに、有料プランの申し込みが
   アプリ内 (プラン管理 → 決済ポータル) で行われる旨を書く。サイトに Checkout 導線が
   無いことと矛盾しない

**未実装であることの開示** — 上限時間・超過課金・登録デバイス数はアプリ側で未強制なので、
`plans.yml` の `rollout_note` が料金カード直下に注記を出す。トップ / `/price/` / `/docs/` の
3 箇所で同じ文が出る。課金実装 (front の TICKET-BILL Phase 1〜6) の出荷後に
`rollout_note: ""` とすれば注記だけが消え、他は 1 文字も変えなくてよい。

**ROI 計算機の修正 (実害のあったバグ)** — Enterprise の `included_basis: pooled` を
単純な「基本料 + 超過」で計算すると最低シート数を無視して **1 シート分 ¥8,000** になり、
Light (¥8,580) より安く見えて常に Enterprise が「適合プラン」に選ばれていた。
`seatsFor()` で `max(min_seats, ceil(hours / included_hours))` を取るよう修正。

計算ロジックは DOM 非依存の純関数として `src/lib/pricing.js` に切り出し、Node 組み込みの
test runner で回帰を固定した (`npm test` = `node --test src/lib/*.test.js`。vitest / jsdom は
足していない)。テストは **`_data/plans.yml` の実データを読む**ので、料金を変えると落ちる。
CI (`.github/workflows/jekyll.yml`) の build ジョブにも入れたので、表示と計算機が食い違った
まま公開されることはない。

実測での確認 (Jekyll serve + CDP):

| 月間 | 適合プラン | 月額 | 内訳 |
|---|---|---|---|
| 12h (既定) | Light | ¥8,580 | 月 5 時間込み ・ 超過 ¥800/時間 ・ 翌月繰越 (最大 10 時間) |
| 14h | Pro | ¥9,800 | 月 40 時間込み ・ 超過 ¥500/時間 ・ 7 日間トライアル |
| 90h | Enterprise | ¥24,000 | 3 シート (120 時間をプール共有) ・ 超過 ¥300/時間 |

既定値の年間削減額は ¥1,625,040 (現状 ¥1,728,000 − Deepmosaic ¥102,960) で、
移植時に設計した期待値と一致。

**副作用として直したもの** — `/price/` に h1 が無く見出し階層が h2 から始まっていたのを修正
(`title` + パンくず + `breadcrumb` schema を `/spec/` と同じ形に揃えた)。
`index.html` の noscript が `site.data.plans.tiers[1]` を index で参照しており、プランを
増やすと別プランを指す事故になっていたのを確定値の直書きに変更。

## 2026-07-26 - Feature: 売上拡大施策に基づくサイト刷新 (Phase 0+1)

設計: `front/docs/deepmosaic-growth-strategy.md` 施策③ (SEO) / ④ (訴求の変更) / ⑦ (変換資産)
新デザイン: Claude Design "Deepmosaic Site Renewal"

**移植方針** — 新デザインは 4 ページを 1 ファイルに内包した SPA 形式 (`state.page` 切替) で
URL が変わらず、施策③ の中核である SEO が構造的に成立しない。よって **4 ページに分割**して
既存 URL にそのまま載せる (`/` `/price/` `/docs/` + 新設 `/spec/`)。**リダイレクトは一切不要**。

公開は段階移行にする。新デザインには **まだ存在しない製品・機能・実績への言及** が広範に
含まれるため (Mac 版 / Light・Enterprise プラン / 確認支援ビュー / 検査結果 PDF / 導入事例)、
一括公開すると施策④ が獲得しようとしている信頼そのものを壊す。

### Phase 0 — 基盤 (見た目変化ゼロ)

- [x] TICKET-SITE-01: デザイントークン14種追加 + components 層 + `@source` に `/spec/` 追加
- [x] TICKET-SITE-02: `icon.html` に lucide 14種追加 + 1行→複数行整形
- [x] TICKET-SITE-03: `_data/` 新設 (site/plans/faq/spec/disclosure/mosaic) — 料金と数値の単一真実源
- [x] TICKET-SITE-04: `_includes` 新設 (kv-table/pricing-cards/cta-download/faq/disclosure-table)

### Phase 1 — トップ刷新 + /spec/ 新設

- [x] TICKET-SITE-05: description のページ単位化 + JSON-LD 分離 + jekyll-seo-tag 除去
- [x] TICKET-SITE-06: トップ前半 (HERO / TRUST BAR / STATS / COMPARISON) — 未検証の数値は出さない
- [x] TICKET-SITE-07: 未検証の数値と未実装機能の言及を全ページから棚卸し
- [x] TICKET-SITE-08: 実測値の取得 (`detection_runs` から算出)
- [x] TICKET-SITE-09: `RoiCalculator.svelte` アイランド (React 廃止)
- [x] TICKET-SITE-10: トップ後半 (RELIABILITY / STANDARDS / PRIVACY / WORKFLOW / DISCLOSURE / FAQ / CTA)
- [x] TICKET-SITE-11: `/spec/` 新設 (Mac は「開発中」表記のみ、DL ボタンなし)
- [x] TICKET-SITE-12: フッター再構成 + 全未接続リンク接続 + `price/index.html:54` の切れた導線修正
- [x] TICKET-SITE-13: 画像最適化 (WebP / width,height / loading / srcset)
- [x] TICKET-SITE-14: 未参照アセット削除 (`assets/img/docs/` 22MB / `assets/videos/` 14MB)
- [x] TICKET-SITE-15: SEO 配管 (sitemap 復活 / robots.txt / meta_desc 誤記 / front matter title)
- [x] TICKET-SITE-16: `/docs/` 差分マージ (`#review` `#usage` 追加、既存アンカーID は不変)

### ヒーローコピーの確定

新デザインの既定は B 案「1本8時間のモザイク作業を、40分に。」だが、**2 つの数値がいずれも
現時点で出せない**ため、B の構造 (工数削減訴求) を維持しつつ数値を外した形に確定した。

- 「8時間」 — 社内にデータが無い (ユーザー確認で根拠なしと確定)
- 「40分」 — 比較表で「うち目視確認 約35分」と内訳が定義されており、**確認支援ビュー
  (未実装) で「抽出された数十箇所だけ確認する」前提の数値**。現状の製品では 2 時間の作品は
  全編目視になる

確定コピー:

> **モザイク作業を、最終確認だけに。**
> 処理はすべてお使いのPC内で完結します。AIが全編を検出してトラッキングし、
> あなたは検出結果の確認と修正だけを行います。

根拠となる実装済み機能: AI 検出 + SeqTrack トラッキング / 検出結果の編集 (bbox 追加・削除・
ドラッグ) / **欠落フレームジャンプ (`[` `]`)** / モザイク焼き込み書き出し / Premiere Pro 連携 /
完全ローカル処理。数値は `_data/site.yml` 経由にして、実測が取れたら 1 行で差し替えられる形にする。

### 意図的に出さない要素

実在しない導線は **リンク先を用意するのではなく要素ごと削除**する。「準備中」ボタンや
グレーアウトは、このサイトが獲得しようとしている信頼を毀損する。

- **導入事例カード2枚** — 実在顧客なしの公開は景表法 (優良誤認) に該当。取材完了後に追加
- **検査結果 PDF** — カードごと削除。同じ行の「オフラインでの動作」(実在・ユーザー自己検証可能
  = 最も強い証明) を 2 カラム幅に拡大
- **資料ダウンロード** — PDF 未作成
- **デモ申込** — 「導入について相談する」に改名 (予約基盤が無いため「申し込む」は約束になる)
- **料金3プランカード** — Phase 1 では出さない。アプリが「Pro 無制限」を売っている状態で
  3 プランを出すと特商法・景表法の実害
- **DISCLOSURE の伏字「○時間・○シーン」** — 節は残し「検出率の実測値は、計測条件とあわせて
  公開します」に書き換え

### TICKET-SITE-05 の記録

**description のページ単位化** — 移行前は全ページが同一の `meta_desc` を出しており、
`description` を持つページが **1 つも無かった**。リポジトリ `CLAUDE.md` の
「全ページに layout / title / description を必ず指定 (SEO)」という規約が守られていない
状態だったので、規約に合わせた。`og:title` もページ単位にした。

**構造化データを `_includes/schema/*` へ分離** し、front matter の `schemas:` で選ぶ形にした。

| include | 出力対象 | データ源 |
|---|---|---|
| `organization.html` | 全ページ | ハードコード (会社情報) |
| `software-application.html` | `/` `/price/` (+ 後で `/spec/`) | `_data/plans.yml` の `AggregateOffer` |
| `faq.html` | `/` | `_data/faq.yml` |
| `breadcrumb.html` | `/docs/` (+ 後で `/spec/` `/guides/*`) | `page` |

移行前の問題を 3 つ解消した:

1. **SoftwareApplication が全ページに重複出力**されていた (会社概要ページにもアプリの
   構造化データが載っていた)
2. **FAQPage が二重管理**だった (`default.html` にハードコード 5 件 / `index.html` の
   `<details>` 5 件)。同一データから生成する形にした
3. `"price": "0"` / `operatingSystem` / 説明文がハードコードで、料金改定・Mac 対応で腐る
   構造だった。`AggregateOffer` (lowPrice / highPrice / offerCount) を `_data` から組む

**あわせて直したもの**

- `index.html` の FAQ 節を `{% include faq.html %}` に差し替えた。JSON-LD だけ 9 件に
  増やして表示が 5 件のままだと **公開した時点で不整合**になるため、同じチケット内で解消した
- `company/privacy.html` と `company/asct.html` の front matter `title` が
  **どちらも「会社概要」のまま**だった (`<title>` に直接出る)。それぞれ
  「プライバシーポリシー」「特定商取引法に基づく表示」に修正
- `jekyll-seo-tag` を **Gemfile と `_config.yml` の両方から**除去。`{% seo %}` が
  呼ばれておらず無効だったため。⚠️ `_config.yml` の `plugins:` に残っていると
  `Dependency Error: you don't have jekyll-seo-tag` でビルドが落ちる (実際に踏んだ)

検証: `--strict_front_matter` ビルド成功後に、6 ページの title / og:title / description /
JSON-LD 種別を出力から抽出し、**description が全ページで異なること**、
**FAQ の JSON-LD 9 件と表示 9 件が一致すること**、**`/company/about` に
SoftwareApplication が出ていないこと**、**seo-tag の痕跡が無いこと**を機械確認。

### TICKET-SITE-04 の記録

**抽出基準** — 「2 ページ以上で使う」か「`_data` ループで生成する」もののみ include 化した。
1 ページでしか使わないセクションはページ本体に置く (Jekyll の include はネストが深いと
追跡不能になる)。

| include | 根拠 |
|---|---|
| `kv-table.html` | ラベル\|値 の定義表が /spec/ ・/price/ ・/docs/ で **15 箇所以上** 重複 |
| `pricing-cards.html` | トップの PRICING 節と /price/ で完全重複 |
| `cta-download.html` | トップ末尾・/price/ 末尾・/spec/ 末尾 の 3 箇所 |
| `faq.html` | 表示本体と FAQPage JSON-LD を **同一データから生成** (食い違いを構造的に防ぐ) |
| `disclosure-table.html` | 通信内容の対比表。施策④-2 の中核 |

- `section-title.html` に `align="left"` を追加 (2 カラム構成の節用)。**第 2 バリアントは
  作らない** — デザイン差分の再現よりトークンの一貫性を優先する
- `download-button.html` (未使用だった) は `cta-download.html` の中身として再利用。
  DL URL の単一管理点になる
- **`spec-table.html` は破棄**。未使用なだけでなく内容が誤っていた
  (メモリ「32GB以上」/ CPU「Intel 第7世代」。現行 index.html は「8GB以上」)

**Liquid の罠 2 件を回避**

1. `include.zebra | default: true` は使えない — Liquid の `default` は `false` を「空」と
   みなして既定値に置き換えてしまう。`{% if include.zebra == false %}` で明示判定した
2. `{% if a and b | filter %}` は書けない — `if` 条件にフィルタを置けないので、
   zebra の偶奇判定は先に `assign` している
3. Liquid に桁区切りフィルタが無いため、料金は数値 (`price`、計算用) と表示文字列
   (`price_display`) を分けて `_data` に持たせた

検証: 一時ページをビルドして kv-row 8 / kv-alt 3 (zebra=false が効いている) /
FAQ details 9 / 開示リスト 11 / プランカード 2 / `¥9,800` の桁区切り /
`align=left` / **新 include に生ヘックスなし** を機械確認。

### TICKET-SITE-13 の記録 — 画像最適化

参照されている画像 14 枚を WebP に変換した (ffmpeg / libwebp / quality 82)。

| | 変換前 | 変換後 |
|---|---|---|
| 対象 14 枚の合計 | 3,530 KB | **368 KB** (10%) |
| トップページの画像転送量 | 約 2,000 KB | **216 KB** |
| `assets/` 全体 | 52 MB (未参照削除前) | **6.4 MB** |

`edit-player.png` は 627 KB → 39 KB、`pr_image.png` は 695 KB → 75 KB。
`app-icon-128.png` と `logo-font-cropped.png` は小さく互換性を優先して PNG のまま。
favicon (`assets/img/ico/`) も対象外。

**運用の穴を塞いだ** — スクリーンショットは front リポの `screenshots.mjs` が **PNG で**
出力し、手で `assets/img/screenshots/` にコピーする運用になっている。変換を手作業に
すると、次に撮り直したとき PNG に戻って **参照だけ `.webp` のまま残り画像が消える**。
`scripts/optimize-images.mjs` としてスクリプト化し、`CLAUDE.md` に「コピー後に必ず
通すこと」と明記した。

ビルドに組み込まない理由: Jekyll プラグインは ImageMagick / libvips を CI ランナーに
要求する (年数回しか変わらないアセットのためにデプロイの故障点を増やしたくない)。
Vite に通すと `/assets/img/…` の URL が全部変わる。

検証: ビルド出力の **ローカルアセット参照 229 件を全数検査してリンク切れ 0 件**。

### TICKET-SITE-16 の記録 — /docs/ 差分マージ

**丸ごと差し替えず、差分だけをマージした。** Claude Design の成果物の docs は
全アンカーを改名しており (`#about`→`#doc-intro` 等 19 本すべて)、さらに 2026-07-25 に
追加したばかりの `#detect-options` 節 (スクショ 3 枚) を持っていない。改名の利得はゼロで、
損失は既存の被リンク・アプリ内ヘルプからのディープリンクの全損。

- **既存 18 アンカー ID は 1 つも変えていない** (before/after を機械比較して確認)
- 追加は `#review` (検出漏れの確認) と `#usage` (使用時間の計測) の 2 本のみ
- `detectable-objects.png` を `#detect` 配下の `<details>` へ移設。**alt も一緒に移した** ——
  画像だけ外して alt がトップに残ると、決済審査・法人稟議・将来の広告出稿という
  移設の目的 (施策④-5) を達成できない
- `#spec` は動作環境の要点だけ残し、実測値・対応フォーマット・macOS 版の状況は
  新設した `/spec/` へ誘導する形にした (二重管理をやめる)

**未実装機能を書かないこと** を両新設節で徹底した:

- `#review` は「確認支援ビュー」(低信頼区間の自動抽出) が未実装なので、
  実装済みの道具だけを列挙 (欠落フレームジャンプ / タイムライン / 信頼度しきい値 /
  安全マージン / 手動追加・削除)
- `#usage` は **現行の計測ルールをそのまま書いた**。「同一ファイルの再インポートは非計上」
  「月次リセット」は課金基盤 (TICKET-BILL 群) の出荷前に書くと虚偽記載になる

トラブルシューティングへの `data-island="accordion"` 付与は **見送った**。
既存マークアップが `<ul>` で、`Accordion.svelte` は `<details>` 前提のため、
付けても無効な島になるだけだから。

### TICKET-SITE-11 / 12 / 14 / 15 の記録

**`/spec/` 新設** — 動作環境ページ。GPU と処理速度の表は **本番テレメトリの実測値**
(`_data/spec.yml`)。Claude Design の成果物は「RTX40以降 = 25fps 以上」等と書いていたが
実測より大幅に過大だったため置き換えた。macOS は **「開発中」の事実だけ**を書き、
ダウンロードボタンも先行登録フォームも置かない (存在しない製品への導線は施策④-4 に反する)。

**導線の整備** — ヘッダーのデスクトップナビ / モバイルドロワー / `<noscript>` の 3 経路すべてに
「動作環境」を追加。フッターに製品リンクと **会社住所・連絡先** を追加した (施策④-5:
特商法ページだけでは見られないため、法人稟議・決済審査での信頼度に直結する)。
`price/index.html` の「問い合わせフォーム」がリンクになっていなかった導線切れも修正。

**未参照アセットの削除** — `assets/` が **52MB → 9.7MB (42.5MB 削減)**。

| 削除 | サイズ |
|---|---|
| `assets/img/docs/` (旧サイト時代の手順画像 151 枚) | 22MB |
| `assets/videos/` (mp4 3 本) | 14MB |
| `assets/others/` (PDF 3 本) | 6.2MB |

⚠️ 判定方法に注意: ファイル名 (`1.png` 等) での grep は**部分一致で誤検出する**
(151 件中 53 件が「参照あり」と出た)。**パス接頭辞 (`assets/img/docs`) で判定**したところ、
参照は CHANGELOG.md と CLAUDE.md のみで、ページからの参照はゼロだった。
削除後にビルド出力の **ローカルアセット参照 228 件を全数検査してリンク切れ 0 件**を確認。

**SEO 配管**

- 手書き `sitemap.xml` / `assets/sitemap.xml` / `assets/img/sitemap.xml` を削除。
  **ルートに手書き sitemap があると `jekyll-sitemap` は生成をスキップする**ため、
  7 URL・`lastmod` 2026-02-11 固定の嘘 sitemap だけが配信されていた。削除して
  プラグインを有効化し、9 ページ + 動的 `lastmod` になった
- `robots.txt` を新規作成。⚠️ `_config.yml` の `defaults` が全ページに `layout: default` を
  当てるため、**`layout: null` を明示しないと robots.txt が HTML になる** (実際に踏んだ)
- `404.html` に `sitemap: false` を追加
- `_data/lang/ja.json` の `meta_desc` を修正。「Adobe **After Effects** へインポート」という
  **誤記** (実装は Premiere Pro 連携) を直し、検索結果に直接出る露骨表現も
  決済審査・法人稟議を考えて言い換えた (施策④-5)

### TICKET-SITE-06 / 07 / 09 / 10 の記録 — トップページ刷新

**HERO** は確定コピー (数値なし)。`detectable-objects.png` をトップから撤去した
(alt も一緒に外している。画像だけ外して alt が残ると施策④-5 の目的を達成できない)。

**STATS** は旧「25fps+ 自動処理速度」「6時間 無料で利用可能」を、検証できる 4 つの事実に
差し替えた: `0 byte`(映像の外部送信量) / `100,000+`(学習画像) / `12 形式`(読み込み対応) /
`4 段階`(検出パイプライン)。

**COMPARISON** は時間・金額の数値を出さず「判断の軸」だけを並べる形にした。
手作業側の所要時間は社内に実測データが無いため。Deepmosaic 側の実測は `/spec/` へ誘導する。

**RELIABILITY** は「確認支援ビュー」(低信頼区間の自動抽出) が未実装なので、
**実装済みの道具だけ**を書いた: 欠落フレームジャンプ (`[` `]`) / 安全マージン (0.5〜2倍) /
適用範囲 4 段階 / 信頼度フィルタ。

**MOSAIC (旧 STANDARDS)** も「審査基準準拠プリセット」が未実装なので、
実装済みの設定項目を説明する形に縮小した。

**ROI 計算機 (TICKET-SITE-09)** は React を捨てて Svelte 5 アイランドで実装。
プラン価格は `data-plans` で `_data/plans.yml` から渡す。見出しと注記はアイランドの外に
置き、`<noscript>` フォールバックも用意した (JS 無効でも何の計算機か読める)。
「手作業の想定」が仮置きであることを UI 上に明示している。

**タブ (Tabs.svelte)** は **DOM を生成しない挙動だけのアイランド**。JS 無効なら全パネルが
縦に並んで見える (比較表なので全部見えても情報として成立する)。矢印キー / Home / End にも対応。

**気付いて直したこと**: セクションの説明を HTML コメントで書いていたため、
「25fps は実測と乖離するため撤去」といった **社内向けの記述が公開 HTML に出力されていた**。
Liquid コメント (`{%- comment -%}`) に変換して出力から除いた。

検証 (ビルド出力に対する機械チェック 20 件、全 PASS): 確定コピー / 未検証の数値 3 種が
出力に無い / 検出対象画像と露骨表現が無い / STATS 4 項目 / 比較表 / ROI アイランドと
plans と noscript / タブ 2 枚 / 通信開示 / オフライン手順 / 料金カード 2 枚 / 責任の明記 /
苦手なケース 5 行 / **FAQ 表示 9 件 = JSON-LD 9 件** / CTA / **全画像に width/height** /
生ヘックスなし / `href="#"` なし。

### TICKET-SITE-08 の記録 — 「25fps+」は実測で裏付けが取れない

本番テレメトリ (`detection_runs`) から処理速度を実測した。**現行サイトに載っている
「25fps+ 自動処理速度」は代表値として成立しない**という結果になった。

集計条件: `status=completed` / 範囲指定なし (全編検出) / 集計対象外アカウント除外 /
2026-06-15〜07-25 / **34 件 / 10 ユーザー**

| 指標 | 実測 |
|---|---|
| 端から端まで (準備→前処理→検出→解析) の処理 fps | **中央値 7.4** / 最良 27.1 |
| 動画長の何倍かかるか | **中央値 4.2 倍** / 上位25% 2.5 倍 / 最良 1.1 倍 |
| 検出ステージのみ (`dur_detect_ms`) の fps | 中央値 16.4 / 最大 43.9 |

GPU 別 (幅 1080〜1920px に揃えた中央値):

| GPU | 件数 | 全体 fps | 実時間倍率 |
|---|---|---|---|
| RTX 4070 Ti | 11 | 11.7 | 3.2 倍 |
| RTX 3070 Ti | 9 | 4.8 | 6.3 倍 |
| RTX 4060 | 1 | 15.2 | 2.0 倍 |
| RTX 3070 | 1 | 27.1 | 1.1 倍 |
| GTX 1070 Ti | 1 | 16.0 | 1.9 倍 |
| GPU なし | 2 | 1.9 | 12.8 倍 |

**判断**

- 「25fps+」を **STATS 帯から外す**。25fps を超えたのは 34 件中 1 件 (RTX 3070) だけで、
  最良ケースの一点を代表値として出すのは景表法 (優良誤認) のリスクを負う
- Claude Design の `/spec/` GPU 表 (「RTX40以降 = 25fps 以上」「RTX30 = 20〜25fps」) は
  **実測より過大**。実測値に差し替えた (`_data/spec.yml`)
- 「CPU のみ 2fps 前後」は実測 2.1 で **正確**。そのまま使う
- 2 時間の作品は中央値で **約 8.4 時間** かかる。「40分」は成立しない
  (ヒーローから数値を外した判断が実測でも裏付けられた)
- STATS 帯は検証できる事実に差し替える: `0 byte`（映像の外部送信量。設計上の事実で
  ユーザー自身が検証できる = 最も強い主張）/ `100,000+`（学習画像データ。自社が持つ事実）/
  `12 形式`（読み込み対応フォーマット。実装と一致）/ `4 段階`（検出パイプライン。UI と一致）

**注意**: `detection_runs.avg_fps` 列は 101 件すべて NULL だった (列はあるが充填されていない)。
本集計は `total_frames / (dur_total_ms / 1000)` で算出している。`avg_fps` の充填は別チケット。
`encode_runs.source_duration_seconds` も全件 NULL でエンコード側の実測は取れていない。

### TICKET-SITE-03 の記録

`_data/` を新設し、料金と数値の単一真実源を作った。Claude Design の成果物は料金を
**料金カードの markup と `renderVals()` の計算ロジックの 2 箇所にハードコード**しており、
必ず片方だけ更新されて破綻する構造だった。これは移植しない。

| ファイル | 内容 |
|---|---|
| `site.yml` | ヒーローコピー / ROI 既定値 / **実測値 (SITE-08)** / STATS 帯 |
| `plans.yml` | 料金プラン。**アプリが実際に強制している値だけ** (Free 6h / Pro ¥9,800 無制限) |
| `faq.yml` | FAQ 9 件。表示本体と FAQPage JSON-LD を同一データから生成する |
| `spec.yml` | 動作環境。GPU 表は実測値。macOS は「開発中」表記のみで DL ボタンなし |
| `disclosure.yml` | 通信内容の開示 / オフライン検証手順 / 苦手なケース / 責任の明記 |
| `mosaic.yml` | モザイク設定。**「審査基準準拠プリセット」は未実装**なので、実装済みの設定項目を説明する形に縮小した |

`plans.yml` に新プラン (Light ¥2,980 等) は **入れていない**。サイトの記述がライセンス
サーバーの挙動と食い違うと虚偽記載になるため、課金実装 (TICKET-BILL 群) の完了後に
TICKET-SITE-20 で差し替える。

`--strict_front_matter` ビルドと Liquid からの参照 (9 パス) を確認済み。

### TICKET-SITE-01 の記録

Claude Design の成果物は生ヘックスを全面インライン直書きしており、グレーが L\* で約3%しか
違わない 8 階調 (`#d0d0d0` / `#c8c8c8` / `#c0c0c0` / `#a8a8a8`) に発散していた。この発散は
移植せず、`--color-ink-body` に 3 階調を統合し `#a8a8a8` は既存 `--color-ink-2` に吸収した。

`@source` に `../spec/**/*.html` と `../_guides/**/*.md` を追加。**これが漏れると新ページで
しか使わないユーティリティが全部 purge され「/spec/ だけスタイルが当たらない」形で出る。**

既存 markup とのクラス名衝突を 19 クラス × 全 html で確認済み (衝突なし)。

### TICKET-SITE-02 の記録

`_includes/icon.html` は全 22 アイコンが **1 行 3KB** に詰まっており、14 個追加すると
保守不能になる。パスデータは手書きせず `front/node_modules/lucide-svelte@0.460.1` の
`iconNode` から機械生成し、`{% when %}` 1 個 = 1 行に整形した (22 → 36 種、53 行)。

- `AlertTriangle` は lucide 0.46 で `triangle-alert` に改称済み (`alert-triangle` は alias)。
  ファイル名は `triangle-alert.svelte` を参照している
- **既存 22 アイコンの描画は不変** — `_site/index.html` と `_site/docs/index.html` を
  変更前後でビルドして diff を取り、差分が cache-busting のタイムスタンプ
  (`?v={{ site.time }}`) だけ = **SVG markup はバイト一致**であることを確認
- 全 36 アイコンが実際に形状要素を持つことを一時ページのビルド出力で機械検証
  (36/36 ブロック、形状要素 112 個)

## 2026-07-25 - Docs: 動画の読み込み / 検出オプションの解説を拡充

ドキュメントに「動画を読み込んだ後に出る検出オプション画面」の説明が一切無く、
読み込み方法も 1 文だけだった。実アプリのキャプチャを撮り直して両節を書き起こす。

- [x] DOC-IMPORT-01: 「動画の読み込み」節を拡充 — 3 つの読み込み経路 (ファイル選択 /
  フォルダ選択 / ドラッグ&ドロップ)、対応形式 12 種、複数まとめ読み込み時の挙動
  - フォルダ選択の実挙動を明記: **直下のみ (サブフォルダ非対象)** / ファイル名昇順 /
    最大 100 件 / 映像として読めないファイルは除外 (front `folder_scan.rs` + `+layout.svelte` 準拠)
  - 複数読み込み時は「1 本目の設定が全件に適用される」「検出範囲の指定だけは 1 本目のみ有効」
- [x] DOC-IMPORT-02: 「検出オプション」節を新設 — プレビュー / 検出範囲 (複数範囲) /
  検出対象トグル / モザイク初期設定 / GPU 表示と使用モデル。目次にも追加
  - 「AI検出」節の導入文から新節へリンク。トラブルシューティングに 2 項目追加
    (プレビューが出ない / フォルダで動画が見つからない)
  - `_includes/icon.html` に `Trash2` を追加 (未定義のアイコン名は空 SVG になるため)
- [x] DOC-IMPORT-03: スクリーンショット (`import-menu.png` / `detect-options.png` /
  `detect-options-panel.png`) を `assets/img/screenshots/` に追加。撮影は front リポの
  `node scripts/e2e/screenshots.mjs --only-options` (実アプリを CDP 駆動)

**検証結果 (2026-07-25)**
- `npm run build` + `bundle exec jekyll build --strict_front_matter` 成功
- ローカル配信 (port 4123) を Playwright で実機確認: 目次 17 → 18 項目、`#detect-options`
  へのアンカー、画像 3 枚の表示、Trash2 アイコンの描画、節間リンクを確認
- ⚠️ CLAUDE.md 記載の `bundle exec jekyll build --strict_front_matter --strict_variables` は
  jekyll 4.4.1 で `invalid option: --strict_variables` になる (`--strict_front_matter` のみで実行)

## 2026-07-19 - Fix/Feature: ダウンロードリンクを R2 へ + モバイルドロワー修正

- [x] **ダウンロードリンクを Cloudflare R2 の "latest" エイリアスへ**: `app_download_link` を旧 `desktop_app_support` v1.0.3 (GitHub) → `https://deepmosaic-r2-proxy.deepmosaic.workers.dev/download/latest/windows`（**版数非依存**）。front は private のため直リンク不可 → R2 (public worker) 配信を利用。全 CTA(9ページ)に反映。
  - **latest エイリアスの実装（別リポ `front/worker-r2-proxy/src/index.ts`）**: `GET /download/latest/windows`（`/download/latest`）を `latest.json` の現行 Windows インストーラ URL へ **302 リダイレクト**する追加専用ルートを実装。→ 新リリース公開時もサイト側リンクの更新不要（`latest.json` を辿るため自動追従）。現行の転送先は v1.0.11（署名済み・HEAD 200 確認）。
  - ⚠️ **要デプロイ（ユーザー操作）**: この worker 変更は未デプロイ。`cd front/worker-r2-proxy && npx wrangler deploy` を実行するまでエイリアスは 401 のまま。**worker を先にデプロイしてからサイトを公開**すること（順序が逆だとダウンロードが一時的に 401）。CF 資格情報が無いため当環境ではデプロイ不可。
- [x] **モバイルドロワー修正**: sticky ヘッダの `backdrop-filter` が `position:fixed` の containing block を生成し、ドロワー/オーバーレイが 60px ヘッダ内に閉じ込められて背景が崩れヒーローに被る不具合。overlay+drawer を `document.body` へ portal して解消（全画面高さで正常表示、実機確認済み）。

## 2026-07-19 - Feature: ダークテーマ全面リニューアル（新アプリ準拠デザイン）

Claude Design のエクスポート `ui_kits/website/index.html` を本番実装。ライト版から**ダークテーマ**へ全面刷新し、コンテンツも新アプリ準拠に更新（新機能・4段階パイプライン・Pro プラン ¥9,800・16章の新ドキュメント）。スタック（Jekyll + Tailwind v4 + Svelte アイランド）は維持し、SPA ではなく実 URL のマルチページとして実装。

- [x] DR-01: ダークデザイントークン（`@theme`: surface/panel/accent #4f8be8 等）+ `.btn-*`/`.rich-prose`(dark) + `_includes/icon.html`(lucide SVG 20種) + 新画像/スクショ複製
- [x] DR-02: 共通テンプレ ダーク化（sticky blur ヘッダ / footer / section-title）、default.html の theme-color #1f1f1f・meta・FAQ JSON-LD(新5問) 更新、MobileNav ダーク
- [x] DR-03: home 実装（Hero/Stats/Features5/Pipeline/Premiere/Steps3/Spec/Faq5/Cta）。実機QA・FAQ単一開閉確認
- [x] DR-04: pricing（Free ¥0 / Pro ¥9,800 featured）+ docs（17章・サイドバーTOC・Scrollspy・スクショ7枚）
- [x] DR-05: legal/404 ダーク追従（クラス置換のみ・文言verbatim）+ 最終検証

**検証結果（2026-07-19）**
- `npm run build` + `jekyll build --strict_front_matter` 成功
- 実機QA（Playwright）: home/pricing/docs/legal をダークで確認。モバイルドロワー(#1f1f1f)・FAQ単一開閉・docsスクロールスパイ(17 TOC)動作
- SEO 不変: JSON-LD(Organization/SoftwareApplication/FAQPage=新5問)・OG・canonical・sitemap(7)・feed・gtag 維持、theme-color #1f1f1f、FAQ DOM=JSON-LD一致
- 依存: materialize/jquery/lity 参照ゼロ継続、全ページに app.css
- アセット: detectable-objects/app-icon-128/logo-font-cropped + スクショ7枚を複製

> **注意（公開前確認）**: 料金 ¥4,800/Enterprise → ¥9,800/Pro、新機能・新ドキュメントに刷新。実製品と一致するか最終確認のうえ公開（コミット/プッシュはユーザー承認後）。

## 2026-07-19 - Feature: Materialize/jQuery 撤去 → Tailwind CSS + Svelte アイランド

Materialize.css 1.0.0（EOL）/ jQuery / lity を全撤去し、CSS を Tailwind CSS v4、対話部品を Svelte 5 アイランドへ書き直し。Jekyll はコンテンツ/SEO 層として継続。

- [x] TICKET-001: ビルド基盤（package.json / vite.config.js / src/app.css / src/main.js / islands）。`npm run build` → `assets/dist/app.{css,js}`。.gitignore / _config.yml 更新
- [x] TICKET-002: Tailwind トークン（@theme: navy/accent/sky/success）+ 自己ホスト Roboto（assets/css/fonts.css）+ 移植スタイル。scroll-reveal は `.js` ガードで JS 無効時も表示
- [x] TICKET-003: Svelte アイランド 4種（MobileNav / Accordion / Scrollspy / VideoLightbox）+ back-to-top/scroll-reveal 素JS移植。全てプログレッシブ・エンハンスメント。ブラウザ実機で挙動確認済み
- [x] TICKET-004: 全ページ markup を Materialize→Tailwind 書換（_layouts/default.html, _includes/*, index, docs(42 section scrollspy), price, company/*5, 404）。Material Icons 7種をインライン SVG 化。docs は Scrollspy アイランド配線
- [x] TICKET-005: 不要アセット削除（index.css/header.css/index.js/lity css・js）+ CI に Node ビルド段追加（setup-node@v7 → npm ci → npm run build）+ CLAUDE.md/README 更新 + 検証完了

**検証結果（2026-07-19）**
- `npm run build` + `bundle exec jekyll build --strict_front_matter` 成功
- `_site` 依存撤去確認: materialize / jquery / lity 参照ゼロ、全ページに `app.css`
- 実機QA（Playwright）: index(PC/モバイル)/docs/price/company 表示良好。モバイルドロワー・FAQ単一開閉・動画ライトボックス(youtube-nocookie/Esc)・docs スクロールスパイ(42 TOC・sticky) 動作確認
- プログレッシブ・エンハンスメント: scroll-reveal を `.js` ガードし JS 無効でもコンテンツ表示
- SEO 不変: JSON-LD(Organization/SoftwareApplication/FAQPage)・OG・canonical/hreflang・sitemap(7 URL)・feed・gtag すべて維持
- 追加改善: 自己ホスト Roboto で Google Fonts 依存を撤去、内部ドキュメント `CLAUDE.md` を publish 対象から除外、404 画像に `alt` 追加、外部リンクに `rel="noopener noreferrer"`

> 次回 push で確認: CI の Node ビルド段 + ruby 3.4 で Pages デプロイが green になること

## 2026-07-19 - Maintenance: 依存パッケージ最新化

- [x] TICKET-001: Ruby gem 最新化（`bundle update` で Gemfile 制約内の全 gem を更新。jekyll-seo-tag 2.8→2.9 ほか。liquid/rouge 等は Jekyll 4.4 制約により据え置き。ビルド成功）
- [x] TICKET-002: CDN ライブラリ更新（video.js 8.21.0→8.23.9 に更新。Materialize 1.0.0 と jQuery 3.7.1 は据え置き＝下記「据え置き判断」参照）
- [x] TICKET-003: GitHub Actions 更新（checkout v4→v7、configure-pages v5→v6、upload-pages-artifact v3→v5、deploy-pages v4→v5、ruby-version 3.3→3.4。setup-ruby は floating `@v1` のため据え置き）
- [x] TICKET-004: vendored アセット整理（未使用の animate.min.css を削除＝サイト内でクラス参照ゼロ、約58KB削減。lity 2.4.1 は最新のため据え置き）
- [x] TICKET-005: Jekyll ビルド検証（`bundle exec jekyll build --strict_front_matter` 成功。_site 出力から animate.min.css / video.js 8.21.0 が消えていることを確認）

### 据え置き判断（ライブラリ版数はライブレジストリで確認済み・2026-07-19 時点）
- **Materialize 1.0.0 → 据え置き**: cdnjs は 1.0.0 が終端（オリジナルは非メンテ）。メンテ版は fork `@materializecss/materialize` 2.3.3 だが jQuery 依存を廃した破壊的リライトで、`$('.scrollspy').scrollSpy()` 等の初期化を全面書き換え＋CDN 移行が必要。sidenav/scrollspy/collapsible を全ページで多用しているため、専用の移行タスクに分離。
- **jQuery 3.7.1 → 据え置き**: 既に 3.x 最終版（3.7.2 は存在しない）。4.0.0 は GA だが、上記 Materialize 1.0.0 が jQuery 4 で未検証のため、Materialize 移行と同時に対応。

### 次回デプロイで確認が必要な項目（bump-with-care）
- ruby-version 3.3→3.4: Gemfile は既に csv/base64/bigdecimal/webrick の 3.4+ shim を持つため低リスク。次回 push 時の Actions ビルドが green になることを確認。
- upload-pages-artifact v5 / deploy-pages v5: 対で更新（artifact フォーマット整合のため）。次回デプロイの成功を確認。

## 2026-03-09 - Maintenance: Ruby/Gem最新化 & リファクタリング

- [x] TICKET-001: Gemfile最新化（Jekyll 4.4+, minima削除, 依存関係整理）
- [x] TICKET-002: _config.yml整備（サイト設定の集約、exclude, defaults設定追加）
- [x] TICKET-003: 共通パーツのinclude化（spec-table.html, download-button.html）
- [x] TICKET-004: dead code除去（コメントアウト済みHTML、未使用CSS約300行削除）
- [x] TICKET-005: Gemfile.lock削除（bundle install再実行で再生成が必要）
- [x] TICKET-006: canonical URL正規化（index.html除去、_siteをgit追跡から除外）
- [x] TICKET-007: .gitignore整備（_site, .jekyll-cache, .sass-cache, vendor追加）
- [x] TICKET-008: GitHub Actions Jekyll 4.4デプロイワークフロー追加（GitHub Pages標準ビルドはJekyll 3.9固定のため）
