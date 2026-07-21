import { StatusCodes } from 'http-status-codes';
import categoryService from './category.service';
import catchAsync from '../../../utils/catchAsync';
import sendResponse from '../../../utils/sendResponse';

const createCategory = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const result = await categoryService.createCategory(req.body, req.file, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Category created successfully',
            data: result,
      });
});

const getAllCategories = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const result = await categoryService.getAllCategories(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Categories fetched successfully',
            data: result,
      });
});

const getCategoryById = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const result = await categoryService.getCategoryById(req.params.id as string, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category fetched successfully',
            data: result,
      });
});

const updateCategory = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const result = await categoryService.updateCategory(req.params.id as string, req.body, req.file, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category updated successfully',
            data: result,
      });
});

const deleteCategory = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      await categoryService.deleteCategory(req.params.id as string, shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category deleted successfully',
            data: null,
      });
});

const getCategoriesWithItemCount = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const result = await categoryService.getCategoriesWithItemCount(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Categories with item count fetched successfully',
            data: result,
      });
});

const bulkUpdateTotalItems = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      await categoryService.bulkUpdateTotalItems(shopkeeperId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'All category item counts updated successfully',
            data: null,
      });
});

export default {
      createCategory,
      getAllCategories,
      getCategoryById,
      updateCategory,
      deleteCategory,
      getCategoriesWithItemCount,
      bulkUpdateTotalItems,
};
