import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/AppError';
import { User } from '../user/user.model';
import { Shop } from './shop.model';

export const getShopkeeperId = (user: any): Types.ObjectId => {
  const id = user?.role === 'staff' && user?.shopkeeperId ? user.shopkeeperId : user?._id;
  return new Types.ObjectId(String(id));
};

export const ensureDefaultShop = async (shopkeeperId: Types.ObjectId | string): Promise<any> => {
  const id = new Types.ObjectId(String(shopkeeperId));

  const user = await User.findById(id).lean();
  if (!user) {
    throw new AppError('Shopkeeper not found', StatusCodes.NOT_FOUND);
  }

  const existing = await Shop.findOne({ shopkeeperId: id, isDefault: true }).lean();
  if (existing) {
    return existing;
  }

  const fallbackName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'My Shop';

  const created = await Shop.create({
    shopkeeperId: id,
    shopName: String(user.shopName || '').trim() || fallbackName,
    shopAddress: String(user.shopAddress || '').trim(),
    whatsappNumber: String(user.whatsappNumber || '').trim(),
    googleReviewPageUrl: String(user.googleReviewPageUrl || '').trim(),
    currency: user.currency || 'USD',
    isDefault: true,
    isActive: true,
    activatedAt: new Date(),
  });

  return created;
};

export const isValidObjectId = (value?: string | Types.ObjectId | null): boolean =>
  Boolean(value) && Types.ObjectId.isValid(String(value));

export const toObjectId = (value?: string | Types.ObjectId): Types.ObjectId | null => {
  if (!isValidObjectId(value)) {
    return null;
  }
  return new Types.ObjectId(String(value));
};

/**
 * Resolves the active shop for a request.
 * - Staff users are always locked to their shopkeeper's default shop.
 * - Shopkeepers use the requested shopId when it belongs to them and is active,
 *   otherwise they fall back to their default shop.
 */
export const resolveShopId = async (user: any, requestedShopId?: string): Promise<Types.ObjectId> => {
  const shopkeeperId = getShopkeeperId(user);

  if (user?.role === 'staff') {
    const defaultShop = await ensureDefaultShop(shopkeeperId);
    return new Types.ObjectId(defaultShop._id);
  }

  if (isValidObjectId(requestedShopId)) {
    const shop = await Shop.findOne({
      _id: requestedShopId,
      shopkeeperId,
      isActive: true,
    }).lean();
    if (shop) {
      return new Types.ObjectId(shop._id);
    }
  }

  const defaultShop = await ensureDefaultShop(shopkeeperId);
  return new Types.ObjectId(defaultShop._id);
};

export const getShopFromRequest = async (req: any): Promise<Types.ObjectId> => {
  const requestedShopId = String(req?.query?.shopId ?? req?.body?.shopId ?? '').trim();
  return resolveShopId(req.user, requestedShopId || undefined);
};

/**
 * Builds a backward-compatible shop-scoped filter for a user-owned collection.
 * Records without a shopId (legacy data) are always included so nothing that
 * existed before the multi-shop feature disappears.
 */
export const buildShopScopeFilter = (
  userId: Types.ObjectId | string,
  shopId?: string | Types.ObjectId | null
): Record<string, any> => {
  const filter: Record<string, any> = { userId: new Types.ObjectId(String(userId)) };

  if (isValidObjectId(shopId)) {
    filter.$or = [{ shopId: new Types.ObjectId(String(shopId)) }, { shopId: null }];
  }

  return filter;
};
