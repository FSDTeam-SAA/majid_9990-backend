// src/utils/currency.ts

export const getCurrencySymbol = (currency?: string, symbol?: string): string => {
      if (symbol && symbol.trim().length > 0) return symbol.trim();
      const code = String(currency || '').trim().toUpperCase();
      const symbols: Record<string, string> = {
            GBP: '£',
            USD: '$',
            EUR: '€',
            CAD: 'CA$',
            AUD: 'A$',
            INR: '₹',
            PKR: '₨',
            AED: 'AED',
            SAR: 'SAR',
            BDT: '৳',
            NONE: '',
      };
      if (code && symbols[code] !== undefined) {
            return symbols[code];
      }
      if (code === 'POUND' || code === '£') return '£';
      if (code === 'DOLLAR' || code === '$') return '$';
      if (code === 'EURO' || code === '€') return '€';
      return '£'; // Default to £ as requested
};
