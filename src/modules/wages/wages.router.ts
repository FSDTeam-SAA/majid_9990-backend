import { Router } from 'express';
import { protect, isAdminOrShopkeeper } from '../../middlewares/auth.middleware';
import wagesController from './wages.controller';

const router = Router();

// Monthly Wages Summary & KPIs
router.get('/summary', protect, isAdminOrShopkeeper, wagesController.getMonthlySummary);

// Exception Review & Decision submission
router.get('/exceptions/:id', protect, isAdminOrShopkeeper, wagesController.getExceptionById);
router.post('/exceptions/:id/decide', protect, isAdminOrShopkeeper, wagesController.resolveException);

// Stepper stage progression (Draft -> Resolve Exceptions -> Owner Approval -> Lock)
router.post('/stage', protect, isAdminOrShopkeeper, wagesController.updateStage);

// Payroll CSV export
router.get('/export', protect, isAdminOrShopkeeper, wagesController.exportCsv);

export default router;
