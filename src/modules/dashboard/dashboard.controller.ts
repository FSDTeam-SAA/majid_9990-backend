import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import dashboardService from './dashboard.service';

const getDashboardStats = catchAsync(async (req, res) => {
      const shopkeeperId = req.query.shopkeeperId as string | undefined;
      const filter = (req.query.filter as 'daily' | 'monthly' | 'yearly') || 'monthly';
      const shopId = req.query.shopId as string | undefined;

      const result = await dashboardService.getDashboardStats(shopkeeperId, filter, shopId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Dashboard stats fetched successfully',
            data: result,
      });
});

export default {
      getDashboardStats,
};
