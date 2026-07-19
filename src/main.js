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

// ---------------------------------------------------------------------------
// Svelte island mounts — each hydrates server-rendered (Jekyll) markup, so the
// page works without JS and islands only add interactivity.
// ---------------------------------------------------------------------------
import { mount } from 'svelte';
import MobileNav from './islands/MobileNav.svelte';
import Accordion from './islands/Accordion.svelte';
import Scrollspy from './islands/Scrollspy.svelte';
import VideoLightbox from './islands/VideoLightbox.svelte';

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
  mountIslands('[data-island="mobile-nav"]', MobileNav);
  mountIslands('[data-island="accordion"]', Accordion);
  mountIslands('[data-island="scrollspy"]', Scrollspy);
  mountIslands('[data-island="video-lightbox"]', VideoLightbox);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
