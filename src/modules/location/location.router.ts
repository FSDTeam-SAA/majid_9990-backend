import { Router } from 'express';
import locationController from './location.controller';

const router = Router();

// GET /location -> returns country code based on client IP
router.get('/', locationController.getCountryCode);

// GET /location/currency -> returns currency code and symbol based on client IP
router.get('/currency', locationController.getCurrencyInfo);

const locationRouter = router;
export default locationRouter;
