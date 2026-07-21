import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import addToCartService from './addToCart.service';

const createAddToCart = catchAsync(async (req, res) => {
      if (req.user.role === 'staff' && req.user.shopkeeperId) {
            req.body.shopkeeperId = req.user.shopkeeperId;
      }
      const result = await addToCartService.createAddToCart(req.body);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Cart item created successfully',
            data: result,
      });
});

const getAddToCartByShopkeeperId = catchAsync(async (req, res) => {
      const shopkeeperId = Array.isArray(req.params.shopkeeperId)
            ? req.params.shopkeeperId[0]
            : req.params.shopkeeperId;

      const result = await addToCartService.getAddToCartByShopkeeperId(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cart items fetched successfully',
            data: result,
      });
});

const updateAddToCart = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const result = await addToCartService.updateAddToCart(id, req.body);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cart item updated successfully',
            data: result,
      });
});

const deleteAddToCart = catchAsync(async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await addToCartService.deleteAddToCart(id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Cart item deleted successfully',
            data: null,
      });
});

const deleteAllByShopkeeperId = catchAsync(async (req, res) => {
      const shopkeeperId = Array.isArray(req.params.shopkeeperId)
            ? req.params.shopkeeperId[0]
            : req.params.shopkeeperId;

      const result = await addToCartService.deleteAllByShopkeeperId(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'All cart items deleted successfully',
            data: result,
      });
});

const addToCartController = {
      createAddToCart,
      getAddToCartByShopkeeperId,
      updateAddToCart,
      deleteAddToCart,
      deleteAllByShopkeeperId,
};

export default addToCartController;
