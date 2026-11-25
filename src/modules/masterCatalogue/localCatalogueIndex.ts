import fs from 'fs';
import path from 'path';
import {
      ICatalogueSearchParams,
      ICatalogueSearchResult,
      IMasterCatalogue,
} from './masterCatalogue.interface';

const STRUCTURED_CATALOGUE_FILES = [
      'IMOSCAN_Apple_Watch_Developer_Catalogue.json',
      'Apple_Audio_Catalogue.json',
      'IMOSCAN_Android_Mobile_Tablet_Catalogue.json',
      'IMOSCAN_Mac_Catalogue.json',
      'IMOSCAN_Laptop_PC_Monitor_Catalogue.json',
      'IMOSCAN_Components_Consoles_Home_Catalogue.json',
];

let cachedItems: Partial<IMasterCatalogue>[] | null = null;
let cachedByCode: Map<string, Partial<IMasterCatalogue>> | null = null;

/**
 * Generates normalized GTIN variants (EAN-8, UPC-A, EAN-13, GTIN-14)
 * while preserving leading zeros.
 */
export const normalizeBarcodeVariants = (rawCode: string): string[] => {
      const code = String(rawCode || '').trim();
      if (!code) return [];

      const variants = new Set<string>([code]);

      if (/^\d+$/.test(code)) {
            if (code.length === 8) {
                  variants.add(code.padStart(12, '0'));
                  variants.add(code.padStart(13, '0'));
                  variants.add(code.padStart(14, '0'));
            } else if (code.length === 12) {
                  variants.add(`0${code}`);
                  variants.add(`00${code}`);
            } else if (code.length === 13) {
                  variants.add(`0${code}`);
                  if (code.startsWith('0')) {
                        variants.add(code.substring(1));
                  }
            } else if (code.length === 14) {
                  if (code.startsWith('00')) {
                        variants.add(code.substring(2));
                        variants.add(code.substring(1));
                  } else if (code.startsWith('0')) {
                        variants.add(code.substring(1));
                  }
            }
      }

      return Array.from(variants);
};

const getCatalogueDir = (): string => {
      return path.resolve(__dirname, '../../../data/catalogue');
};

const mapStructuredRow = (r: Record<string, any>): Partial<IMasterCatalogue> | null => {
      const barcode = String(r.barcode || r.ean || r.upc || r.gtin14 || '').trim();
      if (!barcode) return null;

      const model = String(r.model || r.deviceName || '').trim();
      const deviceName = String(r.deviceName || model).trim();
      if (!model && !deviceName) return null;

      return {
            rowId: r.rowId || r.row_id || undefined,
            deviceName: deviceName || model,
            model: model || deviceName,
            brand: String(r.brand || 'Apple').trim(),
            category: r.category ? String(r.category).trim() : undefined,
            year: r.year ? Number(r.year) : undefined,
            storage: r.storage ? String(r.storage).trim() : undefined,
            colour: r.colour ? String(r.colour).trim() : undefined,
            connectivity: r.connectivity ? String(r.connectivity).trim() : undefined,
            glass: r.glass ? String(r.glass).trim() : undefined,
            modelNumber: r.modelNumber || r.model_number ? String(r.modelNumber || r.model_number).trim() : undefined,
            partNumber: r.partNumber || r.part_number ? String(r.partNumber || r.part_number).trim() : undefined,
            partBase: r.partBase || r.part_base ? String(r.partBase || r.part_base).trim() : undefined,
            upc: r.upc ? String(r.upc).trim() : undefined,
            ean: r.ean ? String(r.ean).trim() : undefined,
            gtin14: r.gtin14 ? String(r.gtin14).trim() : undefined,
            barcode,
            sku: r.sku || r.partNumber || r.part_number || undefined,
            imageUrl: r.imageUrl || r.image_url || undefined,
            imageKey: r.imageKey || r.image_key || undefined,
            sourceStatus: r.sourceStatus || 'preloaded',
            market: r.market ? String(r.market).trim() : undefined,
            specs:
                  r.specs && typeof r.specs === 'object'
                        ? r.specs
                        : typeof r.specs === 'string' && r.specs.trim()
                              ? { summary: r.specs.trim() }
                              : undefined,
            autoFillApproved: typeof r.autoFillApproved === 'boolean' ? r.autoFillApproved : true,
            isActive: true,
      };
};

