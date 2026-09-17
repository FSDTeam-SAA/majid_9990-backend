import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import dashboardController from './dashboard.controller';

const router = Router();

router.get('/stats', protect, dashboardController.getDashboardStats);
router.get('/chart', protect, dashboardController.getDashboardChart);

export default router;
