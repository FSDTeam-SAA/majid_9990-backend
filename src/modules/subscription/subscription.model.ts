import { model, Schema } from 'mongoose';
import { ISubscription } from './subscription.interface';

const PriceSchema = new Schema(
      {
            amount: { type: Number },
            min: { type: Number },
            max: { type: Number },
            currency: {
                  type: String,
                  required: true,
            },
      },
      { _id: false }
);

const DiscountTierSchema = new Schema(
      {
            tier: {
                  type: String,
                  enum: ['bronze', 'silver', 'diamond'],
                  required: true,
            },
            percentage: {
                  type: Number,
                  required: true,
            },
      },
      { _id: false }
);

const SubscriptionSchema = new Schema<ISubscription>(
      {
            title: {
                  type: String,
                  required: true,
                  trim: true,
            },

            badge: {
                  type: String,
                  required: true,
            },

            price: {
                  type: PriceSchema,
                  required: true,
            },

            billingModel: {
                  type: String,
                  enum: ['free', 'one-time', 'subscription'],
                  required: true,
            },

            features: [
                  {
                        type: String,
                        required: true,
                  },
            ],

            discount: {
                  type: [DiscountTierSchema],
                  default: [],
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);
export default Subscription;