const parseLegacyIpadRows = (rows: any[]): Partial<IMasterCatalogue>[] => {
      return rows
            .map((r): Partial<IMasterCatalogue> | null => {
                  const barcode = String(r.ean || r.upc || '').trim();
                  if (!barcode || !r.model) return null;
                  return {
                        rowId: r.row_id,
                        deviceName: r.device_name || r.model,
                        model: r.model,
                        brand: 'Apple',
                        category: 'Tablet',
                        year: r.year ? Number(r.year) : undefined,
                        storage: r.storage || undefined,
                        colour: r.colour || undefined,
                        connectivity: r.connectivity || undefined,
                        glass: r.glass || undefined,
                        modelNumber: r.model_number || undefined,
                        partNumber: r.part_number || undefined,
                        partBase: r.part_base || undefined,
                        upc: r.upc || undefined,
                        ean: r.ean || undefined,
                        barcode,
                        sku: r.part_number || undefined,
                        sourceStatus: r.source_status || 'preloaded',
                        market: r.market || undefined,
                        autoFillApproved: r.auto_fill_approved ?? true,
                        isActive: true,
                  };
            })
            .filter((item): item is Partial<IMasterCatalogue> => item !== null);
};

const parseLegacyIphoneRows = (rows: any[]): Partial<IMasterCatalogue>[] => {
      return rows
            .map((r): Partial<IMasterCatalogue> | null => {
                  const barcode = String(r.ean || r.upc || '').trim();
                  if (!barcode || !r.model) return null;
                  const deviceName = [r.model, r.storage, r.colour].filter(Boolean).join(' ');
                  return {
                        deviceName,
                        model: r.model,
                        brand: 'Apple',
                        category: 'Smartphone',
                        storage: r.storage || undefined,
                        colour: r.colour || undefined,
                        partNumber: r.part_number || undefined,
                        upc: r.upc || undefined,
                        ean: r.ean || undefined,
                        barcode,
                        sku: r.part_number || undefined,
                        imageUrl: r.image_url || undefined,
                        imageKey: r.image_key || undefined,
                        sourceStatus: 'preloaded',
                        market: r.market || undefined,
                        autoFillApproved: true,
                        isActive: true,
                  };
            })
            .filter((item): item is Partial<IMasterCatalogue> => item !== null);
};

/**
 * Loads all structured JSON datasets (`rows` format using IMasterCatalogue fields).
 * Reused by both `seedMasterCatalogue` and the local lookup fallback index.
 */
export const loadStructuredCatalogueItems = (catalogueDir = getCatalogueDir()): Partial<IMasterCatalogue>[] => {
      const items: Partial<IMasterCatalogue>[] = [];

      for (const fileName of STRUCTURED_CATALOGUE_FILES) {
            const filePath = path.join(catalogueDir, fileName);
            if (!fs.existsSync(filePath)) continue;
            try {
                  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                  const rows = Array.isArray(data?.rows) ? data.rows : [];
                  for (const row of rows) {
                        const mapped = mapStructuredRow(row);
                        if (mapped) items.push(mapped);
                  }
            } catch {
                  // Ignore malformed file so remaining catalogues stay usable
            }
      }

      return items;
};

const ensureLocalIndexLoaded = (): {
      items: Partial<IMasterCatalogue>[];
      byCode: Map<string, Partial<IMasterCatalogue>>;
} => {
      if (cachedItems && cachedByCode) {
            return { items: cachedItems, byCode: cachedByCode };
      }

      const catalogueDir = getCatalogueDir();
      const combined: Partial<IMasterCatalogue>[] = [];

      const ipadPath = path.join(catalogueDir, 'IMOSCAN_iPad_Barcode_Lookup.json');
      if (fs.existsSync(ipadPath)) {
            try {
                  const d = JSON.parse(fs.readFileSync(ipadPath, 'utf-8'));
                  combined.push(...parseLegacyIpadRows(Array.isArray(d?.rows) ? d.rows : []));
            } catch {
                  // Keep going
            }
      }

      const iphonePath = path.join(catalogueDir, 'IMOSCAN_iPhone_EAN_UPC_Research.json');
      if (fs.existsSync(iphonePath)) {
            try {
                  const d = JSON.parse(fs.readFileSync(iphonePath, 'utf-8'));
                  combined.push(...parseLegacyIphoneRows(Array.isArray(d?.rows) ? d.rows : []));
            } catch {
                  // Keep going
            }
      }

      combined.push(...loadStructuredCatalogueItems(catalogueDir));

      const dedupedMap = new Map<string, Partial<IMasterCatalogue>>();
      const byCode = new Map<string, Partial<IMasterCatalogue>>();

      const indexCode = (code: string | undefined, item: Partial<IMasterCatalogue>, allowVariants = true) => {
            const clean = String(code || '').trim();
            if (!clean) return;
            if (!allowVariants) {
                  if (!byCode.has(clean)) byCode.set(clean, item);
                  return;
            }
            for (const variant of normalizeBarcodeVariants(clean)) {
                  if (!byCode.has(variant)) byCode.set(variant, item);
            }
      };

      for (const item of combined) {
            if (!item.barcode) continue;
            dedupedMap.set(item.barcode, item);
            const canonical = dedupedMap.get(item.barcode)!;
            indexCode(canonical.barcode, canonical);
            indexCode(canonical.ean, canonical);
            indexCode(canonical.upc, canonical);
            indexCode(canonical.gtin14, canonical);
            indexCode(canonical.sku, canonical, false);
            indexCode(canonical.partNumber, canonical, false);
      }

      cachedItems = Array.from(dedupedMap.values());
      cachedByCode = byCode;
      return { items: cachedItems, byCode: cachedByCode };
};

