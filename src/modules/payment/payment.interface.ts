import { Types } from 'mongoose';

export type TPaymentStatus = 'pending' | 'paid' | 'failed';

export type TPaymentType = 'plan' | 'add_shop';

export interface IPayment {
  userId: Types.ObjectId;
  subscriptionId?: Types.ObjectId;

  amount: number;
  currency: string;

  ryftPaymentSessionId?: string;
  ryftPaymentId?: string;
  clientSecret?: string;

  // Legacy compatibility
  stripeSessionId?: string;
  stripePaymentIntentId?: string;

  paymentStatus: TPaymentStatus;

  paymentMethod?: string;

  paymentType?: TPaymentType | string;
  shopId?: Types.ObjectId;

  // Split payment & Connect fields
  isSplitPayment?: boolean;
  subAccountId?: string;
  platformFee?: number;
  platformFeePercentage?: number;
  shopkeeperAmount?: number;
  recipientUserId?: Types.ObjectId | string;

  createdAt?: Date;
  updatedAt?: Date;
}
