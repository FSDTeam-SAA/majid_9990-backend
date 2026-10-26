import { Router } from 'express';
import {
  protect,
  isShopkeeperOrStaff,
  isAdminOrShopkeeper,
  optionalProtect,
} from '../../middlewares/auth.middleware';
import leaveController from './leave.controller';

const router = Router();

// Staff leave balance (can be accessed by staff on mobile attendance or shopkeeper in portal)
router.get('/balance/:staffId', optionalProtect, leaveController.getLeaveBalance);

// Leave requests list and submission
router.get('/', protect, isShopkeeperOrStaff, leaveController.getLeaveRequests);
router.post('/request', optionalProtect, leaveController.createLeaveRequest);

// Manager decision on leave request
router.patch('/:id/decide', protect, isAdminOrShopkeeper, leaveController.decideLeaveRequest);

export default router;
