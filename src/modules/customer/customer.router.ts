import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import customerController from './customer.controller';

const router = Router();

router.post('/create', protect, customerController.createCustomer);
router.put('/update/:id', protect, customerController.updateCustomer);
router.delete('/delete/:id', protect, customerController.deleteCustomer);
router.get('/shopkeeper/:shopkeeperId', protect, customerController.getByShopkeeperId);
router.get('/all', protect, customerController.getAll);

export default router;
