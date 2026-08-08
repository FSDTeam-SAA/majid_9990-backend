import { Types } from 'mongoose';
import { Category } from './category.model';
import { ICategory } from './category.interface';
import AppError from '../../../errors/AppError';
import { Inventory } from '../inventory.model';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../utils/cloudinary';
import { buildShopScopeFilter, ensureDefaultShop } from '../../shop/shop.utils';

class CategoryService {
      private getOwnerId(ownerId: string | Types.ObjectId) {
            const resolvedOwnerId = ownerId instanceof Types.ObjectId ? ownerId : new Types.ObjectId(ownerId);

            return resolvedOwnerId;
      }

      private async updateTotalItems(
            categoryId: Types.ObjectId,
            shopkeeperId: Types.ObjectId,
            shopId?: string | Types.ObjectId
      ): Promise<void> {
            const inventoryFilter: Record<string, any> = {
                  categoryId: categoryId,
                  status: 'inventory', // Only count active inventory items
            };
            if (shopId && Types.ObjectId.isValid(String(shopId))) {
                  const targetShopId = new Types.ObjectId(String(shopId));
                  const defaultShop = await ensureDefaultShop(shopkeeperId);
                  const isDefault = defaultShop._id.toString() === targetShopId.toString();

                  if (isDefault) {
                        inventoryFilter.$or = [{ storeId: targetShopId }, { storeId: null }, { storeId: { $exists: false } }];
                  } else {
                        inventoryFilter.storeId = targetShopId;
                  }
            }

            const itemCount = await Inventory.countDocuments(inventoryFilter);

            await Category.findOneAndUpdate({ _id: categoryId, shopkeeperId }, { totalItems: itemCount });
      }

      async createCategory(
            payload: Partial<ICategory>,
            file?: any,
            shopkeeperId?: string | Types.ObjectId,
            shopId?: string | Types.ObjectId
      ): Promise<ICategory> {
            const name = payload.name?.trim();
            const ownerId = this.getOwnerId(shopkeeperId ?? payload.shopkeeperId!);
            const resolvedShopId = shopId || payload.shopId;

            if (!name) {
                  throw new AppError('Category name is required', 400);
            }

            const shopFilter = await buildShopScopeFilter(ownerId, resolvedShopId, 'shopkeeperId', 'shopId');

            // Check for existing category (case-insensitive) within this shop scope
            const existingCategory = await Category.findOne({
                  name: { $regex: new RegExp(`^${name}$`, 'i') },
                  ...shopFilter,
            });

            if (existingCategory) {
                  throw new AppError('Category with this name already exists', 409);
            }

            let imageData;
            if (file) {
                  const cloudinaryResponse = await uploadToCloudinary(file.path);
                  if (cloudinaryResponse) {
                        imageData = {
                              public_id: cloudinaryResponse.public_id,
                              url: cloudinaryResponse.secure_url,
                        };
                  }
            }

            const category = await Category.create({
                  name,
                  shopkeeperId: ownerId,
                  shopId: resolvedShopId && Types.ObjectId.isValid(String(resolvedShopId)) ? new Types.ObjectId(String(resolvedShopId)) : undefined,
                  image: imageData,
                  totalItems: 0,
            });

            return category;
      }

      async getAllCategories(shopkeeperId: string | Types.ObjectId, shopId?: string | Types.ObjectId): Promise<ICategory[]> {
            const ownerId = this.getOwnerId(shopkeeperId);
            const filter = await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId');
            const categories = await Category.find(filter).sort({ createdAt: -1 });
            return categories;
      }

