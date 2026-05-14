import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import lowStockAlertService from './lowStockAlert.service';

const createLowStockAlert = catchAsync(async (req, res) => {
      const shopkeeperId = req.user._id as string;
      const result = await lowStockAlertService.createLowStockAlert(req.body, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Low stock alert created successfully',
            data: result,
      });
});

const updateLowStockAlert = catchAsync(async (req, res) => {
      const shopkeeperId = req.user._id as string;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await lowStockAlertService.updateLowStockAlert(id, req.body, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Low stock alert updated successfully',
            data: result,
      });
});

const deleteLowStockAlert = catchAsync(async (req, res) => {
      const shopkeeperId = req.user._id as string;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await lowStockAlertService.deleteLowStockAlert(id, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Low stock alert deleted successfully',
            data: null,
      });
});

const getLowStockAlert = catchAsync(async (req, res) => {
      const shopkeeperId = req.user._id as string;
      const result = await lowStockAlertService.getLowStockAlert(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Low stock alert retrieved successfully',
            data: result,
      });
});

const getLowStockAlertById = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await lowStockAlertService.getLowStockAlertById(id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Low stock alert retrieved successfully',
            data: result,
      });
});

const lowStockAlertController = {
      createLowStockAlert,
      updateLowStockAlert,
      deleteLowStockAlert,
      getLowStockAlert,
      getLowStockAlertById,
};

export default lowStockAlertController;
