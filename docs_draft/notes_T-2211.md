# T-2211 (i18n1112 I18N-713) サイトの言語の自動の案内 (帯) と選んだ言語の記憶

## 変更点の要約
- ユーザーの決定 3 (新しい利用者はブラウザの言語で自動に決める) のサイトの分。**自動のリダイレクトはしない** (Googlebot は英語の環境で描画するので canonical と検索結果の言語が崩れる。設計書 §1.5)。代わりに、ja のページでブラウザの言語 (または前に選んだ言語) が英中のとき、英中のページへの**案内の帯**を JS で `body` の先頭に出し、利用者が選んだ言語を localStorage に覚える (W7-site.md §0-I)。
- 帯は実行時に JS が描くので、ビルドされた ja の HTML は 1 バイトも変わらない (ja-identity OK、17 files)。
- 触ったファイル:
  - `src/lib/lang-suggest.js` (新規、純関数): `STORAGE_KEY`・`TEXT` (3 言語の表)・`resolveSiteLang`・`normalizeStored`・`hreflangToSiteLang`・`toSitePath`・`decideSuggestion`
  - `src/lib/lang-suggest-mount.js` (新規、DOM): `mountLangSuggest(doc, storage, nav)`・`safeLocalStorage()`。`./lang-suggest.css` を import (vite が app.css に束ねる)
  - `src/lib/lang-suggest.css` (新規): `.lang-suggest` と BEM の子 (`__inner`・`__text`・`__actions`・`__link`・`__close`) だけ。上部に固定しない、`flex-wrap` で折り返す、フェードは `prefers-reduced-motion: reduce` で止める。繁体字の帯 (`:lang(zh)`) は TC の書体を先に (app.css の `:root:lang(zh)` と同じ並び)
  - `src/main.js`: 末尾の「i18n の初期化」の区切りの下に 2 行だけ (import と、DOMContentLoaded の後の `mountLangSuggest()`)
  - `src/lib/i18n-site-suggest.test.js` (新規、node テスト 33 件)
  - `e2e/i18n-suggest.spec.ts` (新規、チケットでは回していない)

## 保存のキーと値
- localStorage のキー `dm-site-lang`。値は `ja` | `en` | `zh-tw` (`zh-TW` も読むときは受ける。他の値は保存値なしと同じ)。
- 書く時: 帯のリンクを押す → 候補の言語 / 帯の閉じる → `ja` / 言語の切り替え (`[data-i18n-switch] a[hreflang]`、ヘッダー・フッター・モバイルのドロワー) を押す → その言語 (ja・en・zh-tw のどのページでも)。
- ページを開いただけでは書かない (検索から英中のページに来ただけで「選んだ」ことにしない)。
- localStorage が使えない (例外・無い) ときは保存せず、ブラウザの言語だけで判定する。

## 帯を出す条件 (decideSuggestion + mount)
| ページ | 保存値 | ブラウザの言語 (先頭から最初に当たるもの) | alternate (hreflang) | 帯 |
|---|---|---|---|---|
| en / zh-tw のページ | 何でも | 何でも | — | 出さない (切り替えの保存だけ) |
| ja | `ja` | 何でも | — | 出さない |
| ja | `en` / `zh-tw` | 何でも (ja でも) | その言語がある | その言語の帯 |
| ja | なし・未知の値 | ja* | — | 出さない |
| ja | なし・未知の値 | en* | en がある | 英語の帯 |
| ja | なし・未知の値 | zh* (zh-TW / zh-HK / zh-CN / zh-SG / zh-Hans / zh-Hant …) | zh-Hant-TW がある | 繁体字の帯 |
| ja | なし・未知の値 | ja / en / zh 以外だけ (fr・ko …) | en がある | 英語の帯 |
| ja | なし | 情報が無い (空・空文字だけ) | — | 出さない |
| ja | — | — | 候補の言語が無い (docs・法務・404 = `_data/i18n_pages.yml` の 9 本以外) | 出さない |
| ja | — | — | — | 読み込みの時点で既にスクロールしている (scrollY > 0) なら出さない |

