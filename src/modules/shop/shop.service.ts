import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import Subscription from '../subscription/subscription.model';
import paymentService from '../payment/payment.service';
import { Payment } from '../payment/payment.model';
import { User } from '../user/user.model';
import { IShop, IShopEntitlement } from './shop.interface';
import { Shop } from './shop.model';
import { ensureDefaultShop, getShopkeeperId, toObjectId } from './shop.utils';
import { Invoice } from '../invoice/invoice.model';
import { Category } from '../inventory/category/category.model';
import { Inventory } from '../inventory/inventory.model';

const MULTI_SHOP_PLAN_TYPE = 'MULTI SHOP';

const getMultiShopPlan = async () => {
  const plan = await Subscription.findOne({ type: MULTI_SHOP_PLAN_TYPE, isAvailable: true }).lean();

  if (!plan) {
    throw new AppError(
      'The Multi Shop plan is not configured yet. Please contact support.',
      StatusCodes.BAD_REQUEST
    );
  }

  return plan;
};

const hasPaidMultiShopPlan = async (shopkeeperId: Types.ObjectId): Promise<boolean> => {
  const paidMultiShopPayments = await Payment.find({
    userId: shopkeeperId,
    paymentStatus: 'paid',
  })
    .select('subscriptionId')
    .lean();

  if (!paidMultiShopPayments.length) {
    return false;
  }

  const subscriptionIds = paidMultiShopPayments
    .map((payment) => payment.subscriptionId)
    .filter(Boolean);

  if (!subscriptionIds.length) {
    return false;
  }

  const multiShopSubscriptions = await Subscription.find({
    _id: { $in: subscriptionIds },
    type: MULTI_SHOP_PLAN_TYPE,
  })
    .select('_id')
    .lean();

  return multiShopSubscriptions.length > 0;
};

const getMyShops = async (user: any): Promise<IShop[]> => {
  const shopkeeperId = getShopkeeperId(user);
  await ensureDefaultShop(shopkeeperId);

  const shops = await Shop.find({ shopkeeperId })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();

  return shops as IShop[];
};

const getEntitlement = async (user: any): Promise<IShopEntitlement> => {
  const shopkeeperId = getShopkeeperId(user);

  const shops = await getMyShops(user);
  const defaultShop = shops.find((shop) => shop.isDefault) || shops[0] || null;

  const paidPlan = await hasPaidMultiShopPlan(shopkeeperId);
  const alreadyMulti = shops.filter((shop) => shop.isActive).length > 1;

  return {
    multiShopEnabled: paidPlan || alreadyMulti,
    defaultShopId: defaultShop?._id?.toString() ?? null,
    activeShopId: null,
    shops,
  };
};

const getShopById = async (user: any, shopId: string): Promise<IShop> => {
  const shopkeeperId = getShopkeeperId(user);

  if (!toObjectId(shopId)) {
    throw new AppError('Invalid shop id', StatusCodes.BAD_REQUEST);
  }

  const shop = await Shop.findOne({ _id: shopId, shopkeeperId }).lean();

  if (!shop) {
    throw new AppError('Shop not found', StatusCodes.NOT_FOUND);
  }

  return shop as IShop;
};

