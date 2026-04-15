import { Router } from 'express';
import { checkImeiFromDhru, getServices } from './dhru.controller';

const router = Router();

router.post('/check', checkImeiFromDhru);

// temporary api just to check 
router.get('/services', getServices);

export default router;
