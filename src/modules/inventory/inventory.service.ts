import AppError from '../../errors/AppError';
import path from 'node:path';
import { Types } from 'mongoose';
import XLSX from 'xlsx';
import { IBarcodeSearchResult } from '../barcode/barcode.interface';
import barcodeService from '../barcode/barcode.service';
import { getOpenAiInsight } from '../deviceCheck/scanInfo.transformer';
import { IInventory } from './inventory.interface';
import { Inventory } from './inventory.model';
import { uploadToCloudinary } from '../../utils/cloudinary';

const parseOptionalNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') {
            return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
};

const estimateBarcodeValue = (product: IBarcodeSearchResult) => {
      const text = [product.name, product.brand, product.category, product.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

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

const assertValidObjectId = (value: string, fieldName: string) => {
      if (!Types.ObjectId.isValid(value)) {
            throw new AppError(`Invalid ${fieldName}`, 400);
      }
};

type TBarcodeBulkRow = {
      rowNumber: number;
      code: string;
      userId?: string;
      imeiNumber?: string;
      purchasePrice?: number | string;
      currentState?: IInventory['currentState'];
};

const normalizeHeaderValue = (value: unknown) => {
      let normalizedValue: string;

      if (value === null || value === undefined) {
            normalizedValue = '';
      } else if (Array.isArray(value)) {
            normalizedValue = value.join(' ');
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            normalizedValue = String(value);
      } else {
            normalizedValue = '';
      }

      return normalizedValue
            .trim()
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .join('');
};

const extractBarcodeRowsFromFile = (filePath: string): TBarcodeBulkRow[] => {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
            return [];
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(sheet, {
            header: 1,
            blankrows: false,
            defval: '',
      });

      if (!rows.length) {
            return [];
      }

      const firstRow = rows[0].map((cell) => normalizeHeaderValue(cell));
      const headerIndex = {
            code: firstRow.findIndex((cell) => cell === 'code' || cell.includes('barcode')),
            userId: firstRow.findIndex((cell) => cell === 'userid' || cell === 'user'),
            imeiNumber: firstRow.findIndex((cell) => cell === 'imei' || cell === 'imeinumber'),
            purchasePrice: firstRow.findIndex((cell) => cell === 'purchaseprice' || cell === 'price'),
            currentState: firstRow.findIndex(
                  (cell) => cell === 'currentstate' || cell === 'condition' || cell === 'state'
            ),
      };

      const hasHeaderRow = Object.values(headerIndex).some((index) => index >= 0);
      const dataRows = hasHeaderRow ? rows.slice(1) : rows;

      return dataRows.map((row, index) => ({
            rowNumber: hasHeaderRow ? index + 2 : index + 1,
            code: String(row?.[hasHeaderRow ? headerIndex.code : 0] ?? '').trim(),
            userId: String(row?.[hasHeaderRow ? headerIndex.userId : 1] ?? '').trim(),
            imeiNumber: String(row?.[hasHeaderRow ? headerIndex.imeiNumber : 2] ?? '').trim(),
            purchasePrice: row?.[hasHeaderRow ? headerIndex.purchasePrice : 3] ?? '',
            currentState: String(
                  row?.[hasHeaderRow ? headerIndex.currentState : 4] ?? ''
            ).trim() as IInventory['currentState'],
      }));
};

const createInventory = async (payload: Partial<IInventory>, file?: any) => {
      if (file) {
            const cloudinaryResponse = await uploadToCloudinary(file.path);
            if (cloudinaryResponse) {
                  payload.image = {
                        public_id: cloudinaryResponse.public_id,
                        url: cloudinaryResponse.secure_url,
                  };
            }
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

      if (!Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid userId', 400);
      }

      const userObjectId = new Types.ObjectId(userId);

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
                  userId: userObjectId,
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

const createInventoryFromBarcodeBulk = async (file?: Express.Multer.File, defaultUserId?: string) => {
      if (!file) {
            throw new AppError('A csv or excel file is required', 400);
      }

      const extension = path.extname(file.originalname).toLowerCase();

      if (!['.csv', '.xls', '.xlsx'].includes(extension)) {
            throw new AppError('Only csv, xls, or xlsx files are supported', 400);
      }

      const rows = extractBarcodeRowsFromFile(file.path);

      if (!rows.length) {
            throw new AppError('No barcode rows were found in the file', 400);
      }

      const results = [] as Array<{
            rowNumber: number;
            ok: boolean;
            message: string;
            data?: unknown;
      }>;

      for (const row of rows) {
            const code = String(row.code ?? '').trim();
            const userId = String(row.userId || defaultUserId || '').trim();

            if (!code) {
                  results.push({
                        rowNumber: row.rowNumber,
                        ok: false,
                        message: 'Barcode code is required',
                  });
                  continue;
            }

            if (!userId) {
                  results.push({
                        rowNumber: row.rowNumber,
                        ok: false,
                        message: 'userId is required',
                  });
                  continue;
            }

            try {
                  const created = await createInventoryFromBarcode({
                        code,
                        userId,
                        imeiNumber: row.imeiNumber,
                        purchasePrice: row.purchasePrice,
                        currentState: row.currentState,
                  });

                  results.push({
                        rowNumber: row.rowNumber,
                        ok: true,
                        message: 'Inventory created from barcode successfully',
                        data: created,
                  });
            } catch (error) {
                  results.push({
                        rowNumber: row.rowNumber,
                        ok: false,
                        message: error instanceof Error ? error.message : 'Failed to create inventory from barcode',
                  });
            }
      }

      const successCount = results.filter((result) => result.ok).length;

      return {
            summary: {
                  totalRows: results.length,
                  successCount,
                  failureCount: results.length - successCount,
            },
            results,
      };
};

const getAllInventory = async () => {
      return await Inventory.find().populate('userId');
};

const getSingleInventory = async (id: string) => {
      assertValidObjectId(id, 'id');
      return await Inventory.findById(id).populate('userId');
};

const updateInventory = async (id: string, payload: Partial<IInventory>, file?: any) => {
      assertValidObjectId(id, 'id');

      if (file) {
            const cloudinaryResponse = await uploadToCloudinary(file.path);
            if (cloudinaryResponse) {
                  payload.image = {
                        public_id: cloudinaryResponse.public_id,
                        url: cloudinaryResponse.secure_url,
                  };
            }
      }

      return await Inventory.findByIdAndUpdate(id, payload, {
            new: true,
      });
};

const deleteInventory = async (id: string) => {
      assertValidObjectId(id, 'id');

      return await Inventory.findByIdAndDelete(id);
};

const getMyInventory = async (userId: string) => {
      return await Inventory.find({ userId });
};

const getInventoryByUserId = async (userId: string) => {
      assertValidObjectId(userId, 'userId');

      return await Inventory.find({ userId });
};

export default {
      createInventory,
      createInventoryFromBarcode,
      createInventoryFromBarcodeBulk,
      getAllInventory,
      getSingleInventory,
      updateInventory,
      deleteInventory,
      getMyInventory,
      getInventoryByUserId,
};
