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
import graphRouter from './src/routes/graph.js';
import canvasRouter from './src/routes/canvasRoute.js';
import { loadCanvases } from './src/vault/canvas.js';
import excalidrawRouter from './src/routes/excalidrawRoute.js';
import { loadExcalidrawFiles } from './src/vault/excalidraw.js';
import readwiseRouter from './src/routes/readwiseRoute.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Body parsing for API PUT/POST
app.use(express.json({ limit: '10mb' }));

// Static files
app.use('/public', express.static(join(__dirname, 'public')));
app.use('/assets', express.static(join(VAULT_PATH, 'Assets')));

// Routes
app.use(homeRouter);
app.use(articleRouter);
app.use(searchRouter);
app.use(browseRouter);
app.use(apiRouter);
app.use(readingRouter);
app.use(graphRouter);
app.use(canvasRouter);
app.use(excalidrawRouter);
app.use(readwiseRouter);

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
  console.log(`[boot] Ready: ${files.length} files indexed`);

  // Watch Wiki directory for changes
  const wikiDir = join(VAULT_PATH, 'Wiki');
  const watcher = chokidar.watch(`${wikiDir}/**/*.md`, {
    ignoreInitial: true,
    persistent: true,
  });

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
