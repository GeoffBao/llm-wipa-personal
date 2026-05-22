import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { resolve, dirname, relative } from 'path';
import { resolveWikilink } from '../vault/wikilinks.js';
import { resolveAsset } from './assets.js';
import { VAULT_PATH } from '../../config.js';

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const highlightPlugin = markedHighlight({
  emptyLangClass: 'hljs',
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    if (lang === 'mermaid' || lang === 'mmd') return code;
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
});

const renderHighlightedCode = highlightPlugin.renderer.code.bind(highlightPlugin.renderer);

function isMermaidLang(lang) {
  const language = (lang || '').match(/\S*/)?.[0];
  return language === 'mermaid' || language === 'mmd';
}

function buildMermaidRenderer(fallbackCodeRenderer) {
  return {
    code(token) {
      const text = typeof token === 'object' ? token.text : token;
      const lang = typeof token === 'object' ? token.lang : arguments[1];
      if (isMermaidLang(lang)) {
        return `<div class="mermaid-wrap"><pre class="mermaid">${text.replace(/\n$/, '')}</pre></div>\n`;
      }
      return fallbackCodeRenderer(token);
    },
  };
}

const mermaidPlugin = { renderer: buildMermaidRenderer(renderHighlightedCode) };

// Wikilink inline extension: [[...]]
const wikilinkExtension = {
  name: 'wikilink',
  level: 'inline',
  start(src) { return src.indexOf('[['); },
  tokenizer(src) {
    const match = src.match(/^\[\[([^\]]+)\]\]/);
    if (match) return { type: 'wikilink', raw: match[0], text: match[1] };
  },
  renderer(token) {
    const resolved = resolveWikilink(token.text);
    if (resolved.resolved) {
      return `<a href="${resolved.href}" class="wikilink">${escapeHtml(resolved.display)}</a>`;
    }
    return `<a href="${resolved.href}" class="wikilink wikilink-missing" title="页面不存在，点击查看建议">${escapeHtml(resolved.display)}</a>`;
  },
};

// Obsidian image embed extension: ![[filename.ext]]
// fileDir: absolute directory of the source .md file (for relative path fallback)
function buildEmbedExtension(fileDir = null) {
  return {
    name: 'embed',
    level: 'inline',
    start(src) { return src.indexOf('![['); },
    tokenizer(src) {
      const match = src.match(/^!\[\[([^\]]+)\]\]/);
      if (match) return { type: 'embed', raw: match[0], text: match[1] };
    },
    renderer(token) {
      const filename = token.text.trim();
      if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(filename)) {
        // 1. Try global asset index (Assets/ folder, also by basename)
        const asset = resolveAsset(filename);
        if (asset) return `<img src="${asset}" alt="${escapeHtml(filename)}" class="article-image" loading="lazy">`;
        // 2. Fallback: resolve relative to article file → serve via /vault/
        if (fileDir) {
          const absPath = resolve(fileDir, filename);
          const relToVault = relative(VAULT_PATH, absPath).replace(/\\/g, '/');
          const encodedPath = relToVault.split('/').map(encodeURIComponent).join('/');
          return `<img src="/vault/${encodedPath}" alt="${escapeHtml(filename)}" class="article-image" loading="lazy">`;
        }
        return `<span class="embed-missing">[图片: ${escapeHtml(filename)}]</span>`;
      }
      if (/\.excalidraw$/i.test(filename)) {
        return `<div class="embed-placeholder">📐 图表: ${escapeHtml(filename)}</div>`;
      }
      return `<span class="embed-missing">[嵌入: ${escapeHtml(filename)}]</span>`;
    },
  };
}

const baseRenderer = {
  heading({ text, depth }) {
    const id = text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff\u3040-\u30ff-]/g, '')
      .replace(/--+/g, '-');
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  },
  table({ header, rows }) {
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
};

function buildImageRenderer(fileDir) {
  return {
    image({ href, text }) {
      if (!href) return `<span class="embed-missing">[图片]</span>`;
      if (/^https?:\/\//.test(href) || href.startsWith('/')) {
        return `<img src="${href}" alt="${escapeHtml(text)}" class="article-image" loading="lazy">`;
      }
      // Relative path → resolve against article's directory → /vault/...
      const absPath = resolve(fileDir, href);
      const relToVault = relative(VAULT_PATH, absPath).replace(/\\/g, '/');
      return `<img src="/vault/${relToVault}" alt="${escapeHtml(text)}" class="article-image" loading="lazy">`;
    },
  };
}

function buildMarkedInstance(fileDir = null) {
  const instance = new Marked(highlightPlugin);
  instance.use(mermaidPlugin);
  instance.use({ extensions: [wikilinkExtension, buildEmbedExtension(fileDir)] });
  const renderer = fileDir
    ? { ...baseRenderer, ...buildImageRenderer(fileDir) }
    : baseRenderer;
  instance.use({ renderer });
  return instance;
}

// Default global instance (no file-path context)
const marked = buildMarkedInstance(null);

export function renderMarkdown(markdown, filePath = null) {
  if (filePath) {
    return buildMarkedInstance(dirname(filePath)).parse(markdown);
  }
  return marked.parse(markdown);
}
