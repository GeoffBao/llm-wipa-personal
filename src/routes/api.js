import { Router } from 'express';
import { autocomplete } from '../search/index.js';
import { getAllFiles } from '../vault/loader.js';

const router = Router();

router.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const results = autocomplete(q, 8);
  res.json(results.map(r => ({
    title: r.title,
    slug: r.slug,
    section: r.section,
    type: r.type,
  })));
});

router.get('/api/random', (req, res) => {
  const concepts = getAllFiles().filter(f => f.section === 'concepts');
  if (!concepts.length) return res.json({ slug: null });
  const pick = concepts[Math.floor(Math.random() * concepts.length)];
  res.json({ slug: pick.slug, title: pick.title });
});

export default router;
