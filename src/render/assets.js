import { readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { VAULT_PATH } from '../../config.js';

// Build a filename → relative URL map by scanning Assets/ recursively
const assetMap = new Map(); // filename (lowercase) → URL path

export function buildAssetIndex() {
  const assetsDir = join(VAULT_PATH, 'Assets');
  if (!existsSync(assetsDir)) return;
  scanDir(assetsDir, assetsDir);
  console.log(`[assets] Indexed ${assetMap.size} assets`);
}

function scanDir(dir, base) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full, base);
    } else {
      // Store both exact and lowercase for case-insensitive lookup
      const rel = full.slice(base.length + 1); // relative to Assets/
      assetMap.set(entry.name.toLowerCase(), `/assets/${encodeURIComponent(rel)}`);
    }
  }
}

export function resolveAsset(filename) {
  return assetMap.get(filename.toLowerCase()) || null;
}
