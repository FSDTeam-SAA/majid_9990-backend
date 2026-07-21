import { Types } from 'mongoose';

export type TCustomerDiscountStatus = 'active' | 'inactive';

export interface ICustomerDiscount {
      discountName: string;
      percentage: number;
      usageLimit?: number;
      validFrom: Date;
      until?: Date;
      shopkeeperId?: Types.ObjectId;
      status?: TCustomerDiscountStatus;
      customerId: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
}
