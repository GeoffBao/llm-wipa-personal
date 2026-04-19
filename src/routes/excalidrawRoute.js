import { Router } from 'express';
import { getAllExcalidrawFiles, getExcalidrawFile } from '../vault/excalidraw.js';
import { render } from '../render/template.js';

const router = Router();

// Gallery
router.get('/excalidraw', async (req, res) => {
  const drawings = getAllExcalidrawFiles();

  const cardsHtml = drawings.map(d => `
    <a href="/excalidraw/${d.slug}" class="canvas-gallery-card">
      <div class="canvas-gallery-icon">✏️</div>
      <div class="canvas-gallery-title">${d.title}</div>
      <div class="canvas-gallery-meta">${d.elementCount} elements</div>
    </a>`).join('');

  res.send(await render('browse.html', {
    pageTitle: 'Excalidraw — LLM KB',
    sectionLabel: 'Excalidraw Drawings',
    section: 'excalidraw',
    count: drawings.length,
    items: `<div class="canvas-gallery">${cardsHtml}</div>`,
    breadcrumb: `<a href="/">Home</a> › Excalidraw`,
    activeNav: 'excalidraw',
  }));
});

// Viewer
router.get('/excalidraw/:slug', async (req, res) => {
  const drawing = getExcalidrawFile(req.params.slug);
  if (!drawing) return res.status(404).send('Drawing not found');

  const drawingData = JSON.stringify({
    elements: drawing.elements,
    background: drawing.background,
  });

  res.send(await render('excalidraw.html', {
    pageTitle: `${drawing.title} — LLM KB`,
    title: drawing.title,
    elementCount: drawing.elementCount,
    breadcrumb: `<a href="/">Home</a> › <a href="/excalidraw">Excalidraw</a> › ${drawing.title}`,
    drawingData,
    activeNav: 'excalidraw',
  }));
});

export default router;
