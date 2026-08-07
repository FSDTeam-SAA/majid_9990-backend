import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import config from '../config/config';
import { User } from '../modules/user/user.model';
import { Shop } from '../modules/shop/shop.model';
import { ensureDefaultShop } from '../modules/shop/shop.utils';
import ScanInfo from '../modules/deviceCheck/scanInfo.model';
import { Inventory } from '../modules/inventory/inventory.model';
import { Invoice } from '../modules/invoice/invoice.model';
import { Customer } from '../modules/customer/customer.model';
import RepairRequest from '../modules/repairRequest/repairRequest.model';
import Subscription from '../modules/subscription/subscription.model';

const MULTI_SHOP_PLAN_TYPE = 'MULTI SHOP';

const ensureMultiShopPlan = async () => {
  const existing = await Subscription.findOne({ type: MULTI_SHOP_PLAN_TYPE }).lean();

  if (existing) {
    console.log('MULTI SHOP plan already exists — skipping creation');
    return;
  }

  const price = Number(process.env.MULTI_SHOP_PLAN_PRICE ?? '9.99');

  const plan = await Subscription.create({
    name: 'Multi Shop',
    type: MULTI_SHOP_PLAN_TYPE,
    price,
    priceLabel: `€${price.toFixed(2)}`,
    description: 'Unlock the ability to add and manage multiple shops.',
    features: [
      { name: 'Add unlimited additional shops', included: true },
      { name: 'Per-shop dashboards and history', included: true },
      { name: 'Staff locked to one shop', included: false },
    ],
    isPopular: false,
    customPricing: false,
    ctaText: 'Unlock Multi Shop',
    isAvailable: true,
  });

  console.log(`Created MULTI SHOP plan (price ${price})`);
  return plan;
};

const storeIdMap = new Map<string, mongoose.Types.ObjectId>();

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is required to run the backfill script');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await ensureMultiShopPlan();

  const shopkeepers = await User.find({ role: 'shopkeeper' }).select('_id firstName lastName').lean();

  console.log(`Found ${shopkeepers.length} shopkeepers`);

  let createdShops = 0;
  for (const shopkeeper of shopkeepers) {
    const existing = await Shop.exists({ shopkeeperId: shopkeeper._id, isDefault: true });
    if (!existing) {
      await ensureDefaultShop(shopkeeper._id);
      createdShops += 1;
    }
  }
  console.log(`Created ${createdShops} default shop(s)`);

  for (const shopkeeper of shopkeepers) {
    const shop = await Shop.findOne({ shopkeeperId: shopkeeper._id, isDefault: true }).select('_id').lean();
    if (shop) {
      storeIdMap.set(String(shopkeeper._id), shop._id as mongoose.Types.ObjectId);
    }
  }

  const defaultShops = await Shop.find({ isDefault: true }).select('shopkeeperId _id').lean();
  for (const shop of defaultShops) {
    storeIdMap.set(String(shop.shopkeeperId), shop._id as mongoose.Types.ObjectId);
  }

  let scanBackfilled = 0;
  let inventoryBackfilled = 0;
  let invoiceBackfilled = 0;
  let customerBackfilled = 0;
  let repairBackfilled = 0;

  for (const [userId, shopId] of storeIdMap.entries()) {
    const scanResult = await ScanInfo.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), $or: [{ shopId: null }, { shopId: { $exists: false } }] },
      { $set: { shopId } }
    );
    scanBackfilled += scanResult.modifiedCount;

    const inventoryResult = await Inventory.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), $or: [{ storeId: null }, { storeId: { $exists: false } }] },
      { $set: { storeId: shopId } }
    );
    inventoryBackfilled += inventoryResult.modifiedCount;

    const invoiceResult = await Invoice.updateMany(
      { shopkeeperId: new mongoose.Types.ObjectId(userId), $or: [{ shopId: null }, { shopId: { $exists: false } }] },
      { $set: { shopId } }
    );
    invoiceBackfilled += invoiceResult.modifiedCount;

    const customerResult = await Customer.updateMany(
      { shopkeeperId: new mongoose.Types.ObjectId(userId), $or: [{ shopId: null }, { shopId: { $exists: false } }] },
      { $set: { shopId } }
    );
    customerBackfilled += customerResult.modifiedCount;

    const repairResult = await RepairRequest.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), $or: [{ shopId: null }, { shopId: { $exists: false } }] },
      { $set: { shopId } }
    );
    repairBackfilled += repairResult.modifiedCount;
  }

  console.log(
    `Backfilled: ${scanBackfilled} scan(s), ${inventoryBackfilled} inventory, ${invoiceBackfilled} invoice(s), ${customerBackfilled} customer(s), ${repairBackfilled} repair request(s)`
  );

  await mongoose.disconnect();
  console.log('Backfill complete');
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
