import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import cashManagementController from './cashManagement.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Create or update cash management (shopkeeper can create/update their own)
router.post('/', cashManagementController.createOrUpdateCashManagement);

// Get cash management by shopkeeper (shopkeeper can view their own, admin can view any)
router.get('/shopkeeper/:shopkeeperId', cashManagementController.getCashManagementByShopkeeper);

// Get cash management stats by shopkeeper
router.get('/shopkeeper/:shopkeeperId/stats', cashManagementController.getCashManagementStats);

// Admin only routes
router.get('/', cashManagementController.getAllCashManagementRecords);

router.delete('/:shopkeeperId', cashManagementController.deleteCashManagement);

export default router;
