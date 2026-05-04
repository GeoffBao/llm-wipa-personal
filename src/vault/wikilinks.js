import { byTitle, byTitleLower, bySlug, generateSlug } from './loader.js';

function normalizeWikilinkKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\u3040-\u30ff]+/g, '');
}

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
  let file = byTitle.get(titlePart)
    || byTitleLower.get(titlePart.toLowerCase())
    || bySlug.get(generateSlug(titlePart));

  // Fallback: ignore punctuation/space/fullwidth separator differences.
  if (!file) {
    const normalizedTarget = normalizeWikilinkKey(titlePart);
    if (normalizedTarget) {
      for (const candidate of byTitle.values()) {
        if (normalizeWikilinkKey(candidate.title) === normalizedTarget) {
          file = candidate;
          break;
        }
      }
    }
  }

  const display = displayText || (file ? file.title : titlePart);

  if (!file) {
    const fallbackHref = `/wiki/${generateSlug(titlePart)}${anchor ? '#' + anchor.toLowerCase().replace(/\s+/g, '-') : ''}`;
    return { resolved: false, display, href: fallbackHref };
  }

  const href = `/wiki/${file.slug}${anchor ? '#' + anchor.toLowerCase().replace(/\s+/g, '-') : ''}`;
  return { resolved: true, display, href, file };
}
