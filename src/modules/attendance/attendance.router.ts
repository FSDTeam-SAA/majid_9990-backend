import { Router } from 'express';
import {
  protect,
  isShopkeeperOrStaff,
  isAdminOrShopkeeper,
  optionalProtect,
} from '../../middlewares/auth.middleware';
import attendanceController from './attendance.controller';

const router = Router();

// Public NFC Tap & Verification Endpoints (used by imoscan-attendance-app)
router.get('/verify-token', attendanceController.verifyToken);
router.post('/verify-token', attendanceController.verifyToken);
router.get('/staff-check', attendanceController.staffCheck);
router.post('/staff-check', attendanceController.staffCheck);
router.post('/clock', attendanceController.clockTap);

// Staff Attendance History & Pay Breakdown (used by majid-website Staff Record)
router.get(
  '/staff/:staffId',
  optionalProtect,
  attendanceController.getStaffAttendance
);

// Shopkeeper Attendance Logs
router.get(
  '/shop/:shopId',
  protect,
  isShopkeeperOrStaff,
  attendanceController.getShopAttendanceLogs
);

// NFC Store Beacon Settings
router.get(
  '/settings/nfc/:shopId',
  protect,
  isAdminOrShopkeeper,
  attendanceController.getNfcSettings
);
router.patch(
  '/settings/nfc/:shopId',
  protect,
  isAdminOrShopkeeper,
  attendanceController.updateNfcSettings
);

export default router;
