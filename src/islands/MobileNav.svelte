<script>
  // Renders the mobile hamburger + slide-in drawer from a JSON `data-links`
  // list (server-rendered by Jekyll with localized labels). The desktop nav and
  // a <noscript> fallback live in the header markup, so no-JS still navigates.
  // `dlAttr` は流入経路 (TICKET-SITE-37)。`src/main.js` が **mount より前**に
  // `data-dl-attr` へ書き込むので、Svelte のスケジューリングに依存せず受け取れる。
  // ここで href を組むのは、このドロワーのリンクだけが**クライアント側で後から
  // 生える**ため。読み込み時に `a[data-dl]` を書き換える経路では拾えない。
  import { decorateDownloadUrl, parseStoredAttribution } from '../lib/attribution.js';

  let { links = '[]', edge = 'right', dlAttr = '' } = $props();

  const items = $derived.by(() => {
    try {
      return JSON.parse(links);
    } catch {
      return [];
    }
  });

  // 保存済みの値は外部入力として扱う (由来は着地 URL のクエリ)。parse 側が再検証する
  const attribution = $derived(parseStoredAttribution(dlAttr));

  /** DL 項目だけ href に流入経路を載せる。それ以外のリンクには一切付けない */
  const hrefOf = (item) =>
    item.dl ? decorateDownloadUrl(new URL(item.href, location.href).toString(), attribution) : item.href;

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
  aria-label="メニューを開く"
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
      <button type="button" class="p-2" aria-label="メニューを閉じる" onclick={close}>
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
            download={!!item.download}
            data-dl={item.dl || undefined}
            target={item.target || undefined}
            rel={item.target ? 'noopener noreferrer' : undefined}
            class="block rounded px-3 py-3 text-lg hover:bg-edge"
            onclick={close}
          >{item.label}</a>
        </li>
      {/each}
    </ul>
  </aside>
</div>
