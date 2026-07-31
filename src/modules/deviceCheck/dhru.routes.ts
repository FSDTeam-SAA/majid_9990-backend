import { Router } from 'express';
import {
      checkImeiFromDhru,
      checkImeiFromDhruV2,
      checkImeisFromFile,
      getCheckHistoryReport,
      getCheckHistoryReportPdf,
      getRecentChecksHistory,
      getServices,
      saveCheckHistoryReportPdf,
      syncServices,
} from './dhru.controller';
import { reportPdfUpload, upload } from '../../middlewares/multer.middleware';
import { getDeviceAnalysis, getRiskAnalysis } from './riskAnalysis.controller';
import { optionalProtect, protect } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/check', protect, checkImeiFromDhru);
router.post('/check-v2', optionalProtect, checkImeiFromDhruV2);
router.post('/check-batch', protect, upload.single('file'), checkImeisFromFile);
router.post('/risk-analysis', protect, getRiskAnalysis);
router.post('/device-analysis', protect, getDeviceAnalysis);
router.get('/history', protect, getRecentChecksHistory);
router.post('/history/:reportId/pdf', protect, reportPdfUpload.single('pdf'), saveCheckHistoryReportPdf);
router.get('/history/:reportId/pdf', protect, getCheckHistoryReportPdf);
router.get('/history/:reportId', protect, getCheckHistoryReport);

router.post('/services/sync', syncServices);
router.get('/services', getServices);

export default router;
