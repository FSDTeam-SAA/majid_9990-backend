import fs from 'fs';
import path from 'path';
import { ITradeInCatalogItem, ITradeInSearchParams, ITradeInSearchResult } from './tradeIn.interface';

let cachedCatalog: ITradeInCatalogItem[] | null = null;

const loadCatalog = (): ITradeInCatalogItem[] => {
      if (cachedCatalog) return cachedCatalog;

      const possiblePaths = [
            path.join(process.cwd(), 'data', 'catalogue', 'trade_in_catalog.json'),
            path.join(__dirname, '..', '..', '..', 'data', 'catalogue', 'trade_in_catalog.json'),
            path.join(__dirname, '..', '..', 'data', 'catalogue', 'trade_in_catalog.json'),
      ];

      for (const p of possiblePaths) {
            try {
                  if (fs.existsSync(p)) {
                        const raw = fs.readFileSync(p, 'utf-8');
                        const parsed = JSON.parse(raw);
                        cachedCatalog = Array.isArray(parsed) ? parsed : (parsed.items || []);
                        return cachedCatalog!;
                  }
            } catch (_) {}
      }

      cachedCatalog = [];
      return cachedCatalog;
};

const QUERY_ALIASES: Array<[RegExp, string]> = [
      [/\bps5\b/g, 'playstation 5'],
      [/\bps4\b/g, 'playstation 4'],
      [/\bps3\b/g, 'playstation 3'],
      [/\bps2\b/g, 'playstation 2'],
      [/\bps1\b|\bpsone\b/g, 'playstation'],
      [/\bmbp\b/g, 'macbook pro'],
      [/\bmba\b/g, 'macbook air'],
];

const EXACT_ONLY_TOKENS = new Set([
      'pro', 'air', 'max', 'mini', 'plus', 'duo', 'neo', 'red', 'one', 'se', 'fe', 'xr', 'xs', 'tab',
]);

const BRAND_PREFIX_RE = /^(apple|samsung|sony|microsoft|nintendo)\s+/i;

const tokenizeField = (text: string): string[] => {
      const cleaned = text.toLowerCase().replace(/\(product\)/g, ' ');
      const rawTokens = cleaned.match(/[a-z0-9+.-]+/g) || [];
      const out = new Set<string>();
      for (const tok of rawTokens) {
            const parts = tok.split(/[.-]+/).filter(Boolean);
            const candidates = parts.length > 1 ? [tok, ...parts] : [tok];
            for (const item of candidates) {
                  if (!item) continue;
                  out.add(item);
                  if (item.endsWith('+') && item.length > 1) {
                        out.add(item.slice(0, -1));
                  }
                  const unitMatch = item.match(/^(\d+)(gb|tb|mb|mm)$/);
                  if (unitMatch) {
                        out.add(unitMatch[1]);
                  }
            }
      }
      return Array.from(out);
};

const tokenMatches = (tokens: string[], modelTokens: string[], queryToken: string): 'exact' | 'prefix' | false => {
      if (tokens.includes(queryToken)) return 'exact';
      if (/^\d+$/.test(queryToken)) return false;
      if (/^[a-z]+\d+[a-z]*$/.test(queryToken)) {
            return queryToken.length >= 3 && modelTokens.some(t => t.startsWith(queryToken)) ? 'prefix' : false;
      }
      if (queryToken.length >= 3 && !EXACT_ONLY_TOKENS.has(queryToken)) {
            return tokens.some(t => t.startsWith(queryToken)) ? 'prefix' : false;
      }
      return false;
};

const parseStorageGb = (storage: string): number => {
      const m = storage.match(/(\d+)\s*(TB|GB|MB)/i);
      if (!m) return Number.MAX_SAFE_INTEGER;
      const val = Number(m[1]);
      const unit = m[2].toUpperCase();
      if (unit === 'TB') return val * 1024;
      if (unit === 'GB') return val;
      return val / 1024;
};

