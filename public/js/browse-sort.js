/* Browse page — client-side sort & month-grouping.
   Runs on initial load AND after SPA tab navigation (wipa:navigate),
   since the browse view is injected via innerHTML which does not execute
   inline <script> tags. */
(function () {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function monthLabel(isoDate) {
    if (!isoDate) return '日期未知';
    const [y, m] = isoDate.split('-');
    return `${y} · ${(MONTHS[parseInt(m, 10) - 1] || m).toUpperCase()}`;
  }

  function init(root) {
    const scope = root || document;
    const grid = scope.querySelector('#browseGrid');
    if (!grid || grid.dataset.sortBound) return;
    grid.dataset.sortBound = '1';

    const groupBtn = scope.querySelector('#browseGroupBtn');
    const sortBtns = scope.querySelectorAll('.browse-sort-btn');

    let currentSort = 'newest';
    let grouped = false;

    const getCards = () => [...grid.querySelectorAll('.browse-card')];

    function sortCards(cards, mode) {
      return [...cards].sort((a, b) => {
        const da = a.dataset.date || '', db = b.dataset.date || '';
        const ta = a.dataset.title || '', tb = b.dataset.title || '';
        if (mode === 'newest') return db.localeCompare(da);
        if (mode === 'oldest') return da.localeCompare(db);
        return ta.localeCompare(tb, 'zh-Hans');
      });
    }

    function render() {
      const cards = sortCards(getCards(), currentSort);
      grid.querySelectorAll('.browse-group-header').forEach(el => el.remove());
      cards.forEach(c => grid.appendChild(c));

      if (grouped) {
        let lastMonth = null;
        for (const card of cards) {
          const month = (card.dataset.date || '').slice(0, 7);
          if (month !== lastMonth) {
            lastMonth = month;
            const header = document.createElement('div');
            header.className = 'browse-group-header';
            header.textContent = monthLabel(card.dataset.date);
            grid.insertBefore(header, card);
          }
        }
      }
    }

    sortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sortBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        render();
      });
    });

    if (groupBtn) {
      groupBtn.addEventListener('click', () => {
        grouped = !grouped;
        groupBtn.classList.toggle('active', grouped);
        render();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => init());
  window.addEventListener('wipa:navigate', () => init());
  // In case the script loads after DOMContentLoaded already fired.
  if (document.readyState !== 'loading') init();
})();
