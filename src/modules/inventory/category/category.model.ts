import { Schema, model } from 'mongoose';
import { ICategory } from './category.interface';

const categorySchema = new Schema<ICategory>(
      {
            name: {
                  type: String,
                  required: true,
                  trim: true,
                  unique: true,
            },
            image: {
                  public_id: String,
                  url: String,
            },
            totalItems: {
                  type: Number,
                  default: 0,
                  min: 0,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const Category = model<ICategory>('Category', categorySchema);
