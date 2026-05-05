import { DeviceAnalysisResponse, DeviceChecksResponse, RiskResult, ImeiCheckSection } from './riskAnalysis.interface';
import { calculateRisk, getDeviceChecks } from './riskAnalysis.utils';
import { ImeiCheckFailure, runImeiCheck } from './deviceCheck.helpers';

// Response includes:

// imei
// score
// level (LOW/MEDIUM/HIGH)
// issues (risk findings)
// signals (normalized statuses: blacklist, icloud, mdm, simLock, carrier, fmi, knoxMiLock, activation, brand)
// raw (service-by-service provider payload/errors)

const analyzeRisk = async (imei: string): Promise<DeviceChecksResponse & RiskResult> => {
      const checks = await getDeviceChecks(imei);
      const risk = calculateRisk(checks.signals);

      return {
            ...checks,
            ...risk,
      };
};

const analyzeDeviceAnalysis = async (
      imei: string,
      serviceId: number,
      userId?: string
): Promise<DeviceAnalysisResponse | ImeiCheckFailure> => {
      const [checkResult, risk] = await Promise.all([runImeiCheck(imei, serviceId, userId), analyzeRisk(imei)]);

      if (!checkResult.ok) {
            return checkResult;
      }

      return {
            imei,
            check: {
                  serviceId: checkResult.serviceId,
                  provider: checkResult.provider,
                  structured: checkResult.structured as ImeiCheckSection['structured'],
                  providerData: checkResult.providerData,
            },
            risk,
      };
};

export const riskAnalysisService = {
      analyzeRisk,
      analyzeDeviceAnalysis,
};
