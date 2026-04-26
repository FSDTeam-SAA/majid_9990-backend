import { DeviceChecksResponse, RiskResult } from './riskAnalysis.interface';
import { calculateRisk, getDeviceChecks } from './riskAnalysis.utils';


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

export const riskAnalysisService = {
      analyzeRisk,
};
