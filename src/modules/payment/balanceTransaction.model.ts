import { model, Schema } from 'mongoose';
import { IBalanceTransaction } from './balanceTransaction.interface';

const balanceTransactionSchema = new Schema<IBalanceTransaction>(
      {
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  index: true,
            },
            transactionType: {
                  type: String,
                  enum: ['credit', 'debit'],
                  required: true,
            },
            source: {
                  type: String,
                  enum: ['payment', 'imei_service', 'refund'],
                  required: true,
            },
            amount: {
                  type: Number,
                  required: true,
            },
            currency: {
                  type: String,
                  required: true,
                  trim: true,
            },
            balanceBefore: {
                  type: Number,
                  required: true,
            },
            balanceAfter: {
                  type: Number,
                  required: true,
            },
            description: {
                  type: String,
                  required: true,
                  trim: true,
            },
            referenceId: {
                  type: String,
                  trim: true,
            },
            paymentId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Payment',
            },
            serviceId: {
                  type: Number,
            },
            serviceName: {
                  type: String,
                  trim: true,
            },
            imei: {
                  type: String,
                  trim: true,
            },
            metadata: {
                  type: Schema.Types.Mixed,
                  default: {},
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const BalanceTransaction = model<IBalanceTransaction>('BalanceTransaction', balanceTransactionSchema);
