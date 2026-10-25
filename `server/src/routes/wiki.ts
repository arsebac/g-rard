import express from 'express';
import { searchWikiPage } from '../services/wiki';

const router = express.Router();

router.get('/search/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const page = await searchWikiPage(slug);
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
