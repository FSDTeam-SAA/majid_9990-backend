import axios from 'axios';

type RiskLevel = 'low' | 'medium' | 'high';
type DeviceStatus = 'clean' | 'blacklisted' | 'financed' | 'locked' | 'unknown';

type ProviderPayload = Record<string, any>;

const htmlToText = (input: string) =>
      input
            .split(/<br\s*\/?>/gi)
            .join('\n')
            .split(/<[^>]*>/g)
            .join('')
            .split(/&nbsp;/gi)
            .join(' ')
            .trim();

const extractTextBlock = (providerData: ProviderPayload): string => {
      const raw = providerData?.result ?? providerData?.RESULT ?? providerData?.data ?? '';
      if (typeof raw === 'string') {
            return htmlToText(raw);
      }

      return JSON.stringify(raw ?? providerData);
};

const getField = (text: string, key: string): string | null => {
      const regex = new RegExp(String.raw`${key}\s*:\s*([^\n]+)`, 'i');
      const match = regex.exec(text);
      return match?.[1]?.trim() ?? null;
};

const getFirstField = (text: string, keys: string[]): string | null => {
      for (const key of keys) {
            const value = getField(text, key);
            if (value) {
                  return value;
            }
      }

      return null;
};

const hasMeaningfulText = (value: string | null | undefined) => {
      if (!value) {
            return false;
      }

      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 && normalized !== 'unknown' && normalized !== 'n/a' && normalized !== '-';
};

const toNumber = (value: string | null, fallback: number) => {
      if (!value) {
            return fallback;
      }

      const parsed = Number((String(value).match(/[\d.]+/g) ?? []).join(''));
      return Number.isFinite(parsed) ? parsed : fallback;
};

const estimateMarketValue = (deviceName: string): number => {
      const name = deviceName.toLowerCase();

      if (name.includes('iphone')) {
            return 920;
      }

      if (name.includes('samsung') || name.includes('galaxy')) {
            return 540;
      }

      if (name.includes('xiaomi') || name.includes('redmi')) {
            return 260;
      }

      if (name.includes('pixel')) {
            return 480;
      }

      return 300;
};

const getDeviceStatus = (blacklistStatus: string, paymentPlanActive: boolean): DeviceStatus => {
      const normalized = blacklistStatus.toLowerCase();

      if (normalized.includes('blacklist') || normalized.includes('blacklisted') || normalized.includes('stolen')) {
            return 'blacklisted';
      }

      if (normalized.includes('clean') && paymentPlanActive) {
            return 'financed';
      }

      if (normalized.includes('clean')) {
            return 'clean';
      }

      return 'unknown';
};

const inferFmiStatus = (text: string): 'on' | 'off' | 'unknown' => {
      const normalized = text.toLowerCase();

      if (normalized.includes('fmi on') || normalized.includes('icloud lock on')) {
            return 'on';
      }

      if (normalized.includes('fmi off') || normalized.includes('icloud lock off')) {
            return 'off';
      }

      return 'unknown';
};

