/**
 * Vector store for semantic search over Readwise articles.
 * Loads pre-built index from disk, embeds queries on demand.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { VAULT_PATH } from '../../config.js';

const INDEX_FILE = join(VAULT_PATH, 'Raw', 'readwise-vector-index.json');

let items = [];      // { id, title, author, category, url, savedAt, summary, vector }
let extractor = null;
let modelName = '';
let ready = false;

function cosine(a, b) {
  // Vectors are already L2-normalized, so dot product == cosine similarity
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export async function loadVectorStore() {
  try {
    const raw = JSON.parse(await readFile(INDEX_FILE, 'utf8'));
    items = raw.items || [];
    modelName = raw.model || 'Xenova/multilingual-e5-small';

    // Lazy-import transformers only when index exists
    const { pipeline } = await import('@xenova/transformers');
    extractor = await pipeline('feature-extraction', modelName, { quantized: true });

    ready = true;
    console.log(`[vector] ${items.length} vectors loaded (${modelName})`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('[vector] No index found — run: node --env-file=.env scripts/embed-readwise.js');
    } else {
      console.error('[vector] Failed to load:', err.message);
    }
  }
}

export function isReady() { return ready; }
export function getCount() { return items.length; }

export async function semanticSearch(query, k = 10) {
  if (!ready) return [];

  // multilingual-e5 requires "query:" prefix for search queries
  const prefixed = modelName.includes('multilingual-e5') ? `query: ${query}` : query;
  const output = await extractor([prefixed], { pooling: 'mean', normalize: true });
  const qvec = Array.from(output[0].data);

  const scored = items.map(item => ({
    id: item.id,
    title: item.title,
    author: item.author,
    category: item.category,
    url: item.url,
    savedAt: item.savedAt,
    summary: item.summary,
    score: cosine(qvec, item.vector),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
