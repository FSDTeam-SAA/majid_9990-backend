import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import authController from './auth.controller';

const router = Router();
router.post('/login', authController.login);

router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);

router.post('/resend-forgot-otp', protect, authController.resendForgotOtpCode);

router.post('/verify-otp', protect, authController.verifyOtp);

router.post('/reset-password', protect, authController.resetPassword);

router.post('/change-password', protect, authController.changePassword);

const authRouter = router;
export default authRouter;
