import { Types } from 'mongoose';

export interface ICashManagement {
      _id?: Types.ObjectId;
      shopkeeperId: Types.ObjectId;
      startingDayCash: number;
      banked: number;
      cashInDrawer: number;
      cashManagementScore?: number;
      aiInsight?: string;
      currency?: string;
      date: Date;
      createdAt?: Date;
      updatedAt?: Date;
}

export interface ICashManagementInput {
      shopkeeperId: string;
      startingDayCash: number;
      banked?: number;
      cashInDrawer?: number;
      currency?: string;
      currencySymbol?: string;
}

export interface ICashManagementWithAI extends ICashManagement {
      cashManagementScore: number;
      aiInsight: string;
}
