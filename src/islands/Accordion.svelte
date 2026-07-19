<script>
  // Behavior-only enhancement: the FAQ is server-rendered as native
  // <details>/<summary> elements (works and is crawlable with no JS). This
  // island adds single-open behavior — opening one closes the others.
  let { host } = $props();

  $effect(() => {
    if (!host) return;
    const items = Array.from(host.querySelectorAll('details'));
    const onToggle = (e) => {
      if (e.target.open) {
        items.forEach((d) => {
          if (d !== e.target) d.open = false;
        });
      }
    };
    items.forEach((d) => d.addEventListener('toggle', onToggle));
    return () => items.forEach((d) => d.removeEventListener('toggle', onToggle));
  });
</script>
