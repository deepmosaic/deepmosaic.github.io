<script>
  // Renders the mobile hamburger + slide-in drawer from a JSON `data-links`
  // list (server-rendered by Jekyll with localized labels). The desktop nav and
  // a <noscript> fallback live in the header markup, so no-JS still navigates.
  // `dlAttr` は流入経路 (TICKET-SITE-37)。`src/main.js` が **mount より前**に
  // `data-dl-attr` へ書き込むので、Svelte のスケジューリングに依存せず受け取れる。
  // ここで href を組むのは、このドロワーのリンクだけが**クライアント側で後から
  // 生える**ため。読み込み時に `a[data-dl]` を書き換える経路では拾えない。
  import {
    decorateDownloadUrl,
    parseFirstEnvelope,
    parseStoredAttribution,
  } from '../lib/attribution.js';
  // T-231: `download` は真偽属性ではない。`!!` で渡すと download="false" になり
  // 同一オリジンのリンクが "false.html" の強制ダウンロードになる
  import { downloadAttr } from '../lib/download-attr.js';
  // T-2204 (i18n1112 I18N-706): ページの言語は <html lang> から読む (W7-site.md §0-C)。
  import { pageLang, pick } from '../lib/site-lang.js';

  // ドロワーの文の 3 言語の表 (ja は今の文字列のまま)。言語の切り替えの見出しは lang-switch.html の
  // 「表示言語」/ L.lang_switch_label と同じ文
  const TEXT = {
    ja: { open: 'メニューを開く', close: 'メニューを閉じる', langHeading: '表示言語' },
    en: { open: 'Open menu', close: 'Close menu', langHeading: 'Language' },
    'zh-tw': { open: '開啟選單', close: '關閉選單', langHeading: '語言' },
  };
  const text = pick(TEXT, pageLang());

  /**
   * 言語の切り替えのリンク (lang-switch.html の drawer-data が出す JSON)。無い・読めないときは空 = 何も足さない。
   * 項目は { label, href, lang, current } だけを受け取り、形の違うものは捨てる (外部入力として扱う)
   */
  function readLangLinks() {
    const el = document.querySelector('script[data-lang-links]');
    if (!el) return [];
    try {
      const parsed = JSON.parse(el.textContent ?? '');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        // 行き先はサイト内のパスだけ (`/` で始まり `//` で始まらない。javascript: などを通さない)
        (l) =>
          l &&
          typeof l.label === 'string' &&
          typeof l.lang === 'string' &&
          typeof l.href === 'string' &&
          l.href.startsWith('/') &&
          !l.href.startsWith('//'),
      );
    } catch {
      return [];
    }
  }
  const langLinks = readLangLinks();

  let { links = '[]', edge = 'right', dlAttr = '', dlFirst = '' } = $props();

  const items = $derived.by(() => {
    try {
      return JSON.parse(links);
    } catch {
      return [];
    }
  });

  // 保存済みの値は外部入力として扱う (由来は着地 URL のクエリ)。parse 側が再検証する
  const attribution = $derived(parseStoredAttribution(dlAttr));
  // T-008: first-touch は last-touch と別枠。エンベロープごと渡されるので
  // 期限と中身の再検証もここで通る
  const firstTouch = $derived(parseFirstEnvelope(dlFirst, Date.now()));

  /** DL 項目だけ href に流入経路を載せる。それ以外のリンクには一切付けない */
  const hrefOf = (item) =>
    item.dl
      ? decorateDownloadUrl(new URL(item.href, location.href).toString(), attribution, firstTouch)
      : item.href;

  let open = $state(false);
  let panelEl = $state();

  const close = () => (open = false);
  const toggle = () => (open = !open);
  const onKeydown = (e) => {
    if (e.key === 'Escape' && open) close();
  };

  $effect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) panelEl?.querySelector('a')?.focus();
    return () => {
      document.body.style.overflow = '';
    };
  });

  // Move the overlay + drawer to <body>. The sticky header uses backdrop-filter,
  // which establishes a containing block for position:fixed descendants — without
  // this portal the drawer would be positioned relative to the 60px header
  // instead of the viewport.
  function portal(node) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
</script>

<svelte:window onkeydown={onKeydown} />

<button
  type="button"
  class="inline-flex items-center justify-center p-2 text-ink"
  aria-label={text.open}
  aria-expanded={open}
  onclick={toggle}
>
  <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
</button>

<div use:portal>
  <div
    class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 {open
      ? 'opacity-100'
      : 'pointer-events-none opacity-0'}"
    aria-hidden="true"
    onclick={close}
  ></div>

  <aside
    bind:this={panelEl}
    class="fixed top-0 z-50 h-full w-72 max-w-[80%] transform border-l border-hair bg-surface p-6 text-ink shadow-xl transition-transform duration-300 {edge ===
    'left'
      ? 'left-0'
      : 'right-0'} {open ? 'translate-x-0' : edge === 'left' ? '-translate-x-full' : 'translate-x-full'}"
    aria-hidden={!open}
  >
    <div class="mb-6 flex justify-end">
      <button type="button" class="p-2" aria-label={text.close} onclick={close}>
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
    <ul class="space-y-1">
      {#each items as item}
        <li>
          <a
            href={hrefOf(item)}
            download={downloadAttr(item.download)}
            data-dl={item.dl || undefined}
            hreflang={item.badge ? 'ja' : undefined}
            target={item.target || undefined}
            rel={item.target ? 'noopener noreferrer' : undefined}
            class="block rounded px-3 py-3 text-lg hover:bg-edge"
            onclick={close}
          >{item.label}{#if item.badge}<span class="ml-1 text-xs text-ink-3">{item.badge}</span>{/if}</a>
        </li>
      {/each}
    </ul>
    {#if langLinks.length > 0}
      <div data-i18n-switch class="mt-6 border-t border-hair pt-4" role="group" aria-label={text.langHeading}>
        <p class="mb-2 px-3 text-xs text-ink-3">{text.langHeading}</p>
        <div class="flex flex-col">
          {#each langLinks as link}
            <a
              href={link.href}
              lang={link.lang}
              hreflang={link.lang}
              aria-current={link.current ? 'true' : undefined}
              class="block rounded px-3 py-2 hover:bg-edge {link.current ? 'text-ink' : 'text-ink-2'}"
              onclick={close}
            >{link.label}</a>
          {/each}
        </div>
      </div>
    {/if}
  </aside>
</div>
