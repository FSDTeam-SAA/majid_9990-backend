import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import categoryService from './category.service';

const createCategory = catchAsync(async (req, res) => {
      const result = await categoryService.createCategory(req.body, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Category created successfully',
            data: result,
      });
});

const getAllCategories = catchAsync(async (req, res) => {
      const result = await categoryService.getAllCategories();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Categories fetched successfully',
            data: result,
      });
});

const getCategoryById = catchAsync(async (req, res) => {
      const result = await categoryService.getCategoryById(req.params.id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category fetched successfully',
            data: result,
      });
});

const updateCategory = catchAsync(async (req, res) => {
      const result = await categoryService.updateCategory(req.params.id, req.body, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category updated successfully',
            data: result,
      });
});

const deleteCategory = catchAsync(async (req, res) => {
      await categoryService.deleteCategory(req.params.id);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category deleted successfully',
            data: null,
      });
});

const getCategoriesWithItemCount = catchAsync(async (req, res) => {
      const result = await categoryService.getCategoriesWithItemCount();

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Categories with item count fetched successfully',
            data: result,
      });
});

const bulkUpdateTotalItems = catchAsync(async (req, res) => {
      await categoryService.bulkUpdateTotalItems();

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
