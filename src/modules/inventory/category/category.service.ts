import { Types } from 'mongoose';
import { Category } from './category.model';
import { ICategory } from './category.interface';
import AppError from '../../../errors/AppError';
import { Inventory } from '../inventory.model';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../utils/cloudinary';
import { buildShopScopeFilter, ensureDefaultShop } from '../../shop/shop.utils';

export const DEFAULT_15_CATEGORIES = [
      { key: 'accessories', name: 'Accessories', order: 1, image: '/images/categories/accessories.png' },
      { key: 'windows-laptops', name: 'Windows Laptops', order: 2, image: '/images/categories/windows-laptops.png' },
      { key: 'macbooks', name: 'MacBooks', order: 3, image: '/images/categories/macbooks.png' },
      { key: 'android-tablets', name: 'Android Tablets', order: 4, image: '/images/categories/android-tablets.png' },
      { key: 'apple-ipads', name: 'Apple iPads', order: 5, image: '/images/categories/apple-ipads.png' },
      { key: 'android-phones', name: 'Android Phones', order: 6, image: '/images/categories/android-phones.png' },
      { key: 'gaming-consoles', name: 'Gaming Consoles & Games', order: 7, image: '/images/categories/gaming-consoles.png' },
      { key: 'iphones', name: 'iPhones', order: 8, image: '/images/categories/iphones.png' },
      { key: 'vapes', name: 'Vapes', order: 9, image: '/images/categories/vapes.png' },
      { key: 'toys', name: 'Toys', order: 10, image: '/images/categories/toys.png' },
      { key: 'cameras', name: 'Cameras', order: 11, image: '/images/categories/cameras.png' },
      { key: 'drones', name: 'Drones', order: 12, image: '/images/categories/drones.png' },
      { key: 'health-beauty', name: 'Health & Beauty', order: 13, image: '/images/categories/health-beauty.png' },
      { key: 'speakers', name: 'Speakers', order: 14, image: '/images/categories/speakers.png' },
      { key: 'care', name: 'Care', order: 15, image: '/images/categories/care.png' },
];

class CategoryService {
      private getOwnerId(ownerId: string | Types.ObjectId) {
            const resolvedOwnerId = ownerId instanceof Types.ObjectId ? ownerId : new Types.ObjectId(ownerId);

            return resolvedOwnerId;
      }

      async ensureDefaultCategories(shopkeeperId: string | Types.ObjectId, shopId?: string | Types.ObjectId): Promise<void> {
            const ownerId = this.getOwnerId(shopkeeperId);
            const resolvedShopId = shopId && Types.ObjectId.isValid(String(shopId)) ? new Types.ObjectId(String(shopId)) : undefined;
            const filter = await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId');

            const existingCategories = await Category.find(filter);
            const existingNames = new Set(existingCategories.map((c) => c.name.trim().toLowerCase()));
            const existingKeys = new Set(existingCategories.map((c) => (c.key || '').trim().toLowerCase()));

            const toCreate = [];
            for (const def of DEFAULT_15_CATEGORIES) {
                  const matchName = existingNames.has(def.name.toLowerCase());
                  const matchKey = existingKeys.has(def.key.toLowerCase());
                  if (!matchName && !matchKey) {
                        toCreate.push({
                              name: def.name,
                              key: def.key,
                              shopkeeperId: ownerId,
                              shopId: resolvedShopId,
                              image: { url: def.image, public_id: '' },
                              defaultImage: { url: def.image, public_id: '' },
                              totalItems: 0,
                              isActive: true,
                              isDefault: true,
                              isHidden: false,
                              order: def.order,
                        });
                  }
            }

            if (toCreate.length > 0) {
                  try {
                        await Category.insertMany(toCreate, { ordered: false });
                  } catch (err) {
                        // ignore duplicate key errors if created concurrently
                  }
            }
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

      async getAllCategories(shopkeeperId: string | Types.ObjectId, shopId?: string | Types.ObjectId, includeHidden = false): Promise<ICategory[]> {
            const ownerId = this.getOwnerId(shopkeeperId);
            await this.ensureDefaultCategories(ownerId, shopId);
            const baseFilter = await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId');
            const filter: Record<string, any> = { ...baseFilter };
            if (!includeHidden) {
                  filter.isHidden = { $ne: true };
            }
            const categories = await Category.find(filter).sort({ order: 1, name: 1, createdAt: -1 });
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

      async getCategoriesWithItemCount(shopkeeperId: string | Types.ObjectId, shopId?: string | Types.ObjectId, includeHidden = false): Promise<any[]> {
            const ownerId = this.getOwnerId(shopkeeperId);
            await this.ensureDefaultCategories(ownerId, shopId);
            const baseFilter = await buildShopScopeFilter(ownerId, shopId, 'shopkeeperId', 'shopId');
            const matchFilter: Record<string, any> = { ...baseFilter };
            if (!includeHidden) {
                  matchFilter.isHidden = { $ne: true };
            }

            const storeExprs: Record<string, any>[] = [
                  { $eq: ['$categoryId', '$$catId'] },
                  { $eq: ['$status', 'inventory'] },
            ];

            if (shopId && Types.ObjectId.isValid(String(shopId))) {
                  const storeObjId = new Types.ObjectId(String(shopId));
                  const defaultShop = await ensureDefaultShop(ownerId);
                  const isDefault = defaultShop._id.toString() === storeObjId.toString();

                  if (isDefault) {
                        storeExprs.push({
                              $or: [
                                    { $eq: ['$storeId', storeObjId] },
                                    { $eq: ['$storeId', null] },
                                    { $not: ['$storeId'] },
                              ],
                        });
                  } else {
                        storeExprs.push({ $eq: ['$storeId', storeObjId] });
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
                                                $expr: {
                                                      $and: storeExprs,
                                                },
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
                        $sort: { order: 1, name: 1 },
                  },
            ]);

            return categories;
      }

      async toggleCategoryVisibility(
            id: string,
            shopkeeperId: string | Types.ObjectId,
            isHidden: boolean,
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

            category.isHidden = isHidden;
            await category.save();
            return category;
      }

      async resetCategoryImage(
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

            const matchedDef = DEFAULT_15_CATEGORIES.find(
                  (d) => d.key === category.key || d.name.toLowerCase() === category.name.toLowerCase()
            );

            const resetImageUrl = matchedDef?.image || category.defaultImage?.url || '';

            if (category.image?.public_id) {
                  try {
                        await deleteFromCloudinary(category.image.public_id);
                  } catch (e) {
                        // ignore
                  }
            }

            category.image = {
                  url: resetImageUrl,
                  public_id: '',
            };
            await category.save();
            return category;
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
