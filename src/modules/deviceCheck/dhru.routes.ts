import { Router } from 'express';
import { checkImeiFromDhru, getServices } from './dhru.controller';
import { getRiskAnalysis } from './riskAnalysis.controller';

const router = Router();

router.post('/check', checkImeiFromDhru);
router.post('/risk-analysis', getRiskAnalysis);

// temporary api just to check
router.get('/services', getServices);

export default router;
