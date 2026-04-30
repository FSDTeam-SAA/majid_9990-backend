import axios from 'axios';
import AppError from '../../errors/AppError';
import { IBarcodeSearchResult, IEANSearchAPIResponse, ICacheEntry } from './barcode.interface';

// In-memory cache Map
const barcodeCache = new Map<string, ICacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

const EAN_MCP_API = 'https://www.ean-search.org/mcp';
const EAN_AUTH_TOKEN = process.env.EAN_SEARCH_TOKEN;

type TMcpTool = {
      name: string;
      description?: string;
      inputSchema?: {
            properties?: Record<string, unknown>;
            required?: string[];
      };
};

type TMcpJsonRpcResponse<T> = {
      jsonrpc?: string;
      id?: string | number;
      result?: T;
      error?: {
            code: number;
            message: string;
            data?: unknown;
      };
};

const getMcpHeaders = (sessionId?: string) => {
      const headers: Record<string, string> = {
            Authorization: `Bearer ${EAN_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
      };

      if (sessionId) {
            headers['MCP-Session-Id'] = sessionId;
      }

      return headers;
};

const parseMaybeJson = (value: unknown) => {
      if (typeof value !== 'string') {
            return value;
      }

      try {
            return JSON.parse(value);
      } catch {
            return value;
      }
};

const createJsonRpcRequest = <TParams>(method: string, params?: TParams) => ({
      jsonrpc: '2.0',
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method,
      ...(params === undefined ? {} : { params }),
});

const sendMcpRequest = async <T>(method: string, params?: unknown, sessionId?: string) => {
      if (!EAN_AUTH_TOKEN) {
            throw new AppError('EAN_SEARCH_TOKEN is missing from environment variables', 500);
      }

      const response = await axios.post<TMcpJsonRpcResponse<T> | string>(
            EAN_MCP_API,
            createJsonRpcRequest(method, params),
            {
                  headers: getMcpHeaders(sessionId),
                  timeout: 15000,
                  validateStatus: () => true,
            }
      );

      const parsedResponse = parseMaybeJson(response.data) as TMcpJsonRpcResponse<T>;

      if (response.status >= 400) {
            throw new Error(
                  parsedResponse?.error?.message ||
                        (typeof parsedResponse === 'string'
                              ? parsedResponse
                              : `MCP request failed with status ${response.status}`)
            );
      }

      if (parsedResponse?.error) {
            throw new Error(parsedResponse.error.message || 'MCP request failed');
      }

      return {
            data: parsedResponse,
            headers: response.headers,
      };
};

const getMcpSessionId = (headers: Record<string, unknown>) => {
      const sessionHeader = headers['mcp-session-id'] || headers['MCP-Session-Id'] || headers['x-mcp-session-id'];
      return typeof sessionHeader === 'string' ? sessionHeader : undefined;
};

const initializeMcpSession = async () => {
      const { headers } = await sendMcpRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                  name: 'majid_9990-backend',
                  version: '1.0.0',
            },
      });

      return getMcpSessionId(headers as Record<string, unknown>);
};

const listMcpTools = async () => {
      const sessionId = await initializeMcpSession();
      const { data } = await sendMcpRequest<{ tools?: TMcpTool[] }>('tools/list', {}, sessionId);

      return {
            sessionId,
            tools: data?.result?.tools || [],
      };
};

const scoreTool = (tool: TMcpTool, keywords: string[]) => {
      const haystack = `${tool.name} ${tool.description || ''}`.toLowerCase();
      return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
};

const pickBestTool = (tools: TMcpTool[], mode: 'barcode' | 'name') => {
      const keywords =
            mode === 'barcode'
                  ? ['barcode', 'ean', 'upc', 'gtin', 'isbn', 'lookup', 'product']
                  : ['name', 'search', 'product', 'query'];

      return tools
            .map((tool) => ({
                  tool,
                  score: scoreTool(tool, keywords),
            }))
            .sort((left, right) => right.score - left.score)[0]?.tool;
};

const buildToolArguments = (tool: TMcpTool, value: string, mode: 'barcode' | 'name') => {
      const properties = tool.inputSchema?.properties || {};
      const propertyNames = Object.keys(properties);
      const candidates =
            mode === 'barcode'
                  ? ['barcode', 'code', 'ean', 'upc', 'gtin', 'isbn']
                  : ['query', 'name', 'keyword', 'search'];

      const matchedKey = candidates.find((candidate) => propertyNames.includes(candidate));

      return {
            [matchedKey || (mode === 'barcode' ? 'barcode' : 'query')]: value,
      };
};

const formatOfficialApiResult = (product: any, barcode: string): IBarcodeSearchResult => {
      return {
            name: product?.name || 'Unknown Product',
            brand: product?.brand || product?.manufacturer || undefined,
            category: product?.categoryName || product?.category || undefined,
            description: product?.description || undefined,
            barcode,
            image: product?.image || undefined,
            rawData: product,
      };
};

const getBarcodeLookupParam = (code: string) => {
      if (/^\d{10}$/.test(code)) {
            return { isbn: code };
      }

      if (/^\d{12}$/.test(code)) {
            return { upc: code };
      }

      return { ean: code };
};

const callOfficialRestBarcodeLookup = async (code: string): Promise<IBarcodeSearchResult> => {
      const response = await axios.get<any>('https://api.ean-search.org/api', {
            params: {
                  token: EAN_AUTH_TOKEN,
                  op: 'barcode-lookup',
                  format: 'json',
                  ...getBarcodeLookupParam(code),
            },
            timeout: 15000,
      });

      const items = Array.isArray(response.data) ? response.data : response.data?.productlist || [];

      const usableItems = Array.isArray(items)
            ? items.filter((item: any) => !item?.error && (item?.ean || item?.upc || item?.isbn || item?.name))
            : [];

      if (usableItems.length > 0) {
            const exactMatch =
                  usableItems.find((item: any) => String(item?.ean || item?.upc || item?.isbn) === code) ||
                  usableItems[0];
            return formatOfficialApiResult(exactMatch, code);
      }

      if (/^\d+$/.test(code) && code.length > 7) {
            const prefixResult = await axios.get<any>('https://api.ean-search.org/api', {
                  params: {
                        token: EAN_AUTH_TOKEN,
                        op: 'barcode-prefix-search',
                        format: 'json',
                        prefix: code.slice(0, 7),
                  },
                  timeout: 15000,
            });

            const prefixItems = prefixResult.data?.productlist || prefixResult.data || [];
            const usablePrefixItems = Array.isArray(prefixItems)
                  ? prefixItems.filter((item: any) => !item?.error && (item?.ean || item?.name))
                  : [];

            if (usablePrefixItems.length > 0) {
                  const bestMatch =
                        usablePrefixItems.find((item: any) => String(item?.ean || '').startsWith(code.slice(0, 7))) ||
                        usablePrefixItems[0];
                  return formatOfficialApiResult(bestMatch, String(bestMatch?.ean || code));
            }
      }

      throw new Error('Product not found in EAN-Search REST API');
};

const callOfficialRestNameSearch = async (query: string): Promise<IBarcodeSearchResult[]> => {
      const response = await axios.get<any>('https://api.ean-search.org/api', {
            params: {
                  token: EAN_AUTH_TOKEN,
                  op: 'product-search',
                  format: 'json',
                  name: query,
            },
            timeout: 15000,
      });

      const items = response.data?.productlist || response.data || [];
      const usableItems = Array.isArray(items)
            ? items.filter((item: any) => !item?.error && (item?.ean || item?.upc || item?.isbn || item?.name))
            : [];

      if (usableItems.length === 0) {
            throw new Error('No products found in EAN-Search REST API');
      }

      return usableItems.map((product: any) =>
            formatOfficialApiResult(product, String(product?.ean || product?.upc || product?.isbn || 'N/A'))
      );
};

const extractMcpStructuredResult = (
      responseData: unknown,
      fallbackBarcode: string
): IBarcodeSearchResult | IBarcodeSearchResult[] | null => {
      const payload = parseMaybeJson(responseData) as any;
      const result = payload?.result ?? payload;

      const structuredContent = result?.structuredContent ?? result?.content ?? result;

      if (Array.isArray(structuredContent)) {
            const firstText = structuredContent.find((item: any) => typeof item?.text === 'string')?.text;
            const parsedText = parseMaybeJson(firstText);

            if (parsedText && typeof parsedText === 'object') {
                  return Array.isArray(parsedText) ? parsedText : formatBarcodeResult(parsedText, fallbackBarcode);
            }
      }

      if (structuredContent && typeof structuredContent === 'object' && !Array.isArray(structuredContent)) {
            if (Array.isArray(structuredContent.products)) {
                  return structuredContent.products.map((product: any) =>
                        formatBarcodeResult(product, product?.barcode || product?.ean || fallbackBarcode)
                  );
            }

            if (structuredContent.product || structuredContent.name || structuredContent.barcode) {
                  return formatBarcodeResult(
                        structuredContent,
                        structuredContent.barcode || structuredContent.ean || fallbackBarcode
                  );
            }
      }

      return null;
};

const callMcpTool = async (mode: 'barcode' | 'name', value: string) => {
      const { sessionId, tools } = await listMcpTools();
      const tool = pickBestTool(tools, mode);

      if (!tool) {
            throw new Error(`No MCP tool found for ${mode} lookup`);
      }

      const toolResponse = await sendMcpRequest(
            'tools/call',
            {
                  name: tool.name,
                  arguments: buildToolArguments(tool, value, mode),
            },
            sessionId
      );

      const structuredResult = extractMcpStructuredResult(toolResponse.data, value);

      if (!structuredResult) {
            throw new Error(`Unable to parse MCP response for ${mode} lookup`);
      }

      return structuredResult;
};

/**
 * Check if cache entry is still valid
 */
const isCacheValid = (timestamp: number): boolean => {
      return Date.now() - timestamp < CACHE_TTL;
};

/**
 * Format API response to match our standard
 */
const formatBarcodeResult = (product: any, barcode: string): IBarcodeSearchResult => {
      return {
            name: product?.name || 'Unknown Product',
            brand: product?.brand || product?.manufacturer || undefined,
            category: product?.category || undefined,
            description: product?.description || undefined,
            barcode: barcode,
            image: product?.image || undefined,
            rawData: product,
      };
};

/**
 * Perform barcode search with retry attempts
 */
const performBarcodeSearchWithRetry = async (cleanCode: string): Promise<IBarcodeSearchResult> => {
      let lastError: any = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                  console.log(`[Barcode Search] Attempt ${attempt}/${MAX_RETRIES} for code: ${cleanCode}`);
                  const result = await callMcpTool('barcode', cleanCode);

                  if (Array.isArray(result)) {
                        const [firstResult] = result;
                        if (!firstResult) {
                              throw new Error('MCP returned an empty result set');
                        }

                        console.log(`[Barcode Found] ${cleanCode} via MCP API`);
                        return firstResult;
                  }

                  console.log(`[Barcode Found] ${cleanCode} via MCP API`);
                  return result;
            } catch (error: any) {
                  lastError = error;
                  console.warn(`[MCP API Failed] Attempt ${attempt}: ${error.message}`);

                  if (attempt < MAX_RETRIES) {
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                  }
            }
      }

      console.warn(`[MCP Fallback] Using REST fallback for code: ${cleanCode}`);
      return callOfficialRestBarcodeLookup(cleanCode);
};

/**
 * Search product by barcode via EAN-Search MCP API
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
                  const results = await callMcpTool('name', cleanQuery);

                  if (Array.isArray(results)) {
                        console.log(`[Name Search Found] ${results.length} results for: ${cleanQuery}`);
                        return results;
                  }

                  console.log(`[Name Search Found] 1 result for: ${cleanQuery}`);
                  return [results];
            } catch (error: any) {
                  lastError = error;

                  if (attempt < MAX_RETRIES) {
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                  }
            }
      }

      console.warn(`[MCP Fallback] Using REST fallback for name search: ${cleanQuery}`);
      return callOfficialRestNameSearch(cleanQuery);
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
 * Fallback REST-based search (in case MCP fails)
 * Uses the documented EAN-Search REST API as backup
 */
const fallbackRestSearch = async (code: string): Promise<IBarcodeSearchResult> => {
      try {
            console.log(`[Fallback REST] Searching for barcode: ${code}`);
            const result = await callOfficialRestBarcodeLookup(code);
            console.log(`[Fallback REST Success] Found product: ${result.name}`);
            return result;
      } catch (error: any) {
            console.error(`[Fallback REST Failed] ${error.message}`);
            throw new AppError('Barcode not found in any database', 404);
      }
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
      fallbackRestSearch,
      clearCache,
      getCacheStats,
};
