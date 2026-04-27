import { Router } from 'express';

import { protect } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/multer.middleware';
import userController from './user.controller';
// import { upload } from "../../middleware/multer.middleware";

const router = Router();

router.post('/register', userController.registerUser);

router.post('/verify-email', protect, userController.verifyEmail);

router.post('/resend-otp', protect, userController.resendOtpCode);

router.get('/all-users', userController.getAllUsers);
router.get('/my-profile', protect, userController.getMyProfile);
router.get("/shopkeeper", userController.getAllShopkeepers);

router.put('/update-profile', upload.single('image'), protect, userController.updateUserProfile);

router.get('/admin_id', protect, userController.getAdminId);
router.delete('/delete-user/:userId', protect, userController.deleteUser);

const userRouter = router;
export default userRouter;
