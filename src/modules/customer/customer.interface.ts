import { Types } from 'mongoose';

export interface ICustomer {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
      address?: string;
      shopkeeperId?: Types.ObjectId;
      shopId?: Types.ObjectId | null;
      salesMethod?: string;
      actualSalePrice?: number;
      paymentType?: string;
      alreadyPaid?: number;
      customerId?: string;
      bankName?: string;
      accountHolderName?: string;
      accountNumber?: string;
      sortCode?: string;
      createdAt?: Date;
      updatedAt?: Date;
}
