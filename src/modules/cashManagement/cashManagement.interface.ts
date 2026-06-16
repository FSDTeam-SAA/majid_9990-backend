import { Types } from 'mongoose';

export interface ICashManagement {
      _id?: Types.ObjectId;
      shopkeeperId: Types.ObjectId;
      startingDayCash: number;
      banked: number;
      cashInDrawer: number;
      cashManagementScore?: number;
      aiInsight?: string;
      date: Date;
      createdAt?: Date;
      updatedAt?: Date;
}

export interface ICashManagementInput {
      shopkeeperId: string;
      startingDayCash: number;
      banked?: number;
      cashInDrawer?: number;
}

export interface ICashManagementWithAI extends ICashManagement {
      cashManagementScore: number;
      aiInsight: string;
}
