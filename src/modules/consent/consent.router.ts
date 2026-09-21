import { Router } from 'express';
import { isShopkeeperOrStaff, optionalProtect, protect } from '../../middlewares/auth.middleware';
import { consentController } from './consent.controller';

const router = Router();

// 1. Shopkeeper/User creates/dispatches consent request (email link + code, or copy message)
router.post('/request', protect, consentController.requestConsent);

// 2. Shopkeeper/User lists their consent requests
router.get('/my-requests', protect, consentController.listMyConsents);

// 3. Shopkeeper or app polls/checks status of consent by ID or reference
router.get('/status/:id', protect, consentController.getConsentById);

// 4. Public endpoint: customer opens secure link in mobile browser
router.get('/public/:token', consentController.getPublicConsent);

// 5. Verify 6-digit code (either through public secure token, or consent id/reference)
router.post('/verify/:identifier', optionalProtect, consentController.verifyConsentCode);

// 6. Review & Agree to terms (confirms 18+, ownership, terms agreement)
router.post('/approve/:identifier', optionalProtect, consentController.approveConsent);

// 7. Decline consent
router.post('/decline/:identifier', optionalProtect, consentController.declineConsent);

// 8. Resend new code
router.post('/resend/:identifier', protect, consentController.resendCode);

const consentRouter = router;
export default consentRouter;
