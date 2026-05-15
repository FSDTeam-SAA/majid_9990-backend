import { model, Schema } from 'mongoose';
import { IInvoice } from './invoice.interface';

const invoiceSchema = new Schema<IInvoice>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            invoice: {
                  public_id: {
                        type: String,
                        required: true,
                        trim: true,
                  },
                  url: {
                        type: String,
                        required: true,
                        trim: true,
                  },
                  resource_type: {
                        type: String,
                        required: true,
                        enum: ['raw'],
                        default: 'raw',
                  },
            },
            type: {
                  type: String,
                  required: true,
                  trim: true,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);
