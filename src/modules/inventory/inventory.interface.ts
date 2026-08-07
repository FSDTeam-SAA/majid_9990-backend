import { Types } from 'mongoose';

export type TCondition = 'new' | 'good condition';
export type TInventoryType = 'inventory' | 'sold';
export type TInventoryStatus = 'inventory' | 'sold' | 'due' | 'draft';

export interface IInventoryVariant {
      _id?: Types.ObjectId;
      purchasePrice?: number;
      expectedPrice?: number;
      quantity: number;
      color?: string;
      storage?: string;
      imeiNumber?: string;
      currentState?: TCondition;
      image?: { public_id: string; url: string };
      supplierId?: Types.ObjectId;
}

export interface IInventory {
      itemName: string;
      categoryId?: Types.ObjectId;
      sku?: string;
      brand?: string;
      color?: string[];
      storage?: string[];
      size?: string;
      imeiNumber: string;
      modelNumber?: string;
      quantity?: number;
      purchasePrice?: number;
      expectedPrice?: number;
      salePrice?: number;
      saleQuantity?: number;
      saleMethod?: string;
      productDetails?: string;
      aiDescription?: string;
      image?: {
            public_id: string;
            url: string;
      };
      images?: string[];
      sourceImageUrl?: string;
      sourceImageUrls?: string[];
      userId: Types.ObjectId;
      supplierId?: Types.ObjectId;
      storeId?: Types.ObjectId;
      groupKey?: string;
      minStockLevel?: number;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      customerAddress?: string;
      type?: TInventoryType;
      status?: TInventoryStatus;
      currentState?: TCondition;
      variants?: IInventoryVariant[];
}
