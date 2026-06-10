import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import categoryController from './category.controller';

const router = Router();

// Protected routes (require authentication)
router.get('/', protect, categoryController.getAllCategories);
router.get('/with-count', protect, categoryController.getCategoriesWithItemCount);
router.get('/:id', protect, categoryController.getCategoryById);

// Admin only routes
router.post(
      '/',
      protect,
      restrictTo('admin', 'super-admin'),
      upload.single('image'),
      categoryController.createCategory
);

router.put(
      '/:id',
      protect,
      restrictTo('admin', 'super-admin'),
      upload.single('image'),
      categoryController.updateCategory
);

router.delete('/:id', protect, restrictTo('admin', 'super-admin'), categoryController.deleteCategory);

router.post('/bulk-update-count', protect, restrictTo('admin', 'super-admin'), categoryController.bulkUpdateTotalItems);

export default router;
