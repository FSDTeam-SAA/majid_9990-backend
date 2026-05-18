import { Types } from 'mongoose';

export interface ICustomer {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
      address?: string;
      shopkeeperId?: Types.ObjectId;
      salesMethod?: string;
      actualSalePrice?: number;
      createdAt?: Date;
      updatedAt?: Date;
}
