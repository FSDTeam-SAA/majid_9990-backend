import { StatusCodes } from "http-status-codes";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import dashboardService from "./dashboard.service";


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




const dashboardController = {
      adminDashboardChart,
      getAdminDashboardAnalytics,
};

export default dashboardController;
