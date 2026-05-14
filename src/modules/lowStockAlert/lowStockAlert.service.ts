import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { StatusCodes } from 'http-status-codes';
import { ILowStockAlert } from './lowStockAlert.interface';
import { LowStockAlert } from './lowStockAlert.model';

const createLowStockAlert = async (payload: Partial<ILowStockAlert>, shopkeeperId: string): Promise<ILowStockAlert> => {
      // Check if alert already exists for this shopkeeper
      const existingAlert = await LowStockAlert.findOne({
            shopkeeperId: new Types.ObjectId(shopkeeperId),
      });

      if (existingAlert) {
            throw new AppError('Low stock alert already exists for this shopkeeper', StatusCodes.CONFLICT);
      }

      const alertData = {
            shopkeeperId: new Types.ObjectId(shopkeeperId),
            minimumStock: payload.minimumStock || 0,
      };

      const result = await LowStockAlert.create(alertData);
      return result;
};

const updateLowStockAlert = async (
      id: string,
      payload: Partial<ILowStockAlert>,
      shopkeeperId: string
): Promise<ILowStockAlert> => {
      // Verify ownership
      const alert = await LowStockAlert.findById(id);

      if (!alert) {
            throw new AppError('Low stock alert not found', StatusCodes.NOT_FOUND);
      }

      if (alert.shopkeeperId.toString() !== shopkeeperId) {
            throw new AppError('You do not have permission to update this alert', StatusCodes.FORBIDDEN);
      }

      const updatedAlert = await LowStockAlert.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
      });

      if (!updatedAlert) {
            throw new AppError('Low stock alert not found', StatusCodes.NOT_FOUND);
      }

      return updatedAlert;
};

const deleteLowStockAlert = async (id: string, shopkeeperId: string): Promise<void> => {
      // Verify ownership
      const alert = await LowStockAlert.findById(id);

      if (!alert) {
            throw new AppError('Low stock alert not found', StatusCodes.NOT_FOUND);
      }

      if (alert.shopkeeperId.toString() !== shopkeeperId) {
            throw new AppError('You do not have permission to delete this alert', StatusCodes.FORBIDDEN);
      }

      await LowStockAlert.findByIdAndDelete(id);
};

const getLowStockAlert = async (shopkeeperId: string): Promise<ILowStockAlert | null> => {
      const alert = await LowStockAlert.findOne({
            shopkeeperId: new Types.ObjectId(shopkeeperId),
      });

      return alert;
};

const getLowStockAlertById = async (id: string): Promise<ILowStockAlert | null> => {
      const alert = await LowStockAlert.findById(id);
      return alert;
};

const lowStockAlertService = {
      createLowStockAlert,
      updateLowStockAlert,
      deleteLowStockAlert,
      getLowStockAlert,
      getLowStockAlertById,
};

export default lowStockAlertService;
