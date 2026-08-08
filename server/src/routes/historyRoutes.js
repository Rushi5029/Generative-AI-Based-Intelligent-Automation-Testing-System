import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as historyController from '../controllers/historyController.js';

const router = express.Router();

router.get('/srs', authenticate, historyController.listSrsHistory);
router.post('/srs', authenticate, historyController.createSrsHistory);
router.delete('/srs/:id', authenticate, historyController.deleteSrsHistory);

export default router;
