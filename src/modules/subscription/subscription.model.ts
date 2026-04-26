import { Schema, model } from 'mongoose';
import { IPlanFeature, ISubscription } from './subscription.interface';

const planFeatureSchema = new Schema<IPlanFeature>(
      {
            name: {
                  type: String,
                  required: true,
                  trim: true,
            },
            included: {
                  type: Boolean,
                  required: true,
                  default: false,
            },
      },
      {
            _id: false,
      }
);

const subscriptionSchema = new Schema<ISubscription>(
      {
            name: {
                  type: String,
                  required: true,
                  trim: true,
            },

            type: {
                  type: String,
                  enum: ['STARTER', 'PAY AS YOU GO', 'DIAMOND', 'ENTERPRISE'],
                  required: true,
            },

            price: {
                  type: Number,
                  required: true,
                  min: 0,
            },

            priceLabel: {
                  type: String,
                  required: true,
            },

            description: {
                  type: String,
                  required: true,
            },

            features: {
                  type: [planFeatureSchema],
                  default: [],
            },

            isPopular: {
                  type: Boolean,
                  default: false,
            },

            discount: {
                  type: Number,
                  min: 0,
                  max: 100,
            },

            apiAccess: {
                  type: Boolean,
                  default: false,
            },

            customPricing: {
                  type: Boolean,
                  default: false,
            },

            ctaText: {
                  type: String,
                  required: true,
            },
            isAvailable: {
                  type: Boolean,
                  default: true,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

const Subscription = model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription;