const getRisk = (status: DeviceStatus, paymentPlanActive: boolean, fmiStatus: 'on' | 'off' | 'unknown') => {
      let score = 12;

      if (status === 'blacklisted') {
            score += 70;
      }

      if (status === 'financed' || paymentPlanActive) {
            score += 20;
      }

      if (status === 'locked' || fmiStatus === 'on') {
            score += 20;
      }

      score = Math.max(0, Math.min(100, score));

      let riskLevel: RiskLevel = 'low';
      if (score >= 75) {
            riskLevel = 'high';
      } else if (score >= 40) {
            riskLevel = 'medium';
      }

      let label = 'Low Risk';
      if (riskLevel === 'high') {
            label = 'High Risk';
      } else if (riskLevel === 'medium') {
            label = 'Medium Risk';
      }

      return { score, riskLevel, label };
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

export const getOpenAiInsight = async (params: {
      imei: string;
      deviceName: string;
      deviceStatus: DeviceStatus;
      riskLabel: string;
      sourceText: string;
      estimatedMarketValue: number;
}) => {
      const apiKey = String(process.env.OPENAI_API_KEY ?? '').trim();
      if (!apiKey) {
            return null;
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
                                    content: 'You are an IMEI risk analyst. Return strict JSON only with keys: title, message, estimatedMarketValueUSD.',
                              },
                              {
                                    role: 'user',
                                    content: JSON.stringify({
                                          imei: params.imei,
                                          deviceName: params.deviceName,
                                          deviceStatus: params.deviceStatus,
                                          riskLabel: params.riskLabel,
                                          estimatedMarketValueUSD: params.estimatedMarketValue,
                                          providerSummary: params.sourceText,
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
                  return null;
            }

            const parsed = parseJsonObject(content);
            if (!parsed) {
                  return null;
            }

            return {
                  title: typeof parsed.title === 'string' ? parsed.title : 'AI INSIGHT',
                  message:
                        typeof parsed.message === 'string'
                              ? parsed.message
                              : 'Device appears consistent with provider records. Proceed with normal due diligence.',
                  estimatedMarketValueUSD:
                        typeof parsed.estimatedMarketValueUSD === 'number'
                              ? parsed.estimatedMarketValueUSD
                              : params.estimatedMarketValue,
            };
      } catch {
            return null;
      }
};

// This function processes IMEI scan data from a provider response. It extracts device details, checks blacklist, financing, and FMI/iCloud lock status, calculates device risk and estimated market value, generates AI-based insights, and returns a structured report containing device status, risk meter, market value, verification checks, and report generation information.

export const buildStructuredScanInfo = async (imei: string, providerData: ProviderPayload) => {
      const sourceText = extractTextBlock(providerData);

      const manufacturer = getFirstField(sourceText, ['Manufacturer', 'Brand']);
      const marketingName = getFirstField(sourceText, ['Marketing Name', 'Model Name']);
      const fullName = getFirstField(sourceText, ['Full Name', 'Device Name']);
      const modelCode = getFirstField(sourceText, ['Model Code']);
      const modelNumber = getFirstField(sourceText, ['Model Number']);
      const model = getFirstField(sourceText, ['Model', 'Product']);
      const blacklistStatusRaw = getField(sourceText, 'Blacklist Status') ?? 'Unknown';
      const generalListStatus = (getField(sourceText, 'General List Status') ?? '').toLowerCase();

      const candidateDeviceNames = [marketingName, fullName, model, modelCode, modelNumber, manufacturer].filter(
            (value): value is string => hasMeaningfulText(value)
      );
      const deviceName = candidateDeviceNames.length
            ? Array.from(new Set(candidateDeviceNames)).slice(0, 2).join(' / ')
            : 'Unknown Device';

      const normalizedText = sourceText.toLowerCase();
      const hasPaymentPlanSignal = /(payment\s*plan|financ|installment|contract)/.test(normalizedText);
      const explicitNoPlanSignal = /(no\s*payment\s*plan|fully\s*paid|contract\s*ended)/.test(normalizedText);
      const paymentPlanActive = generalListStatus
            ? !(generalListStatus === 'no' || generalListStatus === 'clean' || generalListStatus === 'none')
            : hasPaymentPlanSignal && !explicitNoPlanSignal;
      const fmiStatus = inferFmiStatus(sourceText);

      const deviceStatus = getDeviceStatus(blacklistStatusRaw, paymentPlanActive);
      const risk = getRisk(deviceStatus, paymentPlanActive, fmiStatus);

      const estimatedMarketValue = estimateMarketValue(deviceName);
      const openAiInsight = await getOpenAiInsight({
            imei,
            deviceName: deviceName || manufacturer || 'Unknown Device',
            deviceStatus,
            riskLabel: risk.label,
            sourceText,
            estimatedMarketValue,
      });

      const finalMarketValue = toNumber(
            String(openAiInsight?.estimatedMarketValueUSD ?? estimatedMarketValue),
            estimatedMarketValue
      );

      let hardwareLockDescription = 'FMI status unavailable';
      let hardwareLockStatus: 'passed' | 'failed' | 'warning' = 'warning';
      if (fmiStatus === 'on') {
            hardwareLockDescription = 'FMI is ON';
            hardwareLockStatus = 'failed';
      } else if (fmiStatus === 'off') {
            hardwareLockDescription = 'FMI is OFF';
            hardwareLockStatus = 'passed';
      }

      return {
            deviceName,
            imei,
            deviceStatus,
            riskMeter: {
                  riskLevel: risk.riskLevel,
                  score: risk.score,
                  label: risk.label,
            },
            marketValue: {
                  amount: finalMarketValue,
                  currency: 'USD',
            },
            aiInsight: {
                  title: openAiInsight?.title ?? 'AI INSIGHT',
                  message:
                        openAiInsight?.message ??
                        `${risk.label}. ${deviceStatus === 'clean' ? 'No blacklist signal was found.' : 'Review blacklist/ownership details before purchase.'}`,
            },
            checks: {
                  globalBlacklist: {
                        title: 'Global Blacklist',
                        description:
                              deviceStatus === 'blacklisted'
                                    ? 'Reported or flagged in blacklist sources'
                                    : 'Not reported stolen',
                        status: deviceStatus === 'blacklisted' ? 'failed' : 'passed',
                        isReportedStolen: deviceStatus === 'blacklisted',
                  },
                  carrierFinancing: {
                        title: 'Carrier Financing',
                        description: paymentPlanActive
                              ? 'Payment plan active or unclear'
                              : 'No active payment plan detected',
                        status: paymentPlanActive ? 'warning' : 'passed',
                        isPaymentPlanActive: paymentPlanActive,
                  },
                  hardwareLock: {
                        title: 'Hardware Lock',
                        description: hardwareLockDescription,
                        status: hardwareLockStatus,
                        fmiStatus,
                  },
                  partAuthenticity: {
                        title: 'Part Authenticity',
                        description: 'No direct part-level authenticity signal in provider response',
                        status: 'warning',
                        isOriginalComponents: true,
                  },
            },
            reportActions: {
                  smartInvoiceCreated: false,
                  pdfCertificateUrl: null,
                  isPdfGenerated: false,
            },
      };
};
