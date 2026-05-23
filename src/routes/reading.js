import { Router } from 'express';

const router = Router();

router.get('/reading', (req, res) => res.redirect('/books'));

export default router;
