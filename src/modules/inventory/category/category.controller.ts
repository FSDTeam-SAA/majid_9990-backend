import { StatusCodes } from 'http-status-codes';
import categoryService from './category.service';
import catchAsync from '../../../utils/catchAsync';
import sendResponse from '../../../utils/sendResponse';
import { getShopFromRequest } from '../../shop/shop.utils';

const createCategory = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const result = await categoryService.createCategory(req.body, req.file, shopkeeperId, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Category created successfully',
            data: result,
      });
});

const getAllCategories = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const result = await categoryService.getAllCategories(shopkeeperId, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Categories fetched successfully',
            data: result,
      });
});

const getCategoryById = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const result = await categoryService.getCategoryById(req.params.id as string, shopkeeperId, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category fetched successfully',
            data: result,
      });
});

const updateCategory = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const result = await categoryService.updateCategory(req.params.id as string, req.body, req.file, shopkeeperId, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category updated successfully',
            data: result,
      });
});

const deleteCategory = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      await categoryService.deleteCategory(req.params.id as string, shopkeeperId, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category deleted successfully',
            data: null,
      });
});

const getCategoriesWithItemCount = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const includeHidden = req.query.includeHidden === 'true';
      const result = await categoryService.getCategoriesWithItemCount(shopkeeperId, storeId, includeHidden);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Categories with item count fetched successfully',
            data: result,
      });
});

const getAllCategoriesIncludingHidden = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const result = await categoryService.getCategoriesWithItemCount(shopkeeperId, storeId, true);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'All categories including hidden fetched successfully',
            data: result,
      });
});

const toggleCategoryVisibility = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const isHidden = Boolean(req.body.isHidden);
      const result = await categoryService.toggleCategoryVisibility(req.params.id as string, shopkeeperId, isHidden, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: isHidden ? 'Category hidden successfully' : 'Category restored successfully',
            data: result,
      });
});

const resetCategoryImage = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      const result = await categoryService.resetCategoryImage(req.params.id as string, shopkeeperId, storeId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Category image reset to default successfully',
            data: result,
      });
});

const bulkUpdateTotalItems = catchAsync(async (req, res) => {
      const shopkeeperId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;
      const storeId = await getShopFromRequest(req);
      await categoryService.bulkUpdateTotalItems(shopkeeperId, storeId);

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
      getAllCategoriesIncludingHidden,
      toggleCategoryVisibility,
      resetCategoryImage,
      bulkUpdateTotalItems,
};
