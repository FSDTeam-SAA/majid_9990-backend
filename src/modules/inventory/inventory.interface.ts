import { Types } from 'mongoose';

export type TCondition = 'new' | 'good condition';
export type TInventoryType = 'inventory' | 'sold';
export type TInventoryStatus = 'inventory' | 'sold' | 'due' | 'draft';

export interface IInventory {
      itemName: string;
      sku?: string;
      brand?: string;
      color?: string;
      storage?: string;
      size?: string;
      imeiNumber: string;
      modelNumber?: string;
      quantity?: number;
      purchasePrice?: number;
      expectedPrice?: number;
      productDetails?: string;
      aiDescription?: string;
      image?: {
            public_id: string;
            url: string;
      };
      userId: Types.ObjectId;
      supplierId?: Types.ObjectId;
      storeId?: Types.ObjectId;
      groupKey?: string;
      minStockLevel?: number;
      type?: TInventoryType;
      status?: TInventoryStatus;
      currentState?: TCondition;
}
