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
        <div class="ex-gallery-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:.6"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></div>
        <div class="ex-gallery-title">${d.title}</div>
        <div class="ex-gallery-meta">${d.elementCount} elements</div>
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
