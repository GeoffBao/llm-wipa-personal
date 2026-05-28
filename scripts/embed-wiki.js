#!/usr/bin/env node
/**
 * Build semantic vector index for Wiki/Notes/Projects .md files.
 * Uses multilingual-e5-small — same model as embed-readwise.js.
 *
 * Reads:  loadVault() → Wiki/, Notes/, Projects/ *.md
 * Writes: $VAULT_PATH/Raw/wiki-vector-index.json
 *
 * Usage:
 *   node --env-file=.env scripts/embed-wiki.js
 *   node --env-file=.env scripts/embed-wiki.js --incremental
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { pipeline } from '@xenova/transformers';
import { loadVault, getAllFiles } from '../src/vault/loader.js';

const VAULT_PATH  = process.env.VAULT_PATH || '';
const INDEX_FILE  = join(VAULT_PATH, 'Raw', 'wiki-vector-index.json');
const INCREMENTAL = process.argv.includes('--incremental');
const MODEL       = 'Xenova/multilingual-e5-small';
const BATCH_SIZE  = 16;
const CHUNK_SIZE  = 800;   // chars (~512 tokens for mixed CJK/EN)
const OVERLAP     = 100;   // chars overlap between adjacent chunks

function chunkBody(body) {
  if (!body) return [];
  const paragraphs = body.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p || p.length < 10) continue;

    const candidate = current ? current + '\n\n' + p : p;
    if (candidate.length <= CHUNK_SIZE) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (p.length > CHUNK_SIZE) {
        for (let i = 0; i < p.length; i += CHUNK_SIZE - OVERLAP) {
          const slice = p.slice(i, i + CHUNK_SIZE);
          if (slice.length > 20) chunks.push(slice);
        }
        current = '';
      } else {
        current = p;
      }
    }
  }
  if (current && current.length > 10) chunks.push(current);

  return chunks.length > 0 ? chunks : [body.slice(0, CHUNK_SIZE)];
}

function passageText(title, chunkText) {
  return 'passage: ' + `${title}\n${chunkText}`.trim().slice(0, 500);
}

async function main() {
  if (!VAULT_PATH) { console.error('VAULT_PATH not set'); process.exit(1); }

  console.log('[embed-wiki] Loading vault...');
  await loadVault();
  const files = getAllFiles();
  console.log(`[embed-wiki] ${files.length} files loaded`);

  // Load existing index for incremental mode
  let existing = {};
  if (INCREMENTAL) {
    try {
      const idx = JSON.parse(await readFile(INDEX_FILE, 'utf8'));
      existing = Object.fromEntries((idx.items || []).map(x => [x.id, x]));
      console.log(`[embed-wiki] Incremental: ${Object.keys(existing).length} cached chunks`);
    } catch { /* first run */ }
  }

  // Build chunk list
  const allChunks = [];
  for (const f of files) {
    const mtimeKey = f.mtime?.toISOString() || '';
    const bodyChunks = chunkBody(f.body);
    bodyChunks.forEach((text, chunkIdx) => {
      allChunks.push({
        id: `${f.slug}__${chunkIdx}`,
        slug: f.slug,
        section: f.section,
        title: f.title,
        chunkIdx,
        snippet: text.slice(0, 200),
        mtimeKey,
        text,
      });
    });
  }

  console.log(`[embed-wiki] ${allChunks.length} chunks from ${files.length} files`);

  const toEmbed = INCREMENTAL
    ? allChunks.filter(c => {
        const cached = existing[c.id];
        return !cached || cached.mtimeKey !== c.mtimeKey;
      })
    : allChunks;

  console.log(`[embed-wiki] Need to embed: ${toEmbed.length}`);
  if (toEmbed.length === 0) {
    console.log('[embed-wiki] Nothing to do.');
    return;
  }

  console.log(`[embed-wiki] Loading model ${MODEL} (downloads ~118MB on first run)...`);
  const extractor = await pipeline('feature-extraction', MODEL, { quantized: true });
  console.log('[embed-wiki] Model ready. Embedding...');

  const newItems = [];
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => passageText(c.title, c.text));
    const output = await extractor(texts, { pooling: 'mean', normalize: true });

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      newItems.push({
        id: c.id,
        slug: c.slug,
        section: c.section,
        title: c.title,
        chunkIdx: c.chunkIdx,
        snippet: c.snippet,
        mtimeKey: c.mtimeKey,
        vector: Array.from(output[j].data),
      });
    }

    const done = Math.min(i + BATCH_SIZE, toEmbed.length);
    process.stdout.write(`\r[embed-wiki] ${done}/${toEmbed.length}`);
  }
  console.log(' — done');

  let merged;
  if (INCREMENTAL) {
    const newById = Object.fromEntries(newItems.map(x => [x.id, x]));
    merged = [
      ...Object.values(existing).filter(x => !newById[x.id]),
      ...newItems,
    ];
  } else {
    merged = newItems;
  }

  const dims = merged[0]?.vector?.length || 384;
  const index = {
    model: MODEL,
    dims,
    builtAt: new Date().toISOString(),
    count: merged.length,
    items: merged,
  };

  await writeFile(INDEX_FILE, JSON.stringify(index));
  const sizeMB = (JSON.stringify(index).length / 1024 / 1024).toFixed(1);
  console.log(`[embed-wiki] Saved ${merged.length} chunks → ${INDEX_FILE} (${sizeMB} MB)`);
}

main().catch(err => { console.error(err); process.exit(1); });
