/**
 * Vector store for semantic search.
 * Two indices: Readwise articles (R layer) and Wiki/Notes/Projects chunks (W layer).
 * Both use multilingual-e5-small; the extractor is shared.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { VAULT_PATH } from '../../config.js';

const INDEX_FILE      = join(VAULT_PATH, 'Raw', 'readwise-vector-index.json');
const WIKI_INDEX_FILE = join(VAULT_PATH, 'Raw', 'wiki-vector-index.json');

// Readwise index
let items    = [];
let modelName = '';
let ready    = false;

// Wiki index
let wikiItems = [];
let wikiReady = false;

// Shared embedding model (lazy-loaded)
let extractor = null;

function cosine(a, b) {
  // Vectors are already L2-normalized, so dot product == cosine similarity
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

async function ensureExtractor(model) {
  if (extractor) return extractor;
  const { pipeline } = await import('@xenova/transformers');
  extractor = await pipeline('feature-extraction', model, { quantized: true });
  return extractor;
}

export async function loadVectorStore() {
  try {
    const raw = JSON.parse(await readFile(INDEX_FILE, 'utf8'));
    items = raw.items || [];
    modelName = raw.model || 'Xenova/multilingual-e5-small';
    await ensureExtractor(modelName);
    ready = true;
    console.log(`[vector] Readwise: ${items.length} vectors loaded (${modelName})`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('[vector] No Readwise index — run: node --env-file=.env scripts/embed-readwise.js');
    } else {
      console.error('[vector] Readwise load failed:', err.message);
    }
  }
}

export async function loadWikiVectorStore() {
  try {
    const raw = JSON.parse(await readFile(WIKI_INDEX_FILE, 'utf8'));
    wikiItems = raw.items || [];
    const wikiModel = raw.model || 'Xenova/multilingual-e5-small';
    if (!modelName) modelName = wikiModel;
    await ensureExtractor(wikiModel);
    wikiReady = true;
    console.log(`[vector] Wiki: ${wikiItems.length} chunks loaded`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('[vector] No Wiki index — run: node --env-file=.env scripts/embed-wiki.js');
    } else {
      console.error('[vector] Wiki load failed:', err.message);
    }
  }
}

export function isReady()      { return ready; }
export function isWikiReady()  { return wikiReady; }
export function getCount()     { return items.length; }
export function getWikiCount() { return wikiItems.length; }

export async function semanticSearch(query, k = 10) {
  if (!ready || !extractor) return [];
  const prefixed = modelName.includes('multilingual-e5') ? `query: ${query}` : query;
  const output = await extractor([prefixed], { pooling: 'mean', normalize: true });
  const qvec = Array.from(output[0].data);
  const scored = items.map(item => ({
    id: item.id, title: item.title, author: item.author,
    category: item.category, url: item.url, savedAt: item.savedAt,
    summary: item.summary, score: cosine(qvec, item.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export async function wikiSemanticSearch(query, k = 8) {
  if (!wikiReady || !extractor) return [];
  const prefixed = modelName.includes('multilingual-e5') ? `query: ${query}` : query;
  const output = await extractor([prefixed], { pooling: 'mean', normalize: true });
  const qvec = Array.from(output[0].data);
  const scored = wikiItems.map(item => ({
    slug: item.slug, title: item.title, section: item.section,
    snippet: item.snippet, score: cosine(qvec, item.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  // Dedup by slug and title: one result per file (handles slug-collision duplicates)
  const seenSlugs = new Set();
  const seenTitles = new Set();
  const deduped = [];
  for (const s of scored) {
    if (seenSlugs.has(s.slug) || seenTitles.has(s.title)) continue;
    seenSlugs.add(s.slug);
    seenTitles.add(s.title);
    deduped.push(s);
    if (deduped.length >= k) break;
  }
  return deduped;
}
