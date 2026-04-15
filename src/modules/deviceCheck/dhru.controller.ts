import { Request, Response, NextFunction } from 'express';
import { dhruService } from './dhru.service';

const DEFAULT_SERVICE_ID = Number(process.env.DHRU_SERVICE_ID ?? 6);

const isValidImei = (imei: string) => /^\d{15}$/.test(imei);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isImeiSerialValidationError = (message: string) => /imei\s*or\s*serial\s*is\s*not\s*valid/i.test(message);

const extractServiceIds = (servicesResponse: unknown): number[] => {
      const payload = servicesResponse as Record<string, any>;
      const candidates = payload?.SUCCESS ?? payload?.success ?? payload?.DATA ?? payload?.data ?? payload;

      if (!Array.isArray(candidates)) {
            return [];
      }

      return candidates
            .map((service) => Number(service?.id ?? service?.serviceid ?? service?.SERVICEID ?? service?.SERVICE_ID))
            .filter((serviceId) => Number.isFinite(serviceId) && serviceId > 0);
};

const getProviderErrorMessage = (response: any) =>
      response?.ERROR?.[0]?.FULL_DESCRIPTION || response?.ERROR?.[0]?.MESSAGE || 'Provider rejected the IMEI';

const getServiceIdFromRequest = (req: Request) => Number(req.body?.serviceId ?? DEFAULT_SERVICE_ID);

const getCandidateServiceIds = async (requestedServiceId: number) => {
      const serviceIds = extractServiceIds(await dhruService.getImeiServices());
      return Array.from(new Set([requestedServiceId, ...serviceIds]));
};

const placeImeiOrderWithFallback = async (imei: string, requestedServiceId: number) => {
      const candidateServiceIds = await getCandidateServiceIds(requestedServiceId);

      let latestResponse: any = null;
      let usedServiceId = requestedServiceId;

      for (const serviceId of candidateServiceIds) {
            const response = await dhruService.placeImeiOrder(serviceId, imei);
            latestResponse = response;
            usedServiceId = serviceId;

            if (!response?.ERROR) {
                  return { response, usedServiceId };
            }

            if (!isImeiSerialValidationError(getProviderErrorMessage(response))) {
                  break;
            }
      }

      return { response: latestResponse, usedServiceId };
};

const pollImeiOrderResult = async (orderId: string | number) => {
      let finalResult: any = null;

      for (let i = 0; i < 5; i++) {
            await sleep(2000);

            const result = await dhruService.getImeiOrder(orderId);

            if (result?.ERROR) {
                  return { error: result };
            }

            finalResult = result;

            const text = JSON.stringify(result).toLowerCase();
            if (text.includes('completed') || text.includes('success') || text.includes('done')) {
                  break;
            }
      }

      return { result: finalResult };
};

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const { imei } = req.body;
            const requestedServiceId = getServiceIdFromRequest(req);

            if (!imei || !isValidImei(String(imei))) {
                  return res.status(400).json({
                        success: false,
                        message: 'Valid 15-digit imei is required',
                  });
            }

            if (!Number.isFinite(requestedServiceId) || requestedServiceId <= 0) {
                  return res.status(400).json({
                        success: false,
                        message: 'Valid serviceId is required',
                  });
            }

            const { response: placeOrderResponse, usedServiceId } = await placeImeiOrderWithFallback(
                  String(imei),
                  requestedServiceId
            );

            // 1) Handle provider error first
            if (placeOrderResponse?.ERROR) {
                  const providerErrorMsg = getProviderErrorMessage(placeOrderResponse);

                  return res.status(400).json({
                        success: false,
                        message: isImeiSerialValidationError(providerErrorMsg)
                              ? `Provider rejected the IMEI for serviceId ${usedServiceId}. The selected service does not support this IMEI. Check /api/v1/imei/services and try another service id.`
                              : providerErrorMsg,
                        data: placeOrderResponse,
                  });
            }

            // 2) Then extract order id only if SUCCESS exists
            const orderId =
                  placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ORDERID;

            if (!orderId) {
                  return res.status(500).json({
                        success: false,
                        message: 'Order was accepted but order id not found in provider response',
                        data: placeOrderResponse,
                  });
            }

            const polledResult = await pollImeiOrderResult(orderId);

            if ('error' in polledResult) {
                  return res.status(400).json({
                        success: false,
                        message:
                              polledResult.error.ERROR?.[0]?.FULL_DESCRIPTION ||
                              polledResult.error.ERROR?.[0]?.MESSAGE ||
                              'Provider returned an error while fetching the result',
                        data: polledResult.error,
                  });
            }

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: polledResult.result,
            });
      } catch (error) {
            next(error);
      }
};

