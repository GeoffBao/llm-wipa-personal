/**
 * WeRead cookie-based sync script
 *
 * Usage:
 *   node --env-file=.env scripts/sync-weread.js
 *
 * Required .env:
 *   WEREAD_COOKIE=<full cookie string from weread.qq.com>
 *   VAULT_PATH=/path/to/obsidian/vault
 *
 * Writes: Raw/weread-sync-data.json
 *
 * API structure (as of 2026):
 *   /web/shelf/sync  → shelf.books[] (flat book objects) + shelf.bookProgress[]
 *   shelf.books[i]  → { bookId, title, author, cover, categories,
 *                        readUpdateTime, finishReading, ... }
 *   shelf.bookProgress[i] → { bookId, progress, readingTime, updateTime }
 *
 * How to get your cookie:
 *   1. Open https://weread.qq.com in your browser → log in
 *   2. DevTools → Network → any /web/ request → Copy → Cookie header value
 *   3. Paste into WEREAD_COOKIE= in .env (no quotes needed)
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const VAULT_PATH    = process.env.VAULT_PATH    || '';
const WEREAD_COOKIE = process.env.WEREAD_COOKIE || '';

if (!VAULT_PATH)    { console.error('[weread-sync] VAULT_PATH not set'); process.exit(1); }
if (!WEREAD_COOKIE) { console.error('[weread-sync] WEREAD_COOKIE not set — add it to .env'); process.exit(1); }

const OUT_FILE = join(VAULT_PATH, 'Raw', 'weread-sync-data.json');
const BASE     = 'https://weread.qq.com/web';

// ── HTTP helper ────────────────────────────────────────────────────────────────
async function wrGet(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: {
      'Cookie':     WEREAD_COOKIE,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer':    'https://weread.qq.com/',
      'Accept':     'application/json, text/plain, */*',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${path}`);
  const json = await res.json();

  // WeRead returns errCode on auth failure
  if (json.errCode && json.errCode !== 0) {
    throw new Error(`WeRead errCode ${json.errCode}: ${json.errMsg || 'unknown'}`);
  }
  return json;
}

// ── Unix timestamp → YYYY-MM-DD ───────────────────────────────────────────────
function tsToDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// ── Format reading time (seconds → human) ─────────────────────────────────────
function fmtReadingTime(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}小时${m > 0 ? m + '分钟' : ''}`;
  return `${m}分钟`;
}

// ── Main sync ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('[weread-sync] Fetching bookshelf…');

  // 1. Get shelf — returns both books[] and bookProgress[]
  const shelf = await wrGet('/shelf/sync', { synckey: 0, teenmode: 0, language: 0 });

  const bookItems    = shelf.books        || [];
  const progressList = shelf.bookProgress || [];

  console.log(`[weread-sync] ${bookItems.length} books, ${progressList.length} with progress data`);

  if (bookItems.length === 0) {
    console.warn('[weread-sync] Empty shelf — check cookie validity');
    process.exit(1);
  }

  // 2. Build progress lookup map  bookId → progressEntry
  const progressMap = new Map();
  for (const p of progressList) {
    progressMap.set(p.bookId, p);
  }

  // 3. Build book records — no per-book API calls needed
  const books = [];
  for (let i = 0; i < bookItems.length; i++) {
    const bk = bookItems[i];          // flat book object from shelf.books
    const pr = progressMap.get(bk.bookId); // may be undefined if never opened

    process.stdout.write(`\r[weread-sync] ${i + 1}/${bookItems.length} ${bk.title?.slice(0, 20)}…`);

    const progress    = pr?.progress    || 0;
    const readingTime = pr?.readingTime || 0;
    const updateTs    = pr?.updateTime  || bk.readUpdateTime || 0;

    // finishReading=1 on the book item, or progress ≥ 99
    const isFinished  = bk.finishReading === 1 || progress >= 99;

    books.push({
      bookId:       bk.bookId,
      title:        bk.title        || '',
      author:       bk.author       || '',
      cover:        bk.cover        || '',
      progress,
      isFinished,
      readingTime:  fmtReadingTime(readingTime),
      lastReadDate: tsToDate(updateTs),
      finishedDate: isFinished ? tsToDate(updateTs) : '',
      noteCount:    0,   // review/list API unavailable (requires signed request)
      reviewCount:  0,
      category:     bk.categories?.[0]?.title || bk.category || '',
    });
  }

  console.log(''); // newline after progress

  // 4. Write output
  const output = {
    syncedAt: new Date().toISOString(),
    source:   'weread-cookie',
    books,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[weread-sync] ✓ Wrote ${books.length} books → ${OUT_FILE}`);
  console.log(`[weread-sync]   With progress data: ${books.filter(b => b.progress > 0).length}`);
  console.log(`[weread-sync]   Finished books:     ${books.filter(b => b.isFinished).length}`);
  console.log(`[weread-sync]   With reading time:  ${books.filter(b => b.readingTime).length}`);
}

main().catch(err => {
  console.error('\n[weread-sync] Fatal:', err.message);
  if (err.message.includes('errCode') || err.message.includes('HTTP 4')) {
    console.error('[weread-sync] Cookie may be expired — refresh it from DevTools');
  }
  process.exit(1);
});
