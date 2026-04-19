import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS_DIR = join(__dirname, '../../views');

const cache = new Map();

async function loadTemplate(name) {
  if (cache.has(name)) return cache.get(name);
  const content = await readFile(join(VIEWS_DIR, name), 'utf8');
  cache.set(name, content);
  return content;
}

// Simple template engine: replace {{VAR}}, {{{RAW_VAR}}}, {{#if VAR}}...{{/if}}
function interpolate(template, vars) {
  // Handle {{#if VAR}}...{{else}}...{{/if}} blocks (else branch optional)
  let result = template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, key, trueContent, falseContent) => vars[key] ? trueContent : (falseContent || '')
  );
  // Triple braces: raw HTML (no escaping)
  result = result.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => vars[key] ?? '');
  // Double braces: escaped HTML
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(String(vars[key] ?? '')));
  return result;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function render(viewName, vars = {}) {
  const layout = await loadTemplate('layout.html');
  const view = await loadTemplate(viewName);

  const viewHtml = interpolate(view, vars);
  return interpolate(layout, { ...vars, content: viewHtml });
}

// Clear template cache (used in dev --watch mode)
export function clearCache() {
  cache.clear();
}
