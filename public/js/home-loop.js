/* KB × Agent loop widget — modal open/close (survives SPA main-content swaps). */
(function () {
  let escapeBound = false;

  function ensureModalRoot() {
    const modal = document.getElementById('loop-modal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    return modal;
  }

  function initLoopWidget() {
    const btn = document.getElementById('loop-widget-btn');
    const modal = ensureModalRoot();
    const closeBtn = document.getElementById('loop-modal-close');
    if (!btn || !modal || btn.dataset.loopBound === '1') return;
    btn.dataset.loopBound = '1';

    function openModal() {
      modal.removeAttribute('hidden');
      modal.classList.add('open');
      document.body.classList.add('loop-modal-open');
    }
    function closeModal() {
      modal.classList.remove('open');
      modal.setAttribute('hidden', '');
      document.body.classList.remove('loop-modal-open');
    }

    btn.addEventListener('click', openModal);
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
    });
    closeBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    if (!escapeBound) {
      escapeBound = true;
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const m = document.getElementById('loop-modal');
        if (!m?.classList.contains('open')) return;
        m.classList.remove('open');
        m.setAttribute('hidden', '');
        document.body.classList.remove('loop-modal-open');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureModalRoot();
    initLoopWidget();
  });
  window.addEventListener('wipa:navigate', () => setTimeout(initLoopWidget, 0));
})();
