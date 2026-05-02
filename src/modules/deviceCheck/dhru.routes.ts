import { Router } from 'express';
import { checkImeiFromDhru, checkImeisFromFile, getServices } from './dhru.controller';
import { upload } from '../../middlewares/multer.middleware';
import { getDeviceAnalysis, getRiskAnalysis } from './riskAnalysis.controller';

const router = Router();

router.post('/check', checkImeiFromDhru);
router.post('/check-batch', upload.single('file'), checkImeisFromFile);
router.post('/risk-analysis', getRiskAnalysis);
router.post('/device-analysis', getDeviceAnalysis);

// temporary api just to check
router.get('/services', getServices);

export default router;
