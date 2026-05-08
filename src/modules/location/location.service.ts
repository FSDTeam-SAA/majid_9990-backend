import axios from 'axios';
import type { Request } from 'express';

const GEO_API = 'https://ipapi.co';
const FX_API = 'https://open.er-api.com/v6/latest/USD';

const parseIp = (req: Pick<Request, 'headers' | 'socket' | 'ip'>) => {
      const forwarded = req.headers?.['x-forwarded-for'];
      const forwardedIp = forwarded ? String(forwarded).split(',')[0].trim() : '';
      const remoteIp = req.socket?.remoteAddress ?? '';
      const ip = forwardedIp || remoteIp || req.ip || '';

      return String(ip).replace(/^::ffff:/, '').trim();
};

const getGeoForIp = async (ip: string) => {
      try {
            const url = `${GEO_API}/${ip}/json/`;
            const { data } = await axios.get(url, { timeout: 5000 });
            return data;
      } catch {
            return null;
      }
};

const getCurrencyCodeForIp = async (ip: string) => {
      const geo = await getGeoForIp(ip);

      return String(geo?.currency || 'USD').toUpperCase();
};

const getUsdToCurrencyRate = async (currencyCode: string) => {
      const code = String(currencyCode || 'USD').trim().toUpperCase();

      if (!code || code === 'USD') {
            return 1;
      }

      try {
            const { data } = await axios.get(FX_API, { timeout: 5000 });
            const rate = Number(data?.rates?.[code]);

            return Number.isFinite(rate) && rate > 0 ? rate : 1;
      } catch {
            return 1;
      }
};

const convertUsdAmount = (amount: number, rate: number) => {
      const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
      return Number((amount * safeRate).toFixed(3));
};

const locationService = {
      parseIp,
      getGeoForIp,
      getCurrencyCodeForIp,
      getUsdToCurrencyRate,
      convertUsdAmount,
};

export default locationService;
