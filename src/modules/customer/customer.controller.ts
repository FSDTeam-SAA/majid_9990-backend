import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import customerService from './customer.service';

const createCustomer = catchAsync(async (req, res) => {
      const userId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      if (req.user.role === 'staff' && req.user.shopkeeperId) {
            req.body.shopkeeperId = req.user.shopkeeperId;
      }
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
      let shopkeeperId = Array.isArray(req.params.shopkeeperId) ? req.params.shopkeeperId[0] : req.params.shopkeeperId;
      if (req.user.role === 'staff' && req.user.shopkeeperId) {
            shopkeeperId = req.user.shopkeeperId.toString();
      }
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

const sendEmailToCustomers = catchAsync(async (req, res) => {
      const shopkeeperId =
            req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId.toString() : req.user._id;
      const result = await customerService.sendEmailToCustomers(shopkeeperId, req.body ?? {});

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Email sent successfully',
            data: result,
      });
});

const customerController = {
      createCustomer,
      updateCustomer,
      deleteCustomer,
      getByShopkeeperId,
      getAll,
      sendEmailToCustomers,
};

export default customerController;
