import { Types } from 'mongoose';
import {
  RepairPartMovement,
  RepairPartStock,
  RepairPartVariant,
} from './repairPart.model';
import {
  IAddDeliveryPayload,
  IAdjustStockPayload,
  IConfirmUsePartPayload,
  IReleasePartPayload,
  IReservePartPayload,
  IReturnPartPayload,
  IRepairPartStock,
  IRepairPartVariant,
} from './repairPart.interface';
import deviceCatalogData from './data/deviceCatalog';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import RepairRequest from '../repairRequest/repairRequest.model';
import Shop from '../shop/shop.model';

export class RepairPartService {
  // 1. Search catalogue
  static async searchCatalogue(query: string, brand?: string, deviceType?: string) {
    const q = (query || '').trim().toLowerCase();
    const cleanQ = q.replace(/^sm-/, '');

    let results = deviceCatalogData as Array<{
      brand: string;
      deviceType: string;
      modelName: string;
      releaseYear: string;
      modelCode: string;
    }>;

    if (brand) {
      results = results.filter(
        (d) => d.brand.toLowerCase() === brand.trim().toLowerCase()
      );
    }
    if (deviceType) {
      results = results.filter(
        (d) => d.deviceType.toLowerCase() === deviceType.trim().toLowerCase()
      );
    }

    if (q) {
      results = results.filter((d) => {
        const name = d.modelName.toLowerCase();
        const code = d.modelCode.toLowerCase();
        const codeNoSM = code.replace(/^sm-/, '');
        const year = String(d.releaseYear).toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          codeNoSM.includes(cleanQ) ||
          year.includes(q)
        );
      });
    }

