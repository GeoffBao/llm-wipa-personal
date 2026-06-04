import { Router } from 'express';
import { autocomplete } from '../search/index.js';
import { getAllFiles, getFile } from '../vault/loader.js';
import { getBacklinks } from '../vault/backlinks.js';

const router = Router();

const SECTION_COLOR = {
  concepts:  '#4da6ff', sources:   '#5fcf80', mocs:      '#ffb347',
  synthesis: '#ffd166', prompts:   '#da8fff', notes:     '#ff9a8b',
  projects:  '#ff6b6b', wiki:      '#7ec8e3',
};

// Local graph — 1-hop neighborhood around a given slug
router.get('/api/local-graph/:slug', (req, res) => {
  const center = getFile(req.params.slug);
  if (!center) return res.status(404).json({ error: 'not found' });

  const files = getAllFiles();
  const byTitle = new Map(files.map(f => [f.title, f]));
  const wikilinkRegex = /\[\[([^\]|^#]+)/g;

  // Outgoing: from this file's wikilinks
  const outgoing = new Set();
  let m;
  while ((m = wikilinkRegex.exec(center.raw)) !== null) {
    const target = byTitle.get(m[1].trim());
    if (target && target.slug !== center.slug) outgoing.add(target.slug);
  }

  // Incoming: backlinks
  const incoming = new Set(getBacklinks(center.title).map(f => f.slug));

  const neighborSlugs = new Set([...outgoing, ...incoming]);
  const nodeSet = new Set([center.slug, ...neighborSlugs]);
  const nodes = files
    .filter(f => nodeSet.has(f.slug))
    .map(f => ({
      id: f.slug,
      title: f.title,
      section: f.section,
      color: SECTION_COLOR[f.section] || '#888',
      center: f.slug === center.slug,
    }));

  const links = [];
  const seen = new Set();
  const pushLink = (s, t) => {
    const k = `${s}→${t}`;
    if (seen.has(k)) return;
    seen.add(k);
    links.push({ source: s, target: t });
  };
  outgoing.forEach(s => pushLink(center.slug, s));
  incoming.forEach(s => pushLink(s, center.slug));

  res.json({ center: center.slug, nodes, links });
});

router.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 50);
  const results = autocomplete(q, limit).map(r => ({
    title: r.title,
    slug: r.slug,
    section: r.section,
    type: r.type,
  }));
  res.json(results);
});

router.get('/api/random', (req, res) => {
  const concepts = getAllFiles().filter(f => f.section === 'concepts');
  if (!concepts.length) return res.json({ slug: null });
  const pick = concepts[Math.floor(Math.random() * concepts.length)];
  res.json({ slug: pick.slug, title: pick.title });
});

export default router;
