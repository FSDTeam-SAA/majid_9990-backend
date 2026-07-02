import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import supplierController from './supplier.controller';

const router = Router();

router.post('/create', protect, supplierController.createSupplier);
router.get('/', protect, supplierController.getAllSuppliers);
router.get('/:id', protect, supplierController.getSupplierById);
router.patch('/:id', protect, supplierController.updateSupplier);
router.delete('/:id', protect, supplierController.deleteSupplier);

export default router;
