import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import inventoryService from './inventory.service';

const createInventory = catchAsync(async (req, res) => {
      const userId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;

      const payload = {
            ...req.body,
            userId,
      };

      const result = await inventoryService.createInventory(payload, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Inventory created successfully',
            data: result,
      });
});

const createInventoryFromBarcode = catchAsync(async (req, res) => {
      const effectiveUserId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : undefined;
      const { code, userId = effectiveUserId, imeiNumber, purchasePrice, currentState } = req.body;

      const result = await inventoryService.createInventoryFromBarcode(
            {
                  code,
                  userId,
                  imeiNumber,
                  purchasePrice,
                  currentState,
            },
            req.file
      );

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Inventory created from barcode successfully',
            data: result,
      });
});

const createInventoryFromBarcodeBulk = catchAsync(async (req, res) => {
      const defaultUserId = req.user.role === 'staff' && req.user.shopkeeperId
            ? String(req.user.shopkeeperId)
            : String(req.body?.userId ?? req.user?._id ?? '').trim() || undefined;
      const result = await inventoryService.createInventoryFromBarcodeBulk(req.body, defaultUserId);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Bulk inventory created from barcode successfully',
            data: result,
      });
});

const importInventoriesFromCsv = catchAsync(async (req, res) => {
      const defaultUserId = req.user.role === 'staff' && req.user.shopkeeperId
            ? String(req.user.shopkeeperId)
            : String(req.body?.userId ?? req.user?._id ?? '').trim() || undefined;
      const result = await inventoryService.importInventoriesFromCsv(req.file?.path, defaultUserId);

      sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: 'Inventory imported from CSV successfully',
            data: result,
      });
});

const getInventoryCsvTemplate = catchAsync(async (_req, res) => {
      const template = inventoryService.getInventoryCsvTemplate();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory-template.csv"');
      res.status(StatusCodes.OK).send(template);
});

const getAllInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.getAllInventory(req.query as Record<string, unknown>);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory fetched successfully',
            data: result,
      });
});

const getSingleInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.getSingleInventory(req.params.id as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory fetched successfully',
            data: result,
      });
});

const updateInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.updateInventory(req.params.id as string, req.body, req.file);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory updated successfully',
            data: result,
      });
});

const deleteInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.deleteInventory(req.params.id as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory deleted successfully',
            data: result,
      });
});

const getMyInventory = catchAsync(async (req, res) => {
      const userId = req.user.role === 'staff' && req.user.shopkeeperId ? req.user.shopkeeperId : req.user._id;

      const result = await inventoryService.getMyInventory(userId);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'My inventory fetched successfully',
            data: result,
      });
});

const getSoldInventory = catchAsync(async (req, res) => {
      const result = await inventoryService.getSoldInventory(req.query as Record<string, unknown>);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Sold inventory fetched successfully',
            data: result,
      });
});

const getInventoryByStatus = catchAsync(async (req, res) => {
      const result = await inventoryService.getInventoryByStatus(
            req.params.status as string,
            req.query as Record<string, unknown>
      );

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Inventory by status fetched successfully',
            data: result,
      });
});

const getGroupedInventoryByGroupKey = catchAsync(async (req, res) => {
      const result = await inventoryService.getGroupedInventoryByGroupKey(req.query as Record<string, unknown>);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Grouped inventory fetched successfully',
            data: result,
      });
});

const getInventoryByUserId = catchAsync(async (req, res) => {
      const { userId } = req.params;

      const result = await inventoryService.getInventoryByUserId(userId as string);

      sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'User inventory fetched successfully',
            data: result,
      });
});

export default {
      createInventory,
      createInventoryFromBarcode,
      createInventoryFromBarcodeBulk,
      importInventoriesFromCsv,
      getInventoryCsvTemplate,
      getAllInventory,
      getSoldInventory,
      getInventoryByStatus,
      getGroupedInventoryByGroupKey,
      getSingleInventory,
      updateInventory,
      deleteInventory,
      getMyInventory,
      getInventoryByUserId,
};
