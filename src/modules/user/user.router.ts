import { Router } from 'express';

import { protect, isAdminOrShopkeeper, isAdmin, isShopkeeperOrStaff, isShopkeeper } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import userController from './user.controller';

const router = Router();

router.post('/register', userController.registerUser);

router.post('/verify-email', protect, userController.verifyEmail);

router.post('/resend-otp', protect, userController.resendOtpCode);

router.get('/all-users', userController.getAllUsers);
router.get('/contact-card/:shopkeeperId', userController.downloadShopkeeperContact);
router.get('/my-profile', protect, userController.getMyProfile);
router.get('/shopkeeper', userController.getAllShopkeepers);
router.get('/balance-history', protect, userController.getBalanceHistory);

router.put('/update-profile', upload.single('image'), protect, userController.updateUserProfile);

router.get('/admin_id', protect, userController.getAdminId);
router.delete('/delete-user/:userId', protect, userController.deleteUser);
router.put('/admin/update-user/:userId', protect, isAdmin, userController.adminUpdateUser);

// Staff routes
router.post('/create-staff', protect, isAdminOrShopkeeper, userController.createStaff);
router.get('/staff/:shopkeeperId', protect, userController.getAllStaffByShopkeeper);
router.get('/my-shopkeeper-data', protect, userController.getMyShopkeeperData);

// Staff session routes
router.get('/staff-session/members', protect, isShopkeeperOrStaff, userController.getStaffSessionMembers);
router.put('/staff-session/pin/:staffId', protect, isShopkeeper, userController.setStaffPin);
router.post('/staff-session/switch', protect, isShopkeeperOrStaff, userController.switchStaffSession);
router.post('/staff-session/owner', protect, userController.returnToOwnerSession);

const userRouter = router;
export default userRouter;

