import AppError from '../../errors/AppError';
import { IBarcodeSearchResult } from '../barcode/barcode.interface';
import barcodeService from '../barcode/barcode.service';
import { getOpenAiInsight } from '../deviceCheck/scanInfo.transformer';
import { IInventory } from './inventory.interface';
import { Inventory } from './inventory.model';

const parseOptionalNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') {
            return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
};

const estimateBarcodeValue = (product: IBarcodeSearchResult) => {
      const text = [product.name, product.brand, product.category, product.description].filter(Boolean).join(' ').toLowerCase();

      if (text.includes('iphone')) {
            return 920;
      }

      if (text.includes('samsung') || text.includes('galaxy')) {
            return 540;
      }

      if (text.includes('xiaomi') || text.includes('redmi')) {
            return 260;
      }

      if (text.includes('pixel')) {
            return 480;
      }

      return 300;
};

const normalizeCondition = (value: IInventory['currentState']) => {
      return value === 'good condition' ? 'good condition' : 'new';
};

const createInventory = async (payload: Partial<IInventory>, file?: any) => {
      if (file) {
            payload.image = {
                  public_id: file.filename,
                  url: file.path,
            };
      }

      const result = await Inventory.create(payload);
      return result;
};

const createInventoryFromBarcode = async (
      payload: {
            code: string;
            userId: string;
            imeiNumber?: string;
            purchasePrice?: number | string;
            currentState?: IInventory['currentState'];
      },
      file?: any
) => {
      const cleanCode = String(payload.code ?? '').trim();
      const userId = String(payload.userId ?? '').trim();

      if (!cleanCode) {
            throw new AppError('Barcode code is required', 400);
      }

      if (!userId) {
            throw new AppError('userId is required', 400);
      }

      const barcodeResult = await barcodeService.searchByBarcode(cleanCode);
      const fallbackName = barcodeResult.brand ? `${barcodeResult.brand} ${barcodeResult.name}` : barcodeResult.name;
      const itemName = fallbackName?.trim() || 'Unknown Product';
      const imeiNumber = String(payload.imeiNumber ?? barcodeResult.barcode ?? cleanCode).trim();
      const estimatedMarketValue = estimateBarcodeValue(barcodeResult);
      const aiInsight = await getOpenAiInsight({
            imei: imeiNumber,
            deviceName: itemName,
            deviceStatus: 'clean',
            riskLabel: 'Low Risk',
            sourceText: JSON.stringify(barcodeResult),
            estimatedMarketValue,
      });

      const purchasePrice = parseOptionalNumber(payload.purchasePrice);
      const expectedPrice = parseOptionalNumber(aiInsight?.estimatedMarketValueUSD) ?? estimatedMarketValue;

      const result = await createInventory(
            {
                  itemName,
                  imeiNumber,
                  userId,
                  purchasePrice,
                  expectedPrice,
                  currentState: normalizeCondition(payload.currentState),
            },
            file
      );

      return {
            result,
            barcodeResult,
            aiInsight,
      };
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

const getMyInventory = async (userId: string) => {
      return await Inventory.find({ userId });
};

const getInventoryByUserId = async (userId: string) => {
      return await Inventory.find({ userId });
};

export default {
      createInventory,
      createInventoryFromBarcode,
      getAllInventory,
      getSingleInventory,
      updateInventory,
      deleteInventory,
      getMyInventory,
      getInventoryByUserId,
};
