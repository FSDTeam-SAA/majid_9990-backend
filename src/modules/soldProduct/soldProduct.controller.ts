import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { soldProductService } from './soldProduct.service';

const createSoldProduct = catchAsync(async (req, res) => {
      const userId = req.user.id;

      const result = await soldProductService.createSoldProduct({ ...req.body, shopkeeperId: userId }, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Sold product created successfully',
            data: result,
      });
});

const getMySoldProducts = catchAsync(async (req, res) => {
      const userId = req.user.id;

      const result = await soldProductService.getMySoldProducts(userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Sold products retrieved successfully',
            data: result,
      });
});

const updateSoldProduct = catchAsync(async (req, res) => {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await soldProductService.updateSoldProduct(id as string, req.body, req.file, userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Sold product updated successfully',
            data: result,
      });
});

const deleteSoldProduct = catchAsync(async (req, res) => {
      const userId = req.user.id;
      const { id } = req.params;

      await soldProductService.deleteSoldProduct(id as string, userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Sold product deleted successfully',
            data: null,
      });
});

export const soldProductController = {
      createSoldProduct,
      getMySoldProducts,
      updateSoldProduct,
      deleteSoldProduct,
};
