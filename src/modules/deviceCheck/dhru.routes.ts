import { Router } from 'express';
import {
      checkImeiFromDhru,
      checkImeisFromFile,
      getRecentChecksHistory,
      getServices,
      syncServices,
} from './dhru.controller';
import { upload } from '../../middlewares/multer.middleware';
import { getDeviceAnalysis, getRiskAnalysis } from './riskAnalysis.controller';
import { protect } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/check', protect, checkImeiFromDhru);
router.post('/check-batch', protect, upload.single('file'), checkImeisFromFile);
router.post('/risk-analysis', protect, getRiskAnalysis);
router.post('/device-analysis', protect, getDeviceAnalysis);
router.get('/history', protect, getRecentChecksHistory);

router.post('/services/sync', syncServices);
router.get('/services', getServices);

export default router;
