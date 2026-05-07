import { Schema, model } from 'mongoose';
import { IInventory } from './inventory.interface';

const inventorySchema = new Schema<IInventory>(
      {
            itemName: {
                  type: String,
                  required: true,
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
            image: {
                  public_id: String,
                  url: String,
            },
            userId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
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
