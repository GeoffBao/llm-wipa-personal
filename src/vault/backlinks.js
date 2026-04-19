import { byTitle, getAllFiles } from './loader.js';

// Map: normalizedTitle → Set<VaultFile>
const backlinksIndex = new Map();

export function buildBacklinks(allFiles) {
  backlinksIndex.clear();
  const wikilinkRegex = /\[\[([^\]|^]+)/g;

  for (const file of allFiles) {
    let match;
    const seen = new Set();
    wikilinkRegex.lastIndex = 0;
    while ((match = wikilinkRegex.exec(file.raw)) !== null) {
      const targetTitle = match[1].trim();
      if (seen.has(targetTitle)) continue;
      seen.add(targetTitle);
      if (!backlinksIndex.has(targetTitle)) backlinksIndex.set(targetTitle, new Set());
      backlinksIndex.get(targetTitle).add(file);
    }
  }
}

export function getBacklinks(title) {
  return [...(backlinksIndex.get(title) || [])];
}
