import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import ocrService from './ocr.service';

/**
 * Extract IMEI numbers from uploaded image
 * POST /ocr/extract-imei
 */
const extractIMEI = catchAsync(async (req: Request, res: Response) => {
      if (!req.file) {
            sendResponse(res, {
                  statusCode: StatusCodes.BAD_REQUEST,
                  success: false,
                  message: 'No image file provided',
            });
            return;
      }

      const filePath = req.file.path;

      try {
            // Process image for IMEI extraction
            const result = await ocrService.processImageForIMEI(filePath);

            sendResponse(res, {
                  statusCode: StatusCodes.OK,
                  success: true,
                  message: 'IMEI extraction completed successfully',
                  data: result,
            });
      } catch (error) {
            console.error('IMEI extraction error:', error);
            sendResponse(res, {
                  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                  success: false,
                  message: 'Failed to extract IMEI from image',
            });
      } finally {
            // Cleanup uploaded file
            ocrService.cleanupFile(filePath);
      }
});

export default {
      extractIMEI,
};
