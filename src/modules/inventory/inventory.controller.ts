import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import inventoryService from './inventory.service';

const createInventory = catchAsync(async (req, res) => {
      const userId = req.user._id;

      const payload = {
            ...req.body,
            userId,
      };

      const result = await inventoryService.createInventory(payload, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Inventory created successfully',
            data: result,
      });
});

const getAllInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.getAllInventory();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory fetched successfully',
            data: result,
      });
});

const getSingleInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.getSingleInventory(req.params.id as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory fetched successfully',
            data: result,
      });
});

const updateInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.updateInventory(req.params.id as string, req.body, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory updated successfully',
            data: result,
      });
});

const deleteInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.deleteInventory(req.params.id as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory deleted successfully',
            data: result,
      });
});

const getMyInventory = catchAsync(async (req, res) => {
      const userId = req.user._id;

      const result = await inventoryService.getMyInventory(userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'My inventory fetched successfully',
            data: result,
      });
});

const getInventoryByUserId = catchAsync(async (req, res) => {
      const { userId } = req.params;

      const result = await inventoryService.getInventoryByUserId(userId as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'User inventory fetched successfully',
            data: result,
      });
});

export default {
      createInventory,
      getAllInventory,
      getSingleInventory,
      updateInventory,
      deleteInventory,
      getMyInventory,
      getInventoryByUserId,
};