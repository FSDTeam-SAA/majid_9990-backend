import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import inventoryController from './inventory.controller';

const router = Router();

router.post('/create', protect, upload.single('image'), inventoryController.createInventory);

router.get('/', protect, inventoryController.getAllInventory);

router.get('/:id', protect, inventoryController.getSingleInventory);

router.put('/:id', protect, upload.single('image'), inventoryController.updateInventory);

router.delete('/:id', protect, inventoryController.deleteInventory);

router.get('/my-inventory', protect, inventoryController.getMyInventory);

//ideally admin only
router.get('/user/:userId', protect, inventoryController.getInventoryByUserId);

export default router;
