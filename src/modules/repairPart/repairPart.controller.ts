import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { RepairPartService } from './repairPart.service';
import { getShopkeeperId, getShopFromRequest } from '../shop/shop.utils';
import { Types } from 'mongoose';

const searchCatalogue = catchAsync(async (req, res) => {
  const { query, brand, deviceType } = req.query;
  const results = await RepairPartService.searchCatalogue(
    String(query || ''),
    brand ? String(brand) : undefined,
    deviceType ? String(deviceType) : undefined
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Catalogue devices retrieved',
    data: results,
  });
});

const getParts = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const shopId = (await getShopFromRequest(req)).toString();
  const { category, brand, modelName, modelCode, search } = req.query;

  const result = await RepairPartService.getParts(shopkeeperId, {
    shopId,
    category: category ? String(category) : undefined,
    brand: brand ? String(brand) : undefined,
    modelName: modelName ? String(modelName) : undefined,
    modelCode: modelCode ? String(modelCode) : undefined,
    search: search ? String(search) : undefined,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Repair parts retrieved successfully',
    data: result,
  });
});

const addDelivery = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const userId = new Types.ObjectId(String(req.user._id));
  const fallbackShopId = (await getShopFromRequest(req)).toString();

  const payload = req.body;
  if (!payload.allocations || !payload.allocations.length) {
    payload.allocations = [
      {
        shopId: fallbackShopId,
        quantity: Number(payload.deliveryQuantity) || 1,
      },
    ];
  }

  const result = await RepairPartService.addDelivery(
    shopkeeperId,
    userId,
    payload
  );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Stock delivery recorded successfully',
    data: result,
  });
});

const adjustStock = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const userId = new Types.ObjectId(String(req.user._id));
  const fallbackShopId = (await getShopFromRequest(req)).toString();

  const payload = {
    ...req.body,
    shopId: req.body.shopId || fallbackShopId,
  };

  const result = await RepairPartService.adjustStock(
    shopkeeperId,
    userId,
    payload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stock adjusted successfully',
    data: result,
  });
});

const getCompatibleParts = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const shopId = (await getShopFromRequest(req)).toString();
  const { brand, modelName, modelCode, issue, category, screenPlacement } =
    req.query;

  const result = await RepairPartService.getCompatibleParts(shopkeeperId, {
    shopId,
    brand: brand ? String(brand) : undefined,
    modelName: modelName ? String(modelName) : undefined,
    modelCode: modelCode ? String(modelCode) : undefined,
    issue: issue ? String(issue) : undefined,
    category: category ? String(category) : undefined,
    screenPlacement: screenPlacement as any,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Compatible parts retrieved successfully',
    data: result,
  });
});

const reservePart = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const userId = new Types.ObjectId(String(req.user._id));
  const fallbackShopId = (await getShopFromRequest(req)).toString();

  const payload = {
    ...req.body,
    shopId: req.body.shopId || fallbackShopId,
  };

  const result = await RepairPartService.reservePart(
    shopkeeperId,
    userId,
    payload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Part reserved for repair job successfully',
    data: result,
  });
});

const confirmUsePart = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const userId = new Types.ObjectId(String(req.user._id));
  const fallbackShopId = (await getShopFromRequest(req)).toString();

  const payload = {
    ...req.body,
    shopId: req.body.shopId || fallbackShopId,
  };

  const result = await RepairPartService.confirmUsePart(
    shopkeeperId,
    userId,
    payload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Part usage confirmed and stock deducted successfully',
    data: result,
  });
});

const releasePart = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const userId = new Types.ObjectId(String(req.user._id));
  const fallbackShopId = (await getShopFromRequest(req)).toString();

  const payload = {
    ...req.body,
    shopId: req.body.shopId || fallbackShopId,
  };

  const result = await RepairPartService.releasePart(
    shopkeeperId,
    userId,
    payload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Part reservation released successfully',
    data: result,
  });
});

const returnPart = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const userId = new Types.ObjectId(String(req.user._id));
  const fallbackShopId = (await getShopFromRequest(req)).toString();

  const payload = {
    ...req.body,
    shopId: req.body.shopId || fallbackShopId,
  };

  const result = await RepairPartService.returnPart(
    shopkeeperId,
    userId,
    payload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Unused part returned to stock successfully',
    data: result,
  });
});

const getMovements = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const shopId = (await getShopFromRequest(req)).toString();
  const { variantId, repairRequestId, type } = req.query;

  const result = await RepairPartService.getMovements(shopkeeperId, {
    shopId,
    variantId: variantId ? String(variantId) : undefined,
    repairRequestId: repairRequestId ? String(repairRequestId) : undefined,
    type: type ? String(type) : undefined,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Stock movements retrieved successfully',
    data: result,
  });
});

const getSupplierComparison = catchAsync(async (req, res) => {
  const shopkeeperId = getShopkeeperId(req.user);
  const variantId = String(req.params.variantId);

  const result = await RepairPartService.getSupplierComparisonForVariant(
    shopkeeperId,
    new Types.ObjectId(variantId)
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Supplier comparison retrieved successfully',
    data: result,
  });
});

export const repairPartController = {
  searchCatalogue,
  getParts,
  addDelivery,
  adjustStock,
  getCompatibleParts,
  reservePart,
  confirmUsePart,
  releasePart,
  returnPart,
  getMovements,
  getSupplierComparison,
};
