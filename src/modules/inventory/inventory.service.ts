import { IInventory } from './inventory.interface';
import { Inventory } from './inventory.model';

const createInventory = async (payload: IInventory, file?: any) => {
      if (file) {
            payload.image = {
                  public_id: file.filename,
                  url: file.path,
            };
      }

      const result = await Inventory.create(payload);
      return result;
};

const getAllInventory = async () => {
      return await Inventory.find().populate('userId');
};

const getSingleInventory = async (id: string) => {
      return await Inventory.findById(id).populate('userId');
};

const updateInventory = async (id: string, payload: Partial<IInventory>, file?: any) => {
      if (file) {
            payload.image = {
                  public_id: file.filename,
                  url: file.path,
            };
      }

      return await Inventory.findByIdAndUpdate(id, payload, {
            new: true,
      });
};

const deleteInventory = async (id: string) => {
      return await Inventory.findByIdAndDelete(id);
};

export default {
      createInventory,
      getAllInventory,
      getSingleInventory,
      updateInventory,
      deleteInventory,
};
