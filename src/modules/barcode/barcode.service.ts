import axios from 'axios';
import AppError from '../../errors/AppError';
import { IBarcodeSearchResult, ICacheEntry } from './barcode.interface';
import masterCatalogueService from '../masterCatalogue/masterCatalogue.service';

// In-memory cache Map
const barcodeCache = new Map<string, ICacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

const BARCODE_LOOKUP_API = 'https://api.barcodelookup.com/v3/products';
const BARCODE_LOOKUP_TOKEN = process.env.BARCODE_LOOKUP_TOKEN || 'm6l7qhj3cnx0poqskmaz8e3tkdcium';

// Remove all MCP-related types and functions since we're using REST API directly

const extractBarcodeValue = (product: any, fallback: string) => {
      const directCandidates = [
            product?.barcode,
            product?.barcode_number,
            product?.ean,
            product?.ean13,
            product?.upc,
            product?.gtin,
            product?.mpn,
      ];

      for (const candidate of directCandidates) {
            if (typeof candidate === 'string' && candidate.trim() && candidate.trim().toUpperCase() !== 'N/A') {
                  return candidate.trim();
            }
      }

      if (typeof product?.barcode_formats === 'string' && product.barcode_formats.trim()) {
            const match = product.barcode_formats.match(/\b(\d{8,14})\b/);
            if (match?.[1]) {
                  return match[1];
            }
      }

      return fallback;
};

/**
 * Format API response to match our standard interface
 */
const formatBarcodeResult = (product: any, barcode: string): IBarcodeSearchResult => {
      const images = Array.isArray(product?.images)
            ? product.images.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
            : typeof product?.image === 'string' && product.image.trim()
                  ? [product.image.trim()]
                  : [];
      const resolvedBarcode = extractBarcodeValue(product, barcode);

      return {
            name: product?.title || product?.product_name || product?.name || 'Unknown Product',
            brand: product?.brand || product?.manufacturer || undefined,
            category: product?.category || product?.category_name || undefined,
            description: product?.description || product?.short_description || undefined,
            color: product?.color || undefined,
            size: product?.size || product?.storage || undefined,
            barcode: resolvedBarcode,
            image: images[0] || undefined,
            images,
            rawData: product,
      };
};

/**
 * Format master catalogue item to match standard IBarcodeSearchResult
 */
const formatMasterCatalogueResult = (item: any, fallbackBarcode: string): IBarcodeSearchResult => {
      const images = item.imageUrl ? [item.imageUrl] : [];
      const resolvedBarcode = item.barcode || item.ean || item.upc || item.gtin14 || fallbackBarcode;

      return {
            name: item.deviceName || (item.brand ? `${item.brand} ${item.model}` : item.model) || 'Unknown Product',
            brand: item.brand,
            category: item.category,
            description: [item.model, item.storage, item.colour].filter(Boolean).join(' ') || undefined,
            color: item.colour || undefined,
            size: item.storage || undefined,
            barcode: resolvedBarcode,
            image: item.imageUrl || undefined,
            images,
            rawData: {
                  ...item,
                  masterCatalogId: item._id,
                  isPreloaded: true,
                  source: item.sourceStatus || 'preloaded',
                  modelNumber: item.modelNumber,
                  partNumber: item.partNumber,
                  upc: item.upc,
                  ean: item.ean,
                  gtin14: item.gtin14,
                  sku: item.sku,
                  autoFillApproved: item.autoFillApproved,
                  specs: item.specs,
                  ...(item.specs?.price !== undefined ? { price: item.specs.price } : {}),
                  ...(item.specs?.currency ? { currency: item.specs.currency } : {}),
            },
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
                  const foundBarcode = extractBarcodeValue(product, code);

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
                        const foundBarcode = extractBarcodeValue(product, code);
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
                  const barcode = extractBarcodeValue(product, 'N/A');
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
 * Search product by barcode (EAN / UPC / GTIN / ISBN)
 * Step 1: Check memory cache
 * Step 2: Search internal Master Product Catalogue (sub-10ms, accurate, 0 API cost)
 * Step 3: Only on internal miss -> Fallback to external BarcodeLookup API
 */
const searchByBarcode = async (code: string): Promise<IBarcodeSearchResult> => {
      // Validate barcode
      if (!code || code.trim().length === 0) {
            throw new AppError('Barcode code is required', 400);
      }

      const cleanCode = code.trim();
      const cacheKey = `barcode_${cleanCode}`;

      // 1. Check in-memory cache
      const cachedEntry = barcodeCache.get(cacheKey);
      if (cachedEntry && isCacheValid(cachedEntry.timestamp)) {
            console.log(`[Barcode Cache Hit] ${cleanCode}`);
            return cachedEntry.data;
      }

      // 2. Step 1: Query internal Master Product Catalogue FIRST
      try {
            const internalItem = await masterCatalogueService.findByBarcode(cleanCode);
            if (internalItem) {
                  console.log(`[Master Catalogue Hit] Found preloaded specs for barcode: ${cleanCode} (${internalItem.deviceName})`);
                  const result = formatMasterCatalogueResult(internalItem, cleanCode);
                  barcodeCache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now(),
                  });
                  return result;
            }
      } catch (catErr: any) {
            console.warn(`[Master Catalogue Lookup Warning]: ${catErr?.message}`);
      }

      // 3. Step 2: Fallback to external BarcodeLookup API ONLY after internal miss
      console.log(`[Master Catalogue Miss] -> Falling back to External Barcode API for code: ${cleanCode}`);
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
 * Search product by name / keyword
 * Step 1: Query internal Master Product Catalogue (returns 10-20 lightweight matches)
 * Step 2: Only if zero matches found -> Fallback to external API
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

      // Step 1: Query internal Master Product Catalogue FIRST
      try {
            const internalSearchResult = await masterCatalogueService.searchCatalogue({
                  query: cleanQuery,
                  limit: 20,
            });

            if (internalSearchResult.results && internalSearchResult.results.length > 0) {
                  console.log(`[Master Catalogue Hit] Found ${internalSearchResult.results.length} internal matches for: ${cleanQuery}`);
                  const formattedResults = internalSearchResult.results.map((item) =>
                        formatMasterCatalogueResult(item, item.barcode || item.ean || item.upc || 'N/A')
                  );
                  barcodeCache.set(cacheKey, {
                        data: formattedResults[0],
                        timestamp: Date.now(),
                  });
                  return formattedResults;
            }
      } catch (catErr: any) {
            console.warn(`[Master Catalogue Name Search Warning]: ${catErr?.message}`);
      }

      // Step 2: Fallback to external API if internal catalogue returns no results
      console.log(`[Master Catalogue Miss] -> Falling back to External Name Search for query: ${cleanQuery}`);
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
