import { model, Schema } from 'mongoose';
import { IInvoice } from './invoice.interface';

const invoiceSchema = new Schema<IInvoice>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            shopId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Shop',
                  default: null,
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
            lineItems: [{ itemId: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true }, quantity: { type: Number, required: true, min: 1 }, variantId: { type: Schema.Types.ObjectId } }],
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

            taxName: { type: String, default: null },
            taxIncludedInPrice: { type: Boolean, default: null },
            tax: {
                  type: Number,
                  default: null,
            },

            paymentMethod: {
                  type: String,
                  trim: true,
                  default: null,
            },
            paymentStatus: {
                  type: String,
                  enum: ['paid', 'partial', 'due'],
                  default: null,
            },
            paymentDetails: {
                  amountReceived: { type: Number, default: null },
                  changeGiven: { type: Number, default: null },
                  cardholderName: { type: String, trim: true, default: null },
                  cardLastFour: { type: String, trim: true, default: null },
                  bankName: { type: String, trim: true, default: null },
                  accountLastFour: { type: String, trim: true, default: null },
                  transactionReference: { type: String, trim: true, default: null },
                  amountPaid: { type: Number, default: null },
                  dueAmount: { type: Number, default: null },
                  dueDate: { type: Date, default: null },
                  notes: { type: String, trim: true, default: null },
            },
            amountPaid: {
                  type: Number,
                  default: null,
            },
            invoiceNumber: {
                  type: String,
                  trim: true,
                  default: null,
            },
            currency: {
                  type: String,
                  trim: true,
                  uppercase: true,
                  default: null,
            },
            orderDetails: {
                  checkoutMode: { type: String, trim: true, default: null },
                  marketplace: { type: String, trim: true, default: null },
                  orderNumber: { type: String, trim: true, default: null },
                  deliveryFrom: { type: String, trim: true, default: null },
                  deliveryTo: { type: String, trim: true, default: null },
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
            idImages: {
                  front: {
                        url: { type: String, trim: true, default: null },
                        public_id: { type: String, trim: true, default: null },
                  },
                  back: {
                        url: { type: String, trim: true, default: null },
                        public_id: { type: String, trim: true, default: null },
                  },
                  deleteAfter: { type: Date, default: null },
                  isDeleted: { type: Boolean, default: false },
                  deletedAt: { type: Date, default: null },
            },
            idImageDeleteAfter: {
                  type: Date,
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
invoiceSchema.index({ shopkeeperId: 1, shopId: 1, createdAt: -1 });
invoiceSchema.index({ shopkeeperId: 1, customerInfo: 1, createdAt: -1 });
invoiceSchema.index({ shopId: 1, customerInfo: 1, createdAt: -1 });
invoiceSchema.index({ idImageDeleteAfter: 1 });
invoiceSchema.index({ 'idImages.deleteAfter': 1, 'idImages.isDeleted': 1 });