const createShop = async (user: any, payload: any) => {
  const shopkeeperId = getShopkeeperId(user);

  if (user.role !== 'shopkeeper' && user.role !== 'user' && user.role !== 'admin') {
    throw new AppError('Only the shop owner can add a shop', StatusCodes.FORBIDDEN);
  }

  const shopName = String(payload?.shopName ?? '').trim();
  const shopAddress = String(payload?.shopAddress ?? '').trim();

  if (!shopName) {
    throw new AppError('Shop name is required', StatusCodes.BAD_REQUEST);
  }

  if (!shopAddress) {
    throw new AppError('Shop address is required', StatusCodes.BAD_REQUEST);
  }

  const multiShopEnabled = await hasPaidMultiShopPlan(shopkeeperId);
  const existingShops = await Shop.find({ shopkeeperId }).select('_id isActive').lean();
  const alreadyMulti = existingShops.filter((shop) => shop.isActive).length > 1;

  if (!multiShopEnabled && !alreadyMulti) {
    const error: any = new AppError(
      'The Multi Shop plan is required to add another shop.',
      StatusCodes.PAYMENT_REQUIRED
    );
    error.code = 'MULTI_SHOP_REQUIRED';
    throw error;
  }

  const plan = await getMultiShopPlan();

  const shop = await Shop.create({
    shopkeeperId,
    shopName,
    shopAddress,
    whatsappNumber: String(payload?.whatsappNumber ?? '').trim(),
    googleReviewPageUrl: String(payload?.googleReviewPageUrl ?? '').trim(),
    currency: String(payload?.currency ?? '').trim().toUpperCase() || 'USD',
    isDefault: false,
    isActive: false,
  });

  const checkout = await paymentService.createPaymentSession(user, {
    amount: plan.price,
    currency: String(plan.price && plan.price > 0 ? (user.currency || 'usd') : 'usd'),
    subscriptionId: plan._id,
    paymentType: 'add_shop',
    shopId: shop._id,
  });

  return {
    shop,
    checkout,
  };
};

const updateShop = async (user: any, shopId: string, payload: any) => {
  const shopkeeperId = getShopkeeperId(user);

  if (!toObjectId(shopId)) {
    throw new AppError('Invalid shop id', StatusCodes.BAD_REQUEST);
  }

  const shop = await Shop.findOne({ _id: shopId, shopkeeperId });

  if (!shop) {
    throw new AppError('Shop not found', StatusCodes.NOT_FOUND);
  }

  const updateData: Record<string, unknown> = {};

  if (payload.shopName !== undefined) {
    const shopName = String(payload.shopName).trim();
    if (!shopName) {
      throw new AppError('Shop name cannot be empty', StatusCodes.BAD_REQUEST);
    }
    updateData.shopName = shopName;
  }

  if (payload.shopAddress !== undefined) {
    updateData.shopAddress = String(payload.shopAddress).trim();
  }

  if (payload.whatsappNumber !== undefined) {
    updateData.whatsappNumber = String(payload.whatsappNumber).trim();
  }

  if (payload.googleReviewPageUrl !== undefined) {
    updateData.googleReviewPageUrl = String(payload.googleReviewPageUrl).trim();
  }

  if (payload.currency !== undefined) {
    updateData.currency = String(payload.currency).trim().toUpperCase() || 'USD';
  }

  if (payload.taxEnabled !== undefined) {
    updateData.taxEnabled = Boolean(payload.taxEnabled);
  }

  if (payload.taxName !== undefined) {
    updateData.taxName = String(payload.taxName).trim() || 'Tax';
  }

  if (payload.taxPercentage !== undefined) {
    updateData.taxPercentage = Number(payload.taxPercentage) || 0;
  }

  if (payload.taxIncludedInPrice !== undefined) {
    updateData.taxIncludedInPrice = Boolean(payload.taxIncludedInPrice);
  }

  if (Object.keys(updateData).length === 0) {
    return shop;
  }

  const updated = await Shop.findOneAndUpdate(
    { _id: shopId, shopkeeperId },
    { $set: updateData },
    { new: true, runValidators: true }
  ).lean();

  return updated;
};

const deleteShop = async (user: any, shopId: string) => {
  const shopkeeperId = getShopkeeperId(user);

  if (!toObjectId(shopId)) {
    throw new AppError('Invalid shop id', StatusCodes.BAD_REQUEST);
  }

  const shop = await Shop.findOne({ _id: shopId, shopkeeperId });

  if (!shop) {
    throw new AppError('Shop not found', StatusCodes.NOT_FOUND);
  }

  if (shop.isDefault) {
    throw new AppError('The default shop cannot be deleted', StatusCodes.BAD_REQUEST);
  }

  await Shop.deleteOne({ _id: shopId });

  return { _id: shopId };
};

