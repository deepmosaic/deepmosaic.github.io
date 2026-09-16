# notes_T-252: 料金カードの「支払方法」行を 3 プランに揃える

変更は `_data/plans.yml` の 1 ファイルのみ。コミット・push・サイトビルド・デプロイは **していない**
(別エージェントがサイトをビルド中のため `npm run build` / `jekyll build` も未実行)。

## 変更点 (要約)

| プラン | 行 | 変更 |
|---|---|---|
| Light | `支払方法` | **追加**: `クレジットカード` (「同時起動」の直後。Light に「解約」行は無いので末尾) |
| Pro | `支払方法` | **追加**: `クレジットカード` (「同時起動」の後・「解約」の前) |
| Enterprise | `支払方法` | 値を `請求書払い・銀行振込` → **`クレジットカード・請求書払い・銀行振込`** |

- ラベルは既存の Enterprise 行と同じ **「支払方法」(「い」なし)** で統一。
- 「追加契約」行は従来どおり `specs` に書かず、`max_contracts` から `_includes/pricing-cards.html` が
  「込み時間」の直後に差し込む (`specs` の先頭が「込み時間」である前提も崩していない)。
- `plan.specs` を描画する箇所はトップ (`index.html:370`) と `/price/` (`price/index.html:49`) の
  `{% include pricing-cards.html %}`、および `llms-full.txt` §4 の `{% for s in t.specs %}` で、
  **全部 SSOT を読むので自動で追従する**。include / ページ側の変更は無し。
- 写しの有無を確認した (`grep -rn '請求書払い\|同時起動\|支払方法' .` — `node_modules` / `_site` 除外)。
  仕様表を文字列で複製している箇所は無い。ヒットした `CHANGELOG.md` は履歴、`_includes/docs/02-account.html`
  はポータルの説明文 (別エージェントが編集中・触っていない)、`company/asct.html` (特商法) は
  「口座振り込み、クレジットカードによるお支払」で今回の文言と矛盾しない。JSON-LD は specs を参照していない。
- CTA / `href` は変更していない (T-254 / T-263 の範囲)。

## 追加・変更したコマンド

新規コマンドは無し。ゲートとして実行したもの (再現用):

```bash
cd deepmosaic.github.io

# YAML 構文 (js-yaml は本リポに無い。Jekyll と同じ Psych で読む → 実 YAML パーサ、サイトはビルドしない)
ruby -Eutf-8:utf-8 -ryaml -e 'd = YAML.load_file("_data/plans.yml"); d["tiers"].each { |t| next unless t["specs"]; puts "#{t["code"]}: " + t["specs"].map { |s| "#{s["label"]}=#{s["value"]}" }.join(" | ") }'

# 第 2 のパーサ (desktop の node_modules にある js-yaml を借りる) + 本リポの極小パーサ `loadTiers()` が読めること
node -e 'const r=require("node:module").createRequire("C:/Users/core/scripts/deepmosaic/desktop/package.json");const d=r("js-yaml").load(require("node:fs").readFileSync("_data/plans.yml","utf8"));for(const t of d.tiers)if(t.specs)console.log(t.code+": "+t.specs.map(s=>s.label+"="+s.value).join(" | "))'
node -e 'import("./src/lib/plans-yml.js").then(m=>console.log(m.loadTiers().map(x=>x.code).join(",")))'

node scripts/check-plan-catalog.mjs   # SUPABASE_PROXY_API_KEY 未設定 → ::warning:: を出して exit 0 (素通し。仕様どおり)
npm test                              # node --test src/lib/*.test.js → 106 tests / pass 105 / skip 1 (plan-catalog はローカル skip)
```

3 つのパーサとも同じ結果:

```
light:      込み時間=月 5 時間 | 同時起動=1 台 | 支払方法=クレジットカード
pro:        込み時間=月 40 時間 | 同時起動=1 台 | 支払方法=クレジットカード | 解約=いつでも可能・違約金なし
enterprise: 込み時間=アカウント数 × 40 時間をプール共有 | 請求=月末締め翌月請求 | 支払方法=クレジットカード・請求書払い・銀行振込
```

