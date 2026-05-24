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
 * Apple Books stores EPUBs as expanded directories (not zipped), so cover images
 * are directly readable. This script extracts covers and caches them in the
 * server's public/covers/ab/ directory.
 *
 * Writes: Raw/apple-books-sync-data.json
 */

import Database from 'better-sqlite3';
import { writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const VAULT_PATH = process.env.VAULT_PATH || '';
if (!VAULT_PATH) { console.error('[apple-books-sync] VAULT_PATH not set'); process.exit(1); }

const HOME      = homedir();
const BK_DIR    = join(HOME, 'Library/Containers/com.apple.iBooksX/Data/Documents/BKLibrary');
const AE_DIR    = join(HOME, 'Library/Containers/com.apple.iBooksX/Data/Documents/AEAnnotation');
const OUT_FILE  = join(VAULT_PATH, 'Raw', 'apple-books-sync-data.json');

// Cover cache: <project-root>/public/covers/ab/
const __dir     = dirname(fileURLToPath(import.meta.url));
const COVER_DIR = join(__dir, '..', 'public', 'covers', 'ab');

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

// ── Extract cover image from an expanded EPUB directory ───────────────────────
// Apple Books on iCloud stores EPUBs as directories (not ZIP files).
// We parse container.xml → OPF → cover item → copy the image file.
function extractCover(epubPath, bookId) {
  const cached = join(COVER_DIR, `${bookId}.jpg`);
  if (existsSync(cached)) return `/public/covers/ab/${bookId}.jpg`;

  try {
    if (!existsSync(epubPath)) return '';

    // 1. Read container.xml
    const containerPath = join(epubPath, 'META-INF', 'container.xml');
    if (!existsSync(containerPath)) return '';
    const container = readFileSync(containerPath, 'utf8');
    const opfMatch  = container.match(/full-path="([^"]+\.opf)"/);
    if (!opfMatch) return '';

    // 2. Read OPF
    const opfPath = join(epubPath, ...opfMatch[1].split('/'));
    if (!existsSync(opfPath)) return '';
    const opf     = readFileSync(opfPath, 'utf8');
    const opfDir  = dirname(opfPath);

    // 3. Find cover image href — try several patterns
    let coverHref = '';

    // Pattern A: <item properties="cover-image" href="...">
    const propMatch = opf.match(/<item[^>]+properties=["'][^"']*cover-image[^"']*["'][^>]+href=["']([^"']+)["']/);
    if (propMatch) coverHref = propMatch[1];

    // Pattern B: <meta name="cover" content="ID"/> then <item id="ID" href="...">
    if (!coverHref) {
      const metaMatch = opf.match(/<meta\s+name=["']cover["']\s+content=["']([^"']+)["']/i)
                     || opf.match(/<meta\s+content=["']([^"']+)["']\s+name=["']cover["']/i);
      if (metaMatch) {
        const id = metaMatch[1];
        const itemMatch = opf.match(new RegExp(`<item[^>]+id=["']${id}["'][^>]+href=["']([^"']+)["']`))
                       || opf.match(new RegExp(`<item[^>]+href=["']([^"']+)["'][^>]+id=["']${id}["']`));
        if (itemMatch) coverHref = itemMatch[1];
      }
    }

    // Pattern C: first image item with "cover" in id or href
    if (!coverHref) {
      const fallback = opf.match(/<item[^>]+(?:id|href)=["'][^"']*cover[^"']*["'][^>]+href=["']([^"']+)["']/i)
                    || opf.match(/<item[^>]+href=["']([^"']*cover[^"']*\.(?:jpe?g|png))["']/i);
      if (fallback) coverHref = fallback[1];
    }

    if (!coverHref) return '';

    // 4. Resolve relative to OPF directory and copy
    const imgPath = join(opfDir, ...coverHref.split('/'));
    if (!existsSync(imgPath)) return '';

    copyFileSync(imgPath, cached);
    return `/public/covers/ab/${bookId}.jpg`;
  } catch {
    return '';
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  mkdirSync(COVER_DIR, { recursive: true });
  console.log('[apple-books-sync] Opening Apple Books databases…');

  const bkDb = new Database(findDb(BK_DIR, 'BKLibrary'), { readonly: true });
  const aeDb = new Database(findDb(AE_DIR, 'AEAnnotation'), { readonly: true });

  // ── 1. Annotations: counts + text per book (non-deleted only) ────────────────
  const annotationRows = aeDb.prepare(`
    SELECT
      ZANNOTATIONASSETID            as assetId,
      ZANNOTATIONSELECTEDTEXT       as selectedText,
      ZANNOTATIONNOTE               as note,
      ZANNOTATIONCREATIONDATE       as createdTs
    FROM ZAEANNOTATION
    WHERE (ZANNOTATIONDELETED = 0 OR ZANNOTATIONDELETED IS NULL)
      AND ZANNOTATIONASSETID != ''
      AND ZANNOTATIONSELECTEDTEXT IS NOT NULL
      AND ZANNOTATIONSELECTEDTEXT != ''
    ORDER BY ZANNOTATIONCREATIONDATE ASC
  `).all();

  const annotationMap  = new Map(); // bookId → count
  const highlightsMap  = new Map(); // bookId → [{text, note, date}]
  for (const row of annotationRows) {
    annotationMap.set(row.assetId, (annotationMap.get(row.assetId) || 0) + 1);
    if (!highlightsMap.has(row.assetId)) highlightsMap.set(row.assetId, []);
    highlightsMap.get(row.assetId).push({
      text: row.selectedText,
      note: row.note || '',
      date: macTsToDate(row.createdTs),
    });
  }
  aeDb.close();

  // ── 2. Book records ────────────────────────────────────────────────────────
  const rows = bkDb.prepare(`
    SELECT
      ZASSETID                        as bookId,
      ZTITLE                          as title,
      ZAUTHOR                         as author,
      ZPATH                           as epubPath,
      ZREADINGPROGRESS                as progressRaw,
      ZBOOKHIGHWATERMARKPROGRESS      as highWater,
      ZLASTOPENDATE                   as lastOpenTs,
      ZDATEFINISHED                   as finishedTs,
      ZISFINISHED                     as isFinished,
      ZGENRE                          as genre
    FROM ZBKLIBRARYASSET
    WHERE ZTITLE IS NOT NULL
      AND ZASSETID IS NOT NULL
    ORDER BY ZLASTOPENDATE DESC NULLS LAST
  `).all();

  bkDb.close();

  let coversFound = 0;
  const books = rows.map((r, i) => {
    const progressRaw = r.progressRaw ?? r.highWater ?? 0;
    const progress    = Math.round(progressRaw * 100);
    const isFinished  = r.isFinished === 1 || progress >= 99;

    // Extract cover from EPUB directory
    const cover = r.epubPath ? extractCover(r.epubPath, r.bookId) : '';
    if (cover) coversFound++;

    process.stdout.write(`\r[apple-books-sync] ${i + 1}/${rows.length} covers…`);

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
      highlights:   highlightsMap.get(r.bookId) || [],
      category:     r.genre || '',
    };
  });

  console.log('');

  // ── 3. Write output ────────────────────────────────────────────────────────
  const output = {
    syncedAt: new Date().toISOString(),
    source:   'apple-books',
    books,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[apple-books-sync] ✓ Wrote ${books.length} books → ${OUT_FILE}`);
  console.log(`[apple-books-sync]   Covers extracted: ${coversFound}/${books.length}`);
  console.log(`[apple-books-sync]   Finished:         ${books.filter(b => b.isFinished).length}`);
  console.log(`[apple-books-sync]   Highlights:       ${books.reduce((s, b) => s + b.noteCount, 0)}`);
}

main();
