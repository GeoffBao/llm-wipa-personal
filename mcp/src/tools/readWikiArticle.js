import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { VAULT_PATH } from '../config.js';

const WIKI_DIRS = ['concepts', 'sources', 'mocs', 'synthesis', 'prompts'];
const MAX_CHARS = 6000;

function toSlug(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9一-鿿-]/g, '');
}

async function findFile(query) {
  const querySlug = toSlug(query);
  const queryLower = query.toLowerCase();

  for (const pass of ['exact', 'partial']) {
    for (const dir of WIKI_DIRS) {
      const dirPath = join(VAULT_PATH, 'Wiki', dir);
      let files;
      try { files = await readdir(dirPath); } catch { continue; }

      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        const name = f.slice(0, -3);
        if (pass === 'exact') {
          if (name.toLowerCase() === queryLower || toSlug(name) === querySlug) {
            return join(dirPath, f);
          }
        } else {
          if (name.toLowerCase().includes(queryLower) || queryLower.includes(name.toLowerCase())) {
            return join(dirPath, f);
          }
        }
      }
    }
  }
  return null;
}

export async function readWikiArticle(slug) {
  const filePath = await findFile(slug);
  if (!filePath) {
    return `No wiki article found for "${slug}".\nTip: use search_wiki("${slug}") to find valid article names.`;
  }

  const content = await readFile(filePath, 'utf8');
  if (content.length <= MAX_CHARS) return content;
  return content.slice(0, MAX_CHARS) + `\n\n[... truncated at ${MAX_CHARS} chars. Full article is ${content.length} chars.]`;
}
