// T-2211 (i18n1112 I18N-713): サイトの言語の案内の帯を描き、選んだ言語を覚える (DOM と localStorage はこのファイルだけ)。
//
//   - ja のページ (<html lang="ja">) で、ブラウザの言語か保存値が英中のときだけ、`body` の先頭に帯を足す。
//     行き先は <link rel="alternate" hreflang> (I18N-705) の href。alternate の無いページ (docs・法務・404) には出さない。
//   - **リダイレクトはしない** (設計書 §1.5・W7-site.md §0-I)。帯のリンクは利用者が押したときだけ移る。
//   - 帯のリンクを押す → 保存値にその言語、閉じる → 保存値に 'ja' (以後 帯を出さない)。
//   - 言語の切り替え (`[data-i18n-switch] a[hreflang]`、I18N-706) を押す → その言語を保存 (英中のページでも保存だけする)。
//   - localStorage は try/catch で包む。使えなければ保存せず、ブラウザの言語だけで帯を判定する。
//   - フォーカスを奪わない。読み込みの時点で既にスクロールしていれば帯を差し込まない (位置を動かさない)。
//   - DOM へは createElement・textContent・setAttribute だけ (innerHTML を使わない)。外部へ何も送らない。
//   - ja の HTML は 1 バイトも変わらない (帯は実行時に JS が描く。ja-identity はビルドの HTML を比べる)。

import './lang-suggest.css';
import { pageLang } from './site-lang.js';
import { STORAGE_KEY, TEXT, decideSuggestion, hreflangToSiteLang, normalizeStored, toSitePath } from './lang-suggest.js';

/** 帯の要素の lang / hreflang の値 */
const HTML_LANG = { en: 'en', 'zh-tw': 'zh-Hant-TW' };
const SWITCH_LINK = 'a[hreflang]';
const SWITCH_ROOT = '[data-i18n-switch]';
const BANNER_CLASS = 'lang-suggest';

/** localStorage (アクセスそのものが throw する環境では null) */
export function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStored(storage) {
  try {
    return normalizeStored(storage?.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStored(storage, lang) {
  try {
    storage?.setItem(STORAGE_KEY, lang);
  } catch {
    /* 保存できなくても帯と移動はそのまま動く */
  }
}

/** ブラウザの言語の並び (navigator.languages、無ければ [navigator.language]) */
function browserLanguages(nav) {
  if (Array.isArray(nav?.languages) && nav.languages.length > 0) return nav.languages;
  return typeof nav?.language === 'string' ? [nav.language] : [];
}

/** <link rel="alternate" hreflang> から { en, 'zh-tw' } のサイト内のパスを集める (x-default は使わない) */
function collectAlternates(doc) {
  const out = {};
  for (const link of doc.querySelectorAll('link[rel="alternate"][hreflang]')) {
    const lang = hreflangToSiteLang(link.getAttribute('hreflang'));
    if (lang !== 'en' && lang !== 'zh-tw') continue;
    const path = toSitePath(link.getAttribute('href'));
    if (path !== null && !(lang in out)) out[lang] = path;
  }
  return out;
}

/** 言語の切り替えのクリックを拾って保存する (document に 1 つだけ) */
function listenSwitch(doc, storage) {
  doc.addEventListener('click', (e) => {
    const target = e?.target;
    if (!target || typeof target.closest !== 'function') return;
    const a = target.closest(SWITCH_LINK);
    if (!a || !a.closest(SWITCH_ROOT)) return;
    const lang = hreflangToSiteLang(a.getAttribute('hreflang'));
    if (lang !== null) writeStored(storage, lang);
  });
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildBanner(doc, storage, { lang, href }) {
  const text = TEXT[lang];
  const banner = el(doc, 'div', BANNER_CLASS);
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', text.region);
  banner.setAttribute('lang', HTML_LANG[lang]);
  banner.setAttribute('data-nosnippet', '');

  const inner = el(doc, 'div', 'lang-suggest__inner');
  const message = el(doc, 'p', 'lang-suggest__text', text.message);
  const actions = el(doc, 'div', 'lang-suggest__actions');
  const link = el(doc, 'a', 'lang-suggest__link', text.action);
  link.setAttribute('href', href);
  link.setAttribute('hreflang', HTML_LANG[lang]);
  link.addEventListener('click', () => writeStored(storage, lang));
  const close = el(doc, 'button', 'lang-suggest__close', text.close);
  close.setAttribute('type', 'button');
  close.addEventListener('click', () => {
    writeStored(storage, 'ja');
    banner.remove();
  });

  actions.append(link, close);
  inner.append(message, actions);
  banner.append(inner);
  return banner;
}

const switchDocs = new WeakSet();

/**
 * 言語の案内を初期化する。帯を描いたらその要素、描かなければ null。
 * @param {Document} [doc]
 * @param {Pick<Storage, 'getItem' | 'setItem'> | null} [storage]
 * @param {{ languages?: readonly string[], language?: string }} [nav]
 */
export function mountLangSuggest(doc = document, storage = safeLocalStorage(), nav = globalThis.navigator) {
  if (!switchDocs.has(doc)) {
    switchDocs.add(doc);
    listenSwitch(doc, storage);
  }
  const lang = pageLang(doc);
  if (lang !== 'ja' || !doc.body) return null;
  // 2 回目の呼び出しで帯を重ねない
  if (doc.body.children && Array.from(doc.body.children).some((c) => c.className === BANNER_CLASS)) return null;
  // 既にスクロールした位置 (戻る・アンカー) で差し込むと本文が下へずれるので出さない
  if ((doc.defaultView?.scrollY ?? 0) > 0) return null;

  const suggestion = decideSuggestion({
    pageLang: lang,
    languages: browserLanguages(nav),
    stored: readStored(storage),
    alternates: collectAlternates(doc),
  });
  if (suggestion === null) return null;
  const banner = buildBanner(doc, storage, suggestion);
  doc.body.insertBefore(banner, doc.body.firstChild);
  return banner;
}
