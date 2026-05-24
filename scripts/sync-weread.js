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
 * How to get your cookie:
 *   1. Open https://weread.qq.com in Chrome → log in
 *   2. DevTools → Network → any /web/ request → Copy → Cookie header value
 *   3. Paste into WEREAD_COOKIE= in .env (no quotes needed)
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load config directly (avoid ESM circular issues)
const VAULT_PATH = process.env.VAULT_PATH || '';
const WEREAD_COOKIE = process.env.WEREAD_COOKIE || '';

if (!VAULT_PATH) { console.error('[weread-sync] VAULT_PATH not set'); process.exit(1); }
if (!WEREAD_COOKIE) { console.error('[weread-sync] WEREAD_COOKIE not set — add it to .env'); process.exit(1); }

const OUT_FILE = join(VAULT_PATH, 'Raw', 'weread-sync-data.json');
const BASE = 'https://weread.qq.com/web';

// ── HTTP helper ────────────────────────────────────────────────────────────────
async function wrGet(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers: {
      'Cookie': WEREAD_COOKIE,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://weread.qq.com/',
      'Accept': 'application/json, text/plain, */*',
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

// ── Throttle helper ────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main sync ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('[weread-sync] Fetching bookshelf…');

  // 1. Get shelf
  const shelf = await wrGet('/shelf/sync', { synckey: 0, teenmode: 0, language: 0 });
  const bookItems = shelf.books || [];
  console.log(`[weread-sync] ${bookItems.length} books on shelf`);

  if (bookItems.length === 0) {
    console.warn('[weread-sync] Empty shelf — check cookie validity');
    process.exit(1);
  }

  // 2. Enrich each book
  const books = [];
  for (let i = 0; i < bookItems.length; i++) {
    const item = bookItems[i];
    const bk   = item.book || item;
    const ri   = item.readInfo || {};

    process.stdout.write(`\r[weread-sync] ${i + 1}/${bookItems.length} ${bk.title?.slice(0, 20)}…`);

    let noteCount = 0, reviewCount = 0;

    try {
      // Highlights (type=1) and reviews/notes (type=4)
      const [hl, rv] = await Promise.all([
        wrGet('/review/list', { bookId: bk.bookId, type: 1, maxIdx: 0, count: 0, synckey: 0 }),
        wrGet('/review/list', { bookId: bk.bookId, type: 4, maxIdx: 0, count: 0, synckey: 0 }),
      ]);
      noteCount   = hl.total   || 0;
      reviewCount = rv.total   || 0;
    } catch (e) {
      // Non-fatal — continue without counts
    }

    const progress     = ri.progress || 0;
    const markedStatus = ri.markedStatus || 0; // 4 = finished
    const isFinished   = markedStatus === 4 || progress >= 99;
    const updateTs     = ri.updateTime || 0;
    const finishedTs   = isFinished ? updateTs : 0;

    books.push({
      bookId:      bk.bookId,
      title:       bk.title || '',
      author:      bk.author || '',
      cover:       bk.cover || '',
      progress,
      isFinished,
      readingTime:  fmtReadingTime(ri.readingTime),
      lastReadDate: tsToDate(updateTs),
      finishedDate: isFinished ? tsToDate(finishedTs) : '',
      noteCount,
      reviewCount,
      category:    bk.categories?.[0]?.title || '',
    });

    await sleep(250); // polite rate-limit
  }

  console.log(''); // newline after progress

  // 3. Write output
  const output = {
    syncedAt: new Date().toISOString(),
    source:   'weread-cookie',
    books,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[weread-sync] ✓ Wrote ${books.length} books → ${OUT_FILE}`);
  console.log(`[weread-sync]   Total highlights: ${books.reduce((s, b) => s + b.noteCount, 0)}`);
  console.log(`[weread-sync]   Finished books:   ${books.filter(b => b.isFinished).length}`);
}

main().catch(err => {
  console.error('\n[weread-sync] Fatal:', err.message);
  if (err.message.includes('errCode') || err.message.includes('HTTP 4')) {
    console.error('[weread-sync] Cookie may be expired — refresh it from DevTools');
  }
  process.exit(1);
});
