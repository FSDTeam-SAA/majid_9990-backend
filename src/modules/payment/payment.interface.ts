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

  paymentType?: TPaymentType;
  shopId?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}
