import { Router } from 'express';
import { semanticSearch, isReady, getCount } from '../search/vectorStore.js';

const router = Router();

router.get('/api/semantic-search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const k = Math.min(parseInt(req.query.k || '10', 10), 30);

  if (!isReady()) {
    return res.json({
      results: [],
      ready: false,
      message: 'Index not built. Run: node --env-file=.env scripts/embed-readwise.js',
    });
  }

  if (!q) {
    return res.json({ results: [], ready: true, count: getCount() });
  }

  try {
    const results = await semanticSearch(q, k);
    res.json({ results, ready: true, count: getCount(), query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
