import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { ICustomer } from './customer.interface';
import { Customer } from './customer.model';

const createCustomer = async (userId: string, payload: Partial<ICustomer> = {}) => {
      // Optional: prevent duplicate by phone or email
      if (payload.email) {
            const exists = await Customer.findOne({ email: payload.email });
            if (exists) {
                  throw new AppError('Customer with this email already exists', StatusCodes.CONFLICT);
            }
      }

      const result = await Customer.create({
            ...payload,
            shopkeeperId: payload.shopkeeperId ?? userId,
      });

      return result;
};

const updateCustomer = async (id: string, payload: Partial<ICustomer>, userId: string) => {
      const existing = await Customer.findOne({ _id: id });

      if (!existing) {
            throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
      }

      return await Customer.findOneAndUpdate({ _id: id }, payload, {
            new: true,
            runValidators: true,
      });
};

const deleteCustomer = async (id: string, userId: string) => {
      const existing = await Customer.findOne({ _id: id });

      if (!existing) {
            throw new AppError('Customer not found', StatusCodes.NOT_FOUND);
      }

      await Customer.findOneAndDelete({ _id: id });

      return null;
};

const getByShopkeeperId = async (shopkeeperId: string) => {
      return await Customer.find({ shopkeeperId }).sort({ createdAt: -1 });
};

const getAll = async () => {
      return await Customer.find().sort({ createdAt: -1 });
};

const customerService = {
      createCustomer,
      updateCustomer,
      deleteCustomer,
      getByShopkeeperId,
      getAll,
};

export default customerService;
