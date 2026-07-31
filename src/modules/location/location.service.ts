import axios from 'axios';
import type { Request } from 'express';

const GEO_API = 'https://ipapi.co';
const FX_API = 'https://open.er-api.com/v6/latest/USD';
const FX_CACHE_TTL = 60 * 60 * 1000;
let fxRatesCache: { rates: Record<string, number>; timestamp: number } | null = null;

const CURRENCY_SYMBOLS: Record<string, string> = {
      USD: '$',
      BDT: '৳',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      PKR: '₨',
      JPY: '¥',
      CNY: '¥',
      KRW: '₩',
      BRL: 'R$',
      RUB: '₽',
      TRY: '₺',
      NGN: '₦',
      EGP: 'E£',
      ZAR: 'R',
      AUD: 'A$',
      CAD: 'C$',
      SGD: 'S$',
      HKD: 'HK$',
      MXN: 'MX$',
      PHP: '₱',
      THB: '฿',
      IDR: 'Rp',
      MYR: 'RM',
      VND: '₫',
      AED: 'د.إ',
      SAR: '﷼',
      QAR: 'ر.ق',
      KWD: 'د.ك',
      BHD: 'BD',
      OMR: 'ر.ع',
      ILS: '₪',
      PLN: 'zł',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      CZK: 'Kč',
      HUF: 'Ft',
      CHF: 'CHF',
      TWD: 'NT$',
      NZD: 'NZ$',
      LKR: 'Rs',
      NPR: 'Rs',
      GHS: 'GH₵',
      KES: 'KSh',
      TZS: 'TSh',
      UGX: 'USh',
      MAD: 'MAD',
      DZD: 'د.ج',
      TND: 'د.ت',
      JOD: 'JD',
      LBP: 'L£',
      MMK: 'K',
      LAK: '₭',
      KHR: '៛',
      BND: 'B$',
      FJD: 'FJ$',
      PGK: 'K',
      MUR: '₨',
      MVR: 'Rf',
      BTN: 'Nu.',
      BWP: 'P',
      SZL: 'E',
      LSL: 'L',
      NAD: 'N$',
      WST: 'WS$',
      TOP: 'T$',
      VUV: 'VT',
      XPF: '₣',
};

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

const getCurrencySymbol = (currencyCode: string): string => {
      const code = String(currencyCode || 'USD').trim().toUpperCase();
      return CURRENCY_SYMBOLS[code] || code;
};

const getCurrencyInfo = async (ip: string) => {
      const currencyCode = await getCurrencyCodeForIp(ip);
      const symbol = getCurrencySymbol(currencyCode);

      return { currency: currencyCode, symbol };
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

const getExchangeRates = async () => {
      if (fxRatesCache && Date.now() - fxRatesCache.timestamp < FX_CACHE_TTL) {
            return fxRatesCache.rates;
      }

      try {
            const { data } = await axios.get(FX_API, { timeout: 5000 });
            const rates = data?.rates;

            if (!rates || typeof rates !== 'object') {
                  return null;
            }

            fxRatesCache = {
                  rates: rates as Record<string, number>,
                  timestamp: Date.now(),
            };

            return fxRatesCache.rates;
      } catch {
            return null;
      }
};

const convertCurrencyAmount = (
      amount: number,
      rates: Record<string, number> | null,
      fromCurrency: string,
      toCurrency: string
) => {
      const from = String(fromCurrency || 'USD').trim().toUpperCase();
      const to = String(toCurrency || 'USD').trim().toUpperCase();

      if (!Number.isFinite(amount)) {
            return null;
      }

      if (from === to) {
            return amount;
      }

      const usdToFrom = from === 'USD' ? 1 : Number(rates?.[from]);
      const usdToTo = to === 'USD' ? 1 : Number(rates?.[to]);

      if (!Number.isFinite(usdToFrom) || usdToFrom <= 0 || !Number.isFinite(usdToTo) || usdToTo <= 0) {
            return null;
      }

      return (amount / usdToFrom) * usdToTo;
};

const convertUsdAmount = (amount: number, rate: number) => {
      const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
      return Number((amount * safeRate).toFixed(3));
};

const locationService = {
      parseIp,
      getGeoForIp,
      getCurrencyCodeForIp,
      getCurrencySymbol,
      getCurrencyInfo,
      getUsdToCurrencyRate,
      getExchangeRates,
      convertCurrencyAmount,
      convertUsdAmount,
      CURRENCY_SYMBOLS,
};

export default locationService;