export const findLocalCatalogueByBarcode = (code: string): IMasterCatalogue | null => {
      const cleanCode = String(code || '').trim();
      if (!cleanCode) return null;

      const { byCode } = ensureLocalIndexLoaded();
      for (const variant of normalizeBarcodeVariants(cleanCode)) {
            const hit = byCode.get(variant);
            if (hit) return hit as IMasterCatalogue;
      }
      return (byCode.get(cleanCode) as IMasterCatalogue) || null;
};

export const searchLocalCatalogue = (params: ICatalogueSearchParams): ICatalogueSearchResult => {
      const {
            query,
            brand,
            category,
            model,
            storage,
            colour,
            autoFillApproved,
            page = 1,
            limit = 20,
            sortOrder = 'asc',
      } = params;

      const { items } = ensureLocalIndexLoaded();
      const brandRe = brand ? new RegExp(`^${escapeRegExp(brand.trim())}$`, 'i') : null;
      const catRe = category ? new RegExp(`^${escapeRegExp(category.trim())}$`, 'i') : null;
      const modelRe = model ? new RegExp(escapeRegExp(model.trim()), 'i') : null;
      const storageRe = storage ? new RegExp(`^${escapeRegExp(storage.trim())}$`, 'i') : null;
      const colourRe = colour ? new RegExp(`^${escapeRegExp(colour.trim())}$`, 'i') : null;
      const words = query ? query.trim().toLowerCase().split(/\s+/).filter(Boolean) : [];

      const filtered = items.filter((item) => {
            if (brandRe && !brandRe.test(String(item.brand || ''))) return false;
            if (catRe && !catRe.test(String(item.category || ''))) return false;
            if (modelRe && !modelRe.test(String(item.model || ''))) return false;
            if (storageRe && !storageRe.test(String(item.storage || ''))) return false;
            if (colourRe && !colourRe.test(String(item.colour || ''))) return false;
            if (typeof autoFillApproved === 'boolean' && item.autoFillApproved !== autoFillApproved) return false;
            if (words.length > 0) {
                  const hay = [
                        item.deviceName,
                        item.model,
                        item.partNumber,
                        item.modelNumber,
                        item.barcode,
                        item.upc,
                        item.ean,
                        item.brand,
                  ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();
                  if (!words.every((w) => hay.includes(w))) return false;
            }
            return true;
      });

      filtered.sort((a, b) => {
            const cmp = String(a.deviceName || '').localeCompare(String(b.deviceName || ''));
            return sortOrder === 'desc' ? -cmp : cmp;
      });

      const currentPage = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(limit)));
      const skip = (currentPage - 1) * pageSize;
      const results = filtered.slice(skip, skip + pageSize) as IMasterCatalogue[];
      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize);

      return {
            results,
            pagination: {
                  total,
                  page: currentPage,
                  limit: pageSize,
                  totalPages,
                  hasNextPage: currentPage < totalPages,
                  hasPrevPage: currentPage > 1,
            },
      };
};

export const getLocalCatalogueStats = () => {
      const { items } = ensureLocalIndexLoaded();
      const brands = Array.from(new Set(items.map((i) => i.brand).filter(Boolean) as string[])).sort();
      const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort();
      const autoFillApprovedCount = items.filter((i) => i.autoFillApproved).length;

      return {
            totalItems: items.length,
            totalBrands: brands.length,
            brands,
            totalCategories: categories.length,
            categories,
            autoFillApprovedCount,
            reviewPendingCount: items.length - autoFillApprovedCount,
      };
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
