<script>
  // タブの挙動だけを足すアイランド (TICKET-SITE-09)。
  //
  // **DOM は生成しない。** パネルは Jekyll がサーバレンダリング済みで、JS 無効なら
  // 全パネルが縦に並んで見える (比較表なので全部見えても情報として成立する)。
  // このアイランドは `hidden` と `aria-selected` を付け外しするだけ。
  //
  // 期待する markup:
  //   <div data-island="tabs">
  //     <div role="tablist">
  //       <button role="tab" aria-controls="panel-a">…</button>
  //     </div>
  //     <div class="tabpanels">
  //       <div role="tabpanel" id="panel-a">…</div>
  //     </div>
  //   </div>
  let { host } = $props();

  $effect(() => {
    if (!host) return;
    const tabs = Array.from(host.querySelectorAll('[role="tab"]'));
    const panels = Array.from(host.querySelectorAll('[role="tabpanel"]'));
    if (!tabs.length || !panels.length) return;

    const panelFor = (tab) => panels.find((p) => p.id === tab.getAttribute('aria-controls'));

    function select(index, focus = false) {
      tabs.forEach((t, i) => {
        const on = i === index;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle('tab-active', on);
        const p = panelFor(t);
        if (p) p.hidden = !on;
      });
      if (focus) tabs[index].focus();
    }

    const onClick = (e) => select(tabs.indexOf(e.currentTarget));
    const onKey = (e) => {
      const i = tabs.indexOf(e.currentTarget);
      if (e.key === 'ArrowRight') select((i + 1) % tabs.length, true);
      else if (e.key === 'ArrowLeft') select((i - 1 + tabs.length) % tabs.length, true);
      else if (e.key === 'Home') select(0, true);
      else if (e.key === 'End') select(tabs.length - 1, true);
      else return;
      e.preventDefault();
    };

    tabs.forEach((t) => {
      t.addEventListener('click', onClick);
      t.addEventListener('keydown', onKey);
    });
    // JS が動いたので初めてパネルを絞る (無効時は全部見えたまま)
    select(0);

    return () => {
      tabs.forEach((t) => {
        t.removeEventListener('click', onClick);
        t.removeEventListener('keydown', onKey);
      });
    };
  });
</script>
