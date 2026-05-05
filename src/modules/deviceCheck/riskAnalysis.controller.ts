import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { riskAnalysisService } from './riskAnalysis.service';
import { ImeiServiceCatalog } from './imeiService.model';
import {
      getExistingScanInfoByImei,
      isValidImei,
      resolveServiceId,
      runImeiCheck,
      validateServiceId,
} from './deviceCheck.helpers';
import { creditUserBalance, debitUserBalance } from '../payment/balanceTransaction.service';
import { resolveServicePrice } from './dhru.controller';

const findServiceByServiceId = async (serviceId: number) => {
      return await ImeiServiceCatalog.findOne({
            $or: [{ serviceId }, { serviceIds: serviceId }],
      }).lean();
};

export const getRiskAnalysis = catchAsync(async (req, res) => {
      const imei = String(req.body?.imei ?? '').trim();
      const shouldGenerateFresh =
            String(req.body?.genarate ?? req.body?.generate ?? '')
                  .trim()
                  .toLowerCase() === 'new';

      if (!isValidImei(imei)) {
            throw new AppError('Valid 15-digit IMEI is required', 400);
      }

      const serviceId = resolveServiceId(req.body?.serviceId);

      if (!validateServiceId(serviceId)) {
            throw new AppError('Valid serviceId is required', 400);
      }

      const service = await findServiceByServiceId(serviceId);

      if (!service) {
            throw new AppError('Service not found in the catalog', 404);
      }

      const servicePrice = resolveServicePrice(service);
      const shouldCharge = servicePrice > 0;

      if (shouldCharge) {
            await debitUserBalance({
                  userId: req.user._id,
                  amount: servicePrice,
                  currency: service.currency ?? 'USD',
                  source: 'imei_service',
                  description: `IMEI risk analysis charge for ${service.name}`,
                  serviceId,
                  serviceName: service.name,
                  imei,
                  metadata: {
                        normalizedName: service.normalizedName,
                  },
            });
      }

      const existingScanInfo = shouldGenerateFresh ? null : await getExistingScanInfoByImei(imei);

      if (existingScanInfo) {
            sendResponse(res, {
                  statusCode: 200,
                  success: true,
                  message: 'Risk analysis fetched from database',
                  data: {
                        ...existingScanInfo,
                        oldGenerated: true,
                  },
            });
            return;
      }

      try {
            const refreshResult = await runImeiCheck(imei, serviceId, req.user._id);

            if (!refreshResult.ok) {
                  throw new AppError(refreshResult.message, refreshResult.statusCode);
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
                        oldGenerated: false,
                  },
            });
      } catch (error) {
            if (shouldCharge) {
                  await creditUserBalance({
                        userId: req.user._id,
                        amount: servicePrice,
                        currency: service.currency ?? 'USD',
                        source: 'refund',
                        description: `Refund for failed IMEI risk analysis ${service.name}`,
                        serviceId,
                        serviceName: service.name,
                        imei,
                        metadata: {
                              normalizedName: service.normalizedName,
                        },
                  }).catch(() => undefined);
            }

            throw error;
      }
});

export const getDeviceAnalysis = catchAsync(async (req, res) => {
      const imei = String(req.body?.imei ?? '').trim();
      const shouldGenerateFresh =
            String(req.body?.genarate ?? req.body?.generate ?? '')
                  .trim()
                  .toLowerCase() === 'new';

      if (!isValidImei(imei)) {
            return res.status(400).json({
                  success: false,
                  message: 'Valid 15-digit IMEI is required',
            });
      }

      const serviceId = resolveServiceId(req.body?.serviceId);

      if (!validateServiceId(serviceId)) {
            return res.status(400).json({
                  success: false,
                  message: 'Valid serviceId is required',
            });
      }

      const service = await findServiceByServiceId(serviceId);

      if (!service) {
            return res.status(404).json({
                  success: false,
                  message: 'Service not found in the catalog',
            });
      }

      const servicePrice = resolveServicePrice(service);
      const shouldCharge = servicePrice > 0;

      if (shouldCharge) {
            await debitUserBalance({
                  userId: req.user._id,
                  amount: servicePrice,
                  currency: service.currency ?? 'USD',
                  source: 'imei_service',
                  description: `IMEI device analysis charge for ${service.name}`,
                  serviceId,
                  serviceName: service.name,
                  imei,
                  metadata: {
                        normalizedName: service.normalizedName,
                  },
            });
      }

      const existingScanInfo = shouldGenerateFresh ? null : await getExistingScanInfoByImei(imei);

      if (existingScanInfo) {
            sendResponse(res, {
                  statusCode: 200,
                  success: true,
                  message: 'Device analysis fetched from database',
                  data: {
                        ...existingScanInfo,
                        oldGenerated: true,
                  },
            });
            return;
      }

      try {
            const result = await riskAnalysisService.analyzeDeviceAnalysis(imei, serviceId, req.user._id);

            if (!('risk' in result)) {
                  if (shouldCharge) {
                        await creditUserBalance({
                              userId: req.user._id,
                              amount: servicePrice,
                              currency: service.currency ?? 'USD',
                              source: 'refund',
                              description: `Refund for failed IMEI device analysis ${service.name}`,
                              serviceId,
                              serviceName: service.name,
                              imei,
                              metadata: {
                                    normalizedName: service.normalizedName,
                                    reason: result.message,
                              },
                        }).catch(() => undefined);
                  }

                  return res.status(result.statusCode).json({
                        success: false,
                        message: result.message,
                        data: result.data,
                  });
            }

            sendResponse(res, {
                  statusCode: 200,
                  success: true,
                  message: shouldGenerateFresh ? 'Device analysis regenerated' : 'Device analysis generated',
                  data: {
                        ...result,
                        oldGenerated: false,
                  },
            });
      } catch (error) {
            if (shouldCharge) {
                  await creditUserBalance({
                        userId: req.user._id,
                        amount: servicePrice,
                        currency: service.currency ?? 'USD',
                        source: 'refund',
                        description: `Refund for failed IMEI device analysis ${service.name}`,
                        serviceId,
                        serviceName: service.name,
                        imei,
                        metadata: {
                              normalizedName: service.normalizedName,
                        },
                  }).catch(() => undefined);
            }

            throw error;
      }
});
