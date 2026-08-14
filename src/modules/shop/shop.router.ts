import { Router } from 'express';
import { isShopkeeperOrStaff, protect } from '../../middlewares/auth.middleware';
import shopController from './shop.controller';

const router = Router();

router.get('/my-shops', protect, isShopkeeperOrStaff, shopController.getMyShops);
router.get('/performance', protect, isShopkeeperOrStaff, shopController.getShopPerformance);
router.get('/entitlement', protect, isShopkeeperOrStaff, shopController.getEntitlement);
router.get('/images', protect, isShopkeeperOrStaff, shopController.getUploadedImages);
router.get('/:id', protect, isShopkeeperOrStaff, shopController.getShopById);
router.post('/create', protect, isShopkeeperOrStaff, shopController.createShop);
router.put('/:id', protect, isShopkeeperOrStaff, shopController.updateShop);
router.delete('/:id', protect, isShopkeeperOrStaff, shopController.deleteShop);

export default router;
