import { Router } from 'express';

import { protect, isAdminOrShopkeeper } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import userController from './user.controller';

const router = Router();

router.post('/register', userController.registerUser);

router.post('/verify-email', protect, userController.verifyEmail);

router.post('/resend-otp', protect, userController.resendOtpCode);

router.get('/all-users', userController.getAllUsers);
router.get('/my-profile', protect, userController.getMyProfile);
router.get('/shopkeeper', userController.getAllShopkeepers);
router.get('/balance-history', protect, userController.getBalanceHistory);

router.put('/update-profile', upload.single('image'), protect, userController.updateUserProfile);

router.get('/admin_id', protect, userController.getAdminId);
router.delete('/delete-user/:userId', protect, userController.deleteUser);

// Staff routes
router.post('/create-staff', protect, isAdminOrShopkeeper, userController.createStaff);
router.get('/staff/:shopkeeperId', protect, userController.getAllStaffByShopkeeper);
router.get('/my-shopkeeper-data', protect, userController.getMyShopkeeperData);

const userRouter = router;
export default userRouter;
