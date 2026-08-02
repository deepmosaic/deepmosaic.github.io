import './app.css';

// ---------------------------------------------------------------------------
// Vanilla progressive enhancements (no framework). These replace the old
// jQuery-wrapped assets/js/index.js. Svelte island mounts are added below.
// ---------------------------------------------------------------------------

// Scroll-triggered reveal: add `.animated` once each element enters the viewport.
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const els = document.querySelectorAll('.animate-on-scroll');
  if (!els.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  els.forEach((el) => observer.observe(el));
}

// Back-to-top button: show past 500px, smooth-scroll to top on click.
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ダウンロードの流入経路 (TICKET-SITE-37)。
//
// 着地時に utm_* と外部参照元を sessionStorage へ置き、DL リンクの href に載せ直す。
// **JS が動いたときの上乗せに限る** — 素の href は Liquid が出したままなので、
// JS 無効・バンドル読み込み失敗・広告ブロッカーでもダウンロードは今までどおり動く。
//
// 純ロジックは `src/lib/attribution.js`。この関数だけが DOM / sessionStorage に触る。
import {
  attributionFromLanding,
  decorateDownloadUrl,
  ga4FileDownloadParams,
  mergeAttribution,
  parseStoredAttribution,
  serializeAttribution,
} from './lib/attribution.js';

const ATTR_KEY = 'dm_attr';

// sessionStorage は Safari のプライベートモード等で throw する。握って続行する
function readStored() {
  try {
    return parseStoredAttribution(sessionStorage.getItem(ATTR_KEY));
  } catch {
    return null;
  }
}
function writeStored(record) {
  try {
    sessionStorage.setItem(ATTR_KEY, serializeAttribution(record));
  } catch {
    /* 保存できなくてもこのページ内の装飾は効く */
  }
}

/** `a[data-dl]` の href に流入経路を載せる。冪等 (二度呼んでも増えない)。 */
function decorateLinks(record, root = document) {
  if (record === null) return;
  root.querySelectorAll('a[data-dl]').forEach((a) => {
    // `a.href` は解決済みの絶対 URL。**クエリ由来の値を href に直接代入しない**
    a.setAttribute('href', decorateDownloadUrl(a.href, record));
  });
}

function initDownloadTracking() {
  const record = mergeAttribution(
    readStored(),
    attributionFromLanding({
      search: location.search,
      referrer: document.referrer,
      origin: location.origin,
    })
  );
  if (record !== null) writeStored(record);

  // 読み込み時に書き換えるのが主。**クリック委譲だけでは中クリック・右クリックの
  // 「リンクのアドレスをコピー」・ステータスバー表示・D&D で utm が全部落ちる。**
  decorateLinks(record);

  // クリック側は (1) 後から生えた <a> の取りこぼしの保険 (2) GA4 の送信。
  // capture 相で拾うのは、ナビゲーションが始まる前に href を確定させるため。
  // 中クリックは `click` ではなく `auxclick` が飛ぶので両方を見る。
  let lastSent = null;
  const onActivate = (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[data-dl]') : null;
    if (a === null) return;
    const current = readStored() ?? record;
    if (current !== null) a.setAttribute('href', decorateDownloadUrl(a.href, current));

    // `click` と `auxclick` が同一操作で続けて飛ぶ環境があるので重複を潰す。
    // **時刻をバケットに丸めない** — 境界をまたぐと同じ操作が 2 回送られる。
    // 「同じボタンを 500ms 以内に再度」だけを潰す (別のボタンなら必ず送る)。
    const now = Date.now();
    if (lastSent !== null && lastSent.dl === a.dataset.dl && now - lastSent.at < 500) return;
    lastSent = { dl: a.dataset.dl, at: now };

    // **gtag が無くても装飾は続ける。** 計測が落ちてもダウンロードは壊さない
    window.gtag?.(
      'event',
      'file_download',
      ga4FileDownloadParams({
        href: a.href,
        text: a.textContent,
        id: a.dataset.dl ?? '',
        classes: a.className,
      })
    );
  };
  document.addEventListener('click', onActivate, true);
  document.addEventListener('auxclick', onActivate, true);

  return record;
}

// ---------------------------------------------------------------------------
// Svelte island mounts — each hydrates server-rendered (Jekyll) markup, so the
// page works without JS and islands only add interactivity.
// ---------------------------------------------------------------------------
import { mount } from 'svelte';
import MobileNav from './islands/MobileNav.svelte';
import Accordion from './islands/Accordion.svelte';
import Scrollspy from './islands/Scrollspy.svelte';
import VideoLightbox from './islands/VideoLightbox.svelte';
import RoiCalculator from './islands/RoiCalculator.svelte';
import Tabs from './islands/Tabs.svelte';

function mountIslands(selector, Component) {
  document.querySelectorAll(selector).forEach((el) => {
    // Pass the host element (behavior islands enhance existing DOM) plus any
    // data-* attributes (rendering islands read their config from these).
    mount(Component, { target: el, props: { host: el, ...el.dataset } });
  });
}

function init() {
  initScrollReveal();
  initBackToTop();
  // **island のマウントより前**に済ませる。MobileNav が描画する DL リンクへは
  // `data-dl-attr` を props として渡すので、Svelte のスケジューリングに依存しない。
  const attribution = initDownloadTracking();
  document.querySelectorAll('[data-island="mobile-nav"]').forEach((el) => {
    el.dataset.dlAttr = serializeAttribution(attribution);
  });
  mountIslands('[data-island="mobile-nav"]', MobileNav);
  mountIslands('[data-island="accordion"]', Accordion);
  mountIslands('[data-island="scrollspy"]', Scrollspy);
  mountIslands('[data-island="video-lightbox"]', VideoLightbox);
  mountIslands('[data-island="roi"]', RoiCalculator);
  mountIslands('[data-island="tabs"]', Tabs);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
