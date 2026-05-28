import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { VAULT_PATH, PORT } from './config.js';
import { loadVault, updateFile, removeFile, getAllFiles } from './src/vault/loader.js';
import { buildBacklinks } from './src/vault/backlinks.js';
import { buildSearchIndex, updateSearchDoc } from './src/search/index.js';
import { buildAssetIndex } from './src/render/assets.js';
import { clearCache } from './src/render/template.js';
import homeRouter from './src/routes/home.js';
import articleRouter from './src/routes/article.js';
import searchRouter from './src/routes/search.js';
import browseRouter from './src/routes/browse.js';
import apiRouter from './src/routes/api.js';
import readingRouter from './src/routes/reading.js';
import libraryRouter from './src/routes/libraryRoute.js';
import graphRouter from './src/routes/graph.js';
import canvasRouter from './src/routes/canvasRoute.js';
import { loadCanvases } from './src/vault/canvas.js';
import excalidrawRouter from './src/routes/excalidrawRoute.js';
import { loadExcalidrawFiles } from './src/vault/excalidraw.js';
import readwiseRouter from './src/routes/readwiseRoute.js';
import flipbookRouter from './src/routes/flipbookRoute.js';
import journeyRouter from './src/routes/journeyRoute.js';
import semanticSearchRouter from './src/routes/semanticSearch.js';
import { loadVectorStore, loadWikiVectorStore } from './src/search/vectorStore.js';
import chatRouter from './src/routes/chatRoute.js';
import embedRouter from './src/routes/embedRoute.js';
import { CACHE_DIR as FLIPBOOK_CACHE_DIR } from './src/services/flipbook.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Body parsing for API PUT/POST
app.use(express.json({ limit: '10mb' }));

// Static files
app.use('/public', express.static(join(__dirname, 'public')));
app.use('/assets', express.static(join(VAULT_PATH, 'Assets')));
app.use('/vault', express.static(VAULT_PATH));
app.use('/flipbook-cache', express.static(FLIPBOOK_CACHE_DIR, {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache');
  },
}));

// Routes
app.use(homeRouter);
app.use(articleRouter);
app.use(searchRouter);
app.use(browseRouter);
app.use(apiRouter);
app.use(readingRouter);
app.use(libraryRouter);
app.use(graphRouter);
app.use(canvasRouter);
app.use(excalidrawRouter);
app.use(readwiseRouter);
app.use(flipbookRouter);
app.use(journeyRouter);
app.use(semanticSearchRouter);
app.use(chatRouter);
app.use(embedRouter);

// Debounced vault watcher
let rebuildTimer = null;
function scheduleRebuild(filepath, action) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    if (action === 'remove') {
      removeFile(filepath);
    } else {
      const file = await updateFile(filepath);
      if (file) updateSearchDoc(file);
    }
    buildBacklinks(getAllFiles());
    console.log(`[watcher] Rebuilt index after ${action}: ${filepath}`);
  }, 200);
}

// Bootstrap
async function start() {
  console.log('[boot] Loading vault...');
  const files = await loadVault();
  buildBacklinks(files);
  buildSearchIndex(files);
  buildAssetIndex();
  await loadCanvases();
  await loadExcalidrawFiles();
  loadVectorStore();     // non-blocking: Readwise semantic search available once index loads
  loadWikiVectorStore(); // non-blocking: Wiki semantic search available once index loads

  // Hot-reload vector indices when rebuilt by embed scripts
  const indexFile     = join(VAULT_PATH, 'Raw', 'readwise-vector-index.json');
  const wikiIndexFile = join(VAULT_PATH, 'Raw', 'wiki-vector-index.json');
  chokidar.watch(indexFile, { ignoreInitial: true })
    .on('change', () => { loadVectorStore(); console.log('[watcher] Readwise vector index reloaded'); });
  chokidar.watch(wikiIndexFile, { ignoreInitial: true })
    .on('change', () => { loadWikiVectorStore(); console.log('[watcher] Wiki vector index reloaded'); });
  console.log(`[boot] Ready: ${files.length} files indexed`);

  // Watch views/ templates — clear cache on change
  const viewsDir = join(__dirname, 'views');
  chokidar.watch(`${viewsDir}/**/*.html`, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  }).on('change', () => { clearCache(); console.log('[watcher] Template cache cleared'); });

  // Watch Wiki, Notes, Projects for changes
  const wikiDir = join(VAULT_PATH, 'Wiki');
  const notesDir = join(VAULT_PATH, 'Notes');
  const projectsDir = join(VAULT_PATH, 'Projects');
  const watcher = chokidar.watch(
    [wikiDir, notesDir, projectsDir].map(d => `${d}/**/*.md`),
    { ignoreInitial: true, persistent: true }
  );

  watcher
    .on('add', path => scheduleRebuild(path, 'add'))
    .on('change', path => scheduleRebuild(path, 'change'))
    .on('unlink', path => scheduleRebuild(path, 'remove'));

  // Clear template cache in dev (--watch mode restarts automatically)
  if (process.env.NODE_ENV !== 'production') {
    clearCache();
  }

  app.listen(PORT, () => {
    console.log(`\n🌐 AI Knowledge Base running at http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('[boot] Failed to start:', err);
  process.exit(1);
});
