import { dhruService } from './dhru.service';
import {
      DeviceChecksResponse,
      RiskResult,
      RiskSignals,
      ServiceCallResult,
      TriState,
      CarrierState,
      SimLockState,
      ActivationState,
      BlacklistState,
} from './riskAnalysis.interface';

const IMPORTANT_SERVICES = {
      blacklist: '54',
      icloud: '3',
      simLock: '8',
      carrier: '103',
      fmi: '61',
      mdm: '81',
      brand: '203',
} as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toSearchableText = (value: unknown): string => JSON.stringify(value ?? {}).toLowerCase();

const getProviderErrorMessage = (response: any): string =>
      response?.ERROR?.[0]?.FULL_DESCRIPTION ||
      response?.ERROR?.[0]?.MESSAGE ||
      response?.message ||
      'Provider returned an error';

const extractOrderId = (placeOrderResponse: any) =>
      placeOrderResponse?.SUCCESS?.[0]?.REFERENCEID ||
      placeOrderResponse?.SUCCESS?.[0]?.ID ||
      placeOrderResponse?.SUCCESS?.[0]?.ORDERID ||
      placeOrderResponse?.SUCCESS?.[0]?.orderId ||
      placeOrderResponse?.ORDERID ||
      placeOrderResponse?.orderId;

const isDirectFinalResult = (response: unknown) => {
      const text = toSearchableText(response);
      return !text.includes('processing') && !text.includes('queued') && !text.includes('in progress');
};

const pollOrderResult = async (orderId: string | number): Promise<unknown> => {
      let finalResult: unknown = null;

      for (let i = 0; i < 5; i++) {
            await sleep(1500);
            const result = await dhruService.getImeiOrder(orderId);

            if ((result as Record<string, unknown>)?.ERROR) {
                  return result;
            }

            finalResult = result;

            const text = toSearchableText(result);
            if (text.includes('completed') || text.includes('success') || text.includes('done')) {
                  break;
            }
      }

      return finalResult;
};

const callService = async (imei: string, serviceId: string): Promise<ServiceCallResult> => {
      const placeOrderResponse = await dhruService.placeImeiOrder(serviceId, imei);

      if ((placeOrderResponse as Record<string, unknown>)?.ERROR) {
            return {
                  payload: placeOrderResponse,
                  errorMessage: getProviderErrorMessage(placeOrderResponse),
            };
      }

      const orderId = extractOrderId(placeOrderResponse);
      if (!orderId && isDirectFinalResult(placeOrderResponse)) {
            return { payload: placeOrderResponse };
      }

      if (!orderId) {
            return {
                  payload: placeOrderResponse,
                  errorMessage: 'Order accepted but no order id was returned',
            };
      }

      const result = await pollOrderResult(orderId);

      if ((result as any)?.ERROR) {
            return {
                  payload: result,
                  errorMessage: getProviderErrorMessage(result),
            };
      }

      return { payload: result };
};

const parseBlacklist = (text: string): BlacklistState => {
      if (/blacklisted|lost|stolen|barred|blocked/.test(text)) {
            return 'BLACKLISTED';
      }

      if (/clean|not blacklisted|no blacklist/.test(text)) {
            return 'CLEAN';
      }

      return 'UNKNOWN';
};

const parseIcloud = (text: string): TriState => {
      if (/icloud\s*(on|locked|enabled|yes)|find\s*my\s*(iphone|device)\s*(on|enabled)/.test(text)) {
            return 'ON';
      }

      if (/icloud\s*(off|disabled|no)|find\s*my\s*(iphone|device)\s*(off|disabled)|icloud\s*clean/.test(text)) {
            return 'OFF';
      }

      return 'UNKNOWN';
};

const parseMdm = (text: string): TriState => {
      if (/mdm\s*(on|locked|enabled|active|yes)|mobile\s*device\s*management\s*(on|active)/.test(text)) {
            return 'ON';
      }

      if (/mdm\s*(off|disabled|no)|mobile\s*device\s*management\s*(off|disabled)/.test(text)) {
            return 'OFF';
      }

      return 'UNKNOWN';
};

const parseSimLock = (text: string): SimLockState => {
      if (/sim\s*(locked|lock|restricted)|network\s*lock/.test(text)) {
            return 'LOCKED';
      }

      if (/sim\s*(unlocked|free)|factory\s*unlocked/.test(text)) {
            return 'UNLOCKED';
      }

      return 'UNKNOWN';
};

const parseCarrier = (text: string): CarrierState => {
      if (/carrier\s*(blocked|blacklisted)|esn\s*bad|barred/.test(text)) {
            return 'BLOCKED';
      }

      if (/carrier\s*(unlocked|clean)|sim\s*free|network\s*unlocked|factory\s*unlocked/.test(text)) {
            return 'UNLOCKED';
      }

      if (/carrier|network|t-mobile|verizon|at&t|sprint|vodafone|orange/.test(text)) {
            return 'RESTRICTED';
      }

      return 'UNKNOWN';
};

