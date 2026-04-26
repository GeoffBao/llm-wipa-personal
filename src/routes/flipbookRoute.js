import { Router } from 'express';

import { render } from '../render/template.js';
import { getFile } from '../vault/loader.js';
import { ensureRoot, ensureExplore } from '../services/flipbook.js';

const router = Router();

// ── Shell page ────────────────────────────────────────────────────────────────
// The shell renders immediately; the client fetches a deterministic SVG frame
// JSON from /api/flipbook/generate.
router.get('/flipbook/:slug', async (req, res) => {
  const file = getFile(req.params.slug);
  if (!file) {
    return res.status(404).send(await render('404.html', {
      title: 'Page Not Found',
      slug: req.params.slug,
      suggestions: '<p>That slug has no vault entry to flipbook from.</p>',
      pageTitle: '404 — Flipbook',
      activeNav: '',
    }));
  }

  res.send(await render('flipbook.html', {
    pageTitle: `Flipbook · ${file.title} — LLM KB`,
    title: file.title,
    slug: file.slug,
    sectionLabel: file.section,
    activeNav: '',
  }));
});

// ── Generate the root frame for an article ───────────────────────────────────
router.post('/api/flipbook/generate', async (req, res) => {
  const { slug } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'missing slug' });
  if (!getFile(slug)) return res.status(404).json({ error: 'unknown slug' });

  try {
    const result = await ensureRoot(slug);
    res.json(result);
  } catch (err) {
    console.error('[flipbook] generate failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Click-to-explore (recursive) ─────────────────────────────────────────────
router.post('/api/flipbook/explore', async (req, res) => {
  const { parentKey, nodeId, x, y, viewportW, viewportH, slug } = req.body || {};
  if (!parentKey) return res.status(400).json({ error: 'missing parentKey' });
  const file = slug ? getFile(slug) : null;

  try {
    const result = await ensureExplore({
      parentKey,
      nodeId,
      x: Number(x) || 0,
      y: Number(y) || 0,
      viewportW: Number(viewportW) || 1024,
      viewportH: Number(viewportH) || 1024,
      file,
    });
    res.json(result);
  } catch (err) {
    console.error('[flipbook] explore failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
