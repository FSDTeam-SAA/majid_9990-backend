import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import customerService from './customer.service';

const createCustomer = catchAsync(async (req, res) => {
      const userId = req.user._id;
      const result = await customerService.createCustomer(userId, req.body ?? {});

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Customer created successfully',
            data: result,
      });
});

const updateCustomer = catchAsync(async (req, res) => {
      const userId = req.user._id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await customerService.updateCustomer(id, req.body, userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customer updated successfully',
            data: result,
      });
});

const deleteCustomer = catchAsync(async (req, res) => {
      const userId = req.user._id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await customerService.deleteCustomer(id, userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customer deleted successfully',
            data: null,
      });
});

const getByShopkeeperId = catchAsync(async (req, res) => {
      const shopkeeperId = Array.isArray(req.params.shopkeeperId)
            ? req.params.shopkeeperId[0]
            : req.params.shopkeeperId;
      const result = await customerService.getByShopkeeperId(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customers fetched successfully',
            data: result,
      });
});

const getAll = catchAsync(async (req, res) => {
      const result = await customerService.getAll();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'All customers fetched successfully',
            data: result,
      });
});

const customerController = {
      createCustomer,
      updateCustomer,
      deleteCustomer,
      getByShopkeeperId,
      getAll,
};

export default customerController;
