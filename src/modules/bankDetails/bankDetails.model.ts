import { model, Schema } from 'mongoose';
import { IBankDetail } from './bankDetails.interface';

const bankDetailSchema = new Schema<IBankDetail>(
      {
            accountHolderName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            bankName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            accountNumber: {
                  type: String,
                  required: true,
                  trim: true,
            },
            sortCode: {
                  type: String,
                  trim: true,
                  default: null,
            },
            branchName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            routingNumber: {
                  type: String,
                  required: true,
                  trim: true,
            },
            currency: {
                  type: String,
                  required: true,
                  trim: true,
            },
            country: {
                  type: String,
                  required: true,
                  trim: true,
            },
            currentBalance: {
                  type: Number,
                  required: true,
                  min: 0,
            },
            addedBy: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            invoiceId: {
                  type: String,
                  required: true,
                  trim: true,
                  unique: true,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const BankDetail = model<IBankDetail>('BankDetail', bankDetailSchema);
