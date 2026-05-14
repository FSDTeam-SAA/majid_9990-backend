import { Types } from 'mongoose';

export interface ILowStockAlert {
      shopkeeperId: Types.ObjectId;
      minimumStock: number;
      createdAt?: Date;
      updatedAt?: Date;
}
