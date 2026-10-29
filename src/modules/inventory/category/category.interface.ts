import { Types } from 'mongoose';

export interface ICategory {
      _id?: Types.ObjectId;
      name: string;
      key?: string;
      shopkeeperId: Types.ObjectId;
      shopId?: Types.ObjectId;
      image?: {
            public_id: string;
            url: string;
      };
      defaultImage?: {
            public_id?: string;
            url: string;
      };
      totalItems: number;
      isActive: boolean;
      isDefault?: boolean;
      isHidden?: boolean;
      order?: number;
      createdAt?: Date;
      updatedAt?: Date;
}

export interface ICategoryWithCount extends ICategory {
      itemCount?: number;
      subCategories?: ICategory[];
}
