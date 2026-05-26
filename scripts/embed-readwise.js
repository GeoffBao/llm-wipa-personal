#!/usr/bin/env node
/**
 * Build semantic vector index for Readwise articles.
 * Uses multilingual-e5-small for Chinese/English mixed content.
 *
 * Reads:  $VAULT_PATH/Raw/readwise-sync-data.json
 * Writes: $VAULT_PATH/Raw/readwise-vector-index.json
 *
 * Usage:
 *   node --env-file=.env scripts/embed-readwise.js
 *   node --env-file=.env scripts/embed-readwise.js --incremental
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { pipeline } from '@xenova/transformers';

const VAULT_PATH = process.env.VAULT_PATH || '';
const SYNC_FILE  = join(VAULT_PATH, 'Raw', 'readwise-sync-data.json');
const INDEX_FILE = join(VAULT_PATH, 'Raw', 'readwise-vector-index.json');
const INCREMENTAL = process.argv.includes('--incremental');

// multilingual-e5-small: 118MB, handles Chinese + English
const MODEL = 'Xenova/multilingual-e5-small';
const BATCH_SIZE = 32;

// multilingual-e5 requires "passage:" prefix for indexed docs
function passageText(a) {
  const parts = [a.title || ''];
  if (a.summary) parts.push(a.summary);
  return 'passage: ' + parts.join(' ').trim().slice(0, 500);
}

async function main() {
  if (!VAULT_PATH) { console.error('VAULT_PATH not set'); process.exit(1); }

  console.log('[embed] Loading Readwise data...');
  const raw = JSON.parse(await readFile(SYNC_FILE, 'utf8'));
  const articles = raw.articles || [];
  console.log(`[embed] ${articles.length} articles found`);

  // Load existing index for incremental mode
  let existing = {};
  if (INCREMENTAL) {
    try {
      const idx = JSON.parse(await readFile(INDEX_FILE, 'utf8'));
      existing = Object.fromEntries((idx.items || []).map(x => [x.id, x]));
      console.log(`[embed] Incremental: ${Object.keys(existing).length} cached`);
    } catch { /* first run */ }
  }

  const toEmbed = INCREMENTAL
    ? articles.filter(a => !existing[a.id])
    : articles;

  console.log(`[embed] Need to embed: ${toEmbed.length}`);
  if (toEmbed.length === 0) {
    console.log('[embed] Nothing to do.');
    return;
  }

  console.log(`[embed] Loading model ${MODEL} (downloads ~118MB on first run)...`);
  const extractor = await pipeline('feature-extraction', MODEL, { quantized: true });
  console.log('[embed] Model ready. Embedding...');

  const newItems = [];
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map(passageText);
    const output = await extractor(texts, { pooling: 'mean', normalize: true });

    for (let j = 0; j < batch.length; j++) {
      const a = batch[j];
      newItems.push({
        id: a.id,
        title: a.title || '',
        author: a.author || '',
        category: a.category || '',
        url: a.url || '',
        savedAt: a.savedAt || '',
        summary: (a.summary || '').slice(0, 200),
        vector: Array.from(output[j].data),
      });
    }

    const done = Math.min(i + BATCH_SIZE, toEmbed.length);
    process.stdout.write(`\r[embed] ${done}/${toEmbed.length}`);
  }
  console.log(' — done');

  const merged = INCREMENTAL
    ? [...Object.values(existing), ...newItems]
    : newItems;

  const dims = merged[0]?.vector?.length || 384;
  const index = {
    model: MODEL,
    dims,
    builtAt: new Date().toISOString(),
    count: merged.length,
    items: merged,
  };

  await writeFile(INDEX_FILE, JSON.stringify(index));
  console.log(`[embed] Saved ${merged.length} vectors → ${INDEX_FILE}`);
  console.log(`[embed] Index size: ${(JSON.stringify(index).length / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => { console.error(err); process.exit(1); });
