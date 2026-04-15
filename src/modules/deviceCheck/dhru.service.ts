import axios, { AxiosInstance } from 'axios';
import qs from 'qs';

class DhruService {
      private readonly client: AxiosInstance;
      private readonly username: string;
      private readonly apiKey: string;
      private readonly baseUrl: string;

      constructor() {
            this.baseUrl = String(process.env.DHRU_BASE_URL ?? '').trim();
            this.username = String(process.env.DHRU_USERNAME ?? '').trim();
            this.apiKey = String(process.env.DHRU_API_KEY ?? '').trim();

            if (!this.baseUrl || !this.username || !this.apiKey) {
                  throw new Error('Missing DHRU configuration: DHRU_BASE_URL, DHRU_USERNAME, DHRU_API_KEY');
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

      private async request(action: string, extraData: Record<string, unknown> = {}) {
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
            return this.request('placeimeiorder', {
                  serviceid: serviceId,
                  imei,
            });
      }

      // this is the part you asked for
      async getImeiServices() {
            return this.request('imeiservicelist');
      }

      async getImeiOrder(orderId: string | number) {
            return this.request('getimeiorder', {
                  id: orderId,
            });
      }
}

export const dhruService = new DhruService();
