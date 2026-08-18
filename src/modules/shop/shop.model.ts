import { Schema, model } from 'mongoose';
import { IShop } from './shop.interface';

const shopImageSchema = new Schema(
  {
    public_id: { type: String, trim: true },
    url: { type: String, trim: true },
  },
  { _id: false }
);

const shopSchema = new Schema<IShop>(
  {
    shopkeeperId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    shopAddress: {
      type: String,
      trim: true,
      default: '',
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: '',
    },
    googleReviewPageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: shopImageSchema,
      default: null,
    },
    currency: {
      type: String,
      uppercase: true,
      default: 'USD',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    taxEnabled: {
      type: Boolean,
      default: false,
    },
    taxName: {
      type: String,
      trim: true,
      default: 'Tax',
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxIncludedInPrice: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

shopSchema.index({ shopkeeperId: 1, isDefault: 1 });
shopSchema.index({ shopkeeperId: 1, isActive: 1 });

export const Shop = model<IShop>('Shop', shopSchema);
export default Shop;
