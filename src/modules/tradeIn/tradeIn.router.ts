import { Router } from 'express';
import tradeInController from './tradeIn.controller';

const router = Router();

/**
 * Public/authenticated catalog search for trade-in guidance
 * GET /trade-in/catalog/search?query=iPhone+15+Pro&category=phone
 */
router.get('/catalog/search', tradeInController.searchCatalog);

export default router;
