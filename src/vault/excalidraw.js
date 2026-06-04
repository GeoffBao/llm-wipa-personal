import { readFile, writeFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { glob } from 'glob';
import LZString from 'lz-string';
import { VAULT_PATH } from '../../config.js';

const EXCALIDRAW_DIR = process.env.EXCALIDRAW_DIR || '';
const VAULT_DIAGRAMS = VAULT_PATH ? join(VAULT_PATH, 'Diagrams') : '';
const excalidrawIndex = new Map(); // slug → ExcalidrawFile

function slugify(title) {
  return title.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w一-鿿぀-ヿ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleFromFilename(filename) {
  const base = basename(filename);
  if (base.endsWith('.excalidraw.md')) return base.slice(0, -'.excalidraw.md'.length);
  if (base.endsWith('.excalidraw')) return base.slice(0, -'.excalidraw'.length);
  return base.replace(/\.md$/, '');
}

// Parse a raw file into Excalidraw scene data. Returns { data, wrapped } where
// `wrapped` means the file is the Obsidian Excalidraw markdown wrapper (frontmatter
// + a "## Drawing" code block) — those are read-only here, since writing back raw
// JSON would discard the markdown/Text-Elements wrapper Obsidian relies on.
//
// Format is detected by content, not extension: a *.excalidraw file may hold raw
// JSON OR the Obsidian markdown wrapper, and *.excalidraw.md is always wrapped.
function parseExcalidrawRaw(raw) {
  if (raw.trimStart().startsWith('{')) {
    return { data: JSON.parse(raw), wrapped: false };
  }

  // Obsidian markdown wrapper — only look inside "## Drawing" to avoid matching the body.
  const section = raw.split(/^## Drawing\s*$/m)[1] ?? raw;

  const compressed = section.match(/```compressed-json\n([\s\S]*?)\n```/);
  if (compressed) {
    const payload = compressed[1].replace(/[\n\r]/g, '').trim();
    const json = LZString.decompressFromBase64(payload);
    return { data: json ? JSON.parse(json) : null, wrapped: true };
  }

  const plain = section.match(/```json\n([\s\S]*?)\n```/);
  if (plain) return { data: JSON.parse(plain[1]), wrapped: true };

  return { data: null, wrapped: true };
}

export async function loadExcalidrawFiles() {
  excalidrawIndex.clear();

  // root → glob patterns. Files from EXCALIDRAW_DIR are editable (native .excalidraw);
  // Obsidian *.excalidraw.md are read-only (we don't write back the markdown wrapper).
  const sources = [];
  if (EXCALIDRAW_DIR) sources.push({ root: EXCALIDRAW_DIR, patterns: ['**/*.excalidraw', '**/*.excalidraw.md'] });
  if (VAULT_DIAGRAMS) sources.push({ root: VAULT_DIAGRAMS, patterns: ['**/*.excalidraw.md'] });

  if (!sources.length) {
    console.log('[excalidraw] No source directories configured, skipping');
    return;
  }

  for (const { root, patterns } of sources) {
    let files;
    try { files = await glob(patterns, { cwd: root, absolute: false }); }
    catch { continue; }

    for (const filename of files) {
      const filepath = join(root, filename);

      let raw, fileStat;
      try { [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]); }
      catch { continue; }

      let data, wrapped;
      try { ({ data, wrapped } = parseExcalidrawRaw(raw)); }
      catch { continue; }
      if (!data) continue;

      const title = titleFromFilename(filename);
      const slug = slugify(title);
      if (excalidrawIndex.has(slug)) {
        console.warn(`[excalidraw] Duplicate slug "${slug}" — keeping first, skipping ${filepath}`);
        continue;
      }

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
        wrapped, // true = Obsidian markdown-wrapper format; save must update ## Drawing block
      });
    }
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

// Save elements + appState back to disk.
// For wrapped Obsidian files (.excalidraw.md), only the ## Drawing block is replaced
// so frontmatter, Text Elements, and plugin metadata are preserved.
export async function saveExcalidrawFile(slug, payload) {
  const drawing = excalidrawIndex.get(slug);
  if (!drawing) throw new Error(`Drawing not found: ${slug}`);

  const sceneData = {
    type: 'excalidraw',
    version: 2,
    source: 'llm-wipa',
    elements: payload.elements || [],
    appState: payload.appState || {},
    files: payload.files || {},
  };

  if (drawing.wrapped) {
    // Obsidian markdown wrapper: replace only the ## Drawing fenced block
    const currentRaw = await readFile(drawing.filepath, 'utf8');
    const compressed = LZString.compressToBase64(JSON.stringify(sceneData));
    // Line-wrap at 76 chars to match Obsidian's style (purely cosmetic)
    const wrapped = (compressed.match(/.{1,76}/g) || [compressed]).join('\n');
    const newBlock = `## Drawing\n\`\`\`compressed-json\n${wrapped}\n\`\`\``;
    const newRaw = currentRaw.replace(
      /^## Drawing\s*\n```(?:compressed-json|json)\n[\s\S]*?\n```/m,
      newBlock,
    );
    await writeFile(drawing.filepath, newRaw, 'utf8');
  } else {
    await writeFile(drawing.filepath, JSON.stringify(sceneData, null, 2), 'utf8');
  }

  // Refresh the index entry
  const fileStat = await stat(drawing.filepath);
  const elements = sceneData.elements.filter(e => !e.isDeleted);
  excalidrawIndex.set(slug, {
    ...drawing,
    elements,
    background: sceneData.appState?.viewBackgroundColor || '#ffffff',
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
    wrapped: false,
  });
  return slug;
}
