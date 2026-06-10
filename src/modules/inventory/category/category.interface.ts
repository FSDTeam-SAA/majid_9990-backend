import { Types } from 'mongoose';

export interface ICategory {
      _id?: Types.ObjectId;
      name: string;
      image?: {
            public_id: string;
            url: string;
      };
      totalItems: number;
      isActive: boolean;
      createdAt?: Date;
      updatedAt?: Date;
}

export interface ICategoryWithCount extends ICategory {
      itemCount?: number;
      subCategories?: ICategory[];
}
