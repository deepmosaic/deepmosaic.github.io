<script>
  // Behavior-only enhancement for the docs TOC. The sidebar links are native
  // anchor jumps (work with no JS). This island highlights the link for the
  // section currently in view and adds offset-aware smooth scrolling.
  let { host, offset = '80' } = $props();

  $effect(() => {
    if (!host) return;
    const off = Number(offset) || 80;
    // Every in-page link gets offset-aware smooth scrolling, but only the TOC
    // links (inside `.docs-toc`, sidebar + mobile <details>) track the current
    // section. Body links that happen to point at a section must not be marked
    // aria-current. Fall back to all links when the page has no `.docs-toc`.
    const links = Array.from(host.querySelectorAll('a[href^="#"]'));
    const tocLinks = links.filter((l) => l.closest('.docs-toc'));
    const spied = tocLinks.length ? tocLinks : links;
    const idOf = (link) => decodeURIComponent(link.getAttribute('href').slice(1));

    const sections = [];
    const seen = new Set();
    for (const link of spied) {
      const id = idOf(link);
      if (seen.has(id)) continue;
      seen.add(id);
      const sec = document.getElementById(id);
      if (sec) sections.push(sec);
    }

    const onClick = (e) => {
      const link = e.currentTarget;
      const sec = document.getElementById(idOf(link));
      if (!sec) return;
      e.preventDefault();
      const top = sec.getBoundingClientRect().top + window.scrollY - off;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
    };
    links.forEach((l) => l.addEventListener('click', onClick));

    // Keep the active link visible inside a scrollable sidebar (the TOC is
    // capped to the viewport height). Only the <nav> scrolls; never touch the
    // window here, or the mobile <details> TOC would yank the page upward.
    const revealInNav = (link) => {
      const nav = link.closest('nav.docs-toc');
      if (!nav || nav.scrollHeight <= nav.clientHeight) return;
      const r = link.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      if (r.top < n.top || r.bottom > n.bottom) {
        nav.scrollTop += r.top - n.top - n.height / 2;
      }
    };

    let current = null;
    const setActive = (id) => {
      if (id === current) return;
      current = id;
      spied.forEach((l) => {
        const active = idOf(l) === id;
        l.classList.toggle('active', active);
        if (active) {
          l.setAttribute('aria-current', 'true');
          revealInNav(l);
        } else {
          l.removeAttribute('aria-current');
        }
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: `-${off}px 0px -60% 0px`, threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));

    return () => {
      observer.disconnect();
      links.forEach((l) => l.removeEventListener('click', onClick));
    };
  });
</script>
