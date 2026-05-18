import { Types } from 'mongoose';

export interface ICustomer {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
      address?: string;
      shopkeeperId?: Types.ObjectId;
      addedBy: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
}