const getShopPerformance = async (user: any, query: any) => {
  const shopkeeperId = getShopkeeperId(user);
  await ensureDefaultShop(shopkeeperId);

  const { dateFilter = 'today' } = query;

  let dateQuery: any = {};
  const now = new Date();
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(startOfToday.getTime() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  if (dateFilter === 'today') {
    dateQuery = { $gte: startOfToday };
  } else if (dateFilter === 'yesterday') {
    dateQuery = { $gte: startOfYesterday, $lt: startOfToday };
  } else if (dateFilter === 'this-week') {
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    dateQuery = { $gte: startOfWeek };
  } else if (dateFilter === 'this-month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    dateQuery = { $gte: startOfMonth };
  }

  const shops = await Shop.find({ shopkeeperId }).sort({ isDefault: -1, createdAt: 1 }).lean();
  
  const staffList = await User.find({ shopkeeperId, role: 'staff', isVerified: true })
    .select('_id firstName lastName phone email image workingDays weekendDays shopId')
    .lean();

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = daysOfWeek[now.getDay()];

  const invoiceFilter: any = {
    shopkeeperId,
    type: { $nin: ['Purchase Invoice', 'purchase invoice', 'Purchase', 'purchase'] },
  };
  if (Object.keys(dateQuery).length > 0) {
    invoiceFilter.createdAt = dateQuery;
  }

  const salesByShop = await Invoice.aggregate([
    { $match: invoiceFilter },
    {
      $group: {
        _id: '$shopId',
        totalSales: { $sum: '$amountPaid' },
        cashSales: {
          $sum: {
            $cond: [{ $in: [{ $toLower: '$paymentMethod' }, ['cash']] }, '$amountPaid', 0],
          },
        },
        cardSales: {
          $sum: {
            $cond: [{ $in: [{ $toLower: '$paymentMethod' }, ['card', 'credit card', 'debit card']] }, '$amountPaid', 0],
          },
        },
        customersCount: { $sum: 1 },
      },
    },
  ]);

  const periodCashByShop = await Invoice.aggregate([
    {
      $match: {
        shopkeeperId,
        type: { $nin: ['Purchase Invoice', 'purchase invoice', 'Purchase', 'purchase'] },
      },
    },
    {
      $group: {
        _id: '$shopId',
        cashYesterday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', startOfYesterday] },
                  { $lte: ['$createdAt', endOfYesterday] },
                  { $in: [{ $toLower: '$paymentMethod' }, ['cash']] },
                ],
              },
              '$amountPaid',
              0,
            ],
          },
        },
        cashLastWeek: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', sevenDaysAgo] },
                  { $lte: ['$createdAt', endOfToday] },
                  { $in: [{ $toLower: '$paymentMethod' }, ['cash']] },
                ],
              },
              '$amountPaid',
              0,
            ],
          },
        },
        cashLastMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', thirtyDaysAgo] },
                  { $lte: ['$createdAt', endOfToday] },
                  { $in: [{ $toLower: '$paymentMethod' }, ['cash']] },
                ],
              },
              '$amountPaid',
              0,
            ],
          },
        },
      },
    },
  ]);

  const salesMap = salesByShop.reduce((acc: any, curr: any) => {
    acc[curr._id ? curr._id.toString() : 'unassigned'] = curr;
    return acc;
  }, {});

  const periodCashMap = periodCashByShop.reduce((acc: any, curr: any) => {
    acc[curr._id ? curr._id.toString() : 'unassigned'] = curr;
    return acc;
  }, {});

  const shopsWithStats = shops.map((shop) => {
    const shopIdStr = shop._id.toString();
    const stats = salesMap[shopIdStr] || { totalSales: 0, cashSales: 0, cardSales: 0, customersCount: 0 };
    const pCash = periodCashMap[shopIdStr] || { cashYesterday: 0, cashLastWeek: 0, cashLastMonth: 0 };
    
    const assignedStaff = staffList.filter((st: any) => {
      if (st.shopId) {
        return st.shopId.toString() === shopIdStr;
      }
      return shop.isDefault || shops.length === 1;
    });

    const staffWorkingToday = assignedStaff.filter((st: any) => {
      if (Array.isArray(st.workingDays) && st.workingDays.length > 0) {
        return st.workingDays.includes(todayDayName);
      }
      return true;
    });

    // Calculate Business Health Score (0-100)
    const totalOrders = stats.customersCount || 0;
    const totalSales = stats.totalSales || 0;
    let healthScore = 84;
    if (totalOrders > 0 || totalSales > 0) {
      const salesFactor = Math.min(35, (totalSales / 500) * 10);
      const orderFactor = Math.min(35, totalOrders * 7);
      healthScore = Math.min(100, Math.max(40, Math.round(30 + salesFactor + orderFactor)));
    }

    const businessHealthScore = {
      overall: healthScore,
      rating: healthScore >= 85 ? 'Excellent' : healthScore >= 70 ? 'Good' : healthScore >= 55 ? 'Fair' : 'Needs Improvement',
    };

    const cashAvailable = {
      yesterday: pCash.cashYesterday || 0,
      lastWeek: pCash.cashLastWeek || 0,
      lastMonth: pCash.cashLastMonth || 0,
    };

    return {
      ...shop,
      currency: shop.currency || user.currency || 'USD',
      stats: {
        totalSales: stats.totalSales || 0,
        cashSales: stats.cashSales || 0,
        cardSales: stats.cardSales || 0,
        customersCount: stats.customersCount || 0,
        businessHealthScore,
      },
      businessHealthScore,
      cashAvailable,
      staff: assignedStaff,
      staffWorkingToday: staffWorkingToday,
    };
  });

  const aggregateCash = {
    yesterday: shopsWithStats.reduce((sum, s) => sum + (s.cashAvailable?.yesterday || 0), 0),
    lastWeek: shopsWithStats.reduce((sum, s) => sum + (s.cashAvailable?.lastWeek || 0), 0),
    lastMonth: shopsWithStats.reduce((sum, s) => sum + (s.cashAvailable?.lastMonth || 0), 0),
  };

  return {
    shops: shopsWithStats,
    aggregate: {
      activeShopsCount: shops.filter(s => s.isActive).length,
      totalSales: shopsWithStats.reduce((sum, s) => sum + s.stats.totalSales, 0),
      totalCustomers: shopsWithStats.reduce((sum, s) => sum + s.stats.customersCount, 0),
      totalStaff: staffList.length,
      cashAvailable: aggregateCash,
    }
  };
};

const getUploadedImages = async (user: any) => {
  const shopkeeperId = getShopkeeperId(user);
  await ensureDefaultShop(shopkeeperId);

  // Get images from categories
  const categories = await Category.find({ shopkeeperId, 'image.url': { $exists: true, $ne: null } })
    .select('image')
    .lean();

  // Get images from inventories (using userId which stores shopkeeperId for inventory)
  const inventories = await Inventory.find({ userId: shopkeeperId, 'image.url': { $exists: true, $ne: null } })
    .select('image')
    .lean();

  const allImages = [
    ...categories.map(c => c.image),
    ...inventories.map(i => i.image)
  ].filter((img): img is { public_id: string; url: string } => !!(img && img.url));

  // Deduplicate by URL
  const uniqueImages = Array.from(new Map(allImages.map(img => [img.url, img])).values());

  // Return the most recent ones first (we'll just reverse since they usually come in chronological order)
  return uniqueImages.reverse();
};

const shopService = {
  getMyShops,
  getEntitlement,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
  getShopPerformance,
  getUploadedImages,
};

export default shopService;
