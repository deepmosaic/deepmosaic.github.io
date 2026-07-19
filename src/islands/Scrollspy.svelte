<script>
  // Behavior-only enhancement for the docs TOC. The sidebar links are native
  // anchor jumps (work with no JS). This island highlights the link for the
  // section currently in view and adds offset-aware smooth scrolling.
  let { host, offset = '80' } = $props();

  $effect(() => {
    if (!host) return;
    const off = Number(offset) || 80;
    const links = Array.from(host.querySelectorAll('a[href^="#"]'));
    const idOf = (link) => decodeURIComponent(link.getAttribute('href').slice(1));

    const sections = [];
    for (const link of links) {
      const sec = document.getElementById(idOf(link));
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

    let current = null;
    const setActive = (id) => {
      if (id === current) return;
      current = id;
      links.forEach((l) => {
        const active = idOf(l) === id;
        l.classList.toggle('active', active);
        if (active) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
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
