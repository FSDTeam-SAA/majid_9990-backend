import { Router } from 'express';
import locationController from './location.controller';

const router = Router();

// GET /location -> returns country code based on client IP
router.get('/', locationController.getCountryCode);

const locationRouter = router;
export default locationRouter;
