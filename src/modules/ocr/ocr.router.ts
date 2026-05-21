import { Router } from 'express';
import ocrController from './ocr.controller';
import { upload } from '../../middlewares/multer.middleware';

const router = Router();

/**
 * Public routes (no auth required)
 */

// Extract IMEI from image
router.post('/extract-imei', upload.single('image'), ocrController.extractIMEI);

export default router;
