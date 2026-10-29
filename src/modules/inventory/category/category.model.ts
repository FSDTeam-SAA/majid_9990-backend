import { Schema, model } from 'mongoose';
import { ICategory } from './category.interface';

const categorySchema = new Schema<ICategory>(
      {
            name: {
                  type: String,
                  required: true,
                  trim: true,
            },
            key: {
                  type: String,
                  trim: true,
            },
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  index: true,
            },
            shopId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Shop',
                  index: true,
            },
            image: {
                  public_id: String,
                  url: String,
            },
            defaultImage: {
                  public_id: String,
                  url: String,
            },
            totalItems: {
                  type: Number,
                  default: 0,
                  min: 0,
            },
            isActive: {
                  type: Boolean,
                  default: true,
            },
            isDefault: {
                  type: Boolean,
                  default: false,
            },
            isHidden: {
                  type: Boolean,
                  default: false,
            },
            order: {
                  type: Number,
                  default: 0,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

categorySchema.index({ name: 1, shopkeeperId: 1, shopId: 1 }, { unique: true });

export const Category = model<ICategory>('Category', categorySchema);
