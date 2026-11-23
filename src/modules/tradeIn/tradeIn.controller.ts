import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import tradeInService from './tradeIn.service';

const searchCatalog = catchAsync(async (req, res) => {
      const { query, category, page, limit } = req.query;

      const result = await tradeInService.searchTradeInCatalog({
            query: typeof query === 'string' ? query : undefined,
            category: typeof category === 'string' ? category : undefined,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 30,
      });

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: `Found ${result.items.length} trade-in device(s)`,
            data: result.items,
            meta: {
                  page: result.pagination.page,
                  limit: result.pagination.limit,
                  total: result.pagination.total,
                  totalPage: result.pagination.totalPages,
            },
      });
});

export default {
      searchCatalog,
};
