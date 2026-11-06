import { Types } from 'mongoose';

export type TRepairPartCategory =
  | 'Battery'
  | 'Screen'
  | 'Touch / Digitiser'
  | 'Charging port'
  | 'Back cover'
  | 'Flex cable'
  | 'Housing'
  | 'Camera'
  | 'Speaker'
  | 'Vibration motor'
  | 'Buttons'
  | 'Other parts';

export type TDeviceType = 'Phone' | 'Tablet' | 'Laptop' | 'Other';
export type TPartQuality = 'TFT' | 'OLED' | 'Compatible' | 'Original';
export type TMovementType =
  | 'delivery'
  | 'adjustment'
  | 'reservation'
  | 'release'
  | 'used'
  | 'return'
  | 'transfer_out'
  | 'transfer_in';

export interface IRepairPartVariant {
  _id?: Types.ObjectId;
  shopkeeperId: Types.ObjectId;
  category: TRepairPartCategory;
  deviceType: TDeviceType;
  brand: string;
  modelName: string;
  modelCode: string;
  releaseYear?: string;
  quality: TPartQuality;
  sku: string;
  partName?: string;
  color?: string;
  size?: string;
  position?: 'Front' | 'Rear' | 'Top' | 'Bottom';
  buttonType?: 'Volume up' | 'Volume down' | 'Power' | 'Other';
  flexSubtype?: string;
  screenPlacement?: 'Inner screen' | 'Cover screen';
  sellingPrice: number;
  costPrice?: number;
  minStockLevel?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRepairPartStock {
  _id?: Types.ObjectId;
  variantId: Types.ObjectId;
  shopkeeperId: Types.ObjectId;
  shopId: Types.ObjectId;
  onHand: number;
  reserved: number;
  minStockLevel?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRepairPartMovement {
  _id?: Types.ObjectId;
  shopkeeperId: Types.ObjectId;
  shopId: Types.ObjectId;
  variantId: Types.ObjectId;
  type: TMovementType;
  quantity: number;
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  costPrice?: number;
  sellingPrice?: number;
  supplierId?: Types.ObjectId;
  supplierName?: string;
  supplierStamp?: string;
  reason?: string;
  repairRequestId?: Types.ObjectId;
  userId?: Types.ObjectId;
  sourceShopId?: Types.ObjectId;
  destinationShopId?: Types.ObjectId;
  createdAt?: Date;
}

export interface IAddDeliveryPayload {
  variant: {
    category: TRepairPartCategory;
    deviceType: TDeviceType;
    brand: string;
    modelName: string;
    modelCode: string;
    releaseYear?: string;
    quality: TPartQuality;
    sku?: string;
    partName?: string;
    color?: string;
    size?: string;
    position?: 'Front' | 'Rear' | 'Top' | 'Bottom';
    buttonType?: 'Volume up' | 'Volume down' | 'Power' | 'Other';
    flexSubtype?: string;
    screenPlacement?: 'Inner screen' | 'Cover screen';
    sellingPrice: number;
    costPrice?: number;
    minStockLevel?: number;
  };
  deliveryQuantity: number;
  costPrice: number;
  sellingPrice: number;
  supplierId?: string;
  supplierName?: string;
  supplierStamp?: string;
  minStockReminder?: number;
  allocations: Array<{
    shopId: string;
    quantity: number;
  }>;
}

export interface IAdjustStockPayload {
  variantId: string;
  shopId: string;
  newQuantity: number;
  reason: string;
}

export interface IReservePartPayload {
  variantId: string;
  shopId: string;
  repairRequestId: string;
  quantity?: number;
}

export interface IConfirmUsePartPayload {
  variantId: string;
  shopId: string;
  repairRequestId: string;
  quantity?: number;
}

export interface IReleasePartPayload {
  variantId: string;
  shopId: string;
  repairRequestId: string;
  quantity?: number;
}

export interface IReturnPartPayload {
  variantId: string;
  shopId: string;
  repairRequestId: string;
  quantity?: number;
  reason?: string;
}
