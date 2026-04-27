import { ISoldProduct } from './soldProduct.interface';
import { SoldProduct } from './soldProduct.model';
import AppError from '../../errors/AppError';
import { StatusCodes } from 'http-status-codes';

const SoldProductModel = SoldProduct as any;

const createSoldProduct = async (payload: ISoldProduct, file: any) => {
      if (file) {
            payload.image = {
                  public_id: file.filename,
                  url: file.path,
            };
      }

      const result = await SoldProductModel.create(payload);
      return result;
};

const getMySoldProducts = async (shopkeeperId: string) => {
      return await SoldProductModel.find({ shopkeeperId });
};

const updateSoldProduct = async (id: string, payload: Partial<ISoldProduct>, file: any, shopkeeperId: string) => {
      const product = await SoldProductModel.findOne({ _id: id, shopkeeperId });

      if (!product) {
            throw new AppError('Product not found', StatusCodes.NOT_FOUND);
      }

      if (file) {
            payload.image = {
                  public_id: file.filename,
                  url: file.path,
            };
      }

      const result = await SoldProductModel.findByIdAndUpdate(id, payload, {
            new: true,
      });

      return result;
};

const deleteSoldProduct = async (id: string, shopkeeperId: string) => {
      const product = await SoldProductModel.findOne({ _id: id, shopkeeperId });

      if (!product) {
            throw new AppError('Product not found', StatusCodes.NOT_FOUND);
      }

      await SoldProductModel.findByIdAndDelete(id);

      return null;
};

export const soldProductService = {
      createSoldProduct,
      getMySoldProducts,
      updateSoldProduct,
      deleteSoldProduct,
};
