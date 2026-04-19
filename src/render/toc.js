/**
 * Extract headings from rendered HTML to build a Table of Contents.
 * Returns array of { level, id, text } objects.
 */
export function extractTOC(html) {
  const headings = [];
  const regex = /<h([2-4])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, ''),
    });
  }
  return headings;
}

/**
 * Render TOC headings as nested HTML list.
 */
export function renderTOC(headings) {
  if (headings.length < 3) return '';

  let html = '<div class="toc" id="toc"><div class="toc-title">目录</div><ol>';
  let currentLevel = 2;

  for (const h of headings) {
    if (h.level > currentLevel) {
      html += '<ol>'.repeat(h.level - currentLevel);
    } else if (h.level < currentLevel) {
      html += '</ol>'.repeat(currentLevel - h.level);
    }
    currentLevel = h.level;
    html += `<li><a href="#${h.id}">${h.text}</a></li>`;
  }

  html += '</ol>'.repeat(currentLevel - 1) + '</div>';
  return html;
}
