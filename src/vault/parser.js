import yaml from 'js-yaml';

/**
 * Parse metadata from Obsidian markdown files.
 * Supports two formats:
 *   1. YAML frontmatter (--- ... ---)
 *   2. Inline blockquote block (> Key: Value lines after H1)
 */
export function parseFile(rawContent) {
  // Try YAML frontmatter first
  const yamlMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (yamlMatch) {
    let meta = {};
    try { meta = yaml.load(yamlMatch[1]) || {}; } catch (_) {}
    const body = rawContent.slice(yamlMatch[0].length);
    const title = extractTitle(body) || extractTitle(rawContent);
    return { meta: normalizeMeta(meta), body, title };
  }

  // Try inline blockquote metadata block
  // Pattern: after optional H1, one or more "> Key: Value" lines
  const lines = rawContent.split('\n');
  let title = null;
  let metaStartIdx = -1;
  let metaEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip blank lines before H1
    if (!title && line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    if (!title) continue; // Haven't seen H1 yet

    // Blank line after title — look for meta block next
    if (line.trim() === '' && metaStartIdx === -1) continue;

    // Start of meta block
    if (line.startsWith('> ') && metaStartIdx === -1) {
      metaStartIdx = i;
    }

    // Continue meta block
    if (metaStartIdx !== -1 && line.startsWith('> ')) {
      metaEndIdx = i;
      continue;
    }

    // End of meta block
    if (metaStartIdx !== -1 && !line.startsWith('> ')) {
      break;
    }
  }

  const meta = {};
  if (metaStartIdx !== -1) {
    for (let i = metaStartIdx; i <= metaEndIdx; i++) {
      const line = lines[i].slice(2); // strip "> "
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      meta[key] = value;
    }
  }

  // Body = everything after the meta block (or after H1 if no meta)
  let bodyStartIdx = metaEndIdx !== -1 ? metaEndIdx + 1 : (title ? 1 : 0);
  // Skip blank line immediately after meta block
  while (bodyStartIdx < lines.length && lines[bodyStartIdx].trim() === '') {
    bodyStartIdx++;
  }
  const body = lines.slice(bodyStartIdx).join('\n');

  return { meta: normalizeMeta(meta), body, title: title || 'Untitled' };
}

function extractTitle(text) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function normalizeMeta(raw) {
  const meta = { ...raw };

  // Normalize type: "#concept" → "concept"
  if (meta.type) meta.type = meta.type.replace(/^#/, '').toLowerCase().trim();

  // Normalize tags: "#tag1 #tag2" → ["tag1", "tag2"]
  if (typeof meta.tags === 'string') {
    meta.tags = meta.tags.split(/\s+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);
  } else if (!Array.isArray(meta.tags)) {
    meta.tags = [];
  }

  // Normalize level: "L2" → "L2"
  if (meta.level) meta.level = meta.level.trim().toUpperCase();

  // Normalize parent: "[[AI Research MOC]]" → "AI Research MOC"
  if (meta.parent) meta.parent = meta.parent.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();

  return meta;
}
