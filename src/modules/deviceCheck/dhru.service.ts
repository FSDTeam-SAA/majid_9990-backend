import axios, { AxiosInstance } from 'axios';
import qs from 'qs';

class DhruService {
      private client: AxiosInstance;
      private username: string;
      private apiKey: string;

      constructor() {
            this.username = process.env.DHRU_USERNAME as string;
            this.apiKey = process.env.DHRU_API_KEY as string;

            this.client = axios.create({
                  baseURL: process.env.DHRU_BASE_URL,
                  headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  timeout: 60000,
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

      async getImeiOrder(orderId: string | number) {
            return this.request('getimeiorder', {
                  id: orderId,
            });
      }
}

export const dhruService = new DhruService();
