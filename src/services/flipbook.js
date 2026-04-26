import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFile, getAllFiles } from '../vault/loader.js';
import { getBacklinks } from '../vault/backlinks.js';
import { search } from '../search/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

export const CACHE_DIR = join(PROJECT_ROOT, 'public/flipbook-cache');

const FRAME_SIZE = 1024;
const inflight = new Map();
const NODE_LAYOUT = [
  { x: 92, y: 92, w: 270, h: 118 },
  { x: 662, y: 92, w: 270, h: 118 },
  { x: 64, y: 392, w: 252, h: 118 },
  { x: 708, y: 392, w: 252, h: 118 },
  { x: 148, y: 724, w: 270, h: 118 },
  { x: 606, y: 724, w: 270, h: 118 },
];

function sha1(input) {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

export function rootKeyForFile(file) {
  const stamp = file.mtime?.toISOString?.() || '';
  return `init-${sha1(`${file.slug}\n${stamp}`)}`;
}

export function exploreKey({ parentKey, x, y, concept }) {
  return `expl-${sha1(`${parentKey}\n${x}|${y}\n${concept || ''}`)}`;
}

function cachePath(key, ext) {
  return join(CACHE_DIR, `${key}.${ext}`);
}

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

// ── Candidate slug list (for grounding the prompt) ────────────────────────────
// Pulls candidate vault titles from: (a) wikilinks present in this article's
// body, (b) backlinks pointing to it, (c) search results, and (d) same-section
// neighbours. These become deterministic SVG nodes, not AI-painted labels.
function extractWikilinks(body) {
  const out = new Set();
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(body)) !== null) out.add(m[1].trim());
  return [...out];
}

export function buildCandidates(file, { max = 24 } = {}) {
  const all = getAllFiles();
  const byTitleLower = new Map(all.map(f => [f.title.toLowerCase(), f]));
  const candidates = new Map(); // slug → {title, slug}

  // 1. Wikilinks IN the article body — most relevant
  for (const title of extractWikilinks(file.body || '')) {
    const f = byTitleLower.get(title.toLowerCase());
    if (f) candidates.set(f.slug, { title: f.title, slug: f.slug });
  }

  // 2. Backlinks — concepts that point at this article
  for (const f of getBacklinks(file.title)) {
    if (candidates.size >= max) break;
    candidates.set(f.slug, { title: f.title, slug: f.slug });
  }

  // 3. Full-text search by title — useful for source/notes pages with no links
  if (candidates.size < max) {
    for (const r of search(file.title, max)) {
      if (candidates.size >= max) break;
      if (r.slug === file.slug) continue;
      const f = getFile(r.slug);
      if (f) candidates.set(f.slug, { title: f.title, slug: f.slug });
    }
  }

  // 4. Section neighbours — fill the rest with same-section files
  if (candidates.size < max) {
    for (const f of all) {
      if (candidates.size >= max) break;
      if (f.slug === file.slug) continue;
      if (f.section !== file.section) continue;
      candidates.set(f.slug, { title: f.title, slug: f.slug });
    }
  }

  return [...candidates.values()].slice(0, max);
}

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function readCachedResult(key) {
  const meta = cachePath(key, 'frame.json');
  if (!(await fileExists(meta))) return null;
  try {
    const raw = await readFile(meta, 'utf8');
    return { ...JSON.parse(raw), cached: true };
  } catch {
    return null;
  }
}

async function writeCachedResult(key, payload) {
  await writeFile(cachePath(key, 'frame.json'), JSON.stringify(payload, null, 2), 'utf8');
}

async function generateRoot(file) {
  const key = rootKeyForFile(file);
  const cached = await readCachedResult(key);
  if (cached) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    await ensureCacheDir();
    const frame = buildFlipbookFrame({
      key,
      file,
      depth: 0,
      mode: 'root',
      breadcrumb: [{ title: file.title, slug: file.slug }],
    });
    await writeCachedResult(key, frame);
    return { ...frame, cached: false };
  })();

  inflight.set(key, promise);
  promise.then(
    () => inflight.delete(key),
    () => inflight.delete(key),
  );
  return promise;
}

