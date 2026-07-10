import { model, Schema } from 'mongoose';
import { ICustomerDiscount } from './customerDiscount.interface';

const customerDiscountSchema = new Schema<ICustomerDiscount>(
      {
            discountName: { type: String, required: true, trim: true },
            percentage: { type: Number, required: true, min: 0, max: 100 },
            usageLimit: { type: Number, default: 1, min: 1 },
            validFrom: { type: Date, required: true },
            until: { type: Date },
            shopkeeperId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            status: {
                  type: String,
                  enum: ['active', 'inactive'],
                  default: 'active',
            },
            customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const CustomerDiscount = model<ICustomerDiscount>('CustomerDiscount', customerDiscountSchema);
