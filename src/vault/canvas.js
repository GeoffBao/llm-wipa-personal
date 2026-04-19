import { readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { glob } from 'glob';
import { VAULT_PATH } from '../../config.js';
import { byTitle, byTitleLower, generateSlug } from './loader.js';

const canvasIndex = new Map(); // slug → CanvasFile

export async function loadCanvases() {
  canvasIndex.clear();
  const diagramsDir = join(VAULT_PATH, 'Diagrams');

  let files;
  try { files = await glob('*.canvas', { cwd: diagramsDir, absolute: false }); }
  catch { return; }

  for (const filename of files) {
    const filepath = join(diagramsDir, filename);
    let raw, fileStat;
    try { [raw, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)]); }
    catch { continue; }

    let data;
    try { data = JSON.parse(raw); }
    catch { continue; }

    const title = basename(filename, '.canvas');
    const slug = generateSlug(title);

    // Resolve file nodes to wiki articles
    const resolvedNodes = (data.nodes || []).map(node => {
      if (node.type === 'file' && node.file) {
        const noteName = basename(node.file, '.md');
        const wikiFile = byTitle.get(noteName) || byTitleLower.get(noteName.toLowerCase());
        return { ...node, wikiSlug: wikiFile?.slug || null, wikiTitle: wikiFile?.title || noteName };
      }
      return node;
    });

    canvasIndex.set(slug, {
      slug,
      title,
      filepath,
      mtime: fileStat.mtime,
      nodes: resolvedNodes,
      edges: data.edges || [],
    });
  }

  console.log(`[canvas] Loaded ${canvasIndex.size} canvas diagrams`);
}

export function getAllCanvases() { return [...canvasIndex.values()]; }
export function getCanvas(slug) { return canvasIndex.get(slug) || null; }
