import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import masterCatalogueService from './masterCatalogue.service';

/**
 * Search master catalogue with debounce & pagination support
 * GET /master-catalogue/search?query=...&page=1&limit=20
 */
const searchCatalogue = catchAsync(async (req, res) => {
      const {
            query,
            brand,
            category,
            model,
            storage,
            colour,
            autoFillApproved,
            page,
            limit,
            sortBy,
            sortOrder,
      } = req.query;

      const result = await masterCatalogueService.searchCatalogue({
            query: typeof query === 'string' ? query : undefined,
            brand: typeof brand === 'string' ? brand : undefined,
            category: typeof category === 'string' ? category : undefined,
            model: typeof model === 'string' ? model : undefined,
            storage: typeof storage === 'string' ? storage : undefined,
            colour: typeof colour === 'string' ? colour : undefined,
            autoFillApproved:
                  autoFillApproved !== undefined ? autoFillApproved === 'true' : undefined,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
            sortBy: typeof sortBy === 'string' ? sortBy : 'deviceName',
            sortOrder: sortOrder === 'desc' ? 'desc' : 'asc',
      });

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: `Found ${result.results.length} item(s)`,
            data: result.results,
            meta: {
                  page: result.pagination.page,
                  limit: result.pagination.limit,
                  total: result.pagination.total,
                  totalPage: result.pagination.totalPages,
            },
      });
});

/**
 * Lookup by barcode in master catalogue
 * GET /master-catalogue/barcode/:code
 */
const findByBarcode = catchAsync(async (req, res) => {
      const { code } = req.params;

      const item = await masterCatalogueService.findByBarcode(code as string);

      if (!item) {
            sendResponse(res, {
                  statusCode: StatusCodes.NOT_FOUND,
                  success: false,
                  message: 'Item not found in master catalogue',
            });
            return;
      }

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Master catalogue item found',
            data: item,
      });
});

/**
 * Get single item by ID
 * GET /master-catalogue/:id
 */
const getById = catchAsync(async (req, res) => {
      const { id } = req.params;

      const item = await masterCatalogueService.getById(id as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Master catalogue item details',
            data: item,
      });
});

/**
 * Save or confirm a product variant in the master catalogue
 * POST /master-catalogue
 */
const saveVariant = catchAsync(async (req, res) => {
      const variant = await masterCatalogueService.saveVariant(req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Master catalogue variant saved successfully',
            data: variant,
      });
});

/**
 * Bulk upsert variants
 * POST /master-catalogue/bulk
 */
const bulkUpsert = catchAsync(async (req, res) => {
      const { items } = req.body;

      if (!Array.isArray(items)) {
            sendResponse(res, {
                  statusCode: StatusCodes.BAD_REQUEST,
                  success: false,
                  message: 'items array is required',
            });
            return;
      }

      const result = await masterCatalogueService.bulkUpsert(items);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: `Bulk upsert completed: ${result.insertedCount} inserted, ${result.modifiedCount} modified`,
            data: result,
      });
});

/**
 * Get master catalogue statistics
 * GET /master-catalogue/stats
 */
const getStats = catchAsync(async (_req, res) => {
      const stats = await masterCatalogueService.getStats();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Master catalogue stats retrieved',
            data: stats,
      });
});

export default {
      searchCatalogue,
      findByBarcode,
      getById,
      saveVariant,
      bulkUpsert,
      getStats,
};
