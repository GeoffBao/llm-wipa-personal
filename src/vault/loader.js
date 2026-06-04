import { readFile, stat } from 'fs/promises';
import { join, relative, basename } from 'path';
import { glob } from 'glob';
import { VAULT_PATH, WIKI_SECTIONS } from '../../config.js';
import { parseFile } from './parser.js';

// In-memory vault index
export const bySlug = new Map();        // slug → VaultFile
export const byTitle = new Map();       // exact title → VaultFile
export const byTitleLower = new Map();  // lowercase title → VaultFile
export const byFilename = new Map();    // basename(filepath, '.md') → VaultFile (canvas file-node resolution)

// Separate reading index (weread books with rich metadata)
export const readingIndex = new Map();  // slug → BookFile

export function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3040-\u30ff-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

function sectionFromRelpath(relpath, defaultSection) {
  const parts = relpath.split('/');
  return parts.length > 1 ? parts[0] : defaultSection;
}

async function loadFiles(baseDir, pattern, defaultSection) {
  const files = await glob(pattern, { cwd: baseDir, absolute: false });
  const results = [];

  for (const relpath of files) {
    const filepath = join(baseDir, relpath);
    let raw, fileStat;
    try {
      [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]);
    } catch { continue; }

    const { meta, body, title } = parseFile(raw);
    if (!title || title === 'Untitled') continue;

    const section = sectionFromRelpath(relpath, defaultSection);
    let slug = generateSlug(title);

    // Collision: prepend section prefix
    if (bySlug.has(slug)) {
      slug = `${defaultSection}-${slug}`;
    }

    const file = { slug, title, filepath, relpath, section: defaultSection, meta, body, raw, mtime: fileStat.mtime };
    results.push(file);
    bySlug.set(slug, file);
    byTitle.set(title, file);
    byTitleLower.set(title.toLowerCase(), file);
    byFilename.set(basename(filepath, '.md'), file);
  }
  return results;
}

export async function loadVault() {
  bySlug.clear();
  byTitle.clear();
  byTitleLower.clear();
  byFilename.clear();
  readingIndex.clear();

  const wikiBase = join(VAULT_PATH, 'Wiki');
  const notesBase = join(VAULT_PATH, 'Notes');
  const projectsBase = join(VAULT_PATH, 'Projects');
  const readingBase = join(VAULT_PATH, 'Raw', 'weread');

  // Load Wiki sections
  const wikiPattern = `{${WIKI_SECTIONS.join(',')}}/**/*.md`;
  const wikiRootPattern = '*.md';
  const [wikiFiles, wikiRoot] = await Promise.all([
    loadFiles(wikiBase, wikiPattern, 'wiki'),
    loadFiles(wikiBase, wikiRootPattern, 'wiki'),
  ]);

  // Assign correct sections for Wiki files
  for (const f of [...wikiFiles, ...wikiRoot]) {
    const section = WIKI_SECTIONS.find(s => f.relpath.startsWith(s + '/')) || 'wiki';
    f.section = section;
    bySlug.set(f.slug, f);
  }

  // Load Notes/
  const notesFiles = await loadFiles(notesBase, '**/*.md', 'notes').catch(() => []);

  // Load Projects/
  const projectFiles = await loadFiles(projectsBase, '**/*.md', 'projects').catch(() => []);

  // Load Reading (weread) — stored separately for book-card rendering
  await loadReading(readingBase);

  const total = bySlug.size;
  console.log(`[vault] Loaded ${total} files (Wiki + Notes + Projects) + ${readingIndex.size} books`);
  return [...bySlug.values()];
}

async function loadReading(baseDir) {
  let files;
  try { files = await glob('**/*.md', { cwd: baseDir, absolute: false }); }
  catch { return; }

  for (const relpath of files) {
    const filepath = join(baseDir, relpath);
    let raw, fileStat;
    try {
      [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]);
    } catch { continue; }

    const { meta, body } = parseFile(raw);
    if (meta.doc_type !== 'weread-highlights-reviews') continue;

    const title = meta.title || basename(filepath, '.md');
    const slug = 'reading-' + generateSlug(title);
    const category = relpath.split('/')[0]; // subfolder = category

    const book = {
      slug,
      title,
      filepath,
      relpath,
      section: 'reading',
      category,
      meta: {
        ...meta,
        noteCount: parseInt(meta.notecount || meta.noteCount || 0),
        reviewCount: parseInt(meta.reviewcount || meta.reviewCount || 0),
      },
      body,
      raw,
      mtime: fileStat.mtime,
    };

    readingIndex.set(slug, book);
  }
}

export function getFile(slug) { return bySlug.get(slug) || null; }
export function getAllFiles() { return [...bySlug.values()]; }
export function getFilesBySection(section) { return [...bySlug.values()].filter(f => f.section === section); }
export function getFilesByTag(tag) {
  return [...bySlug.values()].filter(f => Array.isArray(f.meta.tags) && f.meta.tags.includes(tag));
}
export function getAllBooks() { return [...readingIndex.values()]; }
export function getBook(slug) { return readingIndex.get(slug) || null; }

export async function updateFile(filepath) {
  const wikiBase = join(VAULT_PATH, 'Wiki');
  const notesBase = join(VAULT_PATH, 'Notes');
  const projectsBase = join(VAULT_PATH, 'Projects');

  let base = wikiBase, defaultSection = 'wiki';
  if (filepath.startsWith(notesBase)) { base = notesBase; defaultSection = 'notes'; }
  else if (filepath.startsWith(projectsBase)) { base = projectsBase; defaultSection = 'projects'; }

  const relpath = relative(base, filepath);

  try {
    const [raw, s] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]);
    const { meta, body, title } = parseFile(raw);
    const section = WIKI_SECTIONS.find(sec => relpath.startsWith(sec + '/')) || defaultSection;
    const slug = generateSlug(title);

    // Remove stale entry
    for (const [s, f] of bySlug) {
      if (f.filepath === filepath) {
        bySlug.delete(s);
        byTitle.delete(f.title);
        byTitleLower.delete(f.title.toLowerCase());
        byFilename.delete(basename(f.filepath, '.md'));
        break;
      }
    }

    const file = { slug, title, filepath, relpath, section, meta, body, raw, mtime: s.mtime };
    bySlug.set(slug, file);
    byTitle.set(title, file);
    byTitleLower.set(title.toLowerCase(), file);
    byFilename.set(basename(filepath, '.md'), file);
    return file;
  } catch { return null; }
}

export function removeFile(filepath) {
  for (const [slug, f] of bySlug) {
    if (f.filepath === filepath) {
      bySlug.delete(slug);
      byTitle.delete(f.title);
      byTitleLower.delete(f.title.toLowerCase());
      byFilename.delete(basename(f.filepath, '.md'));
      return;
    }
  }
}
