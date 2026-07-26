import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import barcodeService from './barcode.service';

/**
 * Search product by barcode (EAN / UPC / GTIN / ISBN)
 * GET /barcode/:code
 */
const searchByBarcode = catchAsync(async (req, res) => {
      const { code } = req.params;

      const result = await barcodeService.searchByBarcode(code as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Product found successfully',
            data: result,
      });
});

/**
 * Search product by name keyword
 * GET /barcode/search?query=...
 */
const searchByName = catchAsync(async (req, res) => {
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
            sendResponse(res, {
                  statusCode: StatusCodes.BAD_REQUEST,
                  success: false,
                  message: 'Search query parameter is required',
            });
            return;
      }

      const results = await barcodeService.searchByName(query);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: `Found ${results.length} product(s)`,
            data: results,
      });
});

/**
 * Fallback search using REST API
 * GET /barcode/fallback/:code
 */
const fallbackSearch = catchAsync(async (req, res) => {
      const { code } = req.params;

      const result = await barcodeService.searchByBarcode(code as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Product found via fallback API',
            data: result,
      });
});

/**
 * Get cache statistics (for debugging/monitoring)
 * GET /barcode/cache/stats
 */
const getCacheStats = catchAsync(async (req, res) => {
      const stats = barcodeService.getCacheStats();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cache statistics retrieved',
            data: stats,
      });
});

/**
 * Clear cache (admin only - optional middleware)
 * DELETE /barcode/cache/clear
 */
const clearCache = catchAsync(async (req, res) => {
      barcodeService.clearCache();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cache cleared successfully',
      });
});

export default {
      searchByBarcode,
      searchByName,
      fallbackSearch,
      getCacheStats,
      clearCache,
};
