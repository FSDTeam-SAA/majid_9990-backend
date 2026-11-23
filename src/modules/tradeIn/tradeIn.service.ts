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

const searchTradeInCatalog = async (params: ITradeInSearchParams): Promise<ITradeInSearchResult> => {
      const catalog = loadCatalog();
      const query = (params.query || '').trim().toLowerCase();
      const category = (params.category || '').trim().toLowerCase();
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(params.limit) || 30));

      let filtered = catalog;

      if (category) {
            filtered = filtered.filter(item => item.category.toLowerCase() === category);
      }

      if (query) {
            const queryTokens = query.split(/\s+/).filter(Boolean);
            filtered = filtered.filter(item => {
                  const searchStr = `${item.deviceName} ${item.modelNumber} ${item.storage} ${item.color} ${item.upc || ''} ${item.ean || ''}`.toLowerCase();
                  return queryTokens.every(token => searchStr.includes(token));
            });

            // Rank relevance: exact match or model number match higher
            filtered.sort((a, b) => {
                  const aName = `${a.deviceName} ${a.modelNumber}`.toLowerCase();
                  const bName = `${b.deviceName} ${b.modelNumber}`.toLowerCase();
                  const aStarts = aName.startsWith(query);
                  const bStarts = bName.startsWith(query);
                  if (aStarts && !bStarts) return -1;
                  if (!aStarts && bStarts) return 1;
                  return 0;
            });
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
