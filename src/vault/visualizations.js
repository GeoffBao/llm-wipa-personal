import { readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { glob } from 'glob';
import { VAULT_PATH } from '../../config.js';

const VIZ_DIR = VAULT_PATH ? join(VAULT_PATH, 'Visualizations') : '';
const vizIndex = new Map(); // slug → Visualization

function slugify(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-鿿぀-ヿ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

// Title from <title>, else first <h1>, else filename.
function extractTitle(raw, fallback) {
  const t = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && t[1].trim()) return decodeEntities(t[1]);
  const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1 && h1[1].trim()) return decodeEntities(h1[1].replace(/<[^>]+>/g, ''));
  return fallback;
}

// Date: prefer YYYYMMDD / YYYY-MM-DD embedded in filename, else file mtime (local).
function dateFromName(filename, mtime) {
  const m = filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const p = n => String(n).padStart(2, '0');
  return `${mtime.getFullYear()}-${p(mtime.getMonth() + 1)}-${p(mtime.getDate())}`;
}

export async function loadVisualizations() {
  vizIndex.clear();
  if (!VIZ_DIR) {
    console.log('[viz] VAULT_PATH not set, skipping');
    return;
  }

  let files;
  try { files = await glob('**/*.html', { cwd: VIZ_DIR, absolute: false }); }
  catch { console.log('[viz] No Visualizations dir, skipping'); return; }

  for (const filename of files) {
    const filepath = join(VIZ_DIR, filename);
    let raw, fileStat;
    try { [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]); }
    catch { continue; }

    const base = basename(filename).replace(/\.html$/i, '');
    const slug = slugify(base);
    if (vizIndex.has(slug)) {
      console.warn(`[viz] Duplicate slug "${slug}" — keeping first, skipping ${filepath}`);
      continue;
    }

    vizIndex.set(slug, {
      slug,
      filename,
      filepath,
      title: extractTitle(raw, base),
      date: dateFromName(filename, fileStat.mtime),
      mtime: fileStat.mtime,
      size: fileStat.size,
    });
  }

  console.log(`[viz] Loaded ${vizIndex.size} visualizations`);
}

export function getAllVisualizations() {
  return [...vizIndex.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function getVisualization(slug) {
  return vizIndex.get(slug) || null;
}
