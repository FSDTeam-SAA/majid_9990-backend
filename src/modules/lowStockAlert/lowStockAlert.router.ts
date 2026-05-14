import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import lowStockAlertController from './lowStockAlert.controller';

const router = Router();

router.post('/create', protect, lowStockAlertController.createLowStockAlert);
router.put('/update/:id', protect, lowStockAlertController.updateLowStockAlert);
router.delete('/delete/:id', protect, lowStockAlertController.deleteLowStockAlert);
router.get('/my-alert', protect, lowStockAlertController.getLowStockAlert);
router.get('/:id', protect, lowStockAlertController.getLowStockAlertById);

export default router;