    return results.slice(0, 50);
  }

  // 2. List parts & stock
  static async getParts(
    shopkeeperId: Types.ObjectId,
    query: {
      shopId?: string;
      category?: string;
      brand?: string;
      modelName?: string;
      modelCode?: string;
      search?: string;
    }
  ) {
    const filter: Record<string, any> = { shopkeeperId };

    if (query.category) filter.category = query.category;
    if (query.brand) filter.brand = new RegExp(query.brand, 'i');
    if (query.modelName) filter.modelName = new RegExp(query.modelName, 'i');
    if (query.modelCode) filter.modelCode = new RegExp(query.modelCode, 'i');

    if (query.search) {
      const s = query.search.trim();
      filter.$or = [
        { modelName: new RegExp(s, 'i') },
        { modelCode: new RegExp(s, 'i') },
        { sku: new RegExp(s, 'i') },
        { partName: new RegExp(s, 'i') },
      ];
    }

    const variants = await RepairPartVariant.find(filter).sort({
      createdAt: -1,
    });

    const shopId = query.shopId
      ? new Types.ObjectId(query.shopId)
      : undefined;

    // Attach stock balances
    const variantIds = variants.map((v) => v._id);
    const stockFilter: Record<string, any> = {
      variantId: { $in: variantIds },
    };
    if (shopId) {
      stockFilter.shopId = shopId;
    }

    const stocks = await RepairPartStock.find(stockFilter);
    const stockMap = new Map<string, { onHand: number; reserved: number; available: number }>();

    for (const s of stocks) {
      const key = s.variantId.toString();
      const existing = stockMap.get(key) || { onHand: 0, reserved: 0, available: 0 };
      existing.onHand += s.onHand;
      existing.reserved += s.reserved;
      existing.available += Math.max(0, s.onHand - s.reserved);
      stockMap.set(key, existing);
    }

    return variants.map((v) => {
      const s = stockMap.get(v._id.toString()) || {
        onHand: 0,
        reserved: 0,
        available: 0,
      };
      return {
        ...v.toObject(),
        stock: s,
      };
    });
  }

  // 3. Add delivery (records delivery, increments on-hand, logs movements)
  static async addDelivery(
    shopkeeperId: Types.ObjectId,
    userId: Types.ObjectId,
    payload: IAddDeliveryPayload
  ) {
    const { variant: varData, deliveryQuantity, costPrice, sellingPrice, supplierId, supplierName, supplierStamp, minStockReminder, allocations } = payload;

    if (!deliveryQuantity || deliveryQuantity <= 0) {
      throw new AppError('Delivery quantity must be a positive whole number'
      , httpStatus.BAD_REQUEST);
    }

    // Verify allocations total matches delivery quantity
    const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
    if (totalAllocated !== deliveryQuantity) {
      throw new AppError(
        `Allocations total (${totalAllocated}) must equal delivery quantity (${deliveryQuantity})`,
        httpStatus.BAD_REQUEST
      );
    }

    // Auto-generate SKU if needed
    let sku = varData.sku?.trim();
    if (!sku) {
      const cleanCat = varData.category.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
      const cleanCode = varData.modelCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const cleanQ = varData.quality.substring(0, 3).toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000);
      sku = `RP-${cleanCat}-${cleanCode}-${cleanQ}-${rand}`;
    }

    // Find or create variant
    let variant = await RepairPartVariant.findOne({
      shopkeeperId,
      category: varData.category,
      brand: varData.brand,
      modelCode: varData.modelCode,
      quality: varData.quality,
      color: varData.color || null,
      position: varData.position || null,
      screenPlacement: varData.screenPlacement || null,
      buttonType: varData.buttonType || null,
      flexSubtype: varData.flexSubtype || null,
    });

    if (!variant) {
      variant = await RepairPartVariant.create({
        shopkeeperId,
        category: varData.category,
        deviceType: varData.deviceType || 'Phone',
        brand: varData.brand,
        modelName: varData.modelName,
        modelCode: varData.modelCode,
        releaseYear: varData.releaseYear,
        quality: varData.quality,
        sku,
        partName: varData.partName,
        color: varData.color,
        size: varData.size,
        position: varData.position,
        buttonType: varData.buttonType,
        flexSubtype: varData.flexSubtype,
        screenPlacement: varData.screenPlacement,
        sellingPrice: Number(sellingPrice) || 0,
        costPrice: Number(costPrice) || 0,
        minStockLevel: Number(minStockReminder) || 0,
      });
    } else {
      // Update price and latest cost
      variant.sellingPrice = Number(sellingPrice) >= 0 ? Number(sellingPrice) : variant.sellingPrice;
      variant.costPrice = Number(costPrice) >= 0 ? Number(costPrice) : variant.costPrice;
      if (minStockReminder !== undefined) {
        variant.minStockLevel = Number(minStockReminder);
      }
      await variant.save();
    }

    // Allocate across stores
    const movements = [];
    for (const alloc of allocations) {
      const allocQty = Number(alloc.quantity) || 0;
      if (allocQty <= 0) continue;

      const shopObjectId = new Types.ObjectId(alloc.shopId);

      let stock = await RepairPartStock.findOne({
        variantId: variant._id,
        shopId: shopObjectId,
      });

      const onHandBefore = stock ? stock.onHand : 0;
      const reservedBefore = stock ? stock.reserved : 0;
      const onHandAfter = onHandBefore + allocQty;

      if (!stock) {
        stock = await RepairPartStock.create({
          variantId: variant._id,
          shopkeeperId,
          shopId: shopObjectId,
          onHand: onHandAfter,
          reserved: 0,
          minStockLevel: Number(minStockReminder) || 0,
        });
      } else {
        stock.onHand = onHandAfter;
        if (minStockReminder !== undefined) {
          stock.minStockLevel = Number(minStockReminder);
        }
        await stock.save();
      }

      // Record movement
      const movement = await RepairPartMovement.create({
        shopkeeperId,
        shopId: shopObjectId,
        variantId: variant._id,
        type: 'delivery',
        quantity: allocQty,
        onHandBefore,
        onHandAfter,
        reservedBefore,
        reservedAfter: reservedBefore,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        supplierId: supplierId ? new Types.ObjectId(supplierId) : undefined,
        supplierName,
        supplierStamp,
        userId,
      });

      movements.push(movement);
    }

    return {
      variant,
      movements,
      totalAdded: deliveryQuantity,
    };
  }

  // 4. Quick adjustment (corrects existing stock, requires reason)
  static async adjustStock(
    shopkeeperId: Types.ObjectId,
    userId: Types.ObjectId,
    payload: IAdjustStockPayload
  ) {
    const { variantId, shopId, newQuantity, reason } = payload;

    if (!reason || !reason.trim()) {
      throw new AppError('A reason is required when saving an adjustment'
      , httpStatus.BAD_REQUEST);
    }

    if (newQuantity < 0) {
      throw new AppError('Stock quantity cannot be negative'
      , httpStatus.BAD_REQUEST);
    }

    const varObjectId = new Types.ObjectId(variantId);
    const shopObjectId = new Types.ObjectId(shopId);

    let stock = await RepairPartStock.findOne({
      variantId: varObjectId,
      shopId: shopObjectId,
    });

    if (!stock) {
      stock = await RepairPartStock.create({
        variantId: varObjectId,
        shopkeeperId,
        shopId: shopObjectId,
        onHand: 0,
        reserved: 0,
      });
    }

    // Prevent making on-hand lower than reservations
    if (newQuantity < stock.reserved) {
      throw new AppError(`Cannot adjust on-hand to ${newQuantity} because ${stock.reserved} units are currently reserved for jobs`
      , httpStatus.BAD_REQUEST);
    }

    const onHandBefore = stock.onHand;
    const reservedBefore = stock.reserved;
    const diff = newQuantity - onHandBefore;

    if (diff === 0) {
      return stock;
    }

    stock.onHand = newQuantity;
    await stock.save();

    await RepairPartMovement.create({
      shopkeeperId,
      shopId: shopObjectId,
      variantId: varObjectId,
      type: 'adjustment',
      quantity: Math.abs(diff),
      onHandBefore,
      onHandAfter: newQuantity,
      reservedBefore,
      reservedAfter: reservedBefore,
      reason: reason.trim(),
      userId,
    });

    return stock;
  }

  // 5. Compatible stock lookup for repair jobs & booking order
  static async getCompatibleParts(
    shopkeeperId: Types.ObjectId,
    params: {
      brand?: string;
      modelName?: string;
      modelCode?: string;
      issue?: string;
      category?: string;
      shopId: string;
      screenPlacement?: 'Inner screen' | 'Cover screen';
    }
  ) {
    const shopObjectId = new Types.ObjectId(params.shopId);

    // Map common issue names to categories
    let mappedCategory = params.category;
    if (!mappedCategory && params.issue) {
      const issueLower = params.issue.toLowerCase();
      if (issueLower.includes('screen') || issueLower.includes('display') || issueLower.includes('lcd')) {
        mappedCategory = 'Screen';
      } else if (issueLower.includes('battery') || issueLower.includes('charging issue')) {
        mappedCategory = 'Battery';
      } else if (issueLower.includes('port') || issueLower.includes('charge')) {
        mappedCategory = 'Charging port';
      } else if (issueLower.includes('camera')) {
        mappedCategory = 'Camera';
      } else if (issueLower.includes('back') || issueLower.includes('glass')) {
        mappedCategory = 'Back cover';
      } else if (issueLower.includes('speaker') || issueLower.includes('sound') || issueLower.includes('mic')) {
        mappedCategory = 'Speaker';
      } else if (issueLower.includes('button')) {
        mappedCategory = 'Buttons';
      } else if (issueLower.includes('flex')) {
        mappedCategory = 'Flex cable';
      } else if (issueLower.includes('housing')) {
        mappedCategory = 'Housing';
      } else if (issueLower.includes('vibrat')) {
        mappedCategory = 'Vibration motor';
      }
    }

    const filter: Record<string, any> = { shopkeeperId };
    if (mappedCategory) {
      filter.category = mappedCategory;
    }
    if (params.brand) {
      filter.brand = new RegExp(params.brand.trim(), 'i');
    }

    if (params.modelCode) {
      const code = params.modelCode.trim();
      const codeNoSM = code.replace(/^sm-/i, '');
      filter.$or = [
        { modelCode: new RegExp(code, 'i') },
        { modelCode: new RegExp(codeNoSM, 'i') },
      ];
    } else if (params.modelName) {
      filter.modelName = new RegExp(params.modelName.trim(), 'i');
    }

    if (params.screenPlacement) {
      filter.screenPlacement = params.screenPlacement;
    }

    const variants = await RepairPartVariant.find(filter);

    const variantIds = variants.map((v) => v._id);
    const stocks = await RepairPartStock.find({
      variantId: { $in: variantIds },
      shopId: shopObjectId,
    });

    const stockMap = new Map<string, IRepairPartStock>();
    for (const s of stocks) {
      stockMap.set(s.variantId.toString(), s);
    }

    // For parts with 0 available stock, get supplier price comparison
    const results = [];
    for (const v of variants) {
      const stock = stockMap.get(v._id.toString()) || {
        onHand: 0,
        reserved: 0,
      };
      const available = Math.max(0, stock.onHand - stock.reserved);

      let supplierComparison = null;
      if (available <= 0) {
        supplierComparison = await this.getSupplierComparisonForVariant(
          shopkeeperId,
          v._id
        );
      }

      results.push({
        variant: v,
        onHand: stock.onHand,
        reserved: stock.reserved,
        available,
        sellingPrice: v.sellingPrice,
        costPrice: v.costPrice,
        supplierComparison,
      });
    }

    return results;
  }

  // 6. Supplier comparison for a variant (where cheapest last purchased)
  static async getSupplierComparisonForVariant(
    shopkeeperId: Types.ObjectId,
    variantId: Types.ObjectId
  ) {
    const deliveries = await RepairPartMovement.find({
      shopkeeperId,
      variantId,
      type: 'delivery',
      supplierName: { $exists: true, $ne: '' },
    })
      .sort({ costPrice: 1, createdAt: -1 })
      .limit(5);

    if (!deliveries.length) return null;

    const cheapest = deliveries[0];
    const latest = [...deliveries].sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    )[0];

    return {
      cheapestSupplier: {
        supplierName: cheapest.supplierName,
        costPrice: cheapest.costPrice,
        stamp: cheapest.supplierStamp,
        date: cheapest.createdAt,
      },
      latestPurchase: {
        supplierName: latest.supplierName,
        costPrice: latest.costPrice,
        stamp: latest.supplierStamp,
        date: latest.createdAt,
      },
      pastPurchases: deliveries.map((d) => ({
        supplierName: d.supplierName,
        costPrice: d.costPrice,
        stamp: d.supplierStamp,
        date: d.createdAt,
      })),
    };
  }

  // 7. Reserve part for repair job
  static async reservePart(
    shopkeeperId: Types.ObjectId,
    userId: Types.ObjectId,
    payload: IReservePartPayload
  ) {
    const { variantId, shopId, repairRequestId, quantity = 1 } = payload;
    const qty = Math.max(1, Number(quantity) || 1);

    const varObjectId = new Types.ObjectId(variantId);
    const shopObjectId = new Types.ObjectId(shopId);
    const repairObjectId = new Types.ObjectId(repairRequestId);

    const stock = await RepairPartStock.findOne({
      variantId: varObjectId,
      shopId: shopObjectId,
    });

    if (!stock) {
      throw new AppError('Part stock record not found', httpStatus.BAD_REQUEST);
    }

    const available = stock.onHand - stock.reserved;
    if (available < qty) {
      throw new AppError(
        `Cannot reserve ${qty} unit(s). Only ${Math.max(0, available)} available in stock`,
        httpStatus.BAD_REQUEST
      );
    }

    const onHandBefore = stock.onHand;
    const reservedBefore = stock.reserved;
    const reservedAfter = reservedBefore + qty;

    stock.reserved = reservedAfter;
    await stock.save();

    const movement = await RepairPartMovement.create({
      shopkeeperId,
      shopId: shopObjectId,
      variantId: varObjectId,
      type: 'reservation',
      quantity: qty,
      onHandBefore,
      onHandAfter: onHandBefore,
      reservedBefore,
      reservedAfter,
      repairRequestId: repairObjectId,
      userId,
    });

    return { stock, movement };
  }

  // 8. Confirm fitted or used (deduct on-hand and release reservation in one transaction)
  static async confirmUsePart(
    shopkeeperId: Types.ObjectId,
    userId: Types.ObjectId,
    payload: IConfirmUsePartPayload
  ) {
    const { variantId, shopId, repairRequestId, quantity = 1 } = payload;
    const qty = Math.max(1, Number(quantity) || 1);

    const varObjectId = new Types.ObjectId(variantId);
    const shopObjectId = new Types.ObjectId(shopId);
    const repairObjectId = new Types.ObjectId(repairRequestId);

    const stock = await RepairPartStock.findOne({
      variantId: varObjectId,
      shopId: shopObjectId,
    });

    if (!stock || stock.onHand < qty) {
      throw new AppError('Insufficient on-hand stock to confirm use'
      , httpStatus.BAD_REQUEST);
    }

    const variant = await RepairPartVariant.findById(varObjectId);

    const onHandBefore = stock.onHand;
    const reservedBefore = stock.reserved;
    const onHandAfter = onHandBefore - qty;
    // Release up to qty from reserved if reserved
    const reservedAfter = Math.max(0, reservedBefore - qty);

    stock.onHand = onHandAfter;
    stock.reserved = reservedAfter;
    await stock.save();

    const movement = await RepairPartMovement.create({
      shopkeeperId,
      shopId: shopObjectId,
      variantId: varObjectId,
      type: 'used',
      quantity: qty,
      onHandBefore,
      onHandAfter,
      reservedBefore,
      reservedAfter,
      costPrice: variant?.costPrice || 0,
      sellingPrice: variant?.sellingPrice || 0,
      repairRequestId: repairObjectId,
      userId,
    });

    // Also record on the repair request technician notes for margin reporting
    if (variant) {
      await RepairRequest.findByIdAndUpdate(repairObjectId, {
        $push: {
          technicianNotes: {
            partName: `${variant.category} - ${variant.modelName} (${variant.quality})`,
            cost: variant.costPrice || 0,
            time: 0,
          },
        },
      });
    }

    return { stock, movement };
  }

  // 9. Release reservation before use (cancelled repair / quote rejected)
  static async releasePart(
    shopkeeperId: Types.ObjectId,
    userId: Types.ObjectId,
    payload: IReleasePartPayload
  ) {
    const { variantId, shopId, repairRequestId, quantity = 1 } = payload;
    const qty = Math.max(1, Number(quantity) || 1);

    const varObjectId = new Types.ObjectId(variantId);
    const shopObjectId = new Types.ObjectId(shopId);
    const repairObjectId = new Types.ObjectId(repairRequestId);

    const stock = await RepairPartStock.findOne({
      variantId: varObjectId,
      shopId: shopObjectId,
    });

    if (!stock) {
      throw new AppError('Stock record not found', httpStatus.BAD_REQUEST);
    }

    const reservedBefore = stock.reserved;
    const reservedAfter = Math.max(0, reservedBefore - qty);

    stock.reserved = reservedAfter;
    await stock.save();

    const movement = await RepairPartMovement.create({
      shopkeeperId,
      shopId: shopObjectId,
      variantId: varObjectId,
      type: 'release',
      quantity: qty,
      onHandBefore: stock.onHand,
      onHandAfter: stock.onHand,
      reservedBefore,
      reservedAfter,
      repairRequestId: repairObjectId,
      userId,
    });

    return { stock, movement };
  }

  // 10. Return unused part
  static async returnPart(
    shopkeeperId: Types.ObjectId,
    userId: Types.ObjectId,
    payload: IReturnPartPayload
  ) {
    const { variantId, shopId, repairRequestId, quantity = 1, reason } = payload;
    const qty = Math.max(1, Number(quantity) || 1);

    const varObjectId = new Types.ObjectId(variantId);
    const shopObjectId = new Types.ObjectId(shopId);
    const repairObjectId = new Types.ObjectId(repairRequestId);

    let stock = await RepairPartStock.findOne({
      variantId: varObjectId,
      shopId: shopObjectId,
    });

    if (!stock) {
      stock = await RepairPartStock.create({
        variantId: varObjectId,
        shopkeeperId,
        shopId: shopObjectId,
        onHand: 0,
        reserved: 0,
      });
    }

    const onHandBefore = stock.onHand;
    const onHandAfter = onHandBefore + qty;

    stock.onHand = onHandAfter;
    await stock.save();

    const movement = await RepairPartMovement.create({
      shopkeeperId,
      shopId: shopObjectId,
      variantId: varObjectId,
      type: 'return',
      quantity: qty,
      onHandBefore,
      onHandAfter,
      reservedBefore: stock.reserved,
      reservedAfter: stock.reserved,
      reason: reason || 'Return unused part from repair',
      repairRequestId: repairObjectId,
      userId,
    });

    return { stock, movement };
  }

  // 11. Movement history
  static async getMovements(
    shopkeeperId: Types.ObjectId,
    query: {
      shopId?: string;
      variantId?: string;
      repairRequestId?: string;
      type?: string;
    }
  ) {
    const filter: Record<string, any> = { shopkeeperId };
    if (query.shopId) filter.shopId = new Types.ObjectId(query.shopId);
    if (query.variantId) filter.variantId = new Types.ObjectId(query.variantId);
    if (query.repairRequestId)
      filter.repairRequestId = new Types.ObjectId(query.repairRequestId);
    if (query.type) filter.type = query.type;

    return RepairPartMovement.find(filter)
      .populate('variantId')
      .populate('shopId', 'shopName storeCode')
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(100);
  }
}
