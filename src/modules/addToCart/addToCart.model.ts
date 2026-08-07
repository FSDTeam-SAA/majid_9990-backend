import { model, Schema } from 'mongoose';
import { IAddToCart } from './addToCart.interface';

const addToCartSchema = new Schema<IAddToCart>(
      {
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            itemId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Inventory',
                  required: true,
            },
            quantity: {
                  type: Number,
                  required: true,
                  min: 1,
            },
            variantId: { type: Schema.Types.ObjectId },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

addToCartSchema.index({ shopkeeperId: 1, itemId: 1, variantId: 1 }, { unique: true });

export const AddToCart = model<IAddToCart>('AddToCart', addToCartSchema);
