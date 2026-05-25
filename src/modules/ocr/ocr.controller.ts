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

/**
 * Extract NID number from uploaded images
 * POST /ocr/extract-nid
 */
const extractNID = catchAsync(async (req: Request, res: Response) => {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const frontFile = files?.nid_front?.[0];
      const backFile = files?.nid_back?.[0];

      if (!frontFile && !backFile) {
            sendResponse(res, {
                  statusCode: StatusCodes.BAD_REQUEST,
                  success: false,
                  message: 'No NID image provided. Upload nid_front or nid_back',
            });
            return;
      }

      const frontPath = frontFile?.path;
      const backPath = backFile?.path;

      try {
            const result = await ocrService.processImagesForNID(frontPath, backPath);

            sendResponse(res, {
                  statusCode: StatusCodes.OK,
                  success: true,
                  message: result.isValid ? 'NID extracted successfully' : 'No valid NID found',
                  data: result,
            });
      } catch (error) {
            console.error('NID extraction error:', error);
            sendResponse(res, {
                  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                  success: false,
                  message: 'Failed to extract NID from images',
            });
      } finally {
            if (frontPath) {
                  ocrService.cleanupFile(frontPath);
            }
            if (backPath && backPath !== frontPath) {
                  ocrService.cleanupFile(backPath);
            }
      }
});

export default {
      extractIMEI,
      extractNID,
};
