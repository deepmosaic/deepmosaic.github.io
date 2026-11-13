# T-2218 (i18n1112 I18N-807): 用語集の写しを 220 語の版へ

- 変更点: `scripts/i18n/glossary.json` を desktop (feat/T-2218) の `src/lib/i18n/glossary.json` から LF で写した (211 → 220 語、forbidden.en に cancelled・cancelling)。`scripts/i18n/glossary.source.json` の `sha256["glossary.json"]` を `bbd459767a5a2435a972a11329cbc92b6b58feec979042789258f11b2d1fb8c3` (LF の内容) に、`note` に T-2218 の 1 文を足した。`glossary-chars.json` は desktop と同じ (変えていない)。`src/lib/i18n-site-lang.test.js` の語数の期待値を 211 → 220 と題に。
- 写した版: desktop の T-2218 のコミット (`glossary.source.json` の `desktop_commit` に 40 桁で書く)。
- 足した語の表と W8b への申し送りは desktop の `docs_draft/notes_T-2218.md`。
- ロールバック: このコミットを revert する。
