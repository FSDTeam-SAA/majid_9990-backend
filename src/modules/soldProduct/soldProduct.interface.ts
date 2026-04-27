import { Types } from 'mongoose';

export interface ISoldProduct {
      name: string;
      imeiNumber: string;
      model: string;
      quantity: number;
      purchasePrice: number;
      expectedPrice: number;
      paidAmount: number;
      remainingDue: number;
      dueDate: Date;
      image?: {
            public_id: string;
            url: string;
      };
      shopkeeperId: Types.ObjectId;
}

export type SoldProductModel = {
      // future static methods if needed
};
