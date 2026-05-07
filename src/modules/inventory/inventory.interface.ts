import { Types, model } from 'mongoose';

export type TCondition = 'new' | 'good condition';

export interface IInventory {
      itemName: string;
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
      currentState?: TCondition;
}
