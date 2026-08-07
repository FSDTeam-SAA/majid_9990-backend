import { Types } from 'mongoose';

export interface IAddToCart {
      shopkeeperId: Types.ObjectId;
      itemId: Types.ObjectId;
      quantity: number;
      variantId?: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
}

export interface IAddToCartPayload {
      shopkeeperId?: string;
      itemId?: string;
      quantity?: number;
      variantId?: string;
}
