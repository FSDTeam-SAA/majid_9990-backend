import { Router } from 'express';
import barcodeController from './barcode.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * Public routes (no auth required)
 */

// Search by name/keyword
router.get('/search', barcodeController.searchByName);

// Fallback REST-based search
router.get('/fallback/:code', barcodeController.fallbackSearch);

// Search by barcode (EAN / UPC / GTIN / ISBN)
router.get('/:code', barcodeController.searchByBarcode);

/**
 * Protected routes (auth required - optional)
 */

// Get cache statistics (useful for monitoring)
router.get('/stats/cache', protect, barcodeController.getCacheStats);

// Clear cache (admin operation)
router.delete('/cache/clear', protect, barcodeController.clearCache);

export default router;
