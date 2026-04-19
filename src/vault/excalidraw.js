import { readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { glob } from 'glob';

const EXCALIDRAW_DIR = process.env.EXCALIDRAW_DIR || '';
const excalidrawIndex = new Map(); // slug → ExcalidrawFile

function slugify(title) {
  return title.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3040-\u30ff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function loadExcalidrawFiles() {
  excalidrawIndex.clear();

  if (!EXCALIDRAW_DIR) {
    console.log('[excalidraw] EXCALIDRAW_DIR not set, skipping');
    return;
  }

  let files;
  try {
    files = await glob('*.excalidraw', { cwd: EXCALIDRAW_DIR, absolute: false });
  } catch {
    console.log('[excalidraw] Directory not found, skipping');
    return;
  }

  for (const filename of files) {
    const filepath = join(EXCALIDRAW_DIR, filename);
    let raw, fileStat;
    try {
      [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]);
    } catch { continue; }

    let data;
    try { data = JSON.parse(raw); } catch { continue; }

    const title = basename(filename, '.excalidraw');
    const slug = slugify(title);

    const elements = (data.elements || []).filter(e => !e.isDeleted);
    const background = data.appState?.viewBackgroundColor || '#ffffff';

    excalidrawIndex.set(slug, {
      slug,
      title,
      filepath,
      mtime: fileStat.mtime,
      elements,
      background,
      elementCount: elements.length,
    });
  }

  console.log(`[excalidraw] Loaded ${excalidrawIndex.size} drawings`);
}

export function getAllExcalidrawFiles() {
  return [...excalidrawIndex.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans'));
}

export function getExcalidrawFile(slug) {
  return excalidrawIndex.get(slug) || null;
}
