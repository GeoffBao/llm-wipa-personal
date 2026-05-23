#!/usr/bin/env node
/**
 * Readwise Reader sync script.
 * Fetches all documents from the Readwise v3 API and writes them to:
 *   $VAULT_PATH/Raw/readwise-sync-data.json
 *
 * Usage:
 *   node --env-file=.env scripts/sync-readwise.js
 *   node --env-file=.env scripts/sync-readwise.js --incremental   (only updated since last sync)
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const VAULT_PATH    = process.env.VAULT_PATH || '';
const TOKEN         = process.env.READWISE_TOKEN || '';
const INCREMENTAL   = process.argv.includes('--incremental');
const SYNC_FILE     = join(VAULT_PATH, 'Raw', 'readwise-sync-data.json');

if (!TOKEN) { console.error('[sync] READWISE_TOKEN not set'); process.exit(1); }
if (!VAULT_PATH) { console.error('[sync] VAULT_PATH not set'); process.exit(1); }

function extractDomain(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function loadExisting() {
  try {
    const raw = await readFile(SYNC_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchAll(updatedAfter = null) {
  const articles = [];
  let cursor = null;
  let page = 0;

  do {
    page++;
    const url = new URL('https://readwise.io/api/v3/list/');
    url.searchParams.set('withHtmlContent', 'false');
    if (cursor) url.searchParams.set('pageCursor', cursor);
    if (updatedAfter) url.searchParams.set('updatedAfter', updatedAfter);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Token ${TOKEN}` },
    });

    if (resp.status === 429) {
      const wait = parseInt(resp.headers.get('Retry-After') || '60', 10);
      console.log(`[sync] Rate limited — waiting ${wait}s then retrying page ${page}...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;  // retry same page
    }

    if (!resp.ok) throw new Error(`API responded ${resp.status}`);

    const data = await resp.json();
    const docs = (data.results || [])
      .filter(d => d.category !== 'highlight' && d.title)
      .map(d => ({
        id:        d.id,
        title:     d.title || '(untitled)',
        author:    d.author || '',
        url:       `https://read.readwise.io/read/${d.id}`,
        sourceUrl: d.source_url || d.url || '',
        category:  (d.category || 'article').toLowerCase(),
        location:  (d.location || 'later').toLowerCase(),
        savedAt:   d.saved_at || d.created_at || '',
        updatedAt: d.updated_at || '',
        tags:      Object.keys(d.tags || {}),
        domain:    extractDomain(d.source_url || d.url || ''),
        progress:  typeof d.reading_progress === 'number' ? d.reading_progress : 0,
        wordCount: d.word_count || 0,
        summary:   d.summary || '',
        imageUrl:  d.image_url || '',
      }));

    articles.push(...docs);
    cursor = data.nextPageCursor || null;

    process.stdout.write(`\r[sync] Fetched ${articles.length} docs (page ${page})...`);
  } while (cursor);

  console.log('');
  return articles;
}

async function run() {
  const startedAt = Date.now();
  console.log(`[sync] Starting Readwise sync (${INCREMENTAL ? 'incremental' : 'full'})...`);

  const existing = await loadExisting();
  let updatedAfter = null;

  if (INCREMENTAL && existing?.syncedAt) {
    updatedAfter = existing.syncedAt;
    console.log(`[sync] Incremental since ${updatedAfter}`);
  }

  let articles;
  try {
    articles = await fetchAll(updatedAfter);
  } catch (err) {
    console.error('[sync] Fetch failed:', err.message);
    process.exit(1);
  }

  // Merge incremental updates into existing article list
  let finalArticles = articles;
  if (INCREMENTAL && existing?.articles?.length) {
    const byId = new Map(existing.articles.map(a => [a.id, a]));
    for (const a of articles) byId.set(a.id, a);  // overwrite updated
    finalArticles = [...byId.values()];
    console.log(`[sync] Merged: ${articles.length} updated → ${finalArticles.length} total`);
  }

  // Sort newest first
  finalArticles.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));

  const syncedAt = new Date().toISOString();
  const output = {
    syncedAt,
    durationMs: Date.now() - startedAt,
    totalCount: finalArticles.length,
    fetchedCount: articles.length,
    mode: INCREMENTAL ? 'incremental' : 'full',
    articles: finalArticles,
  };

  await mkdir(join(VAULT_PATH, 'Raw'), { recursive: true });
  await writeFile(SYNC_FILE, JSON.stringify(output, null, 2), 'utf8');

  console.log(`[sync] Done — ${finalArticles.length} articles saved to readwise-sync-data.json (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

run().catch(err => { console.error('[sync] Fatal:', err); process.exit(1); });
