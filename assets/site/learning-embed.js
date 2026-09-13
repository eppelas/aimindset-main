/* Same-origin iframe host. No catalogue content or business rules live here. */
(() => {
  'use strict';
  const channel = 'aim-learning';
  document.querySelectorAll('[data-learning-embed]').forEach(host => {
    const frame = host.querySelector('iframe');
    const status = host.querySelector('[role="status"]');
    let height = 160, modal = false, savedRoot, inertNodes = [];
    const send = (type, payload = {}) => frame.contentWindow?.postMessage({channel, type, ...payload}, location.origin);
    const layout = () => {
      if (host.hasAttribute('data-error')) return;
      if (!modal) {
        frame.style.width = document.documentElement.clientWidth + 'px';
        frame.style.marginLeft = -host.getBoundingClientRect().left + 'px';
        frame.style.height = height + 'px';
        host.style.height = height + 'px';
      }
      send('viewport', {height:innerHeight});
    };
    const fail = () => {
      clearTimeout(watchdog);
      if (modal) setModal(false);
      host.removeAttribute('data-ready');
      host.setAttribute('data-error','');
      host.style.height = 'auto';
      status.replaceChildren(document.createTextNode('Не удалось загрузить лаборатории. '));
      const link = document.createElement('a');
      link.href = host.dataset.learningSource;
      link.textContent = 'открыть на главной';
      status.append(link);
    };
    const watchdog = setTimeout(fail, 30000);
    const setModal = open => {
      if (modal === open) return;
      modal = open;
      host.toggleAttribute('data-dialog', open);
      const root = document.documentElement;
      if (open) {
        savedRoot = {overflow:root.style.overflow, gutter:root.style.scrollbarGutter};
        root.style.scrollbarGutter = 'stable';
        root.style.overflow = 'hidden';
        // Inert every sibling branch, preserving the iframe's ancestor chain.
        for (let branch = frame; branch.parentElement; branch = branch.parentElement) {
          for (const sibling of branch.parentElement.children) {
            if (sibling !== branch && sibling instanceof HTMLElement) {
              inertNodes.push([sibling, sibling.inert]);
              sibling.inert = true;
            }
          }
        }
      } else {
        for (const [node, wasInert] of inertNodes) node.inert = wasInert;
        inertNodes = [];
        root.style.overflow = savedRoot.overflow;
        root.style.scrollbarGutter = savedRoot.gutter;
        layout();
        send('restore-focus');
      }
    };
    addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.channel !== channel) return;
      const data = event.data;
      if (data.type === 'size' && Number.isFinite(data.height) && data.height > 0) {
        height = data.height;
        layout();
      }
      if (data.type === 'ready') {
        clearTimeout(watchdog);
        host.removeAttribute('data-error');
        host.setAttribute('data-ready','');
        status.textContent = '';
        layout();
      }
      if (data.type === 'dialog') setModal(data.open === true);
      if (data.type === 'error') fail();
    });
    status.textContent = 'загружаем лаборатории…';
    frame.addEventListener('load', layout);
    addEventListener('resize', layout);
    new ResizeObserver(layout).observe(host.parentElement);
    layout();
    const url = new URL(frame.dataset.src, location.href);
    url.searchParams.set('viewportHeight', innerHeight);
    frame.src = url.href;
  });
})();
