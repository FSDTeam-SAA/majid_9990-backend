import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { riskAnalysisService } from './riskAnalysis.service';
import { isValidImei } from './riskAnalysis.utils';

export const getRiskAnalysis = catchAsync(async (req, res) => {
      const imei = String(req.body?.imei ?? '').trim();

      if (!isValidImei(imei)) {
            throw new AppError('Valid 15-digit IMEI is required', 400);
      }

      const result = await riskAnalysisService.analyzeRisk(imei);

      sendResponse(res, {
            statusCode: 200,
            success: true,
            message: 'Risk analysis generated',
            data: {
                  imei,
                  score: result.score,
                  level: result.level,
                  issues: result.issues,
                  signals: result.signals,
                  raw: result.raw,
            },
      });
});