const searchTradeInCatalog = async (params: ITradeInSearchParams): Promise<ITradeInSearchResult> => {
      const catalog = loadCatalog();
      const rawQuery = (params.query || '').trim();
      const category = (params.category || '').trim().toLowerCase();
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(params.limit) || 30));

      let filtered = catalog;

      if (category) {
            filtered = filtered.filter(item => item.category.toLowerCase() === category);
      }

      if (rawQuery) {
            if (/^\d{8,}$/.test(rawQuery)) {
                  const noZero = rawQuery.replace(/^0+/, '');
                  filtered = filtered.filter(item => {
                        const upc = (item.upc || '').trim();
                        const ean = (item.ean || '').trim();
                        return (
                              upc === rawQuery ||
                              ean === rawQuery ||
                              (noZero.length >= 8 &&
                                    (upc.replace(/^0+/, '') === noZero || ean.replace(/^0+/, '') === noZero)) ||
                              upc.startsWith(rawQuery) ||
                              ean.startsWith(rawQuery)
                        );
                  });
            } else {
                  let query = rawQuery.toLowerCase();
                  for (const [pattern, replacement] of QUERY_ALIASES) {
                        query = query.replace(pattern, replacement);
                  }
                  query = query.replace(/\s+/g, ' ').trim();
                  const queryTokens = query.split(/\s+/).filter(Boolean);
                  const queryNoBrand = query.replace(BRAND_PREFIX_RE, '').trim();
                  const queryNoBrandTokens = queryNoBrand.split(/\s+/).filter(Boolean);

                  const scored: Array<{ item: ITradeInCatalogItem; score: number }> = [];
                  for (const item of filtered) {
                        const nameTokens = tokenizeField(`${item.brand} ${item.deviceName}`);
                        const modelTokens = tokenizeField(item.modelNumber || '');
                        const extraTokens = tokenizeField(`${item.storage} ${item.color}`);
                        const allTokens = [...nameTokens, ...modelTokens, ...extraTokens];

                        let allMatched = true;
                        let nameMatches = 0;
                        let exactMatches = 0;
                        for (const qt of queryTokens) {
                              const mAll = tokenMatches(allTokens, modelTokens, qt);
                              if (!mAll) {
                                    allMatched = false;
                                    break;
                              }
                              if (mAll === 'exact') exactMatches += 1;
                              if (tokenMatches(nameTokens, modelTokens, qt)) nameMatches += 1;
                        }
                        if (!allMatched) continue;

                        const fullName = item.deviceName.toLowerCase();
                        const shortName = fullName.replace(BRAND_PREFIX_RE, '').trim();
                        const shortModel = shortName.replace(/^galaxy\s+/i, '').trim();
                        const cleanModel = (item.modelNumber || '').replace(/^Model\s*/i, '').trim().toLowerCase();

                        let score = 0;
                        const isExact =
                              shortName === query ||
                              shortName === queryNoBrand ||
                              shortName === `iphone ${queryNoBrand}` ||
                              shortModel === query ||
                              shortModel === queryNoBrand ||
                              fullName === query;
                        if (isExact) {
                              score += 10000;
                        } else if (cleanModel && cleanModel === query) {
                              score += 9000;
                        } else if (
                              shortName.startsWith(query) ||
                              (queryNoBrand && shortName.startsWith(queryNoBrand)) ||
                              (queryNoBrand && shortModel.startsWith(queryNoBrand)) ||
                              fullName.startsWith(query)
                        ) {
                              score += 5000;
                        } else if (
                              shortName.includes(query) ||
                              (queryNoBrand && shortName.includes(queryNoBrand)) ||
                              fullName.includes(query)
                        ) {
                              score += 3500;
                        }

                        score += nameMatches === queryTokens.length ? 2000 : nameMatches * 300;
                        score += exactMatches * 150;

                        const shortNameWords = shortName.split(/\s+/).filter(Boolean);
                        const extraWords = Math.max(0, shortNameWords.length - queryNoBrandTokens.length);
                        score -= extraWords * 50;

                        if (!isExact) {
                              score += Math.min(400, Math.round((item.grades?.B?.price || 0) / 3));
                        }

                        scored.push({ item, score });
                  }

                  scored.sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        const nameCmp = a.item.deviceName.localeCompare(b.item.deviceName);
                        if (nameCmp !== 0) return nameCmp;
                        const stA = parseStorageGb(a.item.storage);
                        const stB = parseStorageGb(b.item.storage);
                        if (stA !== stB) return stA - stB;
                        return a.item.color.localeCompare(b.item.color);
                  });

                  filtered = scored.map(s => s.item);
            }
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginatedItems = filtered.slice(startIndex, startIndex + limit);

      return {
            items: paginatedItems,
            pagination: {
                  total,
                  page,
                  limit,
                  totalPages,
            },
      };
};

export default {
      searchTradeInCatalog,
      loadCatalog,
};
