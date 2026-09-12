import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware';
import securityController from './security.controller';

const router = Router();

// 2FA Settings & Methods
router.get('/2fa/settings', protect, securityController.getSettings);
router.patch('/2fa/toggle', protect, securityController.toggleTwoFactor);
router.patch('/2fa/method', protect, securityController.setMethod);
router.post('/2fa/authenticator/setup', protect, securityController.startAuthenticatorSetup);
router.post('/2fa/authenticator/confirm', protect, securityController.confirmAuthenticatorSetup);
router.delete('/2fa/authenticator', protect, securityController.removeAuthenticator);

// Challenges & destination confirmation
router.post('/2fa/send-challenge', protect, securityController.sendChallenge);
router.post('/2fa/verify-challenge', protect, securityController.verifyChallenge);
router.post('/2fa/confirm-destination', protect, securityController.confirmDestination);

// Connected devices
router.get('/devices', protect, securityController.listDevices);
router.post('/devices/register', protect, securityController.registerDevice);
router.delete('/devices/:deviceId', protect, securityController.removeDevice);

// Step-up verification for sensitive operations
router.post('/verify-code', protect, securityController.verifyCode);

const securityRouter = router;
export default securityRouter;
