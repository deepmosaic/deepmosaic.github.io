<script>
  // Replaces the jQuery-based lity lightbox. Mounted once on a container; it
  // delegates clicks on descendant `a[data-video-url]` links and opens the
  // YouTube video in a modal. With no JS the links navigate to youtu.be.
  let { host } = $props();

  let open = $state(false);
  let embedUrl = $state('');
  let closeBtn = $state();

  function toEmbed(url) {
    let id = '';
    try {
      const u = new URL(url, location.href);
      if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
      else if (u.searchParams.get('v')) id = u.searchParams.get('v');
      else id = u.pathname.split('/').filter(Boolean).pop() || '';
    } catch {
      id = url;
    }
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  }

  const close = () => {
    open = false;
    embedUrl = '';
  };
  const onKeydown = (e) => {
    if (e.key === 'Escape' && open) close();
  };

  $effect(() => {
    if (!host) return;
    const onClick = (e) => {
      const a = e.target.closest('a[data-video-url]');
      if (!a || !host.contains(a)) return;
      e.preventDefault();
      embedUrl = toEmbed(a.getAttribute('data-video-url'));
      open = true;
    };
    host.addEventListener('click', onClick);
    return () => host.removeEventListener('click', onClick);
  });

  $effect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) closeBtn?.focus();
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    role="dialog"
    aria-modal="true"
    aria-label="動画プレーヤー"
    onclick={close}
  >
    <div class="relative w-full max-w-4xl" onclick={(e) => e.stopPropagation()}>
      <button
        bind:this={closeBtn}
        type="button"
        class="absolute -top-10 right-0 p-2 text-white"
        aria-label="閉じる"
        onclick={close}
      >
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div class="video-embed rounded-lg bg-black">
        <iframe
          src={embedUrl}
          title="YouTube video player"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </div>
{/if}
