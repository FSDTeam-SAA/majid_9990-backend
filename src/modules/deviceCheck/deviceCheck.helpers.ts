import ScanInfo from './scanInfo.model';
import { buildStructuredScanInfo } from './scanInfo.transformer';
import { dhruService } from './dhru.service';
import axios from 'axios';

const DEFAULT_SERVICE_ID = Number(process.env.DHRU_SERVICE_ID ?? 6);
const ENABLE_SERVICE_FALLBACK = String(process.env.IMEI_ENABLE_SERVICE_FALLBACK ?? 'false').toLowerCase() === 'true';

/**
 * Decode common HTML entities
 */
const decodeHtmlEntities = (text: string): string => {
      const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
      };

      let decoded = text;
      for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
      }

      return decoded;
};

/**
 * Extract key-value pairs from HTML result string (format: "Key: Value<br>Key: Value...")
 * Converts keys to snake_case and decodes HTML entities
 */
export const extractProviderDataFromHtml = (htmlString: string | null | undefined): Record<string, unknown> => {
      if (!htmlString || typeof htmlString !== 'string') {
            return {};
      }

      // Extract first <img> tag attributes (src, alt, height, width) if present
      const imageInfo: Record<string, unknown> | null = (() => {
            const imgMatch = htmlString.match(/<img\s+[^>]*src=("|')([^"']+)("|')[^>]*>/i);
            if (!imgMatch) return null;

            const imgTag = imgMatch[0];
            const src = imgMatch[2];
            const altMatch = imgTag.match(/alt=("|')([^"']*)("|')/i);
            const heightMatch = imgTag.match(/height=("|')?(\d+)("|')?/i);
            const widthMatch = imgTag.match(/width=("|')?(\d+)("|')?/i);

            return {
                  src,
                  alt: altMatch ? decodeHtmlEntities(altMatch[2]) : undefined,
                  height: heightMatch ? Number(heightMatch[2]) : undefined,
                  width: widthMatch ? Number(widthMatch[2]) : undefined,
                  html: imgTag,
            };
      })();

      // Remove image tags so they don't pollute the key/value parsing
      const htmlWithoutImg = htmlString.replace(/<img[^>]*>/gi, '');

      const lines = htmlWithoutImg.split(/<br\s*\/?>/gi).filter((line) => line.trim().length > 0);
      const data: Record<string, unknown> = {};

      if (imageInfo) {
            data.image = imageInfo;
      }

      for (const line of lines) {
            // Remove HTML tags (like <img>)
            const cleanedLine = line.replace(/<[^>]*>/g, '').trim();

            if (cleanedLine.includes(':')) {
                  const colonIndex = cleanedLine.indexOf(':');
                  const key = cleanedLine.substring(0, colonIndex).trim();
                  const value = cleanedLine.substring(colonIndex + 1).trim();

                  // Decode HTML entities
                  const decodedValue = decodeHtmlEntities(value);

                  // Convert key to snake_case (e.g., "IMEI Number" → "imei_number")
                  const snakeCaseKey = key
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, '');

                  if (snakeCaseKey.length > 0) {
                        data[snakeCaseKey] = decodedValue;
                  }
            }
      }

      return data;
};

const parseJsonObject = (value: string) => {
      const start = value.indexOf('{');
      const end = value.lastIndexOf('}');

      if (start === -1 || end === -1 || end <= start) {
            return null;
      }

      try {
            return JSON.parse(value.slice(start, end + 1));
      } catch {
            return null;
      }
};

export const analyzeParsedProviderDataWithAi = async (
      imei: string,
      parsedProviderData: Record<string, unknown>,
      providerName?: string
) => {
      const sourceText = JSON.stringify(parsedProviderData ?? {});
      const fallbackRiskMeter = (() => {
            const text = sourceText.toLowerCase();

            if (!text || text === '{}') {
                  return 50;
            }

            if (/(blacklist|stolen|lost mode|icloud lock|mdm lock|mdm_lock|simlock|locked)/i.test(text)) {
                  return 82;
            }

            if (/(clean|unlocked|no|off|passed|activated)/i.test(text)) {
                  return 24;
            }

            return 50;
      })();

      const fallbackInsight = {
            title: 'AI INSIGHT',
            message: providerName
                  ? `Parsed data from ${providerName} was analyzed. Review the details before purchase.`
                  : 'Parsed provider data was analyzed. Review the details before purchase.',
      };

      const apiKey = String(process.env.OPENAI_API_KEY ?? '').trim();
      if (!apiKey) {
            return {
                  riskMeter: fallbackRiskMeter,
                  aiInsight: fallbackInsight,
            };
      }

      const model = String(process.env.OPENAI_MODEL ?? 'gpt-4.1-mini').trim();

      try {
            const completion = await axios.post(
                  'https://api.openai.com/v1/chat/completions',
                  {
                        model,
                        temperature: 0.2,
                        messages: [
                              {
                                    role: 'system',
                                    content: 'You are an IMEI risk analyst. Return strict JSON only with keys: riskMeter, title, message. riskMeter must be a number from 1 to 100.',
                              },
                              {
                                    role: 'user',
                                    content: JSON.stringify({
                                          imei,
                                          providerName: providerName ?? 'unknown',
                                          parsedProviderData,
                                    }),
                              },
                        ],
                  },
                  {
                        headers: {
                              Authorization: `Bearer ${apiKey}`,
                              'Content-Type': 'application/json',
                        },
                        timeout: 15000,
                  }
            );

            const content = completion.data?.choices?.[0]?.message?.content;
            if (typeof content !== 'string') {
                  return {
                        riskMeter: fallbackRiskMeter,
                        aiInsight: fallbackInsight,
                  };
            }

            const parsed = parseJsonObject(content);
            if (!parsed) {
                  return {
                        riskMeter: fallbackRiskMeter,
                        aiInsight: fallbackInsight,
                  };
            }

            const parsedRiskMeter = Number((parsed as Record<string, unknown>).riskMeter);
            const riskMeter = Number.isFinite(parsedRiskMeter)
                  ? Math.min(100, Math.max(1, Math.round(parsedRiskMeter)))
                  : fallbackRiskMeter;

            return {
                  riskMeter,
                  aiInsight: {
                        title:
                              typeof (parsed as Record<string, unknown>).title === 'string'
                                    ? String((parsed as Record<string, unknown>).title)
                                    : 'AI INSIGHT',
                        message:
                              typeof (parsed as Record<string, unknown>).message === 'string'
                                    ? String((parsed as Record<string, unknown>).message)
                                    : fallbackInsight.message,
                  },
            };
      } catch {
            return {
                  riskMeter: fallbackRiskMeter,
                  aiInsight: fallbackInsight,
            };
      }
};

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

      const servicesResponse = await dhruService.getImeiServices();
      console.log('Dhru services response:', servicesResponse);
      const serviceIds = extractServiceIds(servicesResponse);
      return Array.from(new Set([requestedServiceId, ...serviceIds]));
};

const placeImeiOrderWithFallback = async (imei: string, requestedServiceId: number) => {
      const candidateServiceIds = await getServiceIdCandidates(requestedServiceId);

      let latestResponse: any = null;
      let usedServiceId = requestedServiceId;

      for (const serviceId of candidateServiceIds) {
            const response = await dhruService.placeImeiOrder(serviceId, imei);
            console.log(`Dhru place order response (serviceId=${serviceId}, imei=${imei}):`, response);
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
            console.log(`Dhru poll result (orderId=${orderId}, attempt=${i + 1}):`, result);

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

export const getExistingScanInfoByImei = async (imei: string, serviceId: number) => {
      return ScanInfo.findOne({ imei, serviceId }).sort({ updatedAt: -1 }).lean();
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
                  // Some providers return the final result HTML inside the initial response
                  // without an order id. Treat that response as the final provider payload
                  // when it contains a `result`, `RESULT` or `data` field.
                  const possiblePayload =
                        placeOrderResponse?.result ?? placeOrderResponse?.RESULT ?? placeOrderResponse?.data ?? null;

                  if (possiblePayload) {
                        providerPayload = placeOrderResponse;
                  } else {
                        return {
                              ok: false,
                              statusCode: 500,
                              message: 'Order was accepted but order id not found in provider response',
                              data: placeOrderResponse,
                        };
                  }
            } else {
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
      }

      const structuredInfo = await buildStructuredScanInfo(imei, providerPayload ?? {});

      const baseScanPayload = {
            ...structuredInfo,
            serviceId: requestedServiceId,
            providerData: providerPayload ?? null,
      };
      const scanPayload = userId ? { ...baseScanPayload, userId } : baseScanPayload;

      await ScanInfo.findOneAndUpdate({ imei, serviceId: requestedServiceId }, scanPayload, {
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
