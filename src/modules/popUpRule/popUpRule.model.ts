import { Schema, model } from 'mongoose';
import { IPopUpRule } from './popUpRule.interface';

const recommendedItemSchema = new Schema(
      {
            itemType: {
                  type: String,
                  enum: ['category', 'inventory'],
                  required: true,
            },
            itemId: {
                  type: Schema.Types.ObjectId,
                  required: true,
                  // ref is dynamic, so we might not put a hardcoded ref here, but we can query dynamically
            },
      },
      { _id: false }
);

const popUpRuleSchema = new Schema<IPopUpRule>(
      {
            categoryId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Category',
                  required: true,
                  index: true,
            },
            recommendedItems: [recommendedItemSchema],
            trigger: {
                  type: String,
                  default: 'show_on_checkout',
            },
            status: {
                  type: String,
                  enum: ['active', 'inactive'],
                  default: 'active',
            },
            autoPopupReminder: {
                  type: Boolean,
                  default: true,
            },
            shopkeeperId: {
                  type: Schema.Types.ObjectId,
                  ref: 'User',
                  required: true,
                  index: true,
            },
            shopId: {
                  type: Schema.Types.ObjectId,
                  ref: 'Shop',
                  index: true,
            },
      },
      {
            timestamps: true,
            versionKey: false,
      }
);

popUpRuleSchema.index({ categoryId: 1, shopkeeperId: 1, shopId: 1 }, { unique: true });

export const PopUpRule = model<IPopUpRule>('PopUpRule', popUpRuleSchema);
