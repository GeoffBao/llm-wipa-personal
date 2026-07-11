import { Router } from 'express';
import { render } from '../render/template.js';

const router = Router();

router.get('/agent', async (req, res) => {
  res.send(await render('agent.html', {
    pageTitle: 'Reading Agent — LLM WIPA',
    activeNav: 'agent',
    slug: String(req.query.slug || ''),
    selectedText: String(req.query.selected || ''),
    initialQuery: String(req.query.q || ''),
  }));
});

export default router;
