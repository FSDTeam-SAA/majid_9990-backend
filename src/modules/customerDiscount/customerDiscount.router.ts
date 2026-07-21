import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import customerDiscountController from './customerDiscount.controller';

const router = Router();

router.post('/create', protect, customerDiscountController.createCustomerDiscount);
router.get('/customer/:customerId', protect, customerDiscountController.getCustomerDiscountsByCustomerId);
router.put('/update/:id', protect, customerDiscountController.updateCustomerDiscount);
router.delete('/delete/:id', protect, customerDiscountController.deleteCustomerDiscount);
router.patch('/reset/:id', protect, customerDiscountController.resetCustomerDiscount);

export default router;
