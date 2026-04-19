import { Router } from 'express';
import { getAllFiles } from '../vault/loader.js';
import { getBacklinks } from '../vault/backlinks.js';
import { render } from '../render/template.js';

const router = Router();

router.get('/graph', async (req, res) => {
  const files = getAllFiles();
  res.send(await render('graph.html', {
    pageTitle: 'Knowledge Graph — LLM KB',
    totalNodes: files.length,
    activeNav: 'graph',
    // graph.html is full-screen, skip layout wrapper
  }));
});

// JSON data for D3
router.get('/api/graph', (req, res) => {
  const files = getAllFiles();

  const sectionColor = {
    concepts:  '#4da6ff',
    sources:   '#5fcf80',
    mocs:      '#ffb347',
    synthesis: '#ffd166',
    prompts:   '#da8fff',
    notes:     '#ff9a8b',
    projects:  '#ff6b6b',
    wiki:      '#7ec8e3',
  };

  const nodes = files.map(f => ({
    id: f.slug,
    title: f.title,
    section: f.section,
    color: sectionColor[f.section] || '#888',
    backlinks: getBacklinks(f.title).length,
  }));

  // Build edges from backlinks index
  const slugSet = new Set(files.map(f => f.slug));
  const edgeSet = new Set();
  const links = [];

  for (const file of files) {
    const wikilinkRegex = /\[\[([^\]|^]+)/g;
    let match;
    while ((match = wikilinkRegex.exec(file.raw)) !== null) {
      const targetTitle = match[1].trim();
      // Find target node
      const target = files.find(f => f.title === targetTitle || f.title.toLowerCase() === targetTitle.toLowerCase());
      if (!target || target.slug === file.slug) continue;
      const key = `${file.slug}→${target.slug}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      links.push({ source: file.slug, target: target.slug });
    }
  }

  res.json({
    nodes,
    links,
    sections: Object.entries(sectionColor).map(([k, v]) => ({ section: k, color: v })),
  });
});

export default router;
