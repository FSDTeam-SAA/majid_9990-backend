import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errors/AppError';
import { Inventory } from '../inventory/inventory.model';
import { User } from '../user/user.model';
import { IAddToCartPayload } from './addToCart.interface';
import { AddToCart } from './addToCart.model';

const validateObjectId = (value: string, fieldName: string) => {
      const trimmedValue = String(value ?? '').trim();

      if (!trimmedValue) {
            throw new AppError(`${fieldName} is required`, StatusCodes.BAD_REQUEST);
      }

      if (!Types.ObjectId.isValid(trimmedValue)) {
            throw new AppError(`Invalid ${fieldName}`, StatusCodes.BAD_REQUEST);
      }

      return trimmedValue;
};

const ensureShopkeeperExists = async (shopkeeperId: string) => {
      const shopkeeper = await User.findById(shopkeeperId);

      if (!shopkeeper) {
            throw new AppError('Shopkeeper not found', StatusCodes.NOT_FOUND);
      }
};

const ensureItemExists = async (itemId: string) => {
      const item = await Inventory.findById(itemId);

      if (!item) {
            throw new AppError('Inventory item not found', StatusCodes.NOT_FOUND);
      }
      return item;
};

const validateQuantity = (quantity?: number) => {
      if (quantity === undefined || quantity === null) {
            throw new AppError('quantity is required', StatusCodes.BAD_REQUEST);
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new AppError('quantity must be a positive integer', StatusCodes.BAD_REQUEST);
      }

      return quantity;
};

const createAddToCart = async (payload: IAddToCartPayload) => {
      const shopkeeperId = validateObjectId(String(payload.shopkeeperId), 'shopkeeperId');
      const itemId = validateObjectId(String(payload.itemId), 'itemId');
      const quantity = validateQuantity(payload.quantity);
      const variantId = payload.variantId ? validateObjectId(String(payload.variantId), 'variantId') : undefined;

      await ensureShopkeeperExists(shopkeeperId);
      const item = await ensureItemExists(itemId);

      if (variantId && !item.variants?.some((variant: any) => String(variant._id) === variantId)) {
            throw new AppError('Inventory variant not found', StatusCodes.NOT_FOUND);
      }
      const existing = await AddToCart.findOne({ shopkeeperId, itemId, variantId: variantId ?? null });

      if (existing) {
            existing.quantity += quantity;
            await existing.save();
            await existing.populate([
                  { path: 'itemId' },
                  { path: 'shopkeeperId', select: 'firstName lastName email phone role shopName' },
            ]);

            return existing;
      }

      const result = await AddToCart.create({
            shopkeeperId,
            itemId,
            quantity,
            variantId,
      });

      await result.populate([
            { path: 'itemId' },
            { path: 'shopkeeperId', select: 'firstName lastName email phone role shopName' },
      ]);

      return result;
};

const getAddToCartByShopkeeperId = async (shopkeeperId: string) => {
      const validatedShopkeeperId = validateObjectId(shopkeeperId, 'shopkeeperId');

      return await AddToCart.find({ shopkeeperId: validatedShopkeeperId })
            .populate('itemId')
            .populate('shopkeeperId', 'firstName lastName email phone role shopName')
            .sort({ createdAt: -1 });
};

const updateAddToCart = async (id: string, payload: IAddToCartPayload) => {
      const validatedId = validateObjectId(id, 'id');
      const existing = await AddToCart.findById(validatedId);

      if (!existing) {
            throw new AppError('Cart item not found', StatusCodes.NOT_FOUND);
      }

      const updatePayload: Partial<{
            shopkeeperId: string;
            itemId: string;
            quantity: number;
      }> = {};

      if (payload.shopkeeperId !== undefined) {
            const shopkeeperId = validateObjectId(String(payload.shopkeeperId), 'shopkeeperId');
            await ensureShopkeeperExists(shopkeeperId);
            updatePayload.shopkeeperId = shopkeeperId;
      }

      if (payload.itemId !== undefined) {
            const itemId = validateObjectId(String(payload.itemId), 'itemId');
            await ensureItemExists(itemId);
            updatePayload.itemId = itemId;
      }

      if (payload.quantity !== undefined) {
            updatePayload.quantity = validateQuantity(payload.quantity);
      }

      if (payload.shopkeeperId !== undefined || payload.itemId !== undefined) {
            const targetShopkeeperId = updatePayload.shopkeeperId ?? String(existing.shopkeeperId);
            const targetItemId = updatePayload.itemId ?? String(existing.itemId);
            const targetVariantId = payload.variantId !== undefined ? payload.variantId : (existing.variantId ?? null);

            const duplicate = await AddToCart.findOne({
                  _id: { $ne: validatedId },
                  shopkeeperId: targetShopkeeperId,
                  itemId: targetItemId,
                  variantId: targetVariantId,
            });

            if (duplicate) {
                  throw new AppError('Cart item already exists for this shopkeeper and item', StatusCodes.CONFLICT);
            }
      }

      return await AddToCart.findByIdAndUpdate(validatedId, updatePayload, {
            new: true,
            runValidators: true,
      })
            .populate('itemId')
            .populate('shopkeeperId', 'firstName lastName email phone role shopName');
};

const deleteAddToCart = async (id: string) => {
      const validatedId = validateObjectId(id, 'id');
      const existing = await AddToCart.findById(validatedId);

      if (!existing) {
            throw new AppError('Cart item not found', StatusCodes.NOT_FOUND);
      }

      await AddToCart.findByIdAndDelete(validatedId);

      return null;
};

const deleteAllByShopkeeperId = async (shopkeeperId: string) => {
      const validatedShopkeeperId = validateObjectId(shopkeeperId, 'shopkeeperId');
      const result = await AddToCart.deleteMany({ shopkeeperId: validatedShopkeeperId });

      return {
            deletedCount: result.deletedCount,
      };
};

const addToCartService = {
      createAddToCart,
      getAddToCartByShopkeeperId,
      updateAddToCart,
      deleteAddToCart,
      deleteAllByShopkeeperId,
};

export default addToCartService;
