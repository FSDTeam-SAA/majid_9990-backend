import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import masterCatalogueController from './masterCatalogue.controller';

const router = Router();

/**
 * Public search & lookup routes
 * (Fast internal lookups for scanning and auto-complete)
 */
router.get('/search', masterCatalogueController.searchCatalogue);
router.get('/stats', masterCatalogueController.getStats);
router.get('/barcode/:code', masterCatalogueController.findByBarcode);
router.get('/:id', masterCatalogueController.getById);

/**
 * Protected routes: saving variants or bulk operations
 */
router.post('/', protect, masterCatalogueController.saveVariant);
router.post('/bulk', protect, masterCatalogueController.bulkUpsert);

export default router;