export const getServices = async (_req: Request, res: Response) => {
      const result = await dhruService.getImeiServices();
      return res.json({
            success: true,
            data: result,
      });
};

/*
import { Request, Response, NextFunction } from 'express';
import { dhruService } from './dhru.service';

const DEFAULT_SERVICE_ID = 6;

const isValidImei = (imei: string) => /^\d{15}$/.test(imei);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const { imei } = req.body;

            // Validate IMEI
      return res.json({
                  return res.status(400).json({
                        success: false,
                        message: 'IMEI must be a valid 15-digit number',
                        data: {
                              ERROR: [
                                    {
                                          MESSAGE: "ValidationError",
                                          FULL_DESCRIPTION: "IMEI or Serial is not valid"
                                    }
                              ],
                              apiversion: "8.1"
                        }
                  });
            }

            const placeOrderResponse = await dhruService.placeImeiOrder(DEFAULT_SERVICE_ID, String(imei));

            // Handle provider error first
            if (placeOrderResponse?.ERROR) {
                  return res.status(400).json({
                        success: false,
                        message:
                              placeOrderResponse.ERROR?.[0]?.FULL_DESCRIPTION ||
                              placeOrderResponse.ERROR?.[0]?.MESSAGE ||
                              'Provider rejected the IMEI',
                        data: placeOrderResponse,
                  });
            }

            // Extract order id only if SUCCESS exists
            const orderId =
                  placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ORDERID;

            if (!orderId) {
                  return res.status(500).json({
                        success: false,
                        message: 'Order was accepted but order id not found in provider response',
                        data: placeOrderResponse,
                  });
            }

            let finalResult: any = null;

            for (let i = 0; i < 5; i++) {
                  await sleep(2000);

                  const result = await dhruService.getImeiOrder(orderId);

                  if (result?.ERROR) {
                        return res.status(400).json({
                              success: false,
                              message:
                                    result.ERROR?.[0]?.FULL_DESCRIPTION ||
                                    result.ERROR?.[0]?.MESSAGE ||
                                    'Provider returned an error while fetching the result',
                              data: result,
                        });
                  }

                  finalResult = result;

                  const text = JSON.stringify(result).toLowerCase();
                  if (text.includes('completed') || text.includes('success') || text.includes('done')) {
                        break;
                  }
            }

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: finalResult,
            });
      } catch (error) {
            next(error);
import { Request, Response, NextFunction } from 'express';
import { dhruService } from './dhru.service';

const isValidImei = (imei: string) => /^\d{15}$/.test(imei);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_SERVICE_ID = 6;

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const { imei } = req.body;

            // Validate IMEI
            if (!imei || !isValidImei(String(imei))) {
                  return res.status(400).json({
                        success: false,
                        message: 'IMEI must be a valid 15-digit number',
                        data: {
                              ERROR: [
                                    {
                                          MESSAGE: "ValidationError",
                                          FULL_DESCRIPTION: "IMEI or Serial is not valid"
                                    }
                              ],
                              apiversion: "8.1"
                        }
                  });
            }

            const placeOrderResponse = await dhruService.placeImeiOrder(DEFAULT_SERVICE_ID, String(imei));

            // Handle provider error first
            if (placeOrderResponse?.ERROR) {
                  return res.status(400).json({
                        success: false,
                        message:
                              placeOrderResponse.ERROR?.[0]?.FULL_DESCRIPTION ||
                              placeOrderResponse.ERROR?.[0]?.MESSAGE ||
                              'Provider rejected the IMEI',
                        data: placeOrderResponse,
                  });
            }

            // Extract order id only if SUCCESS exists
            const orderId =
                  placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ORDERID;

            if (!orderId) {
                  return res.status(500).json({
                        success: false,
                        message: 'Order was accepted but order id not found in provider response',
                        data: placeOrderResponse,
                  });
      }

            let finalResult: any = null;

            for (let i = 0; i < 5; i++) {
                  await sleep(2000);

                  const result = await dhruService.getImeiOrder(orderId);

                  if (result?.ERROR) {
                        return res.status(400).json({
                              success: false,
                              message:
                                    result.ERROR?.[0]?.FULL_DESCRIPTION ||
                                    result.ERROR?.[0]?.MESSAGE ||
                                    'Provider returned an error while fetching the result',
                              data: result,
                        });
                  }

                  finalResult = result;

                  const text = JSON.stringify(result).toLowerCase();
                  if (text.includes('completed') || text.includes('success') || text.includes('done')) {
                        break;
                  }
            }

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: finalResult,
            });
      } catch (error) {
            next(error);
import { Request, Response, NextFunction } from 'express';
import { dhruService } from './dhru.service';

const DEFAULT_SERVICE_ID = 6;

const isValidImei = (imei: string) => /^\d{15}$/.test(imei);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checkImeiFromDhru = async (req: Request, res: Response, next: NextFunction) => {
      try {
            const { imei } = req.body;

            // Validate IMEI
            if (!imei || !isValidImei(String(imei))) {
                  return res.status(400).json({
                        success: false,
                        message: 'IMEI must be a valid 15-digit number',
                        data: {
                              ERROR: [
                                    {
                                          MESSAGE: "ValidationError",
                                          FULL_DESCRIPTION: "IMEI or Serial is not valid"
                                    }
                              ],
                              apiversion: "8.1"
                        }
                  });
            }

            const placeOrderResponse = await dhruService.placeImeiOrder(DEFAULT_SERVICE_ID, String(imei));

            // Handle provider error first
            if (placeOrderResponse?.ERROR) {
                  return res.status(400).json({
                        success: false,
                        message:
                              placeOrderResponse.ERROR?.[0]?.FULL_DESCRIPTION ||
                              placeOrderResponse.ERROR?.[0]?.MESSAGE ||
                              'Provider rejected the IMEI',
                        data: placeOrderResponse,
                  });
            }

            // Extract order id only if SUCCESS exists
            const orderId =
                  placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ID ||
                  placeOrderResponse?.SUCCESS?.[0]?.ORDERID;

            if (!orderId) {
                  return res.status(500).json({
                        success: false,
                        message: 'Order was accepted but order id not found in provider response',
                        data: placeOrderResponse,
                  });
      }

            let finalResult: any = null;

            for (let i = 0; i < 5; i++) {
                  await sleep(2000);

                  const result = await dhruService.getImeiOrder(orderId);

                  if (result?.ERROR) {
                        return res.status(400).json({
                              success: false,
                              message:
                                    result.ERROR?.[0]?.FULL_DESCRIPTION ||
                                    result.ERROR?.[0]?.MESSAGE ||
                                    'Provider returned an error while fetching the result',
                              data: result,
                        });
                  }

                  finalResult = result;

                  const text = JSON.stringify(result).toLowerCase();
                  if (text.includes('completed') || text.includes('success') || text.includes('done')) {
                        break;
                  }
            }

            return res.status(200).json({
                  success: true,
                  message: 'IMEI check completed',
                  data: finalResult,
            });
      } catch (error) {
            next(error);
      }
};

export const getServices = async (req: Request, res: Response) => {
      const result = await dhruService.getImeiServices();
      return res.json({
            success: true,
            data: result,
      });
};
export const getServices = async (req, res) => {
      const result = await dhruService.getImeiServices();

      res.json({
            success: true,
            data: result,
      });
};

      res.json({
            success: true,
            data: result,
      });
};
*/
