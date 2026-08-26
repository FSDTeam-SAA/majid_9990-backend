import { Router } from 'express';
import paymentController from './payment.controller';
import { isAdmin, protect } from '../../middlewares/auth.middleware';

const router = Router();

// Payment sessions (standard and split payments)
router.post('/create-payment', protect, paymentController.createPayment);

// Ryft Connected-Account / Sub-Account Onboarding & Status
router.post('/connect/onboard', protect, paymentController.createOnboardingLink);
router.get('/connect/status', protect, paymentController.getConnectStatus);
router.post('/connect/save-account', protect, paymentController.saveConnectAccount);

// User payments
router.get('/my-payments', protect, paymentController.getMyPayments);

// Admin only
router.get('/all-payments', protect, isAdmin, paymentController.getAllPayments);
router.patch('/status/:id', protect, isAdmin, paymentController.updatePaymentStatus);
router.delete('/:id', protect, isAdmin, paymentController.deletePayment);

// Webhook (NO protect + raw body for signature verification)
router.post('/webhook', require('express').raw({ type: '*/*' }), paymentController.ryftWebhook);

export default router;
