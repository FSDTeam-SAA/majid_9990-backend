import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { PopUpRule } from './popUpRule.model';
import { IPopUpRule } from './popUpRule.interface';
import { Inventory } from '../inventory/inventory.model';

const createRule = async (shopkeeperId: string, payload: Partial<IPopUpRule>) => {
      // Check if a rule for this category already exists
      if (payload.categoryId) {
            const exists = await PopUpRule.findOne({ categoryId: payload.categoryId, shopkeeperId });
            if (exists) {
                  throw new AppError('A pop-up rule for this category already exists', StatusCodes.CONFLICT);
            }
      }

      const result = await PopUpRule.create({
            ...payload,
            shopkeeperId,
      });

      return result;
};

const updateRule = async (id: string, payload: Partial<IPopUpRule>, shopkeeperId: string) => {
      const existing = await PopUpRule.findOne({ _id: id, shopkeeperId });

      if (!existing) {
            throw new AppError('Pop-up rule not found', StatusCodes.NOT_FOUND);
      }

      return await PopUpRule.findOneAndUpdate({ _id: id, shopkeeperId }, payload, {
            new: true,
            runValidators: true,
      });
};

const deleteRule = async (id: string, shopkeeperId: string) => {
      const existing = await PopUpRule.findOne({ _id: id, shopkeeperId });

      if (!existing) {
            throw new AppError('Pop-up rule not found', StatusCodes.NOT_FOUND);
      }

      await PopUpRule.findOneAndDelete({ _id: id, shopkeeperId });

      return null;
};

const getRules = async (shopkeeperId: string, query: Record<string, unknown> = {}) => {
      const filter: Record<string, unknown> = { shopkeeperId };

      if (query.shopId && Types.ObjectId.isValid(String(query.shopId))) {
            filter.$or = [{ shopId: new Types.ObjectId(String(query.shopId)) }, { shopId: null }];
      }

      return await PopUpRule.find(filter)
            .populate('categoryId')
            // To optionally populate recommended items if they are categories:
            .populate('recommendedItems.itemId')
            .sort({ createdAt: -1 });
};

const getRuleById = async (id: string, shopkeeperId: string) => {
      const rule = await PopUpRule.findOne({ _id: id, shopkeeperId })
            .populate('categoryId')
            .populate('recommendedItems.itemId');
      
      if (!rule) {
            throw new AppError('Pop-up rule not found', StatusCodes.NOT_FOUND);
      }

      return rule;
};

const getRecommendations = async (shopkeeperId: string, categoryIds: string[]) => {
      if (!categoryIds || categoryIds.length === 0) return [];

      const uniqueCategoryIds = Array.from(new Set(categoryIds.filter(id => Types.ObjectId.isValid(id))));
      
      if (uniqueCategoryIds.length === 0) return [];

      // Find active rules for these categories
      const rules = await PopUpRule.find({
            shopkeeperId,
            categoryId: { $in: uniqueCategoryIds },
            status: 'active',
      }).populate('categoryId');

      const recommendations = [];

      for (const rule of rules) {
            let fetchedItems: any[] = [];

            if (rule.recommendedItems && rule.recommendedItems.length > 0) {
                  const inventoryIds = rule.recommendedItems
                        .filter(i => i.itemType === 'inventory')
                        .map(i => i.itemId);
                        
                  const catItemIds = rule.recommendedItems
                        .filter(i => i.itemType === 'category')
                        .map(i => i.itemId);

                  if (inventoryIds.length > 0) {
                        const items = await Inventory.find({ 
                              _id: { $in: inventoryIds }, 
                              userId: shopkeeperId, 
                              type: 'inventory' 
                        }).populate('categoryId');
                        fetchedItems.push(...items);
                  }

                  if (catItemIds.length > 0) {
                        // Fetch a few items from these categories
                        const items = await Inventory.find({ 
                              categoryId: { $in: catItemIds }, 
                              userId: shopkeeperId, 
                              type: 'inventory' 
                        }).limit(15).populate('categoryId');
                        
                        // to avoid duplicates if an item is both matched by inventory ID and category ID
                        fetchedItems.push(...items);
                  }
            } else {
                  // Fallback: show from the same category
                  const items = await Inventory.find({ 
                        categoryId: rule.categoryId, 
                        userId: shopkeeperId, 
                        type: 'inventory' 
                  }).limit(10).populate('categoryId');
                  fetchedItems.push(...items);
            }

            // Remove duplicates based on ID
            const uniqueItems = Array.from(new Map(fetchedItems.map(item => [item._id.toString(), item])).values());

            recommendations.push({
                  ruleId: rule._id,
                  triggerCategory: rule.categoryId,
                  autoPopupReminder: rule.autoPopupReminder,
                  suggestedItems: uniqueItems,
            });
      }

      return recommendations;
};

const popUpRuleService = {
      createRule,
      updateRule,
      deleteRule,
      getRules,
      getRuleById,
      getRecommendations,
};

export default popUpRuleService;
