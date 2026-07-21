import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Customer } from '../customer/customer.model';
import { ICustomerDiscount, TCustomerDiscountStatus } from './customerDiscount.interface';
import { CustomerDiscount } from './customerDiscount.model';

const allowedStatuses: TCustomerDiscountStatus[] = ['active', 'inactive'];

const normalizeStatus = (status?: string) => {
      if (!status) {
            return 'active';
      }

      if (!allowedStatuses.includes(status as TCustomerDiscountStatus)) {
            throw new AppError('Status must be either active or inactive', StatusCodes.BAD_REQUEST);
      }

      return status as TCustomerDiscountStatus;
};

const ensureCustomerExists = async (customerId: string) => {
      const customer = await Customer.findById(customerId);

      if (!customer) {
            throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
      }

      return customer;
};

const buildShopkeeperId = (userId: string, providedShopkeeperId?: Types.ObjectId | string) => {
      return providedShopkeeperId ?? userId;
};

const validatePercentage = (percentage: unknown) => {
      if (typeof percentage !== 'number' || Number.isNaN(percentage)) {
            throw new AppError('Percentage must be a valid number', StatusCodes.BAD_REQUEST);
      }

      if (percentage < 0 || percentage > 100) {
            throw new AppError('Percentage must be between 0 and 100', StatusCodes.BAD_REQUEST);
      }
};

const validateUsageLimit = (usageLimit?: unknown) => {
      if (usageLimit === undefined || usageLimit === null) {
            return 1;
      }

      if (typeof usageLimit !== 'number' || Number.isNaN(usageLimit) || usageLimit < 1) {
            throw new AppError('Usage limit must be a number greater than or equal to 1', StatusCodes.BAD_REQUEST);
      }

      return usageLimit;
};

const validateDateRange = (validFrom: Date, until?: Date) => {
      if (until && until < validFrom) {
            throw new AppError('Until date must be greater than or equal to valid from date', StatusCodes.BAD_REQUEST);
      }
};

const createCustomerDiscount = async (userId: string, payload: Partial<ICustomerDiscount> = {}) => {
      if (!payload.discountName) {
            throw new AppError('Discount name is required', StatusCodes.BAD_REQUEST);
      }

      if (payload.percentage === undefined || payload.percentage === null) {
            throw new AppError('Percentage is required', StatusCodes.BAD_REQUEST);
      }

      if (!payload.validFrom) {
            throw new AppError('Valid from date is required', StatusCodes.BAD_REQUEST);
      }

      if (!payload.customerId) {
            throw new AppError('Customer id is required', StatusCodes.BAD_REQUEST);
      }

      validatePercentage(payload.percentage);

      const validFrom = new Date(payload.validFrom);
      if (Number.isNaN(validFrom.getTime())) {
            throw new AppError('Valid from date is invalid', StatusCodes.BAD_REQUEST);
      }

      const until = payload.until ? new Date(payload.until) : undefined;
      if (until && Number.isNaN(until.getTime())) {
            throw new AppError('Until date is invalid', StatusCodes.BAD_REQUEST);
      }

      validateDateRange(validFrom, until);
      await ensureCustomerExists(String(payload.customerId));

      const result = await CustomerDiscount.create({
            ...payload,
            validFrom,
            until,
            usageLimit: validateUsageLimit(payload.usageLimit),
            status: normalizeStatus(payload.status),
            shopkeeperId: buildShopkeeperId(userId, payload.shopkeeperId),
      });

      return result;
};

const getCustomerDiscountsByCustomerId = async (customerId: string) => {
      await ensureCustomerExists(customerId);

      return await CustomerDiscount.find({ customerId }).sort({ createdAt: -1 });
};

const updateCustomerDiscount = async (id: string, payload: Partial<ICustomerDiscount>) => {
      const existing = await CustomerDiscount.findById(id);

      if (!existing) {
            throw new AppError('Customer discount not found', StatusCodes.NOT_FOUND);
      }

      if (payload.customerId) {
            await ensureCustomerExists(String(payload.customerId));
      }

      if (payload.percentage !== undefined && payload.percentage !== null) {
            validatePercentage(payload.percentage);
      }

      if (payload.usageLimit !== undefined && payload.usageLimit !== null) {
            validateUsageLimit(payload.usageLimit);
      }

      if (payload.validFrom || payload.until) {
            const validFrom = payload.validFrom ? new Date(payload.validFrom) : new Date(existing.validFrom);
            const until = payload.until ? new Date(payload.until) : (existing.until ?? undefined);

            if (Number.isNaN(validFrom.getTime())) {
                  throw new AppError('Valid from date is invalid', StatusCodes.BAD_REQUEST);
            }

            if (until && Number.isNaN(until.getTime())) {
                  throw new AppError('Until date is invalid', StatusCodes.BAD_REQUEST);
            }

            validateDateRange(validFrom, until);
      }

      if (payload.status) {
            normalizeStatus(payload.status);
      }

      const result = await CustomerDiscount.findByIdAndUpdate(
            id,
            {
                  ...payload,
                  ...(payload.validFrom ? { validFrom: new Date(payload.validFrom) } : {}),
                  ...(payload.until ? { until: new Date(payload.until) } : {}),
                  ...(payload.status ? { status: normalizeStatus(payload.status) } : {}),
            },
            {
                  new: true,
                  runValidators: true,
            }
      );

      return result;
};

const deleteCustomerDiscount = async (id: string) => {
      const existing = await CustomerDiscount.findById(id);

      if (!existing) {
            throw new AppError('Customer discount not found', StatusCodes.NOT_FOUND);
      }

      await CustomerDiscount.findByIdAndDelete(id);

      return null;
};

const resetCustomerDiscount = async (id: string) => {
      const existing = await CustomerDiscount.findById(id);

      if (!existing) {
            throw new AppError('Customer discount not found', StatusCodes.NOT_FOUND);
      }

      const result = await CustomerDiscount.findByIdAndUpdate(
            id,
            {
                  usageLimit: 1,
                  status: 'active',
            },
            {
                  new: true,
                  runValidators: true,
            }
      );

      return result;
};

const customerDiscountService = {
      createCustomerDiscount,
      getCustomerDiscountsByCustomerId,
      updateCustomerDiscount,
      deleteCustomerDiscount,
      resetCustomerDiscount,
};

export default customerDiscountService;
