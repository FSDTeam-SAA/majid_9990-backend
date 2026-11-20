import { FilterQuery, Types } from 'mongoose';
import AppError from '../../errors/AppError';
import {
      ICatalogueSearchParams,
      ICatalogueSearchResult,
      IMasterCatalogue,
} from './masterCatalogue.interface';
import { MasterCatalogue } from './masterCatalogue.model';

/**
 * Normalizes barcode strings and generates equivalent variations (UPC-A, EAN-13, GTIN-14)
 */
export const normalizeBarcodeVariants = (rawCode: string): string[] => {
      const code = String(rawCode || '').trim();
      if (!code) return [];

      const variants = new Set<string>();
      variants.add(code);

      // Handle pure digits (UPC-A / EAN-13 / GTIN-14)
      if (/^\d+$/.test(code)) {
            if (code.length === 12) {
                  // UPC-A -> EAN-13 (add leading 0), GTIN-14 (add leading 00)
                  variants.add(`0${code}`);
                  variants.add(`00${code}`);
            } else if (code.length === 13 && code.startsWith('0')) {
                  // EAN-13 with leading 0 -> UPC-A, GTIN-14
                  variants.add(code.substring(1));
                  variants.add(`0${code}`);
            } else if (code.length === 14 && code.startsWith('00')) {
                  // GTIN-14 with leading 00 -> UPC-A, EAN-13
                  variants.add(code.substring(2));
                  variants.add(code.substring(1));
            } else if (code.length === 14 && code.startsWith('0')) {
                  // GTIN-14 with leading 0 -> EAN-13
                  variants.add(code.substring(1));
            }
      }

      return Array.from(variants);
};

/**
 * Fast indexed lookup by barcode (UPC / EAN / GTIN / SKU / Part Number)
 */
const findByBarcode = async (code: string): Promise<IMasterCatalogue | null> => {
      const cleanCode = String(code || '').trim();
      if (!cleanCode) return null;

      const codeVariants = normalizeBarcodeVariants(cleanCode);

      // Indexed query matching barcode, UPC, EAN, GTIN-14, SKU, or partNumber
      const item = await MasterCatalogue.findOne({
            $or: [
                  { barcode: { $in: codeVariants } },
                  { ean: { $in: codeVariants } },
                  { upc: { $in: codeVariants } },
                  { gtin14: { $in: codeVariants } },
                  { sku: cleanCode },
                  { partNumber: cleanCode },
            ],
            isActive: true,
      }).lean();

      return item;
};

/**
 * Lightweight, paginated search on server for shopkeeper auto-complete / search
 * Optimized for low bandwidth & fast mobile response (10-20 items per page)
 */
const searchCatalogue = async (params: ICatalogueSearchParams): Promise<ICatalogueSearchResult> => {
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
            sortBy = 'deviceName',
            sortOrder = 'asc',
      } = params;

      const filter: FilterQuery<IMasterCatalogue> = { isActive: true };

      if (brand) {
            filter.brand = { $regex: new RegExp(`^${brand.trim()}$`, 'i') };
      }

      if (category) {
            filter.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
      }

      if (model) {
            filter.model = { $regex: new RegExp(model.trim(), 'i') };
      }

      if (storage) {
            filter.storage = { $regex: new RegExp(`^${storage.trim()}$`, 'i') };
      }

      if (colour) {
            filter.colour = { $regex: new RegExp(`^${colour.trim()}$`, 'i') };
      }

      if (typeof autoFillApproved === 'boolean') {
            filter.autoFillApproved = autoFillApproved;
      }

      if (query && query.trim().length > 0) {
            const cleanQuery = query.trim();
            const words = cleanQuery.split(/\s+/).filter(Boolean);

            // Match all tokens for flexible search: e.g. "iPhone 17 Pro 512"
            if (words.length > 1) {
                  filter.$and = words.map((word) => ({
                        $or: [
                              { deviceName: { $regex: word, $options: 'i' } },
                              { model: { $regex: word, $options: 'i' } },
                              { partNumber: { $regex: word, $options: 'i' } },
                              { modelNumber: { $regex: word, $options: 'i' } },
                              { barcode: { $regex: word, $options: 'i' } },
                        ],
                  }));
            } else {
                  filter.$or = [
                        { deviceName: { $regex: cleanQuery, $options: 'i' } },
                        { model: { $regex: cleanQuery, $options: 'i' } },
                        { partNumber: { $regex: cleanQuery, $options: 'i' } },
                        { modelNumber: { $regex: cleanQuery, $options: 'i' } },
                        { barcode: cleanQuery },
                        { upc: cleanQuery },
                        { ean: cleanQuery },
                  ];
            }
      }

      const currentPage = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(limit)));
      const skip = (currentPage - 1) * pageSize;

      // Project lightweight fields only (Keep payload small per client instructions!)
      const projection = {
            deviceName: 1,
            model: 1,
            brand: 1,
            category: 1,
            year: 1,
            storage: 1,
            colour: 1,
            connectivity: 1,
            glass: 1,
            modelNumber: 1,
            partNumber: 1,
            barcode: 1,
            upc: 1,
            ean: 1,
            sku: 1,
            imageUrl: 1,
            autoFillApproved: 1,
            sourceStatus: 1,
      };

      const sortOptions: Record<string, 1 | -1> = {
            [sortBy]: sortOrder === 'desc' ? -1 : 1,
      };

      const [results, total] = await Promise.all([
            MasterCatalogue.find(filter, projection).sort(sortOptions).skip(skip).limit(pageSize).lean(),
            MasterCatalogue.countDocuments(filter),
      ]);

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

