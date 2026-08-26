import { Schema, model } from 'mongoose';
import { IPayment } from './payment.interface';

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    ryftPaymentSessionId: String,
    ryftPaymentId: String,
    clientSecret: String,
    stripeSessionId: String,
    stripePaymentIntentId: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: 'RyftPay',
    },
    paymentType: {
      type: String,
      default: 'plan',
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
    },
    isSplitPayment: {
      type: Boolean,
      default: false,
    },
    subAccountId: {
      type: String,
      default: null,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    platformFeePercentage: {
      type: Number,
      default: 2,
    },
    shopkeeperAmount: {
      type: Number,
      default: 0,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ ryftPaymentSessionId: 1 });
paymentSchema.index({ subAccountId: 1 });
paymentSchema.index({ recipientUserId: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
