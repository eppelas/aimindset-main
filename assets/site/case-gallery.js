/* The source order remains in the DOM; disclosure controls the visible set. */
(() => {
  const grid = document.querySelector('[data-case-gallery]');
  const toggle = document.querySelector('[data-case-toggle]');
  if (!grid || !toggle) return;
  const cards = [...grid.querySelectorAll('[data-case-id]')];
  const mobile = matchMedia('(max-width:700px)');
  let expanded = false;
  const update = () => {
    const initial = mobile.matches ? 3 : 6;
    cards.forEach((card, index) => { card.hidden = !expanded && index >= initial; });
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.querySelector('[data-case-label]').textContent = expanded ? 'Свернуть кейсы' : `Ещё ${cards.length - initial} кейсов`;
    toggle.querySelector('[aria-hidden]').textContent = expanded ? '−' : '+';
  };
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const previousTop = toggle.getBoundingClientRect().top;
    expanded = !expanded;
    update();
    if (!expanded) {
      const shift = toggle.getBoundingClientRect().top - previousTop;
      scrollBy({ top: shift, behavior: 'instant' });
    }
  });
  mobile.addEventListener('change', update);
  update();
})();
