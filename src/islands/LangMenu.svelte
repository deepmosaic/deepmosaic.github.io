<script>
  // Behavior-only enhancement: ヘッダーの言語の切り替え (_includes/lang-switch.html の header) は
  // 言語のボタン (lucide の Languages + 今の言語名 + ChevronDown。開いている間の見た目は
  // aria-expanded の Tailwind の variant が受け持つ) と、閉じた一覧 (<ul hidden> の中の a[hreflang] 3 本) をサーバーで描く。リンクは DOM にあるので
  // JS が無くても検索エンジンは辿れる (人の代わりの道はフッターの文字リンク)。この island は開閉だけを足す。
  // 中身はリンクの一覧なので ARIA の型は disclosure (aria-expanded + aria-controls)。menu の型にはしない。
  // キーの判定は src/lib/lang-menu.js (node --test で検証)。
  import { initialIndex, nextIndex, triggerKeyAction, isInside } from '../lib/lang-menu.js';

  let { host } = $props();

  $effect(() => {
    if (!host) return;
    const trigger = host.querySelector('[data-lang-menu-trigger]');
    const list = host.querySelector('[data-lang-menu-list]');
    const links = Array.from(host.querySelectorAll('a[hreflang]'));
    if (!trigger || !list || links.length === 0) return;

    // Space の keydown で開閉したとき、keyup で来るネイティブの click (detail === 0) を 1 回だけ捨てる。
    // Enter は keydown の preventDefault で click が出ないので立てない。フラグは Space の keyup の直後に必ず倒す
    // (focus が一覧へ移って click がボタンに来ない場合に、支援技術の click を誤って捨てないため)。
    let skipKeyClick = false;
    // host の中を押している間は、focusout (Safari ではボタンを押してもフォーカスが移らず relatedTarget が null) で閉じない。
    let pointerInside = false;

    const isOpen = () => !list.hidden;
    const focusAt = (i) => links[i]?.focus();

    function onOutsidePointer(e) {
      if (!isInside(host, e.target)) close(false);
    }

    function open(which) {
      if (!isOpen()) {
        list.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', onOutsidePointer, true);
      }
      const start = initialIndex(links.map((a) => a.getAttribute('aria-current') === 'true'));
      focusAt(which === 'open-last' ? links.length - 1 : start);
    }

    function close(returnFocus) {
      if (!isOpen()) return;
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      if (returnFocus) trigger.focus();
    }

    function onTriggerClick(e) {
      if (skipKeyClick && e.detail === 0) {
        skipKeyClick = false;
        return;
      }
      skipKeyClick = false;
      if (isOpen()) close(false);
      else open('open-current');
    }

    function onTriggerKeydown(e) {
      const action = triggerKeyAction(e.key);
      if (action === null) return;
      e.preventDefault();
      if (e.key === ' ') skipKeyClick = true;
      if (e.key === 'Enter' || e.key === ' ') {
        if (isOpen()) {
          close(false);
          return;
        }
      }
      open(action);
    }

    function onListKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      }
      const next = nextIndex(links.indexOf(document.activeElement), e.key, links.length);
      if (next === null) return;
      e.preventDefault();
      focusAt(next);
    }

    function onHostKeyup(e) {
      // click は keyup の既定の動作として listener の後に来るので、倒すのは次のタスクで。
      if (e.key === ' ' && skipKeyClick) setTimeout(() => (skipKeyClick = false), 0);
    }

    function onFocusOut(e) {
      if (!isOpen() || isInside(host, e.relatedTarget)) return;
      if (e.relatedTarget == null && pointerInside) return;
      close(false);
    }

    const onPointerDown = () => {
      pointerInside = true;
    };
    const onPointerEnd = () => {
      pointerInside = false;
    };

    trigger.addEventListener('click', onTriggerClick);
    trigger.addEventListener('keydown', onTriggerKeydown);
    list.addEventListener('keydown', onListKeydown);
    host.addEventListener('focusout', onFocusOut);
    host.addEventListener('keyup', onHostKeyup);
    host.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointerup', onPointerEnd);
    document.addEventListener('pointercancel', onPointerEnd);
    return () => {
      trigger.removeEventListener('click', onTriggerClick);
      trigger.removeEventListener('keydown', onTriggerKeydown);
      list.removeEventListener('keydown', onListKeydown);
      host.removeEventListener('focusout', onFocusOut);
      host.removeEventListener('keyup', onHostKeyup);
      host.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerEnd);
      document.removeEventListener('pointercancel', onPointerEnd);
      document.removeEventListener('pointerdown', onOutsidePointer, true);
    };
  });
</script>
