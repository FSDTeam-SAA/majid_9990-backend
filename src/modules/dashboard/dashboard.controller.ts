import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import dashboardService from './dashboard.service';

const adminDashboardChart = catchAsync(async (req, res) => {
      const result = await dashboardService.adminDashboardChart(req.query);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Admin dashboard chart fetched',
            data: result,
      });
});

const getAdminDashboardAnalytics = catchAsync(async (req, res) => {
      const result = await dashboardService.getAdminDashboardAnalytics();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Admin dashboard analytics fetched',
            data: result,
      });
});

const getShopkeeperDashboardAnalytics = catchAsync(async (req, res) => {
      const { id } = req.user;
      const result = await dashboardService.getShopkeeperDashboardAnalytics(id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Shopkeeper dashboard analytics fetched',
            data: result,
      });
});

const dashboardController = {
      adminDashboardChart,
      getAdminDashboardAnalytics,
      getShopkeeperDashboardAnalytics,
};

export default dashboardController;
