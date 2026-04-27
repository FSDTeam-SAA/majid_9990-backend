import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import { soldProductController } from './soldProduct.controller';

const router = Router();

router.post('/create', protect, upload.single('image'), soldProductController.createSoldProduct);

router.get('/my-products', protect, soldProductController.getMySoldProducts);

router.put('/update/:id', protect, upload.single('image'), soldProductController.updateSoldProduct);

router.delete('/delete/:id', protect, soldProductController.deleteSoldProduct);

export default router;