/**
 * Retrieve single complete product variant details by Mongo ID
 */
const getById = async (id: string): Promise<IMasterCatalogue> => {
      if (!Types.ObjectId.isValid(id)) {
            throw new AppError('Invalid catalogue item ID', 400);
      }

      const item = await MasterCatalogue.findById(id).lean();
      if (!item) {
            throw new AppError('Master catalogue item not found', 404);
      }

      return item;
};

/**
 * Save or update a product variant into the master catalogue
 * (Used when a shopkeeper confirms an unlisted or external lookup item)
 */
const saveVariant = async (data: Partial<IMasterCatalogue>): Promise<IMasterCatalogue> => {
      const barcode = String(data.barcode || data.ean || data.upc || '').trim();
      if (!barcode) {
            throw new AppError('Barcode (or EAN/UPC) is required to save catalogue item', 400);
      }

      const cleanModel = String(data.model || '').trim();
      const cleanDeviceName = String(data.deviceName || `${data.brand || ''} ${cleanModel}`).trim();

      const payload: Partial<IMasterCatalogue> = {
            ...data,
            barcode,
            model: cleanModel || cleanDeviceName,
            deviceName: cleanDeviceName || cleanModel,
            brand: String(data.brand || 'Apple').trim(),
            sourceStatus: data.sourceStatus || 'user-verified',
            autoFillApproved: typeof data.autoFillApproved === 'boolean' ? data.autoFillApproved : true,
      };

      // Normalise barcode representations if missing
      if (/^\d{12}$/.test(barcode) && !payload.upc) payload.upc = barcode;
      if (/^\d{13}$/.test(barcode) && !payload.ean) payload.ean = barcode;
      if (/^\d{14}$/.test(barcode) && !payload.gtin14) payload.gtin14 = barcode;

      const updated = await MasterCatalogue.findOneAndUpdate(
            { barcode },
            { $set: payload },
            { upsert: true, new: true, runValidators: true }
      ).lean();

      return updated;
};

/**
 * Bulk upsert variants (Used by catalogue import/seeding scripts)
 */
const bulkUpsert = async (
      items: Partial<IMasterCatalogue>[]
): Promise<{ insertedCount: number; modifiedCount: number; total: number }> => {
      if (!items || items.length === 0) {
            return { insertedCount: 0, modifiedCount: 0, total: 0 };
      }

      const operations = items
            .map((item) => {
                  const barcode = String(item.barcode || item.ean || item.upc || '').trim();
                  if (!barcode) return null;

                  return {
                        updateOne: {
                              filter: { barcode },
                              update: {
                                    $set: {
                                          ...item,
                                          barcode,
                                          updatedAt: new Date(),
                                    },
                                    $setOnInsert: {
                                          createdAt: new Date(),
                                    },
                              },
                              upsert: true,
                        },
                  };
            })
            .filter((op): op is NonNullable<typeof op> => op !== null);

      if (operations.length === 0) {
            return { insertedCount: 0, modifiedCount: 0, total: 0 };
      }

      const result = await MasterCatalogue.bulkWrite(operations as any, { ordered: false });

      return {
            insertedCount: result.upsertedCount,
            modifiedCount: result.modifiedCount,
            total: operations.length,
      };
};

/**
 * Get statistics of the master catalogue
 */
const getStats = async () => {
      const [totalCount, brands, categories, autoApprovedCount] = await Promise.all([
            MasterCatalogue.countDocuments({ isActive: true }),
            MasterCatalogue.distinct('brand', { isActive: true }),
            MasterCatalogue.distinct('category', { isActive: true }),
            MasterCatalogue.countDocuments({ isActive: true, autoFillApproved: true }),
      ]);

      return {
            totalItems: totalCount,
            totalBrands: brands.length,
            brands,
            totalCategories: categories.length,
            categories,
            autoFillApprovedCount: autoApprovedCount,
            reviewPendingCount: totalCount - autoApprovedCount,
      };
};

export default {
      findByBarcode,
      searchCatalogue,
      getById,
      saveVariant,
      bulkUpsert,
      getStats,
      normalizeBarcodeVariants,
};
