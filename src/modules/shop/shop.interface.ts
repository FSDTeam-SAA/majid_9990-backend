import { Types } from 'mongoose';

export interface IShopImage {
  public_id?: string;
  url?: string;
}

export interface IShop {
  _id: Types.ObjectId | string;
  shopkeeperId: Types.ObjectId;
  shopName: string;
  shopAddress: string;
  whatsappNumber?: string;
  googleReviewPageUrl?: string;
  image?: IShopImage | null;
  currency?: string;
  isDefault: boolean;
  isActive: boolean;
  activatedAt?: Date | null;
  taxEnabled?: boolean;
  taxName?: string;
  taxPercentage?: number;
  taxIncludedInPrice?: boolean;
  storeCode?: string;
  nfcToken?: string;
  nfcTokenRotatedAt?: Date | null;
  areaManager?: {
    name: string;
    email: string;
    phone: string;
    title?: string;
  };
  storeSupport?: {
    phone: string;
    email: string;
    address: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IShopEntitlement {
  multiShopEnabled: boolean;
  defaultShopId: string | null;
  activeShopId: string | null;
  shops: IShop[];
}
