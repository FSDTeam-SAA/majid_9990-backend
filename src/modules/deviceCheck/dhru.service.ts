import axios, { AxiosInstance } from 'axios';
import qs from 'qs';

type ProviderType = 'dhru' | 'sickw';

class DhruService {
      private readonly client: AxiosInstance;
      private readonly username: string;
      private readonly apiKey: string;
      private readonly baseUrl: string;
      private readonly provider: ProviderType;
      private readonly sickwFormat: string;

      constructor() {
            this.baseUrl = String(process.env.DHRU_BASE_URL ?? '').trim();
            this.username = String(process.env.DHRU_USERNAME ?? '').trim();
            this.apiKey = String(process.env.DHRU_API_KEY ?? '').trim();
            const explicitProvider = String(process.env.IMEI_PROVIDER ?? '')
                  .trim()
                  .toLowerCase();
            const resolvedProvider = this.detectProviderFromUrl();
            this.provider =
                  explicitProvider === 'sickw' || explicitProvider === 'dhru' ? explicitProvider : resolvedProvider;
            this.sickwFormat = String(process.env.SICKW_RESPONSE_FORMAT ?? 'json')
                  .trim()
                  .toLowerCase();

            if (!this.baseUrl || !this.apiKey) {
                  throw new Error('Missing IMEI provider configuration: DHRU_BASE_URL, DHRU_API_KEY');
            }

            if (this.provider === 'dhru' && !this.username) {
                  throw new Error('Missing DHRU configuration: DHRU_USERNAME is required for provider=dhru');
            }

            const timeoutMs = Number(process.env.DHRU_TIMEOUT_MS ?? 60000);

            this.client = axios.create({
                  baseURL: this.baseUrl,
                  headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
            });
      }

      private detectProviderFromUrl(): ProviderType {
            const normalized = this.baseUrl.toLowerCase();
            return normalized.includes('sickw.com') ? 'sickw' : 'dhru';
      }

      getProvider(): ProviderType {
            return this.provider;
      }

      private async request(action: string, extraData: Record<string, unknown> = {}) {
            if (this.provider === 'sickw') {
                  const response = await this.client.get('/api.php', {
                        params: {
                              action,
                              key: this.apiKey,
                              ...extraData,
                        },
                  });
                  return response.data;
            }

            const payload = {
                  username: this.username,
                  apiaccesskey: this.apiKey,
                  requestformat: 'JSON',
                  action,
                  ...extraData,
            };

            const response = await this.client.post('/api/index.php', qs.stringify(payload));
            return response.data;
      }

      async placeImeiOrder(serviceId: string | number, imei: string) {
            if (this.provider === 'sickw') {
                  const response = await this.client.get('/api.php', {
                        params: {
                              format: this.sickwFormat,
                              key: this.apiKey,
                              imei,
                              service: serviceId,
                        },
                  });

                  console.log('dhru service ts, placeImeiOrder___', response);

                  return response.data;
            }

            return this.request('placeimeiorder', {
                  serviceid: serviceId,
                  imei,
            });
      }

      // this is the part you asked for
      async getImeiServices() {
            if (this.provider === 'sickw') {
                  return this.request('services');
            }

            return this.request('imeiservicelist');
      }

      async getImeiOrder(orderId: string | number) {
            if (this.provider === 'sickw') {
                  const response = await this.client.get('/api.php', {
                        params: {
                              format: this.sickwFormat,
                              key: this.apiKey,
                              imei: orderId,
                              action: 'history',
                        },
                  });

                  return response.data;
            }

            return this.request('getimeiorder', {
                  id: orderId,
            });
      }
}

export const dhruService = new DhruService();
