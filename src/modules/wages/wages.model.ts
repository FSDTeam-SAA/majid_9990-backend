import { Schema, model } from 'mongoose';
import { IPayPeriod } from './wages.interface';

const payPeriodSchema = new Schema<IPayPeriod>(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'exceptions_resolved', 'owner_approved', 'locked'],
      default: 'draft',
    },
    totalWorkedHours: {
      type: Number,
      default: 0,
    },
    totalPaidLeaveHours: {
      type: Number,
      default: 0,
    },
    totalGrossPay: {
      type: Number,
      default: 0,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

payPeriodSchema.index({ shopId: 1, year: 1, month: 1 }, { unique: true });

export const PayPeriod = model<IPayPeriod>('PayPeriod', payPeriodSchema);
export default PayPeriod;