      async getCategoryById(
            id: string,
            shopkeeperId: string | Types.ObjectId,
            shopId?: string | Types.ObjectId
      ): Promise<ICategory | null> {
            if (!Types.ObjectId.isValid(id)) {
                  throw new AppError('Invalid category ID', 400);
            }

            const ownerId = this.getOwnerId(shopkeeperId);
            const filter = { _id: id, ...(await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId')) };
            const category = await Category.findOne(filter);

            if (!category) {
                  throw new AppError('Category not found', 404);
            }

            return category;
      }

      async updateCategory(
            id: string,
            payload: Partial<ICategory>,
            file?: any,
            shopkeeperId?: string | Types.ObjectId,
            shopId?: string | Types.ObjectId
      ): Promise<ICategory | null> {
            if (!Types.ObjectId.isValid(id)) {
                  throw new AppError('Invalid category ID', 400);
            }

            const ownerId = this.getOwnerId(shopkeeperId ?? payload.shopkeeperId!);
            const resolvedShopId = shopId || payload.shopId;
            const filter = { _id: id, ...(await buildShopScopeFilter(ownerId, resolvedShopId, 'shopkeeperId', 'shopId')) };
            const category = await Category.findOne(filter);
            if (!category) {
                  throw new AppError('Category not found', 404);
            }

            // Handle image update
            if (file) {
                  // Delete old image if exists
                  if (category.image?.public_id) {
                        await deleteFromCloudinary(category.image.public_id);
                  }

                  const cloudinaryResponse = await uploadToCloudinary(file.path);
                  if (cloudinaryResponse) {
                        payload.image = {
                              public_id: cloudinaryResponse.public_id,
                              url: cloudinaryResponse.secure_url,
                        };
                  }
            }

            // Update name if provided and check for duplicates
            if (payload.name && payload.name !== category.name) {
                  const name = payload.name.trim();
                  const shopFilter = await buildShopScopeFilter(ownerId, resolvedShopId, 'shopkeeperId', 'shopId');
                  const existingCategory = await Category.findOne({
                        name: { $regex: new RegExp(`^${name}$`, 'i') },
                        _id: { $ne: id },
                        ...shopFilter,
                  });

                  if (existingCategory) {
                        throw new AppError('Category with this name already exists', 409);
                  }

                  payload.name = name;
            }

            const updatedCategory = await Category.findOneAndUpdate({ _id: id, shopkeeperId: ownerId }, payload, {
                  new: true,
                  runValidators: true,
            });

            return updatedCategory;
      }

      async deleteCategory(
            id: string,
            shopkeeperId: string | Types.ObjectId,
            shopId?: string | Types.ObjectId
      ): Promise<void> {
            if (!Types.ObjectId.isValid(id)) {
                  throw new AppError('Invalid category ID', 400);
            }

            const ownerId = this.getOwnerId(shopkeeperId);
            const filter = { _id: id, ...(await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId')) };
            const category = await Category.findOne(filter);
            if (!category) {
                  throw new AppError('Category not found', 404);
            }

            // Check if category has items
            const itemCount = await Inventory.countDocuments({ categoryId: id });
            if (itemCount > 0) {
                  throw new AppError(
                        `Cannot delete category. It has ${itemCount} item(s) associated. Please reassign or remove the items first.`,
                        400
                  );
            }

            // Delete image from cloudinary
            if (category.image?.public_id) {
                  await deleteFromCloudinary(category.image.public_id);
            }

            await Category.findByIdAndDelete(id);
      }

      async updateInventoryCategoryCount(
            categoryId: Types.ObjectId,
            shopkeeperId: Types.ObjectId,
            shopId?: Types.ObjectId
      ): Promise<void> {
            await this.updateTotalItems(categoryId, shopkeeperId, shopId);
      }

      async getCategoriesWithItemCount(shopkeeperId: string | Types.ObjectId, shopId?: string | Types.ObjectId): Promise<any[]> {
            const ownerId = this.getOwnerId(shopkeeperId);
            const matchFilter = await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId');

            const storeMatch: Record<string, any>[] = [
                  { $eq: ['$categoryId', '$$catId'] },
                  { $eq: ['$status', 'inventory'] },
            ];

            if (shopId && Types.ObjectId.isValid(String(shopId))) {
                  const storeObjId = new Types.ObjectId(String(shopId));
                  const defaultShop = await ensureDefaultShop(ownerId);
                  const isDefault = defaultShop._id.toString() === storeObjId.toString();

                  if (isDefault) {
                        storeMatch.push({
                              $or: [
                                    { $eq: ['$storeId', storeObjId] },
                                    { $eq: ['$storeId', null] },
                                    { $not: ['$storeId'] },
                              ],
                        });
                  } else {
                        storeMatch.push({ $eq: ['$storeId', storeObjId] });
                  }
            }

            const categories = await Category.aggregate([
                  {
                        $match: matchFilter,
                  },
                  {
                        $lookup: {
                              from: 'inventories',
                              let: { catId: '$_id' },
                              pipeline: [
                                    {
                                          $match: {
                                                $and: storeMatch,
                                          },
                                    },
                              ],
                              as: 'items',
                        },
                  },
                  {
                        $addFields: {
                              itemCount: { $size: '$items' },
                        },
                  },
                  {
                        $project: {
                              items: 0,
                        },
                  },
                  {
                        $sort: { itemCount: -1, name: 1 },
                  },
            ]);

            return categories;
      }

      async bulkUpdateTotalItems(shopkeeperId: string | Types.ObjectId, shopId?: string | Types.ObjectId): Promise<void> {
            const ownerId = this.getOwnerId(shopkeeperId);
            const filter = await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId');
            const categories = await Category.find(filter);

            for (const category of categories) {
                  await this.updateTotalItems(
                        category._id,
                        ownerId,
                        shopId ? new Types.ObjectId(String(shopId)) : undefined
                  );
            }
      }
}

export default new CategoryService();
