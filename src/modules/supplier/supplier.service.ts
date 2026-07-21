import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { Inventory } from '../inventory/inventory.model';
import { ISupplier } from './supplier.interface';
import { Supplier } from './supplier.model';

const createSupplier = async (userId: string, payload: Partial<ISupplier>) => {
  if (payload.email) {
    const exists = await Supplier.findOne({ email: payload.email });
    if (exists) {
      throw new AppError('Supplier with this email already exists', StatusCodes.CONFLICT);
    }
  }

  const result = await Supplier.create({ ...payload, createdBy: userId });
  return result;
};

const getAllSuppliers = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string;
}) => {
  const { page = 1, limit = 10, search, isActive } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);

  return {
    suppliers,
    meta: {
      total,
      page,
      limit,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const getSupplierById = async (id: string) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new AppError('Supplier not found', StatusCodes.NOT_FOUND);
  }

  const [deliveryHistory, inventoryStats] = await Promise.all([
    Inventory.find({ supplierId: id }).sort({ createdAt: -1 }),
    Inventory.aggregate([
      { $match: { supplierId: supplier._id } },
      {
        $group: {
          _id: null,
          totalStockValue: { $sum: '$purchasePrice' },
          totalDeliveries: { $sum: 1 },
        },
      },
    ]),
  ]);

  const totalDeliveries = inventoryStats[0]?.totalDeliveries ?? 0;
  const totalStockValue = inventoryStats[0]?.totalStockValue ?? 0;

  return {
    supplier,
    totalDeliveries,
    totalStockValue,
    deliveryHistory,
  };
};

const updateSupplier = async (id: string, payload: Partial<ISupplier>) => {
  const existing = await Supplier.findById(id);
  if (!existing) {
    throw new AppError('Supplier not found', StatusCodes.NOT_FOUND);
  }

  if (payload.email && payload.email !== existing.email) {
    const duplicate = await Supplier.findOne({ email: payload.email, _id: { $ne: id } });
    if (duplicate) {
      throw new AppError('Supplier with this email already exists', StatusCodes.CONFLICT);
    }
  }

  const result = await Supplier.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });
  return result;
};

const deleteSupplier = async (id: string) => {
  const existing = await Supplier.findById(id);
  if (!existing) {
    throw new AppError('Supplier not found', StatusCodes.NOT_FOUND);
  }

  await Supplier.findByIdAndUpdate(id, { isActive: false });
  return null;
};

const supplierService = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};

export default supplierService;
