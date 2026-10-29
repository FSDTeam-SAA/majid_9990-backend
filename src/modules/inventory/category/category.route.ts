import { Router } from 'express';
import { upload } from '../../../middlewares/multer.middleware'; 
import categoryController from './category.controller';
import { protect } from '../../../middlewares/auth.middleware';

const router = Router();

// Protected routes (require authentication)
router.get('/', protect, categoryController.getAllCategories);
router.get('/with-count', protect, categoryController.getCategoriesWithItemCount);
router.get('/manage', protect, categoryController.getAllCategoriesIncludingHidden);
router.get('/:id', protect, categoryController.getCategoryById);

// Admin only routes
router.post(
      '/',
      protect,
      upload.single('image'),
      categoryController.createCategory
);

router.patch('/:id/visibility', protect, categoryController.toggleCategoryVisibility);
router.post('/:id/reset-image', protect, categoryController.resetCategoryImage);

router.put(
      '/:id',
      protect,
      upload.single('image'),
      categoryController.updateCategory
);

router.delete('/:id', protect, categoryController.deleteCategory);

router.post('/bulk-update-count', protect, categoryController.bulkUpdateTotalItems);

export default router;