const parseTriStateByWords = (text: string, keyword: string): TriState => {
      const onPattern = new RegExp(String.raw`${keyword}\s*(on|enabled|yes|active|locked)`);
      const offPattern = new RegExp(String.raw`${keyword}\s*(off|disabled|no|inactive|unlocked)`);

      if (onPattern.test(text)) {
            return 'ON';
      }

      if (offPattern.test(text)) {
            return 'OFF';
      }

      return 'UNKNOWN';
};

const parseKnoxMiLock = (text: string): TriState => {
      const onPatterns = [
            /knox\s*guard\s*(on|enabled|active)/,
            /knox\s*lock\s*(on|enabled)/,
            /mi\s*account\s*lock\s*(on|enabled|active)/,
            /xiaomi\s*lock\s*(on|enabled)/,
      ];

      if (onPatterns.some((pattern) => pattern.test(text))) {
            return 'ON';
      }

      const offPatterns = [
            /knox\s*guard\s*(off|disabled)/,
            /knox\s*lock\s*(off|disabled)/,
            /mi\s*account\s*lock\s*(off|disabled)/,
            /xiaomi\s*lock\s*(off|disabled)/,
      ];

      if (offPatterns.some((pattern) => pattern.test(text))) {
            return 'OFF';
      }

      return 'UNKNOWN';
};

const parseActivation = (text: string): ActivationState => {
      if (/activation\s*(issue|error|failed|problem|lock)|unable\s*to\s*activate/.test(text)) {
            return 'ISSUE';
      }

      if (/activation\s*(ok|clean|passed|none|good)/.test(text)) {
            return 'OK';
      }

      return 'UNKNOWN';
};

const parseBrand = (text: string): string => {
      const knownBrands = ['apple', 'samsung', 'xiaomi', 'huawei', 'oppo', 'vivo', 'google', 'oneplus'];
      const match = knownBrands.find((brand) => text.includes(brand));
      return match ? match.toUpperCase() : 'UNKNOWN';
};

const buildSignals = (raw: Record<string, ServiceCallResult>): RiskSignals => {
      const blacklistText = toSearchableText(raw.blacklist?.payload);
      const icloudText = toSearchableText(raw.icloud?.payload);
      const simLockText = toSearchableText(raw.simLock?.payload);
      const carrierText = toSearchableText(raw.carrier?.payload);
      const fmiText = toSearchableText(raw.fmi?.payload);
      const mdmText = toSearchableText(raw.mdm?.payload);
      const brandText = toSearchableText(raw.brand?.payload);
      const unifiedText = `${blacklistText} ${icloudText} ${simLockText} ${carrierText} ${fmiText} ${mdmText} ${brandText}`;

      return {
            blacklist: parseBlacklist(`${blacklistText} ${fmiText}`),
            icloud: parseIcloud(`${icloudText} ${fmiText}`),
            mdm: parseMdm(mdmText),
            simLock: parseSimLock(simLockText),
            carrier: parseCarrier(carrierText),
            fmi: parseTriStateByWords(`${icloudText} ${fmiText}`, 'fmi'),
            knoxMiLock: parseKnoxMiLock(unifiedText),
            activation: parseActivation(unifiedText),
            brand: parseBrand(brandText),
      };
};

export const calculateRisk = (signals: RiskSignals): RiskResult => {
      let score = 0;
      const issues: string[] = [];

      if (signals.blacklist === 'BLACKLISTED') {
            score += 50;
            issues.push('Device is blacklisted, lost, or stolen');
      }

      if (signals.icloud === 'ON') {
            score += 40;
            issues.push('iCloud lock enabled');
      }

      if (signals.mdm === 'ON') {
            score += 30;
            issues.push('MDM lock detected');
      }

      if (signals.carrier === 'BLOCKED') {
            score += 25;
            issues.push('Carrier blocked');
      }

      if (signals.simLock === 'LOCKED') {
            score += 15;
            issues.push('SIM locked');
      }

      if (signals.carrier === 'RESTRICTED') {
            score += 10;
            issues.push('Carrier restricted');
      }

      if (signals.knoxMiLock === 'ON') {
            score += 15;
            issues.push('Knox/MI lock enabled');
      }

      if (signals.activation === 'ISSUE') {
            score += 15;
            issues.push('Activation issues detected');
      }

      let level: RiskResult['level'] = 'LOW';
      if (score >= 70) {
            level = 'HIGH';
      } else if (score >= 30) {
            level = 'MEDIUM';
      }

      return { score, level, issues };
};

export const getDeviceChecks = async (imei: string): Promise<DeviceChecksResponse> => {
      const rawResults: Record<string, ServiceCallResult> = {};

      for (const [serviceKey, serviceId] of Object.entries(IMPORTANT_SERVICES)) {
            rawResults[serviceKey] = await callService(imei, serviceId);
      }

      const signals = buildSignals(rawResults);

      return {
            signals,
            raw: rawResults,
      };
};

export const isValidImei = (imei: string): boolean => /^\d{15}$/.test(imei);
