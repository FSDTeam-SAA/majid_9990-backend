import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import supplierService from './supplier.service';

const createSupplier = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const result = await supplierService.createSupplier(userId, req.body ?? {});

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Supplier created successfully',
    data: result,
  });
});

const getAllSuppliers = catchAsync(async (req, res) => {
  const { page, limit, search, isActive } = req.query;
  const result = await supplierService.getAllSuppliers({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: search as string | undefined,
    isActive: isActive as string | undefined,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Suppliers retrieved successfully',
    data: result.suppliers,
    meta: result.meta,
  });
});

const getSupplierById = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await supplierService.getSupplierById(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Supplier retrieved successfully',
    data: result,
  });
});

const updateSupplier = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await supplierService.updateSupplier(id, req.body);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Supplier updated successfully',
    data: result,
  });
});

const deleteSupplier = catchAsync(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await supplierService.deleteSupplier(id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Supplier deactivated successfully',
    data: null,
  });
});

const supplierController = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};

export default supplierController;
