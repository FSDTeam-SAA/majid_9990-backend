import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { repairPartController } from './repairPart.controller';

const router = Router();

router.get('/catalogue', repairPartController.searchCatalogue);
router.get('/', protect, repairPartController.getParts);
router.post('/delivery', protect, repairPartController.addDelivery);
router.post('/adjust', protect, repairPartController.adjustStock);
router.get('/compatible', protect, repairPartController.getCompatibleParts);
router.post('/reserve', protect, repairPartController.reservePart);
router.post('/confirm-use', protect, repairPartController.confirmUsePart);
router.post('/release', protect, repairPartController.releasePart);
router.post('/return', protect, repairPartController.returnPart);
router.get('/movements', protect, repairPartController.getMovements);
router.get(
  '/supplier-comparison/:variantId',
  protect,
  repairPartController.getSupplierComparison
);

export default router;
