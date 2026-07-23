import axios from 'axios';
import AppError from '../../errors/AppError';
import { IBarcodeSearchResult, ICacheEntry } from './barcode.interface';

// In-memory cache Map
const barcodeCache = new Map<string, ICacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

const BARCODE_LOOKUP_API = 'https://api.barcodelookup.com/v3/products';
const BARCODE_LOOKUP_TOKEN = process.env.BARCODE_LOOKUP_TOKEN || 'm6l7qhj3cnx0poqskmaz8e3tkdcium';

// Remove all MCP-related types and functions since we're using REST API directly

/**
 * Format API response to match our standard interface
 */
const formatBarcodeResult = (product: any, barcode: string): IBarcodeSearchResult => {
      return {
            name: product?.product_name || product?.name || 'Unknown Product',
            brand: product?.brand || product?.manufacturer || undefined,
            category: product?.category || product?.category_name || undefined,
            description: product?.description || product?.short_description || undefined,
            barcode: barcode,
            image: product?.images?.[0] || product?.image || undefined,
            rawData: product,
      };
};

/**
 * Call BarcodeLookup API for barcode search
 */
const callBarcodeLookupByBarcode = async (code: string): Promise<IBarcodeSearchResult> => {
      try {
            const response = await axios.get<any>(BARCODE_LOOKUP_API, {
                  params: {
                        barcode: code,
                        key: BARCODE_LOOKUP_TOKEN,
                        formatted: 'n', // Don't use formatted for API calls
                  },
                  timeout: 15000,
            });

            // Check if we got results
            if (response.data?.products && response.data.products.length > 0) {
                  const product = response.data.products[0];

                  // Extract barcode from response or use the one we searched for
                  const foundBarcode = product?.barcode || product?.ean || product?.upc || code;

                  return formatBarcodeResult(product, foundBarcode);
            }

            // Try prefix search as fallback for longer barcodes
            if (/^\d+$/.test(code) && code.length > 7) {
                  const prefixResponse = await axios.get<any>(BARCODE_LOOKUP_API, {
                        params: {
                              search: code.slice(0, 7),
                              key: BARCODE_LOOKUP_TOKEN,
                              formatted: 'n',
                        },
                        timeout: 15000,
                  });

                  if (prefixResponse.data?.products && prefixResponse.data.products.length > 0) {
                        const product = prefixResponse.data.products[0];
                        const foundBarcode = product?.barcode || product?.ean || product?.upc || code;
                        return formatBarcodeResult(product, foundBarcode);
                  }
            }

            throw new Error('Product not found in BarcodeLookup API');
      } catch (error: any) {
            if (error.response?.status === 404 || error.response?.data?.status === 404) {
                  throw new Error('Product not found');
            }
            throw new Error(`BarcodeLookup API error: ${error.message}`);
      }
};

/**
 * Call BarcodeLookup API for name search
 */
const callBarcodeLookupByName = async (query: string): Promise<IBarcodeSearchResult[]> => {
      try {
            const response = await axios.get<any>(BARCODE_LOOKUP_API, {
                  params: {
                        search: query,
                        key: BARCODE_LOOKUP_TOKEN,
                        formatted: 'n',
                  },
                  timeout: 15000,
            });

            if (!response.data?.products || response.data.products.length === 0) {
                  throw new Error('No products found');
            }

            // Format all results
            return response.data.products.map((product: any) => {
                  const barcode = product?.barcode || product?.ean || product?.upc || 'N/A';
                  return formatBarcodeResult(product, barcode);
            });
      } catch (error: any) {
            if (error.response?.status === 404 || error.response?.data?.status === 404) {
                  throw new Error('No products found');
            }
            throw new Error(`BarcodeLookup API error: ${error.message}`);
      }
};

/**
 * Check if cache entry is still valid
 */
const isCacheValid = (timestamp: number): boolean => {
      return Date.now() - timestamp < CACHE_TTL;
};

