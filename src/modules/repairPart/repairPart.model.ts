import { Schema, model } from 'mongoose';
import {
  IRepairPartMovement,
  IRepairPartStock,
  IRepairPartVariant,
} from './repairPart.interface';

const repairPartVariantSchema = new Schema<IRepairPartVariant>(
  {
    shopkeeperId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Battery',
        'Screen',
        'Touch / Digitiser',
        'Charging port',
        'Back cover',
        'Flex cable',
        'Housing',
        'Camera',
        'Speaker',
        'Vibration motor',
        'Buttons',
        'Other parts',
      ],
      index: true,
    },
    deviceType: {
      type: String,
      required: true,
      enum: ['Phone', 'Tablet', 'Laptop', 'Other'],
      default: 'Phone',
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    modelCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    releaseYear: {
      type: String,
      trim: true,
    },
    quality: {
      type: String,
      required: true,
      enum: ['TFT', 'OLED', 'Compatible', 'Original'],
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    partName: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      enum: ['Front', 'Rear', 'Top', 'Bottom'],
    },
    buttonType: {
      type: String,
      enum: ['Volume up', 'Volume down', 'Power', 'Other'],
    },
    flexSubtype: {
      type: String,
      trim: true,
    },
    screenPlacement: {
      type: String,
      enum: ['Inner screen', 'Cover screen'],
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    minStockLevel: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

repairPartVariantSchema.index({
  shopkeeperId: 1,
  category: 1,
  brand: 1,
  modelCode: 1,
  quality: 1,
  color: 1,
  position: 1,
  screenPlacement: 1,
});

const repairPartStockSchema = new Schema<IRepairPartStock>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'RepairPartVariant',
      required: true,
      index: true,
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
      required: true,
      index: true,
    },
    onHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    reserved: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minStockLevel: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

repairPartStockSchema.index({ variantId: 1, shopId: 1 }, { unique: true });

const repairPartMovementSchema = new Schema<IRepairPartMovement>(
  {
    shopkeeperId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'RepairPartVariant',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'delivery',
        'adjustment',
        'reservation',
        'release',
        'used',
        'return',
        'transfer_out',
        'transfer_in',
      ],
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    onHandBefore: {
      type: Number,
      required: true,
    },
    onHandAfter: {
      type: Number,
      required: true,
    },
    reservedBefore: {
      type: Number,
      required: true,
    },
    reservedAfter: {
      type: Number,
      required: true,
    },
    costPrice: {
      type: Number,
    },
    sellingPrice: {
      type: Number,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    supplierName: {
      type: String,
      trim: true,
    },
    supplierStamp: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    repairRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'RepairRequest',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    sourceShopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
    },
    destinationShopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

repairPartMovementSchema.index({ shopkeeperId: 1, createdAt: -1 });

export const RepairPartVariant = model<IRepairPartVariant>(
  'RepairPartVariant',
  repairPartVariantSchema
);

export const RepairPartStock = model<IRepairPartStock>(
  'RepairPartStock',
  repairPartStockSchema
);

export const RepairPartMovement = model<IRepairPartMovement>(
  'RepairPartMovement',
  repairPartMovementSchema
);
