import { byTitle, byTitleLower, bySlug, generateSlug } from './loader.js';

export function resolveWikilink(linkText) {
  // Handle "Title|Display" (pipe for display text)
  const pipeIdx = linkText.indexOf('|');
  const displayText = pipeIdx > -1 ? linkText.slice(pipeIdx + 1).trim() : null;
  const target = pipeIdx > -1 ? linkText.slice(0, pipeIdx).trim() : linkText.trim();

  // Handle "Title^anchor" (block reference)
  const caretIdx = target.indexOf('^');
  const titlePart = caretIdx > -1 ? target.slice(0, caretIdx).trim() : target;
  const anchor = caretIdx > -1 ? target.slice(caretIdx + 1).trim() : null;

  // Lookup: exact → case-insensitive → slug
  const file = byTitle.get(titlePart)
    || byTitleLower.get(titlePart.toLowerCase())
    || bySlug.get(generateSlug(titlePart));

  const display = displayText || (file ? file.title : titlePart);

  if (!file) {
    return { resolved: false, display, href: null };
  }

  const href = `/wiki/${file.slug}${anchor ? '#' + anchor.toLowerCase().replace(/\s+/g, '-') : ''}`;
  return { resolved: true, display, href, file };
}
