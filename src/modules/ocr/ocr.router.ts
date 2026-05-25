import { Router } from 'express';
import ocrController from './ocr.controller';
import { upload } from '../../middlewares/multer.middleware';

const router = Router();

/**
 * Public routes (no auth required)
 */

// Extract IMEI from image
router.post('/extract-imei', upload.single('image'), ocrController.extractIMEI);

// Extract NID from front/back images (back optional)
router.post(
      '/extract-nid',
      upload.fields([
            { name: 'nid_front', maxCount: 1 },
            { name: 'nid_back', maxCount: 1 },
      ]),
      ocrController.extractNID
);

export default router;