async function generateExplore({ parentKey, x, y, viewportW, viewportH, file, nodeId }) {
  // Read parent hotspots so we can hint the model.
  const parentMeta = await readCachedResult(parentKey);
  const parentHotspots = parentMeta?.hotspots || [];

  // Normalize click coords into 1024x1024 space.
  const nx = Math.round((x / Math.max(1, viewportW)) * 1024);
  const ny = Math.round((y / Math.max(1, viewportH)) * 1024);

  // First check whether the click directly lands inside a hotspot whose
  // vault_slug is a real article — in that case skip generation entirely
  // and tell the caller to redirect to /wiki/:slug.
  const hit = nodeId
    ? parentHotspots.find(h => h.nodeId === nodeId)
    : pickHotspot(parentHotspots, nx, ny);
  if (hit && hit.vault_slug && getFile(hit.vault_slug)) {
    return { redirect: `/wiki/${hit.vault_slug}`, hit };
  }

  const concept = hit?.concept || '';
  const key = exploreKey({ parentKey, x: nx, y: ny, concept });
  const cached = await readCachedResult(key);
  if (cached) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    await ensureCacheDir();
    const sourceFile = resolveExploreSource({ file, hit, parentMeta });
    const frame = buildFlipbookFrame({
      key,
      file: sourceFile,
      title: concept || sourceFile?.title || `Explore (${nx}, ${ny})`,
      parentKey,
      depth: (parentMeta?.depth || 0) + 1,
      mode: 'explore',
      clickedAt: { x: nx, y: ny, concept },
      breadcrumb: [...(parentMeta?.breadcrumb || []), { title: concept || 'Explore' }].slice(-5),
    });
    await writeCachedResult(key, frame);
    return { ...frame, cached: false };
  })();

  inflight.set(key, promise);
  promise.then(
    () => inflight.delete(key),
    () => inflight.delete(key),
  );
  return promise;
}

function resolveExploreSource({ file, hit, parentMeta }) {
  if (hit?.vault_slug) {
    const linked = getFile(hit.vault_slug);
    if (linked) return linked;
  }
  if (file) return file;
  const sourceSlug = parentMeta?.sourceSlug || parentMeta?.slug;
  return sourceSlug ? getFile(sourceSlug) : null;
}

function buildFlipbookFrame({ key, file, title, parentKey = null, depth = 0, mode, clickedAt = null, breadcrumb = [] }) {
  const sourceFile = file || getAllFiles()[0];
  const candidatePool = sourceFile ? buildCandidates(sourceFile, { max: 36 }) : [];
  const offset = candidatePool.length > NODE_LAYOUT.length
    ? (depth * NODE_LAYOUT.length) % candidatePool.length
    : 0;
  const candidates = rotate(candidatePool, offset).slice(0, NODE_LAYOUT.length);
  const centerTitle = title || sourceFile?.title || 'Explore';
  const center = {
    id: 'center',
    role: 'center',
    title: centerTitle,
    subtitle: sourceFile ? sectionLabel(sourceFile.section) : 'Explore',
    slug: null,
    section: sourceFile?.section || 'explore',
    x: 352,
    y: 372,
    w: 320,
    h: 172,
    action: 'explore',
  };

  const nodes = [
    center,
    ...candidates.map((c, i) => {
      const f = getFile(c.slug);
      return {
        id: `n${i + 1}`,
        role: 'concept',
        title: c.title,
        subtitle: f ? sectionLabel(f.section) : 'Vault concept',
        slug: c.slug,
        section: f?.section || 'wiki',
        ...NODE_LAYOUT[i],
        action: 'open',
      };
    }),
  ];

  const edges = nodes
    .filter(n => n.id !== 'center')
    .map(n => ({ source: 'center', target: n.id }));

  const hotspots = nodes.map(n => ({
    nodeId: n.id,
    x: n.x,
    y: n.y,
    w: n.w,
    h: n.h,
    concept: n.title,
    vault_slug: n.slug || null,
  }));

  return {
    key,
    type: 'frame',
    mode,
    parentKey,
    depth,
    title: centerTitle,
    slug: sourceFile?.slug || null,
    sourceSlug: sourceFile?.slug || null,
    frameSize: FRAME_SIZE,
    nodes,
    edges,
    hotspots,
    breadcrumb,
    clickedAt,
    provider: 'local-svg',
    generatedAt: new Date().toISOString(),
  };
}

function rotate(arr, offset) {
  if (!arr.length || offset <= 0) return arr;
  return [...arr.slice(offset), ...arr.slice(0, offset)];
}

function sectionLabel(section) {
  const labels = {
    concepts: 'Concept',
    sources: 'Source',
    mocs: 'Map',
    synthesis: 'Synthesis',
    prompts: 'Prompt',
    people: 'People',
    notes: 'Note',
    projects: 'Project',
    wiki: 'Wiki',
  };
  return labels[section] || section || 'Vault';
}

function pickHotspot(hotspots, x, y) {
  for (const h of hotspots) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  }
  return null;
}

function nearestHotspot(hotspots, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const h of hotspots || []) {
    const cx = h.x + h.w / 2;
    const cy = h.y + h.h / 2;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist < bestDist) {
      best = h;
      bestDist = dist;
    }
  }
  return best;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function ensureRoot(slug) {
  const file = getFile(slug);
  if (!file) throw new Error(`No vault file with slug "${slug}"`);
  return generateRoot(file);
}

export async function ensureExplore(input) {
  return generateExplore(input);
}

export function getCacheDir() { return CACHE_DIR; }
export function isInflight(key) { return inflight.has(key); }

export const _internal = {
  buildCandidates, rootKeyForFile, exploreKey,
  buildFlipbookFrame,
};
