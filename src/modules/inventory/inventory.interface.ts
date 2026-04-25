import { Types } from 'mongoose';

export type TCondition = 'new' | 'good condition';

export interface IInventory {
      itemName: string;
      imeiNumber: string;
      purchasePrice: number;
      expectedPrice: number;
      image?: {
            public_id: string;
            url: string;
      };
      userId: Types.ObjectId;
      currentState: TCondition;
}
