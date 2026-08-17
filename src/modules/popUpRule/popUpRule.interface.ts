import { Types } from 'mongoose';

export interface IRecommendedItem {
      itemType: 'category' | 'inventory';
      itemId: Types.ObjectId;
}

export interface IPopUpRule {
      _id?: Types.ObjectId;
      categoryId: Types.ObjectId;
      recommendedItems: IRecommendedItem[];
      trigger: string;
      status: 'active' | 'inactive';
      autoPopupReminder: boolean;
      shopkeeperId: Types.ObjectId;
      shopId?: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
}
