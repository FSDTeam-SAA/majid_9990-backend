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
            customerInfo: {
                  type: Schema.Types.ObjectId,
                  ref: 'Customer',
                  default: null,
            },
            itemsIds: {
                  type: [Schema.Types.ObjectId],
                  ref: 'Inventory',
                  default: [],
            },
            totalAmount: {
                  type: Number,
                  default: null,
            },

            dueAmount: {
                  type: Number,
                  default: null,
            },

            repairRequestId: {
                  type: Schema.Types.ObjectId,
                  ref: 'RepairRequest',
                  default: null,
            },

            tax: {
                  type: Number,
                  default: null,
            },

            paymentMethod: {
                  type: String,
                  trim: true,
                  default: null,
            },
            discountName: {
                  type: String,
                  trim: true,
                  default: null,
            },
            discountPercentage: {
                  type: Number,
                  default: null,
            },
            discountAmount: {
                  type: Number,
                  default: null,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const Invoice = model<IInvoice>('Invoice', invoiceSchema);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ shopkeeperId: 1, createdAt: -1 });
