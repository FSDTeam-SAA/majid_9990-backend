import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import shopService from './shop.service';

const getMyShops = catchAsync(async (req, res) => {
  const shops = await shopService.getMyShops(req.user);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shops fetched successfully',
    data: shops,
  });
});

const getEntitlement = catchAsync(async (req, res) => {
  const result = await shopService.getEntitlement(req.user);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop entitlement fetched successfully',
    data: result,
  });
});

const getShopById = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const shop = await shopService.getShopById(req.user, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop fetched successfully',
    data: shop,
  });
});

const createShop = catchAsync(async (req, res) => {
  const result = await shopService.createShop(req.user, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Shop created successfully. Complete the payment to activate it.',
    data: result,
  });
});

const updateShop = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const shop = await shopService.updateShop(req.user, id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop updated successfully',
    data: shop,
  });
});

const deleteShop = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await shopService.deleteShop(req.user, id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop deleted successfully',
    data: result,
  });
});

const getShopPerformance = catchAsync(async (req, res) => {
  const result = await shopService.getShopPerformance(req.user, req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop performance fetched successfully',
    data: result,
  });
});

const getUploadedImages = catchAsync(async (req, res) => {
  const images = await shopService.getUploadedImages(req.user);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Uploaded images fetched successfully',
    data: images,
  });
});

const shopController = {
  getMyShops,
  getEntitlement,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
  getShopPerformance,
  getUploadedImages,
};

export default shopController;
