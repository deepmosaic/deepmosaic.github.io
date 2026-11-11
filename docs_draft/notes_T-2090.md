# T-2090: 公式サイトに `/join/` (法人の案内メールのリンクの着地点) を足す (login1111、未公開の統合ブランチ `store1109-integrate`)

メール本文に `deepmosaic://` を直接書くとメールソフトが開けない / 警告を出すので、案内メールには https のリンクを入れ、このページから
利用者がボタンでアプリを開く。

- メンバー用: `https://www.deepmosaic.co.jp/join/#code=XXXX-XXXX-XXXX` → 「アプリで開く」= `deepmosaic://join?code=XXXX-XXXX-XXXX`
- 管理者用: `https://www.deepmosaic.co.jp/join/#admin` → 「アプリで開く」= `deepmosaic://login`
- それ以外・不正なコード: 「リンクが正しくありません。…」(ボタンなし、入力値を画面に出さない)

## 変更点
- `join/index.html` (新規): 見出し「Deepmosaic を開く」、3 つの表示 (既定はすべて `hidden`、JS が 1 つだけ出す)、手順、組織コードの「コピー」、
  「アプリをまだ入れていない方」= Microsoft Store の掲載ページ (`_data/lang/ja.json` の `app_download_link`、別タブ・`noopener noreferrer`、`data-dl` なし)。
  JS 無効時は `<noscript>` の案内。ナビゲーション・フッター・`llms.txt` には載せない。
- `src/lib/join-hash.js` (新規): 純関数 `parseJoinHash(hash)` → `{kind:'code',code}` / `{kind:'admin'}` / `{kind:'invalid'}`、`joinAppUrl(code)`。
  組織コードは大文字化・前後の空白除去の後に `^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$` に通ったときだけ返す。フラグメントは 64 文字まで、
  `code=` 以外の値が続く (`&x=1`) ものや壊れたパーセントエンコードは invalid。
- `src/main.js`: `initJoinPage()` (`[data-join]` があるときだけ)。DOM へは `textContent` と `setAttribute('href', …)` / `removeAttribute('href')` だけ。
  `hashchange` で表示を追従させ、前のコードを残さない。**自動では開かない**。
- `_layouts/default.html`: front matter の **`no_tracking: true`** を新設 (既存に「計測なし」の切り替えが無かったため)。
  Google tag・LINE の social plugin・Cloudflare Web Analytics を出さず、`<meta name="referrer" content="no-referrer">` を足し、
  `<html data-no-tracking>` を付ける。`src/main.js` はこの印があると流入経路の記録 (`dm_attr` / `dm_attr_first` の localStorage と
  DL リンクの装飾) をしない。noindex は既存の `page.noindex` (`noindex, nofollow`)、サイトマップは `sitemap: false`。
  **既存ページの出力は不変** (トップ・/price/・/subscribe/・404 の `_site` を変更前と diff、`?v=` のビルド時刻以外は一致)。
- `src/app.css`: `@source "../join/**/*.html";`
- テスト: `src/lib/join-hash.test.js` (表 38 件 + 境界・不変条件)、`src/lib/site-copy-t2090.test.js` (原稿・レイアウト・main.js の固定)、
  `e2e/join.spec.ts` (3 つの表示・href・hashchange・自動で開かない・コピー・外部リクエスト 0・gtag / localStorage なし・noindex・
  referrer・サイトマップ・Store リンク・Pixel 7 幅ではみ出さない、計 16 件)。

## ゲート (このチケットで実行)
- `npm test` 694 件 (pass 693 / skip 1 は既存)、`npm run build && bundle exec jekyll build --strict_front_matter` 成功、
  `npm run e2e` 59 件 (pass 58 / skip 1 は既存)、CI の `Verify build output` 相当 (exit 0)、`node scripts/check-docs.mjs` OK。
- 陰性対照: 同じ「外部リクエストの検知」を `/subscribe/` に向けると googletagmanager / line-scdn / cloudflareinsights の 3 ホストを検知する
  (`/join/` は 0 件)。

## CSP
- このサイトには CSP が無い (`_headers` も `<meta http-equiv="Content-Security-Policy">` も無い。GitHub Pages + Cloudflare)。
  よって `deepmosaic:` へのリンクを塞ぐものは無い。将来 CSP を足すときも、リンクの遷移を縛るのは `navigate-to` (ブラウザ未実装・仕様から削除済み) だけで、
  `default-src` / `script-src` 等はリンクの遷移に効かない。`form-action` は form の送信だけ。
- Cloudflare 側でゾーン全体の Web Analytics の自動注入 (RUM) を再び有効にすると、このページにも beacon が入る (TICKET-SITE-39 で止めてある)。
  公開後に `/join/` のソースに `cloudflareinsights` が無いことを確かめる。

## 公開の順序 (リーダー判断)
- **desktop 2.13 (T-2087〜T-2089 で `deepmosaic://join` / `deepmosaic://login` を受ける) の公開と同時かそれ以降**。それより前に公開しても害は無いが、
  ボタンを押してもアプリ (2.12 以前) は URL を受けられない。
- req1111 が案内メールに `/join/#code=…` / `/join/#admin` のリンクを入れる時期と合わせる (メールの文面は req1111 の担当)。
- 公開は統合ブランチ `store1109-integrate` の他の変更と一緒 (master への push はリーダー / ユーザー)。

## 仮定
- フラグメントのキー名 `code` は大文字小文字を区別しない (`#CODE=` も可)、`#admin` も同様。`code=` の後ろに別の値 (`&…`) が付いたものは不正扱い。
- 「アプリで開く」の主ボタン (コード) は原稿では `href` を持たず、JS が検証後に付ける。管理者のボタンは固定値なので原稿に `deepmosaic://login` を書いた
  (表示は `hidden` で、`#admin` のときだけ出る)。
- Store へのリンクは計測しない (`data-dl` を付けない。CI の data-dl 検査は index / price / spec だけなので影響なし)。ヘッダーの DL ボタンは
  `data-dl` を持ったままだが、gtag が無いので送信されず、流入経路の記録も止まる。

## ロールバック
- `join/` / `src/lib/join-hash*.js` / `src/lib/site-copy-t2090.test.js` / `e2e/join.spec.ts` を消し、`src/main.js` の initJoinPage と
  `noTracking` の分岐、`_layouts/default.html` の `no_tracking` の分岐、`src/app.css` の `@source` を戻す (このコミットを revert すればよい)。
