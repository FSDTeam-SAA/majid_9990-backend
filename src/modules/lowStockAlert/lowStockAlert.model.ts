import { model, Schema } from 'mongoose';
import { ILowStockAlert } from './lowStockAlert.interface';

const lowStockAlertSchema = new Schema<ILowStockAlert>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  unique: true,
            },
            minimumStock: {
                  type: Number,
                  default: 0,
                  min: 0,
            },
      },
      {
            timestamps: true,
      }
);

export const LowStockAlert = model<ILowStockAlert>('LowStockAlert', lowStockAlertSchema);
