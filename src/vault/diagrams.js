import { getAllCanvases } from './canvas.js';

// slug → [{type, slug, title}]  — built after canvases are loaded
const diagramsBySlug = new Map();

export function buildDiagramsIndex() {
  diagramsBySlug.clear();

  for (const canvas of getAllCanvases()) {
    for (const node of canvas.nodes) {
      if (!node.wikiSlug) continue;
      const list = diagramsBySlug.get(node.wikiSlug) || [];
      // dedup by canvas slug
      if (!list.some(d => d.slug === canvas.slug)) {
        list.push({ type: 'canvas', slug: canvas.slug, title: canvas.title });
      }
      diagramsBySlug.set(node.wikiSlug, list);
    }
  }

  const total = [...diagramsBySlug.values()].reduce((n, arr) => n + arr.length, 0);
  console.log(`[diagrams] Index built: ${total} diagram links across ${diagramsBySlug.size} wiki pages`);
}

export function getDiagramsForSlug(slug) {
  return diagramsBySlug.get(slug) || [];
}
