import { Schema, model } from 'mongoose';
import { ISoldProduct, SoldProductModel } from './soldProduct.interface';

const soldProductSchema = new Schema<ISoldProduct>(
      {
            name: { type: String, required: true },
            imeiNumber: { type: String, required: true },
            model: { type: String, required: true },
            quantity: { type: Number, required: true },
            purchasePrice: { type: Number, required: true },
            expectedPrice: { type: Number, required: true },
            paidAmount: { type: Number, required: true },
            remainingDue: { type: Number, required: true },
            dueDate: { type: Date, required: true },

            image: {
                  public_id: String,
                  url: String,
            },

            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const SoldProduct = model<ISoldProduct, SoldProductModel>('SoldProduct', soldProductSchema);
