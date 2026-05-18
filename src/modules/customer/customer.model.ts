import { model, Schema } from 'mongoose';
import { ICustomer } from './customer.interface';

const customerSchema = new Schema<ICustomer>(
      {
            firstName: { type: String, required: true, trim: true },
            lastName: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            phone: { type: String, trim: true },
            address: { type: String, trim: true },
            shopkeeperId: { type: Schema.Types.ObjectId, ref: 'User' },
            salesMethod: { type: String, trim: true },
            actualSalePrice: { type: Number },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const Customer = model<ICustomer>('Customer', customerSchema);
