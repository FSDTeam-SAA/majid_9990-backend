import ScanInfo from './scanInfo.model';
import { buildStructuredScanInfo } from './scanInfo.transformer';
import { dhruService } from './dhru.service';

const DEFAULT_SERVICE_ID = Number(process.env.DHRU_SERVICE_ID ?? 6);
const ENABLE_SERVICE_FALLBACK = String(process.env.IMEI_ENABLE_SERVICE_FALLBACK ?? 'false').toLowerCase() === 'true';

export const isValidImei = (imei: string): boolean => /^\d{15}$/.test(imei);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isImeiSerialValidationError = (message: string) => /imei\s*or\s*serial\s*is\s*not\s*valid/i.test(message);

const normalizeServiceCandidates = (input: unknown): unknown[] => {
      if (Array.isArray(input)) {
            return input;
      }

      if (input && typeof input === 'object') {
            return Object.entries(input as Record<string, unknown>).map(([id, value]) =>
                  typeof value === 'object' && value !== null
                        ? { id, ...(value as Record<string, unknown>) }
                        : { id, value }
            );
      }

      return [];
};

const extractServiceIds = (servicesResponse: unknown): number[] => {
      const payload = servicesResponse as Record<string, any>;
      const candidates =
            payload?.SUCCESS ??
            payload?.success ??
            payload?.DATA ??
            payload?.data ??
            payload?.SERVICES ??
            payload?.services ??
            payload;

      return normalizeServiceCandidates(candidates)
            .map((service: any) =>
                  Number(
                        service?.id ??
                              service?.serviceid ??
                              service?.serviceId ??
                              service?.SERVICEID ??
                              service?.SERVICE_ID ??
                              service?.ID
                  )
            )
            .filter((serviceId) => Number.isFinite(serviceId) && serviceId > 0);
};

const getProviderErrorMessage = (response: any) =>
      response?.ERROR?.[0]?.FULL_DESCRIPTION ||
      response?.ERROR?.[0]?.MESSAGE ||
      response?.message ||
      'Provider rejected the IMEI';

const extractOrderId = (placeOrderResponse: any) =>
      placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
      placeOrderResponse?.SUCCESS?.[0]?.ID ||
      placeOrderResponse?.SUCCESS?.[0]?.ORDERID ||
      placeOrderResponse?.SUCCESS?.[0]?.orderId ||
      placeOrderResponse?.ORDERID ||
      placeOrderResponse?.orderId;

const isDirectFinalResult = (response: any) => {
      const text = JSON.stringify(response ?? {}).toLowerCase();
      return !text.includes('processing') && !text.includes('queued') && !text.includes('in progress');
};

const getServiceIdCandidates = async (requestedServiceId: number) => {
      if (!ENABLE_SERVICE_FALLBACK) {
            return [requestedServiceId];
      }

      const serviceIds = extractServiceIds(await dhruService.getImeiServices());
      return Array.from(new Set([requestedServiceId, ...serviceIds]));
};

const placeImeiOrderWithFallback = async (imei: string, requestedServiceId: number) => {
      const candidateServiceIds = await getServiceIdCandidates(requestedServiceId);

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

export const resolveServiceId = (serviceId: unknown) => Number(serviceId ?? DEFAULT_SERVICE_ID);

export const validateServiceId = (serviceId: number) => Number.isFinite(serviceId) && serviceId > 0;

export const getExistingScanInfoByImei = async (imei: string) => {
      return ScanInfo.findOne({ imei }).lean();
};

export type ImeiCheckFailure = {
      ok: false;
      statusCode: number;
      message: string;
      data?: unknown;
};

export type ImeiCheckSuccess = {
      ok: true;
      imei: string;
      serviceId: number;
      provider: string;
      structured: Awaited<ReturnType<typeof buildStructuredScanInfo>>;
      providerData: unknown;
};

export type ImeiCheckResult = ImeiCheckSuccess | ImeiCheckFailure;

export const runImeiCheck = async (
      imei: string,
      requestedServiceId: number,
      userId?: string
): Promise<ImeiCheckResult> => {
      const { response: placeOrderResponse, usedServiceId } = await placeImeiOrderWithFallback(
            imei,
            requestedServiceId
      );

      let providerPayload: any = null;

      if (placeOrderResponse?.ERROR) {
            const providerErrorMsg = getProviderErrorMessage(placeOrderResponse);

            return {
                  ok: false,
                  statusCode: 400,
                  message: isImeiSerialValidationError(providerErrorMsg)
                        ? `Provider rejected the IMEI for serviceId ${usedServiceId}. The selected service does not support this IMEI. Check /api/v1/imei/services and try another service id.`
                        : providerErrorMsg,
                  data: placeOrderResponse,
            };
      }

      const orderId = extractOrderId(placeOrderResponse);

      if (!orderId && isDirectFinalResult(placeOrderResponse)) {
            providerPayload = placeOrderResponse;
      }

      if (!providerPayload) {
            if (!orderId) {
                  return {
                        ok: false,
                        statusCode: 500,
                        message: 'Order was accepted but order id not found in provider response',
                        data: placeOrderResponse,
                  };
            }

            const polledResult = await pollImeiOrderResult(orderId);

            if ('error' in polledResult) {
                  return {
                        ok: false,
                        statusCode: 400,
                        message:
                              polledResult.error.ERROR?.[0]?.FULL_DESCRIPTION ||
                              polledResult.error.ERROR?.[0]?.MESSAGE ||
                              'Provider returned an error while fetching the result',
                        data: polledResult.error,
                  };
            }

            providerPayload = polledResult.result;
      }

      const structuredInfo = await buildStructuredScanInfo(imei, providerPayload ?? {});

      const scanPayload = userId ? { ...structuredInfo, userId } : structuredInfo;

      await ScanInfo.findOneAndUpdate({ imei }, scanPayload, {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
      });

      return {
            ok: true,
            imei,
            serviceId: usedServiceId,
            provider: dhruService.getProvider(),
            structured: structuredInfo,
            providerData: providerPayload,
      };
};