/**
 * Perform barcode search with retry attempts
 */
const performBarcodeSearchWithRetry = async (cleanCode: string): Promise<IBarcodeSearchResult> => {
      let lastError: any = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                  console.log(`[Barcode Search] Attempt ${attempt}/${MAX_RETRIES} for code: ${cleanCode}`);
                  const result = await callBarcodeLookupByBarcode(cleanCode);
                  console.log(`[Barcode Found] ${cleanCode} via BarcodeLookup API`);
                  return result;
            } catch (error: any) {
                  lastError = error;
                  console.warn(`[BarcodeLookup API Failed] Attempt ${attempt}: ${error.message}`);

                  if (attempt < MAX_RETRIES) {
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                  }
            }
      }

      throw lastError || new Error('Barcode search failed after retries');
};

/**
 * Search product by barcode via BarcodeLookup API
 * Includes retry logic and caching
 */
const searchByBarcode = async (code: string): Promise<IBarcodeSearchResult> => {
      // Validate barcode
      if (!code || code.trim().length === 0) {
            throw new AppError('Barcode code is required', 400);
      }

      const cleanCode = code.trim();
      const cacheKey = `barcode_${cleanCode}`;

      // Check cache first
      const cachedEntry = barcodeCache.get(cacheKey);
      if (cachedEntry && isCacheValid(cachedEntry.timestamp)) {
            console.log(`[Barcode Cache Hit] ${cleanCode}`);
            return cachedEntry.data;
      }

      // Search with retries
      const result = await performBarcodeSearchWithRetry(cleanCode);

      // Cache the result
      barcodeCache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
      });

      return result;
};

/**
 * Perform name search with retry attempts
 */
const performNameSearchWithRetry = async (cleanQuery: string): Promise<IBarcodeSearchResult[]> => {
      let lastError: any = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                  console.log(`[Name Search] Attempt ${attempt}/${MAX_RETRIES} for query: ${cleanQuery}`);
                  const results = await callBarcodeLookupByName(cleanQuery);
                  console.log(`[Name Search Found] ${results.length} results for: ${cleanQuery}`);
                  return results;
            } catch (error: any) {
                  lastError = error;
                  console.warn(`[BarcodeLookup API Failed] Attempt ${attempt}: ${error.message}`);

                  if (attempt < MAX_RETRIES) {
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                  }
            }
      }

      throw lastError || new Error('Name search failed after retries');
};

/**
 * Search product by name keyword
 * Includes retry logic
 */
const searchByName = async (query: string): Promise<IBarcodeSearchResult[]> => {
      // Validate query
      if (!query || query.trim().length === 0) {
            throw new AppError('Search query is required', 400);
      }

      if (query.trim().length < 2) {
            throw new AppError('Search query must be at least 2 characters', 400);
      }

      const cleanQuery = query.trim();
      const cacheKey = `name_${cleanQuery.toLowerCase()}`;

      // Check cache first
      const cachedEntry = barcodeCache.get(cacheKey);
      if (cachedEntry && isCacheValid(cachedEntry.timestamp)) {
            console.log(`[Name Search Cache Hit] ${cleanQuery}`);
            return [cachedEntry.data];
      }

      // Search with retries
      const results = await performNameSearchWithRetry(cleanQuery);

      // Cache the first result
      if (results.length > 0) {
            barcodeCache.set(cacheKey, {
                  data: results[0],
                  timestamp: Date.now(),
            });
      }

      return results;
};

/**
 * Clear cache for testing purposes
 */
const clearCache = (): void => {
      barcodeCache.clear();
      console.log('[Cache] Cleared all barcode cache');
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
      return {
            size: barcodeCache.size,
            ttl: CACHE_TTL,
            entries: Array.from(barcodeCache.entries()).map(([key, value]) => ({
                  key,
                  age: Date.now() - value.timestamp,
            })),
      };
};

export default {
      searchByBarcode,
      searchByName,
      clearCache,
      getCacheStats,
};
