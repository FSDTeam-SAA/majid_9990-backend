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
            purchasePrice: {
                  type: Number,
                  required: true,
            },
            expectedPrice: {
                  type: Number,
                  required: true,
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
