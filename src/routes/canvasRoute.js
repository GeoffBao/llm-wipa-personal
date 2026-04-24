import { Router } from 'express';
import { getAllCanvases, getCanvas } from '../vault/canvas.js';
import { render } from '../render/template.js';
import { renderMarkdown } from '../render/markdown.js';
import { marked } from 'marked';

const router = Router();

// Canvas gallery
router.get('/diagrams', async (req, res) => {
  const canvases = getAllCanvases().sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans'));

  const cardsHtml = canvases.map(c => `
    <a href="/diagrams/${c.slug}" class="canvas-gallery-card">
      <div class="canvas-gallery-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:.6"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></div>
      <div class="canvas-gallery-title">${c.title}</div>
      <div class="canvas-gallery-meta">${c.nodes.length} nodes · ${c.edges.length} edges</div>
    </a>`).join('');

  res.send(await render('browse.html', {
    pageTitle: 'Canvas Diagrams — LLM KB',
    sectionLabel: 'Canvas Diagrams',
    section: 'diagrams',
    count: canvases.length,
    items: `<div class="canvas-gallery">${cardsHtml}</div>`,
    containerClass: 'browse-list',
    breadcrumb: `<a href="/">Home</a> › Canvas Diagrams`,
    activeNav: 'diagrams',
  }));
});

// Canvas viewer
router.get('/diagrams/:slug', async (req, res) => {
  const canvas = getCanvas(req.params.slug);
  if (!canvas) return res.status(404).send('Canvas not found');

  const canvasData = JSON.stringify({
    nodes: canvas.nodes,
    edges: canvas.edges,
  });

  res.send(await render('canvas.html', {
    pageTitle: `${canvas.title} — LLM KB`,
    title: canvas.title,
    nodeCount: canvas.nodes.length,
    edgeCount: canvas.edges.length,
    breadcrumb: `<a href="/">Home</a> › <a href="/diagrams">Canvas</a> › ${canvas.title}`,
    canvasData,
    activeNav: 'diagrams',
  }));
});

export default router;
