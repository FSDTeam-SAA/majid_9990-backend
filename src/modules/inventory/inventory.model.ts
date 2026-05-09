import { Schema, model } from 'mongoose';
import { IInventory } from './inventory.interface';

const inventorySchema = new Schema<IInventory>(
      {
            itemName: {
                  type: String,
                  required: true,
                  trim: true,
            },
            sku: {
                  type: String,
                  trim: true,
            },
            brand: {
                  type: String,
                  trim: true,
            },
            color: {
                  type: String,
                  trim: true,
            },
            storage: {
                  type: String,
                  trim: true,
            },
            size: {
                  type: String,
                  trim: true,
            },
            imeiNumber: {
                  type: String,
                  required: true,
                  unique: true,
            },
            modelNumber: {
                  type: String,
            },
            quantity: {
                  type: Number,
                  default: 0,
            },
            purchasePrice: {
                  type: Number,
            },
            expectedPrice: {
                  type: Number,
            },
            productDetails: {
                  type: String,
            },
            aiDescription: {
                  type: String,
            },
            groupKey: {
                  type: String,
                  trim: true,
                  index: true,
            },
            minStockLevel: {
                  type: Number,
                  default: 0,
                  min: 0,
            },
            type: {
                  type: String,
                  enum: ['inventory', 'sold'],
                  default: 'inventory',
                  index: true,
            },
            status: {
                  type: String,
                  enum: ['inventory', 'sold', 'due', 'draft'],
                  default: 'inventory',
                  index: true,
            },
            image: {
                  public_id: String,
                  url: String,
            },
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
            },
            supplierId: {
                  type: Schema.Types.ObjectId,
            },
            storeId: {
                  type: Schema.Types.ObjectId,
            },
            currentState: {
                  type: String,
                  enum: ['new', 'good condition'],
                  default: 'new',
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

export const Inventory = model<IInventory>('Inventory', inventorySchema);
