# T-1940: ヘッダー「法人様はこちら」

## 変更点
- `_includes/header.html`
  - PC (lg = 1024px 以上): 「無料でダウンロード」の右に `btn-secondary` の「法人様はこちら」(アイコン `Building2`) を追加。行き先は `/enterprise/inquiry/`。ダウンロードとの間は `lg:-ml-4` で 12px に詰めた。
  - md (768〜1023px): 新ボタンは隠す。あわせて既存の崩れ (768px でナビの「ホーム」「料金」などが 1 文字ずつ折り返して 2 行になっていた) を直した: 行の間隔 `gap-7` → `gap-4 lg:gap-7`、ナビのリンクの横の余白 `px-3` → `px-2 lg:px-3`、ナビの左の余白 `ml-3` → `lg:ml-3`、ナビに `whitespace-nowrap`、ロゴに `shrink-0`。lg 以上の見た目は従来どおり。
  - モバイル: ドロワーの `data-links` の末尾 (「問い合わせ」の後) に `{"label":"法人様はこちら","href":"/enterprise/inquiry/"}`。`<noscript>` 版のナビにも同じリンク。
- `e2e/header-enterprise.spec.ts` (新規): PC 幅で最後の要素が「法人様はこちら」でダウンロードより右・クリックで遷移 / 320・768・1024px ではみ出し・折り返し・重なりが無い (1024px は新ボタンが見える、それ未満は隠れる) / モバイルのドロワーの項目とタップでの遷移。
- `e2e/contact.spec.ts`: 導入相談リンクの件数の検査をページ本文の section の中に絞った (ヘッダーの新リンクが混ざるため)。

## 追加・変更したコマンド
- なし (`npm run e2e` が新しい spec も拾う。単独なら `npx playwright test e2e/header-enterprise.spec.ts`)

## 注意点・既知の制約
- 768〜1023px では新ボタンもドロワーも出ない (ドロワーは md 未満だけ)。この幅の利用者は料金ページの導線 (`/enterprise/inquiry/`) から行く。md でも出すには、ダウンロードの文言を短くするかハンバーガーを lg 未満まで広げる必要がある (今回は既存の流儀を変えない)。
- 1024px での行の余りは数十 px しかない。ナビの項目を足すと lg でも詰まるので、そのときは本 spec の 1024px が落ちる。
- ヘッダーは全ページに載るので、`/enterprise/inquiry/` へのリンクを数えるテストではヘッダーの 2 本 (PC ボタンと noscript) が件数に混ざる。`e2e/contact.spec.ts` の「本文に導入相談への逃がし先が 1 つ残る」検査は、ページ本文の `section` の中に絞った (モバイルのドロワーは body 直下へ portal されるので `header ~ *` では混ざる)。
- `mobile-nav.spec.ts` はドロワーの同一オリジンのリンクを全部タップするので、新しい項目も自動で対象になる。

## ロールバック
- `_includes/header.html` と `e2e/header-enterprise.spec.ts` をこのコミットの前に戻すだけ (他への依存なし)。

## OpenAPI に足す内容
- なし (サイトの表示だけ)。
