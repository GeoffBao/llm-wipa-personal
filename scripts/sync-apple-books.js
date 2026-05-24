/**
 * Apple Books sync script
 *
 * Usage:
 *   node --env-file=.env scripts/sync-apple-books.js
 *
 * Required .env:
 *   VAULT_PATH=/path/to/obsidian/vault
 *
 * Reads Apple Books SQLite databases directly (no auth required):
 *   ~/Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary/BKLibrary-*.sqlite
 *   ~/Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation/AEAnnotation_*.sqlite
 *
 * Writes: Raw/apple-books-sync-data.json
 */

import Database from 'better-sqlite3';
import { writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const VAULT_PATH = process.env.VAULT_PATH || '';
if (!VAULT_PATH) { console.error('[apple-books-sync] VAULT_PATH not set'); process.exit(1); }

const HOME     = homedir();
const BK_DIR   = join(HOME, 'Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary');
const AE_DIR   = join(HOME, 'Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation');
const OUT_FILE = join(VAULT_PATH, 'Raw', 'apple-books-sync-data.json');

// ── Find SQLite file matching a pattern in a directory ────────────────────────
function findDb(dir, prefix) {
  try {
    const file = readdirSync(dir).find(f => f.startsWith(prefix) && f.endsWith('.sqlite'));
    if (!file) throw new Error(`No ${prefix}*.sqlite found in ${dir}`);
    return join(dir, file);
  } catch (e) {
    console.error(`[apple-books-sync] ${e.message}`);
    process.exit(1);
  }
}

// ── macOS Core Data timestamp → YYYY-MM-DD ───────────────────────────────────
// macOS reference: 2001-01-01 00:00:00 UTC = Unix 978307200
function macTsToDate(ts) {
  if (!ts) return '';
  return new Date((ts + 978307200) * 1000).toISOString().slice(0, 10);
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('[apple-books-sync] Opening Apple Books databases…');

  const bkDb = new Database(findDb(BK_DIR, 'BKLibrary'), { readonly: true });
  const aeDb = new Database(findDb(AE_DIR, 'AEAnnotation'), { readonly: true });

  // ── 1. Annotation counts per book ──────────────────────────────────────────
  const annotationRows = aeDb.prepare(`
    SELECT ZANNOTATIONASSETID as assetId, COUNT(*) as cnt
    FROM ZAEANNOTATION
    WHERE ZANNOTATIONDELETED = 0
       OR ZANNOTATIONDELETED IS NULL
    GROUP BY ZANNOTATIONASSETID
  `).all();

  const annotationMap = new Map();
  for (const row of annotationRows) {
    annotationMap.set(row.assetId, row.cnt);
  }
  aeDb.close();

  // ── 2. Book records ────────────────────────────────────────────────────────
  const rows = bkDb.prepare(`
    SELECT
      ZASSETID                        as bookId,
      ZTITLE                          as title,
      ZAUTHOR                         as author,
      ZCOVERURL                       as cover,
      ZREADINGPROGRESS                as progressRaw,
      ZBOOKHIGHWATERMARKPROGRESS      as highWater,
      ZLASTOPENDATE                   as lastOpenTs,
      ZDATEFINISHED                   as finishedTs,
      ZISFINISHED                     as isFinished,
      ZGENRE                          as genre,
      ZPAGECOUNT                      as pageCount
    FROM ZBKLIBRARYASSET
    WHERE ZTITLE IS NOT NULL
      AND ZASSETID IS NOT NULL
    ORDER BY ZLASTOPENDATE DESC NULLS LAST
  `).all();

  bkDb.close();

  const books = rows.map(r => {
    const progressRaw = r.progressRaw ?? r.highWater ?? 0;
    const progress    = Math.round(progressRaw * 100);
    const isFinished  = r.isFinished === 1 || progress >= 99;

    // Cover: Apple Books stores a local cache path or empty — skip local paths,
    // keep http URLs only (they work as <img src>)
    const cover = (r.cover && r.cover.startsWith('http')) ? r.cover : '';

    return {
      bookId:       r.bookId,
      title:        r.title  || '',
      author:       r.author || '',
      cover,
      progress,
      isFinished,
      lastReadDate: macTsToDate(r.lastOpenTs),
      finishedDate: isFinished ? macTsToDate(r.finishedTs || r.lastOpenTs) : '',
      noteCount:    annotationMap.get(r.bookId) || 0,
      category:     r.genre || '',
    };
  });

  // ── 3. Write output ────────────────────────────────────────────────────────
  const output = {
    syncedAt: new Date().toISOString(),
    source:   'apple-books',
    books,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[apple-books-sync] ✓ Wrote ${books.length} books → ${OUT_FILE}`);
  console.log(`[apple-books-sync]   Finished:   ${books.filter(b => b.isFinished).length}`);
  console.log(`[apple-books-sync]   Highlights: ${books.reduce((s, b) => s + b.noteCount, 0)}`);
  console.log(`[apple-books-sync]   With date:  ${books.filter(b => b.lastReadDate).length}`);
}

main();
