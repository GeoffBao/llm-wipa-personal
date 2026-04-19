import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { resolveWikilink } from '../vault/wikilinks.js';
import { resolveAsset } from './assets.js';

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Custom marked instance
const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  })
);

// Wikilink inline extension: [[...]]
const wikilinkExtension = {
  name: 'wikilink',
  level: 'inline',
  start(src) { return src.indexOf('[['); },
  tokenizer(src) {
    const match = src.match(/^\[\[([^\]]+)\]\]/);
    if (match) {
      return { type: 'wikilink', raw: match[0], text: match[1] };
    }
  },
  renderer(token) {
    const resolved = resolveWikilink(token.text);
    if (resolved.resolved) {
      return `<a href="${resolved.href}" class="wikilink">${escapeHtml(resolved.display)}</a>`;
    }
    return `<a class="wikilink wikilink-missing" title="页面不存在">${escapeHtml(resolved.display)}</a>`;
  },
};

// Obsidian image embed extension: ![[filename.ext]]
const embedExtension = {
  name: 'embed',
  level: 'inline',
  start(src) { return src.indexOf('![['); },
  tokenizer(src) {
    const match = src.match(/^!\[\[([^\]]+)\]\]/);
    if (match) {
      return { type: 'embed', raw: match[0], text: match[1] };
    }
  },
  renderer(token) {
    const filename = token.text.trim();
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filename)) {
      const asset = resolveAsset(filename);
      if (asset) {
        return `<img src="${asset}" alt="${escapeHtml(filename)}" class="article-image" loading="lazy">`;
      }
      return `<span class="embed-missing">[图片: ${escapeHtml(filename)}]</span>`;
    }
    if (/\.excalidraw$/i.test(filename)) {
      return `<div class="embed-placeholder">📐 图表: ${escapeHtml(filename)}</div>`;
    }
    return `<span class="embed-missing">[嵌入: ${escapeHtml(filename)}]</span>`;
  },
};

marked.use({ extensions: [wikilinkExtension, embedExtension] });

// Custom renderer: add IDs to headings, wrap tables
marked.use({
  renderer: {
    heading({ text, depth }) {
      const id = text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fff\u3040-\u30ff-]/g, '')
        .replace(/--+/g, '-');
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    table({ header, rows }) {
      // Default marked table rendering, wrapped in scroll div
      const thead = `<thead><tr>${header.map(c => `<th>${c.text}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(row =>
        `<tr>${row.map(c => `<td>${c.text}</td>`).join('')}</tr>`
      ).join('')}</tbody>`;
      return `<div class="table-wrap"><table>${thead}${tbody}</table></div>\n`;
    },
    link({ href, text }) {
      const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
      const attrs = isExternal ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${href}"${attrs}>${text}</a>`;
    },
  },
});

export function renderMarkdown(markdown) {
  return marked.parse(markdown);
}
