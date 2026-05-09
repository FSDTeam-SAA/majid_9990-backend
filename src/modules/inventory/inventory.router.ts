import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import inventoryController from './inventory.controller';

const router = Router();

router.post('/create', protect, upload.single('image'), inventoryController.createInventory);
router.post('/create-from-barcode', protect, upload.single('image'), inventoryController.createInventoryFromBarcode);
router.post(
      '/create-from-barcode/bulk',
      protect,
      upload.single('file'),
      inventoryController.createInventoryFromBarcodeBulk
);

router.get('/', protect, inventoryController.getAllInventory);
router.get('/sold-items', protect, inventoryController.getSoldInventory);
router.get('/grouped', protect, inventoryController.getGroupedInventoryByGroupKey);
router.get('/status/:status', protect, inventoryController.getInventoryByStatus);
router.get('/my-inventory', protect, inventoryController.getMyInventory);
// ideally admin only
router.get('/user/:userId', protect, inventoryController.getInventoryByUserId);

router.get('/:id', protect, inventoryController.getSingleInventory);

router.put('/:id', protect, upload.single('image'), inventoryController.updateInventory);

router.delete('/:id', protect, inventoryController.deleteInventory);

export default router;
