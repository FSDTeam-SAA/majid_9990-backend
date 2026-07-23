import { Router } from 'express';
import paymentController from './payment.controller';
import { isAdmin, protect } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/create-payment', protect, paymentController.createPayment);

router.get('/my-payments', protect, paymentController.getMyPayments);

// admin only (add authorize middleware)
router.get('/all-payments', protect, isAdmin, paymentController.getAllPayments);
router.patch('/status/:id', protect, isAdmin, paymentController.updatePaymentStatus);
router.delete('/:id', protect, isAdmin, paymentController.deletePayment);

// webhook (NO protect + raw body)
router.post('/webhook', require('express').raw({ type: 'application/json' }), paymentController.stripeWebhook);

export default router;
