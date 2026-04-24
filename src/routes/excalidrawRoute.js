import { Router } from 'express';
import {
  getAllExcalidrawFiles, getExcalidrawFile,
  saveExcalidrawFile, createExcalidrawFile,
} from '../vault/excalidraw.js';
import { render } from '../render/template.js';

const router = Router();

// ── Gallery ───────────────────────────────────────────────────────────────────
router.get('/excalidraw', async (req, res) => {
  const drawings = getAllExcalidrawFiles();

  const cardsHtml = drawings.map(d => `
    <div class="ex-gallery-card">
      <a href="/excalidraw/${d.slug}" class="ex-gallery-preview">
        <div class="ex-gallery-thumb">
          <img src="/api/excalidraw/${d.slug}/thumbnail.svg" alt="${d.title}" loading="lazy">
        </div>
        <div class="ex-gallery-title" style="padding:0.75rem 0.75rem 0.25rem">${d.title}</div>
        <div class="ex-gallery-meta" style="padding:0 0.75rem 0.5rem">${d.elementCount} elements</div>
      </a>
      <div class="ex-gallery-actions">
        <a href="/excalidraw/${d.slug}/edit" class="ex-edit-btn">Edit</a>
      </div>
    </div>`).join('');

  const newBtn = `<a href="/excalidraw/new" class="ex-new-btn">＋ New Drawing</a>`;

  res.send(await render('browse.html', {
    pageTitle: 'Excalidraw — LLM KB',
    sectionLabel: 'Excalidraw Drawings',
    section: 'excalidraw',
    count: drawings.length,
    items: `${newBtn}<div class="ex-gallery">${cardsHtml}</div>`,
    containerClass: 'browse-list',
    breadcrumb: `<a href="/">Home</a> › Excalidraw`,
    activeNav: 'excalidraw',
  }));
});

// ── New drawing form ──────────────────────────────────────────────────────────
router.get('/excalidraw/new', async (req, res) => {
  res.send(await render('excalidraw-editor.html', {
    pageTitle: 'New Drawing — LLM KB',
    slug: '',
    title: '',
    drawingData: 'null',
    isNew: true,
  }));
});

// ── Viewer (read-only) ────────────────────────────────────────────────────────
router.get('/excalidraw/:slug', async (req, res) => {
  if (req.params.slug === 'new') return res.redirect('/excalidraw/new'); // safety
  const drawing = getExcalidrawFile(req.params.slug);
  if (!drawing) return res.status(404).send('Drawing not found');

  const drawingData = JSON.stringify({ elements: drawing.elements, background: drawing.background });

  res.send(await render('excalidraw.html', {
    pageTitle: `${drawing.title} — LLM KB`,
    title: drawing.title,
    elementCount: drawing.elementCount,
    breadcrumb: `<a href="/">Home</a> › <a href="/excalidraw">Excalidraw</a> › ${drawing.title}`,
    drawingData,
    activeNav: 'excalidraw',
  }));
});

// ── Editor (read-write) ───────────────────────────────────────────────────────
router.get('/excalidraw/:slug/edit', async (req, res) => {
  const drawing = getExcalidrawFile(req.params.slug);
  if (!drawing) return res.status(404).send('Drawing not found');

  res.send(await render('excalidraw-editor.html', {
    pageTitle: `Edit: ${drawing.title} — LLM KB`,
    slug: drawing.slug,
    title: drawing.title,
    drawingData: JSON.stringify({ elements: drawing.elements, appState: { viewBackgroundColor: drawing.background } }),
    isNew: false,
  }));
});

// ── API: thumbnail SVG ────────────────────────────────────────────────────────
router.get('/api/excalidraw/:slug/thumbnail.svg', (req, res) => {
  const drawing = getExcalidrawFile(req.params.slug);
  if (!drawing) return res.status(404).send('Not found');
  const svg = buildThumbnailSvg(drawing);
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=120');
  res.send(svg);
});

// ── API: get raw file data ────────────────────────────────────────────────────
router.get('/api/excalidraw/:slug', (req, res) => {
  const drawing = getExcalidrawFile(req.params.slug);
  if (!drawing) return res.status(404).json({ error: 'Not found' });
  res.json({ elements: drawing.elements, appState: { viewBackgroundColor: drawing.background } });
});

// ── API: save existing file ───────────────────────────────────────────────────
router.put('/api/excalidraw/:slug', async (req, res) => {
  try {
    await saveExcalidrawFile(req.params.slug, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── API: create new file ──────────────────────────────────────────────────────
router.post('/api/excalidraw', async (req, res) => {
  const { title, elements, appState, files } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
  try {
    const slug = await createExcalidrawFile(title.trim());
    if (elements || appState) {
      await saveExcalidrawFile(slug, { elements: elements || [], appState: appState || {}, files: files || {} });
    }
    res.json({ ok: true, slug });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;

// ── Thumbnail SVG generator ────────────────────────────────────────────────────

function buildThumbnailSvg({ elements, background }) {
  const W = 200, H = 130, PAD = 10;

  if (!elements.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${background || '#fff'}"/><text x="${W/2}" y="${H/2+5}" text-anchor="middle" font-size="11" fill="#ccc" font-family="sans-serif">empty</text></svg>`;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    if (el.x === undefined) continue;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 0));
    maxY = Math.max(maxY, el.y + (el.height || 0));
  }
  if (!isFinite(minX)) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${background || '#fff'}"/></svg>`;

  const bw = maxX - minX || 1, bh = maxY - minY || 1;
  const scale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh);
  const ox = PAD + ((W - PAD * 2) - bw * scale) / 2 - minX * scale;
  const oy = PAD + ((H - PAD * 2) - bh * scale) / 2 - minY * scale;

  const shapes = elements.map(el => {
    const x = el.x * scale + ox;
    const y = el.y * scale + oy;
    const w = (el.width || 40) * scale;
    const h = (el.height || 40) * scale;
    const fill = (el.backgroundColor && el.backgroundColor !== 'transparent') ? el.backgroundColor : 'none';
    const stroke = el.strokeColor || '#1c1c1c';
    const sw = Math.max(0.4, (el.strokeWidth || 1) * scale * 0.5).toFixed(1);

    switch (el.type) {
      case 'rectangle':
      case 'frame':
        return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="1"/>`;
      case 'ellipse':
        return `<ellipse cx="${f(x+w/2)}" cy="${f(y+h/2)}" rx="${f(w/2)}" ry="${f(h/2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      case 'diamond': {
        const cx = x + w / 2, cy = y + h / 2;
        return `<polygon points="${f(cx)},${f(y)} ${f(x+w)},${f(cy)} ${f(cx)},${f(y+h)} ${f(x)},${f(cy)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      case 'text':
        return w > 2 ? `<rect x="${f(x)}" y="${f(y+h*0.3)}" width="${f(w)}" height="${f(Math.max(1, h*0.2))}" fill="${stroke}" opacity="0.35" rx="1"/>` : '';
      case 'line':
      case 'arrow': {
        const pts = el.points || [[0, 0], [el.width || 40, el.height || 0]];
        if (pts.length < 2) return '';
        const x1 = f((el.x + pts[0][0]) * scale + ox);
        const y1 = f((el.y + pts[0][1]) * scale + oy);
        const x2 = f((el.x + pts[pts.length-1][0]) * scale + ox);
        const y2 = f((el.y + pts[pts.length-1][1]) * scale + oy);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      default: return '';
    }
  }).filter(Boolean).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${background || '#fff'}"/>${shapes}</svg>`;
}

function f(n) { return n.toFixed(1); }
