import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import cashManagementService from './cashManagement.service';

const createOrUpdateCashManagement = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.body.shopkeeperId;
      const { startingDayCash, banked, cashInDrawer } = req.body;

      const result = await cashManagementService.createOrUpdateCashManagement({
            shopkeeperId,
            startingDayCash,
            banked,
            cashInDrawer,
      });

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Cash management record saved successfully',
            data: result,
      });
});

const getCashManagementByShopkeeper = catchAsync(async (req, res) => {
      const { shopkeeperId } = req.params;

      const result = await cashManagementService.getCashManagementByShopkeeper(shopkeeperId as string);

      if (!result) {
            return sendResponse(res, {
                  statusCode: StatusCodes.NOT_FOUND,
                  success: false,
                  message: 'Cash management record not found for this shopkeeper',
                  data: null,
        });
      }

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cash management record fetched successfully',
            data: result,
      });
});

const getAllCashManagementRecords = catchAsync(async (req, res) => {
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;

      const result = await cashManagementService.getAllCashManagementRecords(limit, skip);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cash management records fetched successfully',
            data: result.data,
            meta: {
                  total: result.total,
                  limit,
                  page: Math.floor(skip / limit) + 1,
                  totalPage: Math.ceil(result.total / limit),
            },
      });
});

const deleteCashManagement = catchAsync(async (req, res) => {
      const { shopkeeperId } = req.params;

      await cashManagementService.deleteCashManagement(shopkeeperId as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cash management record deleted successfully',
            data: null,
      });
});

const getCashManagementStats = catchAsync(async (req, res) => {
      const { shopkeeperId } = req.params;

      const result = await cashManagementService.getCashManagementStats(shopkeeperId as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cash management stats fetched successfully',
            data: result,
      });
});

export default {
      createOrUpdateCashManagement,
      getCashManagementByShopkeeper,
      getAllCashManagementRecords,
      deleteCashManagement,
      getCashManagementStats,
};
