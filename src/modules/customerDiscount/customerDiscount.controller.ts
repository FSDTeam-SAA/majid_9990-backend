import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import customerDiscountService from './customerDiscount.service';

const getShopkeeperIdFromUser = (user: any) => {
      return user.role === 'staff' && user.shopkeeperId ? user.shopkeeperId.toString() : user._id.toString();
};

const createCustomerDiscount = catchAsync(async (req, res) => {
      const userId = getShopkeeperIdFromUser(req.user);

      if (req.user.role === 'staff' && req.user.shopkeeperId) {
            req.body.shopkeeperId = req.user.shopkeeperId;
      }

      const result = await customerDiscountService.createCustomerDiscount(userId, req.body ?? {});

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Customer discount created successfully',
            data: result,
      });
});

const getCustomerDiscountsByCustomerId = catchAsync(async (req, res) => {
      const customerId = Array.isArray(req.params.customerId) ? req.params.customerId[0] : req.params.customerId;
      const result = await customerDiscountService.getCustomerDiscountsByCustomerId(customerId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customer discounts fetched successfully',
            data: result,
      });
});

const updateCustomerDiscount = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await customerDiscountService.updateCustomerDiscount(id, req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customer discount updated successfully',
            data: result,
      });
});

const deleteCustomerDiscount = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await customerDiscountService.deleteCustomerDiscount(id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customer discount deleted successfully',
            data: null,
      });
});

const resetCustomerDiscount = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await customerDiscountService.resetCustomerDiscount(id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Customer discount reset successfully',
            data: result,
      });
});

const customerDiscountController = {
      createCustomerDiscount,
      getCustomerDiscountsByCustomerId,
      updateCustomerDiscount,
      deleteCustomerDiscount,
      resetCustomerDiscount,
};

export default customerDiscountController;
