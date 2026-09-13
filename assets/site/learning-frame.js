/* The homepage owns the catalogue, its CSS, motion and waitlist behaviour.
   This document only transports that source; it never stores programme data. */
(() => {
  'use strict';
  const sourceURL = new URL('../../index.html', location.href);
  const channel = 'aim-learning';
  const send = (type, payload = {}) => parent.postMessage({channel, type, ...payload}, location.origin);
  let viewportHeight = Number(new URL(location.href).searchParams.get('viewportHeight')) || innerHeight;
  let section, dialog, lastOpener, frameRequest = 0, lastHeight = 0;
  const heightStyles = [];

  // An auto-sized iframe has a document-sized viewport. Evaluate source height
  // breakpoints against the actual browser viewport, while retaining width rules.
  const adaptHeightMedia = () => heightStyles.forEach(({node, source}) => {
    node.textContent = source.replace(/\((min|max)-height\s*:\s*([\d.]+)px\)/g, (_, kind, size) => {
      const matches = kind === 'min' ? viewportHeight >= +size : viewportHeight <= +size;
      return matches ? '(min-width:0px)' : '(max-width:0px)';
    });
  });
  const measure = () => {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      if (!section || dialog?.open) return;
      const height = Math.ceil(section.getBoundingClientRect().bottom + scrollY);
      if (height > 0 && height !== lastHeight) {
        lastHeight = height;
        send('size', {height});
      }
    });
  };
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.channel !== channel) return;
    if (event.data.type === 'viewport' && Number.isFinite(event.data.height)) {
      viewportHeight = event.data.height;
      adaptHeightMedia();
      measure();
    }
    if (event.data.type === 'restore-focus') {
      scrollTo(0, 0);
      lastOpener?.focus({preventScroll:true});
      measure();
    }
  });

  async function load() {
    const response = await fetch(sourceURL, {cache:'no-store', credentials:'same-origin', signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`Homepage HTTP ${response.status}`);
    const source = new DOMParser().parseFromString(await response.text(), 'text/html');
    const originalSection = source.getElementById('learning');
    const originalDialog = source.getElementById('waitlistDialog');
    const runtimes = [...source.querySelectorAll('script[data-learning-runtime]')];
    const roles = ['waitlist', 'motion', 'responsive'];
    const formIds = ['waitlistForm','waitlistTopic','waitlistCode','waitlistTelegram','waitlistName','waitlistStatus','waitlistSubmit','waitlistClose'];
    const completeRuntimes = roles.every(role => runtimes.filter(node => node.dataset.learningRuntime === role && !node.src).length === 1);
    const completeForm = formIds.every(id => originalDialog?.querySelector('#' + id));
    if (!originalSection?.querySelector('.program-grid') || !completeForm || !completeRuntimes) {
      throw new Error('Homepage learning contract is incomplete');
    }
    // Preserve the source form's attribution to the page where the user clicked.
    document.documentElement.dataset.waitlistPageUrl = parent === window ? sourceURL.href : parent.location.href;
    const base = document.createElement('base');
    base.href = sourceURL.href;
    base.target = '_top';
    document.head.prepend(base);
    const cssLoads = [];
    source.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(original => {
      const node = document.importNode(original, true);
      if (node.tagName === 'STYLE' && /\((?:min|max)-height\s*:/.test(node.textContent)) {
        heightStyles.push({node, source:node.textContent});
      }
      if (node.tagName === 'LINK') cssLoads.push(new Promise(resolve => {
        node.addEventListener('load', resolve, {once:true});
        node.addEventListener('error', resolve, {once:true});
        setTimeout(resolve, 8000);
      }));
      document.head.append(node);
    });
    adaptHeightMedia();
    const integration = document.createElement('style');
    integration.id = 'learning-frame-integration';
    integration.textContent = `
      html,body{margin:0!important;padding:0!important;min-height:0!important;height:auto!important;background:transparent!important;scroll-behavior:auto!important}
      body>main.wrap{margin-block:0;padding-block:0}
      #learning.learning-space{margin-block:0!important;padding-block:0!important;border:0}
      #learning .learning-intro{display:none}
      html.learning-dialog-open{overflow:hidden}
      .learning-dialog-open main{visibility:hidden}
    `;
    document.head.append(integration);
    const main = document.createElement('main');
    main.className = 'wrap';
    section = document.importNode(originalSection, true);
    section.querySelectorAll('script').forEach(script => script.remove());
    main.append(section);
    dialog = document.importNode(originalDialog, true);
    document.body.append(main, dialog);

    document.addEventListener('click', event => {
      const opener = event.target.closest('.waitlist-open');
      if (opener) lastOpener = opener;
    }, true);
    new MutationObserver(() => {
      document.documentElement.classList.toggle('learning-dialog-open', dialog.open);
      send('dialog', {open:dialog.open});
    }).observe(dialog, {attributes:true, attributeFilter:['open']});
    // Execute only the existing, explicitly exported homepage runtimes. In
    // particular, do not load its editor, hero canvases or global wheel handler.
    let runtimeError;
    const catchRuntimeError = event => { runtimeError = event.error || new Error(event.message); };
    addEventListener('error', catchRuntimeError);
    try { for (const original of runtimes) {
      const runtime = document.createElement('script');
      for (const {name,value} of original.attributes) runtime.setAttribute(name,value);
      runtime.textContent = original.textContent;
      document.body.append(runtime);
      if (runtimeError) throw runtimeError;
    } } finally { removeEventListener('error', catchRuntimeError); }
    new ResizeObserver(measure).observe(section);
    addEventListener('resize', measure);
    await Promise.all(cssLoads);
    await document.fonts.ready;
    send('ready');
    measure();
  }
  load().catch(error => {
    console.error('Learning source could not be loaded:', error);
    send('error');
  });
})();
