import { readFile, writeFile, stat } from 'fs/promises';
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

export function getExcalidrawDir() {
  return EXCALIDRAW_DIR;
}

// Save elements + appState back to the .excalidraw file on disk
export async function saveExcalidrawFile(slug, payload) {
  const drawing = excalidrawIndex.get(slug);
  if (!drawing) throw new Error(`Drawing not found: ${slug}`);

  const fileData = {
    type: 'excalidraw',
    version: 2,
    source: 'llm-wipa',
    elements: payload.elements || [],
    appState: payload.appState || {},
    files: payload.files || {},
  };
  await writeFile(drawing.filepath, JSON.stringify(fileData, null, 2), 'utf8');

  // Refresh the index entry
  const fileStat = await stat(drawing.filepath);
  const elements = (fileData.elements || []).filter(e => !e.isDeleted);
  excalidrawIndex.set(slug, {
    ...drawing,
    elements,
    background: fileData.appState?.viewBackgroundColor || '#ffffff',
    elementCount: elements.length,
    mtime: fileStat.mtime,
  });
}

// Create a new blank .excalidraw file and add it to the index
export async function createExcalidrawFile(title) {
  if (!EXCALIDRAW_DIR) throw new Error('EXCALIDRAW_DIR not configured');

  const slug = slugify(title);
  if (excalidrawIndex.has(slug)) throw new Error(`Drawing "${title}" already exists`);

  const filepath = join(EXCALIDRAW_DIR, `${title}.excalidraw`);
  const fileData = {
    type: 'excalidraw',
    version: 2,
    source: 'llm-wipa',
    elements: [],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };
  await writeFile(filepath, JSON.stringify(fileData, null, 2), 'utf8');

  const fileStat = await stat(filepath);
  excalidrawIndex.set(slug, {
    slug, title, filepath,
    mtime: fileStat.mtime,
    elements: [],
    background: '#ffffff',
    elementCount: 0,
  });
  return slug;
}