## 注意点・既知の制約

- **Enterprise の「クレジットカード」は広告になる。** 実際にカードで Enterprise を申し込める経路
  (CTA / 申込フロー) は T-254 / T-263 側。デプロイ時点でその経路が無いなら、この行だけ先に出すと
  「実在しない条件の広告」になるので、**T-254 / T-263 と同じリリースに載せる**か、Enterprise の値だけ
  一旦戻す (下のロールバック参照)。
- `scripts/check-plan-catalog.mjs` が突き合わせるのは `max_contracts` / 込み時間 / 月額 / `min_seats` のみで、
  `specs` の文字列は **機械検査の対象外**。支払方法の文言は Stripe / Supabase と自動では突き合わない。
- `src/lib/plans-yml.js` の極小パーサは `specs` の中身を読み飛ばすが、対応外の記法 (ブロックスカラー /
  暗黙 null) が混ざると throw する。今回の 2 行は既存行と同じ 1 行スカラー (6 スペース `- label:`) なので
  読めることを `loadTiers()` で確認済み。
- カードの行数が Light 3 (+追加契約 = 4) / Pro 4 (+追加契約 = 5) / Enterprise 3 になる。カードは
  `items-stretch` で高さが揃うが、**ビルド後にトップ PRICING と `/price/` をモバイル幅 (320〜400px) で目視する**こと
  (ビルドは別エージェント作業中のため未実施)。
- ドキュメント (`_includes/docs/02-account.html`) の散文は「支払い方法（クレジットカード）」と「い」付き。
  別エージェントの編集対象なので今回は触っていない。揃えるなら別チケットで。
- 親リポの `CHANGELOG.md` (T-252 のチェック) はリーダーがまとめて更新する前提。本リポの CHANGELOG は T-175 で
  親に集約済みなので追記していない。

## ロールバック観点

- 変更は `_data/plans.yml` の 3 箇所 (行の追加 2 / 値の変更 1) のみ。スキーマ変更・Supabase / Stripe / Worker
  への変更は無い。
- 未コミットなら `git checkout -- _data/plans.yml`。コミット後なら該当コミットを `git revert`。
- Enterprise だけ戻す場合は `value: "クレジットカード・請求書払い・銀行振込"` を `"請求書払い・銀行振込"` に戻す
  (Light / Pro の行は残してよい。3 プランの行構成は独立)。
- 戻した後もページ側の変更は不要 (全て SSOT 参照)。

## デプロイ時にユーザーが行う手順

1. `deepmosaic.github.io` (追従ブランチ `master`) で差分を確認してコミット:
   `git -C deepmosaic.github.io diff -- _data/plans.yml` → `git commit -m "feat: T-252 料金カードの支払方法を 3 プランに明示"`。
   T-254 / T-263 (CTA / href) と同時に出すなら同じリリースにまとめる (上の注意点)。
2. push (サブモジュール → 親の順)。GitHub Actions (`.github/workflows/jekyll.yml`) が `npm test` →
   `npm run build && jekyll build` → `check-plan-catalog.mjs` (Secrets の `SUPABASE_PROXY_API_KEY` があれば実比較) →
   `check-docs.mjs` を回して Pages にデプロイする。
3. 本番確認 (https://www.deepmosaic.co.jp/):
   - トップ PRICING 節と `/price/` の 3 カードに「支払方法」行が出て、Light / Pro = `クレジットカード`、
     Enterprise = `クレジットカード・請求書払い・銀行振込` になっている
   - `/llms-full.txt` §4 の各プランに `- 支払方法: ...` が出ている
   - モバイル幅でカードの行が折り返しても崩れていない
4. 親リポでサブモジュールのポインタを更新してコミット・push (`chore: T-252 完了 — サブモジュール更新 (deepmosaic.github.io <sha>)`)。
