/* Notebook cover scribbles — persisted in localStorage per portal id. */
(function () {
  const STORAGE_PREFIX = 'wipa-notebook-sketch:';

  function loadSketch(id) {
    try {
      return localStorage.getItem(STORAGE_PREFIX + id);
    } catch {
      return null;
    }
  }

  function saveSketch(id, dataUrl) {
    try {
      localStorage.setItem(STORAGE_PREFIX + id, dataUrl);
    } catch (_) {}
  }

  function restoreCanvas(canvas) {
    const id = canvas.dataset.notebookId;
    if (!id) return;
    const data = loadSketch(id);
    if (!data) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = data;
  }

  function openScribbleModal(canvas) {
    const id = canvas.dataset.notebookId;
    if (!id) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:14px;padding:1rem;max-width:420px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2)">
        <div style="font-weight:600;margin-bottom:0.5rem;font-family:var(--font-display,serif)">Scribble on cover</div>
        <canvas id="scribble-pad" width="360" height="450" style="width:100%;border:1px solid var(--border,#ddd);border-radius:8px;touch-action:none;cursor:crosshair"></canvas>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end">
          <button type="button" id="scribble-clear" style="padding:0.35rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer">Clear</button>
          <button type="button" id="scribble-cancel" style="padding:0.35rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:transparent;cursor:pointer">Cancel</button>
          <button type="button" id="scribble-save" style="padding:0.35rem 0.75rem;border:none;border-radius:8px;background:var(--accent,#6D82FF);color:#fff;cursor:pointer">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const pad = overlay.querySelector('#scribble-pad');
    const ctx = pad.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;

    const existing = loadSketch(id);
    if (existing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, pad.width, pad.height);
      img.src = existing;
    }

    let drawing = false;
    function pos(e) {
      const r = pad.getBoundingClientRect();
      const x = (e.clientX - r.left) * (pad.width / r.width);
      const y = (e.clientY - r.top) * (pad.height / r.height);
      return { x, y };
    }

    pad.addEventListener('pointerdown', (e) => {
      drawing = true;
      pad.setPointerCapture(e.pointerId);
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    pad.addEventListener('pointerup', () => { drawing = false; });

    overlay.querySelector('#scribble-clear').onclick = () => {
      ctx.clearRect(0, 0, pad.width, pad.height);
    };
    overlay.querySelector('#scribble-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#scribble-save').onclick = () => {
      const dataUrl = pad.toDataURL('image/png');
      saveSketch(id, dataUrl);
      restoreCanvas(canvas);
      overlay.remove();
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function bind() {
    document.querySelectorAll('.notebook-cover-sketch').forEach(restoreCanvas);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.notebook-scribble-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.notebookId;
      const canvas = document.querySelector(`.notebook-cover-sketch[data-notebook-id="${id}"]`);
      if (canvas) openScribbleModal(canvas);
    });
  }

  document.addEventListener('DOMContentLoaded', bind);
  window.addEventListener('wipa:navigate', () => setTimeout(bind, 50));

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.notebook-card[data-href]');
    if (!card || e.target.closest('.notebook-scribble-btn')) return;
    const href = card.dataset.href;
    if (href) {
      e.preventDefault();
      if (window.__wipaTabs?.navigateTab) window.__wipaTabs.navigateTab(href);
      else window.location.href = href;
    }
  });
  document.addEventListener('keydown', (e) => {
    const card = e.target.closest('.notebook-card[data-href]');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const href = card.dataset.href;
      if (window.__wipaTabs?.navigateTab) window.__wipaTabs.navigateTab(href);
      else if (href) window.location.href = href;
    }
  });
})();