- 行き先は `<link rel="alternate" hreflang>` の href (本番の絶対 URL) を**パスにして**使う (`toSitePath`。ローカル・プレビューで本番へ飛ばない。http(s) 以外は捨てる)。x-default は使わない。
- 帯: `<div class="lang-suggest" role="region" aria-label="…" lang="en|zh-Hant-TW" data-nosnippet>` の中に文 (`p`)・行き先のリンク (`a[hreflang]`)・閉じる (`button type=button`)。DOM へは createElement・textContent・setAttribute だけ。フォーカスは動かさない。2 回呼んでも 1 つ。

## 訳した文 (TEXT)
| キー | en | zh-tw |
|---|---|---|
| message | This page is also available in English. | 本頁面也提供繁體中文版。 |
| action | View in English | 以繁體中文檢視 |
| close | Close | 關閉 |
| region (aria-label) | Language suggestion | 語言建議 |
- message / action / close は spec の指定どおり (close は用語集 #62 close / 關閉)。region は spec に文が無いので自分で訳した (lintValue を通る)。
- ja の値 (`このページは日本語でもご覧いただけます。` など) は帯に出ない (候補が ja のときは帯を出さない) が、キーの集合を揃えるために置いた。

## 置いた仮定・spec / 設計書との食い違い
- `resolveSiteLang` の「情報が無い」ときは spec どおり `ja` (設計書 §1.2 の `fromSystem([])` は `en`)。空文字だけの並び (`['']`) も「情報が無い」として `ja` にした (設計書の表では `['']` → en)。`['x']` (どれにも当たらない) は `en`。
- `mountLangSuggest` の引数に 3 つ目の `nav = globalThis.navigator` を足した (spec の 2 引数の形はそのまま使える。テストで navigator を差し替えるため)。
- 「英中のページでは保存だけして何も描かない」は「言語の切り替えのクリックの保存だけをする」と読んだ (英中のページを開いただけでは保存しない)。
- 「スクロールの位置を動かさない」: 読み込みの時点で既にスクロールしている (戻る・アンカー付きの URL) ときは帯を差し込まない、とした。DOMContentLoaded の後にブラウザがスクロールの位置を戻す場合は、帯の高さ (約 50px) だけずれることがある (Chrome は scroll anchoring で吸収する)。
- 帯の中のリンクの `hreflang` は `en` / `zh-Hant-TW`。帯は `[data-i18n-switch]` の外なので document のクリックの保存とは二重にならない (帯のリンクは自分のリスナーで保存)。
- node テストは jsdom / linkedom を使わず (devDependencies に無い)、テストの中の小さな偽の DOM で mount を検査した。`lang-suggest-mount.js` の `import './lang-suggest.css'` は node が読めないので、テストの中だけ `node:module` の `register` で .css を空のモジュールに差し替えて動的に import している (Node 20.6 以降。CI は node 22)。
- 計測 (GA4) は足していない。cookie・外部への送信なし。
- desktop の成果物 (用語集・アプリの辞書) は写していない (このチケットの文は帯の 4 文だけで、用語集はサイトの写し `scripts/i18n/glossary.json` を lintValue が読む)。glossary.source.json は変えていない。

## W8 でアプリの辞書と突き合わせること
- `region` の en `Language suggestion` / zh-tw `語言建議` (アプリの辞書に同じ役割の文は無い。用語集の追加は不要と見た)。
- `action` の `View in English` / `以繁體中文檢視` と言語の切り替え (I18N-706、表示名は自称で訳さない) の言い回し。

## 用語集の追加の候補
- なし。

## 追加したコマンド・テスト
- `node --test src/lib/i18n-site-suggest.test.js` (33 件。`npm test` の glob に入る)
- `e2e/i18n-suggest.spec.ts` (Playwright。チケットでは回さない)

## ゲートの結果 (Implementer、コミット前)
- `node --test src/lib/i18n-site-suggest.test.js`: 33 pass / 0 fail (先に書いて RED = モジュールが無くて落ちるのを確かめた)
- `npm test`: 1256 件、pass 1253 / fail 0 / skipped 3 (skip は既存)
- `npm run build && bundle exec jekyll build --strict_front_matter`: OK (app.css に `.lang-suggest*` と `@keyframes lang-suggest-in` が入る)
- `node scripts/check-docs.mjs`: OK
- `node scripts/i18n/ja-identity.mjs D:/dm-scratch/i18n/site-base/W7/_site _site`: OK (17 files)
- `node scripts/i18n/check-site.mjs _site`: OK (11 モジュール)
- `git diff --stat` と `--ignore-cr-at-eol` が一致 (main.js +2 行)

## ウェーブ末尾の Playwright でリーダーが確かめること (`e2e/i18n-suggest.spec.ts`)
- `locale: 'en-US'` で `/` → 帯があり、リンクが `/en/`・押すと `/en/`・`/` に戻っても帯が出る (保存値 en)。URL は `/` のまま (リダイレクトしない)。
- 閉じる → 再読込で帯が無い (保存値 ja)。
- `locale: 'zh-CN'` で `/price/` → 繁体字の帯 (`lang="zh-Hant-TW"`) で `/zh-tw/price/`。
- `locale: 'ja-JP'` で帯が無い。
- 言語の切り替えで「日本語」を選ぶと以後 帯が無い。
- docs (`/docs/`) では帯が無い。
- 目で見ること: 320px 幅で文とボタンが折り返す、sticky のヘッダーを隠さない、帯でページが横にスクロールしない。英中の locale で読み込み直後のレイアウトのずれ (CLS、帯の高さ 約 45〜50px だけヘッダーと本文が下がるか) も確認する (spec どおり body の先頭の通常の流れに置いているので直していない。公開後の計測の観点)。
- 既存の e2e (header-enterprise・mobile-nav・join・contact・inquiry・enterprise-integration・i18n-nav・i18n-contact) も Playwright の既定 locale `en-US` で回るため、alternate を持つ ja のページには英語の帯が出た状態で走る。静的に読んだ範囲では落ちないと見ているが未確認。落ちた場合は帯との干渉 (位置・はみ出し・最初のフォーカス) を先に疑う。playwright.config.ts と既存 spec の期待値は変えない。
- 公開後に確かめること: 英中の Google の検索結果に帯の文が出ないこと (`data-nosnippet`。Googlebot は英語の環境で描画するので ja のページに英語の帯が描かれる)。

## ユーザーの決定 3 の満たし方 (リーダーがユーザーに伝える)
- サイトは**自動のリダイレクトをしない** (検索エンジンが ja のページを英語へ飛ばされて canonical と検索結果の言語が崩れるため)。代わりに、ja のページをブラウザの言語が英語・中国語の人が開くと、ページの上に「英語版 / 繁体字版があります」の帯を出し、押せば英中のページへ移る。選んだ言語 (帯のリンク・閉じる・言語の切り替え) はブラウザに覚え、次から帯の出し方に使う (日本語を選べば以後出さない)。サーバーには何も送らない。

## ロールバックの観点
- 新規 5 ファイルの削除と `src/main.js` の末尾 2 行の削除で戻る。他のチケットの持ち物に依存されていない (lang-switch.html のコメントが I18N-713 を参照しているだけ)。
- 利用者のブラウザに `dm-site-lang` が残るが、戻した後は読まれない。

## レビューの指摘で直さなかったもの
- `_site/scripts/` に check-docs.mjs・check-plan-catalog.mjs・optimize-images.mjs が出力される (`_config.yml` の exclude が scripts/i18n だけ)。基点の _site にも同じ 3 本があり、T-2211 が原因ではない既存の状態なので、このチケットでは触らない。公開物から外すなら別チケットで exclude に scripts を足す。
