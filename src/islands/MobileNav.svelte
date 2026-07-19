<script>
  // Renders the mobile hamburger + slide-in drawer from a JSON `data-links`
  // list (server-rendered by Jekyll with localized labels). The desktop nav and
  // a <noscript> fallback live in the header markup, so no-JS still navigates.
  let { links = '[]', edge = 'right' } = $props();

  const items = $derived.by(() => {
    try {
      return JSON.parse(links);
    } catch {
      return [];
    }
  });

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
</script>

<svelte:window onkeydown={onKeydown} />

<button
  type="button"
  class="inline-flex items-center justify-center p-2 text-white"
  aria-label="メニューを開く"
  aria-expanded={open}
  onclick={toggle}
>
  <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
</button>

<div
  class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 {open
    ? 'opacity-100'
    : 'pointer-events-none opacity-0'}"
  aria-hidden="true"
  onclick={close}
></div>

<aside
  bind:this={panelEl}
  class="bg-hero-gradient fixed top-0 z-50 h-full w-72 max-w-[80%] transform p-6 text-white shadow-xl transition-transform duration-300 {edge ===
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
          href={item.href}
          download={!!item.download}
          target={item.target || undefined}
          rel={item.target ? 'noopener noreferrer' : undefined}
          class="block rounded px-3 py-3 text-lg hover:bg-white/10"
          onclick={close}
        >{item.label}</a>
      </li>
    {/each}
  </ul>
</aside>
