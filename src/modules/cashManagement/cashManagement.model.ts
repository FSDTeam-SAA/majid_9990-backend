import { Schema, model } from 'mongoose';
import { ICashManagement } from './cashManagement.interface';

const cashManagementSchema = new Schema<ICashManagement>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  unique: true,
                  index: true,
            },
            startingDayCash: {
                  type: Number,
                  required: true,
                  min: 0,
            },
            banked: {
                  type: Number,
                  default: 0,
                  min: 0,
            },
            cashInDrawer: {
                  type: Number,
                  default: 0,
                  min: 0,
            },
            cashManagementScore: {
                  type: Number,
                  min: 0,
                  max: 100,
                  default: 0,
            },
            aiInsight: {
                  type: String,
                  trim: true,
            },
            date: {
                  type: Date,
                  default: Date.now,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

// Index for date queries
cashManagementSchema.index({ date: -1 });

export const CashManagement = model<ICashManagement>('CashManagement', cashManagementSchema);
