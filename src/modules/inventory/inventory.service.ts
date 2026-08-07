import fs from 'node:fs/promises';
import XLSX from 'xlsx';
import AppError from '../../errors/AppError';
import { Types } from 'mongoose';
import { IBarcodeSearchResult } from '../barcode/barcode.interface';
import barcodeService from '../barcode/barcode.service';
import { getOpenAiInsight } from '../deviceCheck/scanInfo.transformer';
import { createNotification } from '../socket/notification.service';
import { IInventory, TInventoryStatus, TInventoryType } from './inventory.interface';
import { Inventory } from './inventory.model';
import { uploadToCloudinary } from '../../utils/cloudinary';
import { enqueueLowStockEmail } from '../../workers/lowStockEmailWorker';
import config from '../../config/config';
import { LowStockAlert } from '../lowStockAlert/lowStockAlert.model';
import { User } from '../user/user.model';
import categoryService from './category/category.service';
import locationService from '../location/location.service';

const parseOptionalNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') {
            return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
};

const parseStringArray = (value: unknown) => {
      if (Array.isArray(value)) {
            return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
      }

      if (typeof value === 'string') {
            try {
                  const parsed = JSON.parse(value);
                  if (Array.isArray(parsed)) {
                        return parsed
                              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                              .map((item) => item.trim());
                  }
            } catch {
                  return value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean);
            }
      }

      return [];
};

const normalizeVariants = async (value: unknown, files: Express.Multer.File[] = []) => {
      let rawVariants: unknown[] = [];
      try {
            rawVariants = Array.isArray(value) ? value : JSON.parse(String(value || '[]'));
      } catch {
            throw new AppError('variants must be valid JSON', 400);
      }

      if (!Array.isArray(rawVariants)) {
            throw new AppError('variants must be an array', 400);
      }

      return await Promise.all(
            rawVariants.map(async (raw, index) => {
                  const variant = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
                  const quantity = parseOptionalNumber(variant.quantity);
                  if (quantity === undefined || quantity < 0 || !Number.isInteger(quantity)) {
                        throw new AppError(`Variant ${index + 1} quantity must be a non-negative whole number`, 400);
                  }
                  const imeiNumber = String(variant.imeiNumber || '').trim();
                  const imageUploadIndex = parseOptionalNumber(variant.imageUploadIndex);
                  const file = imageUploadIndex === undefined ? undefined : files[imageUploadIndex];
                  const uploaded = file ? await uploadToCloudinary(file.path) : null;
                  return {
                        ...(variant._id ? { _id: variant._id } : {}),
                        purchasePrice: parseOptionalNumber(variant.purchasePrice),
                        expectedPrice: parseOptionalNumber(variant.expectedPrice),
                        quantity,
                        color: String(variant.color || '').trim() || undefined,
                        storage: String(variant.storage || '').trim() || undefined,
                        imeiNumber: imeiNumber || undefined,
                        currentState: variant.currentState === 'new' ? 'new' : 'good condition',
                        supplierId: String(variant.supplierId || '').trim() || undefined,
                        image: uploaded
                              ? { public_id: uploaded.public_id, url: uploaded.secure_url }
                              : variant.image && typeof variant.image === 'object'
                                ? variant.image
                                : undefined,
                  };
            })
      );
};

type MarketValue = {
      amount: number;
      currency: string;
      sourceAmount: number;
      sourceCurrency: string;
};

type MarketPricing = {
      expected: MarketValue;
      sale: MarketValue;
};

const extractMarketPricing = async (product: IBarcodeSearchResult, targetCurrency: string): Promise<MarketPricing> => {
      const rawData =
            product?.rawData && typeof product.rawData === 'object'
                  ? (product.rawData as Record<string, unknown>)
                  : {};

      const normalizedTargetCurrency = String(targetCurrency || 'USD').trim().toUpperCase();
      const defaultSourceCurrency =
            typeof rawData.currency === 'string' && rawData.currency.trim()
                  ? rawData.currency.trim().toUpperCase()
                  : 'USD';
      const expectedCandidates: Array<{ amount: number; currency: string }> = [];
      const saleCandidates: Array<{ amount: number; currency: string }> = [];
      const directKeys = ['price', 'avg_price', 'lowest_recorded_price', 'highest_recorded_price', 'msrp'];

      for (const key of directKeys) {
            const value = parseOptionalNumber(rawData[key]);
            if (value !== undefined && value > 0) {
                  expectedCandidates.push({ amount: value, currency: defaultSourceCurrency });
            }
      }
      const directSalePrice = parseOptionalNumber(rawData.sale_price);
      if (directSalePrice !== undefined && directSalePrice > 0) {
            saleCandidates.push({ amount: directSalePrice, currency: defaultSourceCurrency });
      }

      if (Array.isArray(rawData.stores)) {
            for (const store of rawData.stores) {
                  if (!store || typeof store !== 'object') continue;
                  const storeData = store as Record<string, unknown>;
                  const price = parseOptionalNumber(storeData.price);
                  const salePrice = parseOptionalNumber(storeData.sale_price);
                  const currency =
                        typeof storeData.currency === 'string' && storeData.currency.trim()
                              ? storeData.currency.trim().toUpperCase()
                              : defaultSourceCurrency;
                  if (price !== undefined && price > 0) {
                        expectedCandidates.push({ amount: price, currency });
                  }
                  if (salePrice !== undefined && salePrice > 0) {
                        saleCandidates.push({ amount: salePrice, currency });
                  } else if (price !== undefined && price > 0) {
                        saleCandidates.push({ amount: price, currency });
                  }
            }
      }

      if (!expectedCandidates.length) {
            expectedCandidates.push({ amount: estimateBarcodeValue(product), currency: 'USD' });
      }
      if (!saleCandidates.length) {
            saleCandidates.push(...expectedCandidates);
      }

      const allCandidates = [...expectedCandidates, ...saleCandidates];
      const requiresConversion = allCandidates.some((candidate) => candidate.currency !== normalizedTargetCurrency);
      const rates = requiresConversion ? await locationService.getExchangeRates() : null;
      const convertAndChooseLowest = (candidates: Array<{ amount: number; currency: string }>) => {
            const convertedCandidates = candidates
                  .map((candidate) => {
                        const convertedAmount = locationService.convertCurrencyAmount(
                              candidate.amount,
                              rates,
                              candidate.currency,
                              normalizedTargetCurrency
                        );

                        return convertedAmount === null
                              ? null
                              : {
                                      amount: Number(convertedAmount.toFixed(2)),
                                      currency: normalizedTargetCurrency,
                                      sourceAmount: candidate.amount,
                                      sourceCurrency: candidate.currency,
                                };
                  })
                  .filter((candidate): candidate is MarketValue => candidate !== null)
                  .sort((a, b) => a.amount - b.amount);

            if (!convertedCandidates.length) {
                  throw new AppError(
                        `Unable to convert barcode price to ${normalizedTargetCurrency}. Please enter the selling price manually.`,
                        502
                  );
            }

            return convertedCandidates[0];
      };

      return {
            expected: convertAndChooseLowest(expectedCandidates),
            sale: convertAndChooseLowest(saleCandidates),
      };
};

const normalizeCsvHeader = (value: string) =>
      value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

const getCsvValue = (row: Record<string, unknown>, aliases: string[]) => {
      const normalizedAliases = aliases.map((alias) => normalizeCsvHeader(alias));

      for (const [key, value] of Object.entries(row)) {
            if (normalizedAliases.includes(key)) {
                  return value;
            }
      }

      return undefined;
};

const parseObjectId = (value: unknown, fieldName: string) => {
      const id = toQueryString(value).trim();

      if (!id) {
            return undefined;
      }

      if (!Types.ObjectId.isValid(id)) {
            throw new AppError(`Invalid ${fieldName}`, 400);
      }

      return new Types.ObjectId(id);
};

const escapeCsvValue = (value: unknown) => {
      const text = toQueryString(value);

      if (!text) {
            return '';
      }

      if (/[",\n\r]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
      }

      return text;
};

const inventoryCsvHeaders = [
      'itemName',
      'sku',
      'brand',
      'color',
      'storage',
      'size',
      'imeiNumber',
      'modelNumber',
      'quantity',
      'purchasePrice',
      'expectedPrice',
      'productDetails',
      'aiDescription',
      'groupKey',
      'minStockLevel',
      'type',
      'status',
      'currentState',
      'userId',
      'supplierId',
      'storeId',
];

const inventoryCsvTemplateRows = [
      [
            'Sample iPhone 13',
            'SKU-IPH13-256-BLK',
            'Apple',
            'Black',
            '256GB',
            '6.1',
            '356789012345678',
            'A2633',
            5,
            500,
            750,
            'Premium smartphone in excellent condition',
            'Ready for sale',
            'GROUP-001',
            2,
            'inventory',
            'inventory',
            'new',
            'USER_OBJECT_ID',
            'SUPPLIER_OBJECT_ID',
            'STORE_OBJECT_ID',
      ],
];

const buildInventoryCsvTemplate = () => {
      const headerLine = inventoryCsvHeaders.join(',');
      const dataLines = inventoryCsvTemplateRows.map((row) => row.map(escapeCsvValue).join(','));

      return [headerLine, ...dataLines].join('\n');
};

const parseInventoryCsvRows = (filePath: string) => {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
            return [] as Array<Record<string, unknown> & { rowNumber: number }>;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            blankrows: false,
            defval: '',
      });

      return rows.map((row, index) => {
            const normalizedRow = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
                  acc[normalizeCsvHeader(key)] = value;
                  return acc;
            }, {});

            return {
                  rowNumber: index + 2,
                  ...normalizedRow,
            };
      });
};

const buildInventoryPayloadFromCsvRow = (
      row: Record<string, unknown> & { rowNumber: number },
      defaultUserId?: string
) => {
      const itemName = toQueryString(getCsvValue(row, ['itemName', 'name', 'productName', 'title'])).trim();
      const imeiNumber = toQueryString(getCsvValue(row, ['imeiNumber', 'imei', 'serialNumber'])).trim();
      const userIdValue =
            toQueryString(getCsvValue(row, ['userId', 'ownerId', 'user'])).trim() || String(defaultUserId ?? '').trim();
      const type = normalizeInventoryType(getCsvValue(row, ['type']));
      const status = normalizeInventoryStatus(getCsvValue(row, ['status']), type);

      if (!itemName) {
            throw new AppError(`Row ${row.rowNumber}: itemName is required`, 400);
      }

      if (!imeiNumber) {
            throw new AppError(`Row ${row.rowNumber}: imeiNumber is required`, 400);
      }

      if (!userIdValue) {
            throw new AppError(`Row ${row.rowNumber}: userId is required`, 400);
      }

      const userId = parseObjectId(userIdValue, 'userId');
      const supplierId = parseObjectId(getCsvValue(row, ['supplierId']), 'supplierId');
      const storeId = parseObjectId(getCsvValue(row, ['storeId']), 'storeId');

      return {
            itemName,
            sku: toQueryString(getCsvValue(row, ['sku'])).trim() || undefined,
            brand: toQueryString(getCsvValue(row, ['brand'])).trim() || undefined,
            color: toQueryString(getCsvValue(row, ['color'])).trim()
                  ? toQueryString(getCsvValue(row, ['color'])).split(',').map((c: string) => c.trim()).filter(Boolean)
                  : undefined,
            storage: toQueryString(getCsvValue(row, ['storage'])).trim()
                  ? toQueryString(getCsvValue(row, ['storage'])).split(',').map((s: string) => s.trim()).filter(Boolean)
                  : undefined,
            size: toQueryString(getCsvValue(row, ['size'])).trim() || undefined,
            imeiNumber,
            modelNumber: toQueryString(getCsvValue(row, ['modelNumber', 'model'])).trim() || undefined,
            quantity: parseOptionalNumber(getCsvValue(row, ['quantity'])),
            purchasePrice: parseOptionalNumber(getCsvValue(row, ['purchasePrice', 'costPrice'])),
            expectedPrice: parseOptionalNumber(getCsvValue(row, ['expectedPrice', 'salePrice'])),
            productDetails: toQueryString(getCsvValue(row, ['productDetails', 'details'])).trim() || undefined,
            aiDescription: toQueryString(getCsvValue(row, ['aiDescription', 'description'])).trim() || undefined,
            groupKey: toQueryString(getCsvValue(row, ['groupKey'])).trim() || undefined,
            minStockLevel: parseOptionalNumber(getCsvValue(row, ['minStockLevel', 'minStock'])),
            type,
            status,
            currentState: normalizeBulkCurrentState(getCsvValue(row, ['currentState', 'condition', 'state'])),
            userId,
            supplierId,
            storeId,
      };
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

const COMMON_COLORS = [
      'black', 'white', 'blue', 'green', 'red', 'gold', 'silver', 'grey', 'gray',
      'purple', 'pink', 'orange', 'yellow', 'midnight', 'space gray', 'rose gold',
      'starlight', 'graphite', 'sierra blue', 'alpine green', 'deep purple',
      'coral', 'navy', 'mint', 'lavender', 'teal', 'bronze', 'titanium',
      'phantom black', 'phantom green', 'phantom violet', 'phantom white',
      'ice blue', 'cream', 'bronze', 'charcoal', 'forest green', 'chocolate',
      'obsidian', 'cloud', 'frost', 'nebula', 'aurora', 'sunrise', 'sunset',
];

const extractColorsFromName = (name: string): string[] => {
      const lower = name.toLowerCase();
      const found: string[] = [];

      for (const color of COMMON_COLORS) {
            if (lower.includes(color)) {
                  found.push(color.replace(/\b\w/g, (c) => c.toUpperCase()));
            }
      }

      const dashMatch = name.match(/[-–]\s*([A-Za-z][A-Za-z\s]+?)(?:\s*\(|$)/);
      if (dashMatch) {
            const candidate = dashMatch[1].trim();
            if (candidate.length <= 25 && !found.some((c) => candidate.toLowerCase().includes(c.toLowerCase()))) {
                  found.push(candidate);
            }
      }

      return [...new Set(found)];
};

const extractStorageFromName = (name: string): string[] => {
      const storagePattern = /\b(\d+\s*(?:GB|TB|MB))\b/gi;
      const matches: string[] = [];
      let match;
      while ((match = storagePattern.exec(name)) !== null) {
            const value = match[1].replace(/\s+/g, '').toUpperCase();
            if (!matches.includes(value)) {
                  matches.push(value);
            }
      }
      return matches;
};

const normalizeCondition = (value: IInventory['currentState']) => {
      return value === 'good condition' ? 'good condition' : 'new';
};

const toQueryString = (value: unknown) => {
      if (typeof value === 'string') {
            return value;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
      }

      return '';
};

const normalizeInventoryType = (value: unknown): TInventoryType => {
      return toQueryString(value).trim().toLowerCase() === 'sold' ? 'sold' : 'inventory';
};

const normalizeInventoryStatus = (value: unknown, inventoryType: TInventoryType): TInventoryStatus => {
      const normalizedValue = toQueryString(value).trim().toLowerCase();

      if (inventoryType === 'sold') {
            return 'sold';
      }

      if (
            normalizedValue === 'inventory' ||
            normalizedValue === 'sold' ||
            normalizedValue === 'due' ||
            normalizedValue === 'draft'
      ) {
            return normalizedValue;
      }

      return 'inventory';
};

const syncInventoryState = (payload: Partial<IInventory>) => {
      const type = normalizeInventoryType(payload.type ?? payload.status);
      const status = normalizeInventoryStatus(payload.status, type);

      return {
            ...payload,
            type,
            status,
      };
};

const buildInventoryFilter = (query: Record<string, unknown>) => {
      const filter: Record<string, unknown> = {};

      const userId = toQueryString(query.userId).trim();
      const groupKey = toQueryString(query.groupKey).trim();
      const type = toQueryString(query.type).trim().toLowerCase();
      const status = toQueryString(query.status).trim().toLowerCase();
      const sold = toQueryString(query.sold).trim().toLowerCase();
      const due = toQueryString(query.due).trim().toLowerCase();
      const draft = toQueryString(query.draft).trim().toLowerCase();
      const categoryId = toQueryString(query.categoryId).trim();

      if (userId) {
            filter.userId = userId;
      }

      if (groupKey) {
            filter.groupKey = groupKey;
      }

      if (categoryId) {
            filter.categoryId = parseObjectId(categoryId, 'categoryId');
      }

      if (type === 'inventory' || type === 'sold') {
            filter.type = type;
      }

      if (status === 'inventory' || status === 'sold' || status === 'due' || status === 'draft') {
            filter.status = status;

            if (status === 'sold') {
                  filter.type = 'sold';
            }
      }

      if (sold === 'true') {
            filter.type = 'sold';
            filter.status = 'sold';
      }

      if (due === 'true') {
            filter.status = 'due';
      }

      if (draft === 'true') {
            filter.status = 'draft';
      }

      return filter;
};

const groupInventoryByGroupKey = (items: Array<any>) => {
      const grouped = new Map<
            string,
            {
                  groupKey: string;
                  totalQuantity: number;
                  items: Array<any>;
            }
      >();

      for (const item of items) {
            const groupKey = String(item.groupKey ?? item._id);

            if (!grouped.has(groupKey)) {
                  grouped.set(groupKey, {
                        groupKey,
                        totalQuantity: 0,
                        items: [],
                  });
            }

            const groupedItem = grouped.get(groupKey)!;
            groupedItem.items.push(item);
            groupedItem.totalQuantity += Number(item.quantity ?? 0);
      }

      return Array.from(grouped.values());
};

const sendLowStockAlert = async (inventoryItem: any) => {
      const quantity = Number(inventoryItem?.quantity ?? 0);
      const minStockLevel = Number(inventoryItem?.minStockLevel ?? 0);
      const recipientId = inventoryItem?.userId;

      if (!recipientId || !Types.ObjectId.isValid(String(recipientId))) {
            return;
      }

      if (!Number.isFinite(quantity) || !Number.isFinite(minStockLevel) || minStockLevel <= 0) {
            return;
      }

      if (quantity > minStockLevel) {
            return;
      }

      // Create socket notification
      await createNotification({
            to: new Types.ObjectId(String(recipientId)),
            title: 'Low Stock Alert',
            message: `${inventoryItem.itemName} is low on stock. Only ${quantity} item(s) remain and the minimum stock level is ${minStockLevel}.`,
            type: 'LOW_STOCK',
            id: new Types.ObjectId(String(inventoryItem._id)),
      });

      // Send email notification if enabled
      if (config.lowStockAlert.enableEmailNotification) {
            try {
                  // Fetch low stock alert configuration for this user
                  const lowStockAlertConfig = await LowStockAlert.findOne({
                        shopkeeperId: new Types.ObjectId(String(recipientId)),
                  });

                  // Fetch user data for email and name
                  const user = await User.findById(recipientId).select('email firstName lastName');

                  if (!user || !user.email) {
                        console.warn(`[LowStockAlert] User ${recipientId} has no email configured`);
                        return;
                  }

                  // Check if alert threshold is met (use user's minimumStock or item's minStockLevel)
                  const alertThreshold = lowStockAlertConfig?.minimumStock ?? minStockLevel;

                  if (quantity > alertThreshold) {
                        return;
                  }

                  // Enqueue email sending in worker thread
                  await enqueueLowStockEmail({
                        userId: String(recipientId),
                        email: user.email,
                        shopkeeperName: `${user.firstName} ${user.lastName}`.trim() || 'Shopkeeper',
                        lowStockItems: [
                              {
                                    itemName: inventoryItem.itemName,
                                    quantity: quantity,
                                    minimumStock: alertThreshold,
                                    imeiNumber: inventoryItem.imeiNumber,
                              },
                        ],
                  });
            } catch (error: any) {
                  console.error('[LowStockAlert] Error enqueueing email:', error.message);
                  // Don't throw - let system continue even if email fails
            }
      }
};

const assertValidObjectId = (value: string, fieldName: string) => {
      if (!Types.ObjectId.isValid(value)) {
            throw new AppError(`Invalid ${fieldName}`, 400);
      }
};

type TBarcodeBulkInputItem = {
      code?: string;
      barcode?: string;
      userId?: string;
      imeiNumber?: string;
      purchasePrice?: number | string;
      currentState?: IInventory['currentState'];
};

const parseBarcodeBulkItems = (value: unknown): TBarcodeBulkInputItem[] => {
      const normalizeItem = (item: unknown): TBarcodeBulkInputItem => {
            if (typeof item === 'string') {
                  return { code: item };
            }

            if (!item || typeof item !== 'object') {
                  return {};
            }

            return item as TBarcodeBulkInputItem;
      };

      const parseArray = (input: unknown): TBarcodeBulkInputItem[] => {
            if (!Array.isArray(input)) {
                  return [];
            }

            return input.map(normalizeItem);
      };

      if (Array.isArray(value)) {
            return parseArray(value);
      }

      if (typeof value === 'string') {
            try {
                  return parseArray(JSON.parse(value));
            } catch {
                  return [];
            }
      }

      if (!value || typeof value !== 'object') {
            return [];
      }

      const payload = value as Record<string, unknown>;
      const candidates = payload.barcodes ?? payload.items ?? payload.rows ?? payload.codes;

      if (Array.isArray(candidates)) {
            return parseArray(candidates);
      }

      if (typeof candidates === 'string') {
            try {
                  return parseArray(JSON.parse(candidates));
            } catch {
                  return [];
            }
      }

      return [];
};

const normalizeBulkCurrentState = (value: unknown): IInventory['currentState'] | undefined => {
      const state = toQueryString(value).trim();

      if (state === 'new' || state === 'good condition') {
            return state;
      }

      return undefined;
};

const createInventory = async (payload: Partial<IInventory>, file?: any, variantFiles: Express.Multer.File[] = []) => {
      const normalizedPayload = syncInventoryState(payload);
      const inventoryImages = parseStringArray(payload.images);
      const sourceImageUrls = parseStringArray(payload.sourceImageUrls);
      const payloadImageUrl =
            typeof payload.image === 'object' && payload.image !== null && typeof payload.image.url === 'string'
                  ? payload.image.url.trim()
                  : '';
      const normalizedSourceImageUrl =
            typeof payload.sourceImageUrl === 'string' && payload.sourceImageUrl.trim()
                  ? payload.sourceImageUrl.trim()
                  : sourceImageUrls[0] || inventoryImages[0] || payloadImageUrl;
      const normalizedSalePrice = parseOptionalNumber(payload.salePrice);
      const normalizedExpectedPrice = parseOptionalNumber(payload.expectedPrice);
      const variants = await normalizeVariants((payload as any).variants, variantFiles);

      for (const variant of variants) {
            if (variant.imeiNumber) {
                  const exists = await Inventory.exists({ $or: [{ imeiNumber: variant.imeiNumber }, { 'variants.imeiNumber': variant.imeiNumber }] });
                  if (exists) throw new AppError(`Inventory with IMEI ${variant.imeiNumber} already exists`, 409);
            }
      }
      if (variants.length) normalizedPayload.variants = variants as IInventory['variants'];

      if (normalizedSalePrice !== undefined) {
            normalizedPayload.salePrice = normalizedSalePrice;
      } else if (normalizedExpectedPrice !== undefined) {
            normalizedPayload.salePrice = normalizedExpectedPrice;
      }

      if (normalizedExpectedPrice !== undefined) {
            normalizedPayload.expectedPrice = normalizedExpectedPrice;
      }

      if (payload.imeiNumber) {
            const existingInventory = await Inventory.findOne({ $or: [{ imeiNumber: payload.imeiNumber }, { 'variants.imeiNumber': payload.imeiNumber }] });

            if (existingInventory) {
                  throw new AppError(`Inventory with IMEI ${payload.imeiNumber} already exists`, 409);
            }
      }

      if (normalizedSourceImageUrl) {
            normalizedPayload.sourceImageUrl = normalizedSourceImageUrl;
      }

      if (inventoryImages.length) {
            normalizedPayload.images = inventoryImages;
      } else if (sourceImageUrls.length) {
            normalizedPayload.images = sourceImageUrls;
      } else if (normalizedSourceImageUrl) {
            normalizedPayload.images = [normalizedSourceImageUrl];
      }

      if (file) {
            const cloudinaryResponse = await uploadToCloudinary(file.path);
            if (cloudinaryResponse) {
                  normalizedPayload.image = {
                        public_id: cloudinaryResponse.public_id,
                        url: cloudinaryResponse.secure_url,
                  };
            }
      } else if (normalizedSourceImageUrl) {
            normalizedPayload.image = {
                  public_id: '',
                  url: normalizedSourceImageUrl,
            };
      }

      if (sourceImageUrls.length) {
            normalizedPayload.sourceImageUrls = sourceImageUrls;
      } else if (normalizedSourceImageUrl) {
            normalizedPayload.sourceImageUrls = [normalizedSourceImageUrl];
      }

      const result = await Inventory.create(normalizedPayload);
      // Update category total items if categoryId is provided
      if (result.categoryId) {
            await categoryService.updateInventoryCategoryCount(result.categoryId, result.userId);
      }

      await sendLowStockAlert(result);

      return result;
};

const importInventoriesFromCsv = async (filePath?: string, defaultUserId?: string) => {
      if (!filePath) {
            throw new AppError('CSV file is required', 400);
      }

      try {
            const rows = parseInventoryCsvRows(filePath);

            if (!rows.length) {
                  throw new AppError('CSV file must contain at least one data row', 400);
            }

            const results = [] as Array<{
                  rowNumber: number;
                  ok: boolean;
                  message: string;
                  data?: unknown;
            }>;

            for (const row of rows) {
                  try {
                        const payload = buildInventoryPayloadFromCsvRow(row, defaultUserId);
                        const created = await createInventory(payload);

                        results.push({
                              rowNumber: row.rowNumber,
                              ok: true,
                              message: 'Inventory created successfully',
                              data: created,
                        });
                  } catch (error) {
                        results.push({
                              rowNumber: row.rowNumber,
                              ok: false,
                              message: error instanceof Error ? error.message : 'Failed to create inventory',
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
      } finally {
            await fs.unlink(filePath).catch(() => undefined);
      }
};

const getInventoryCsvTemplate = () => buildInventoryCsvTemplate();

// This function creates an inventory item from a barcode. It validates inputs, fetches product details from a barcode service,
// generates AI insights and a detailed AI description, estimates market value, formats product information, normalizes inventory fields (status/type/condition), uploads optional files, and finally saves the inventory record into the database.
const createInventoryFromBarcode = async (
      payload: {
            code: string;
            userId: string;
            imeiNumber?: string;
            purchasePrice?: number | string;
            currentState?: IInventory['currentState'];
            type?: IInventory['type'];
            status?: IInventory['status'];
            categoryId?: string;
            images?: string[] | string;
            sourceImageUrl?: string;
            sourceImageUrls?: string[] | string;
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
      const inventoryOwner = await User.findById(userObjectId).select('currency').lean();
      if (!inventoryOwner) {
            throw new AppError('User not found', 404);
      }
      const inventoryCurrency = String(inventoryOwner.currency || 'USD').trim().toUpperCase();

      const barcodeResult = await barcodeService.searchByBarcode(cleanCode);
      const rawData =
            barcodeResult?.rawData && typeof barcodeResult.rawData === 'object'
                  ? (barcodeResult.rawData as Record<string, unknown>)
                  : {};
      const resolvedTitle =
            typeof rawData.title === 'string' && rawData.title.trim()
                  ? rawData.title.trim()
                  : typeof barcodeResult.name === 'string' && barcodeResult.name.trim()
                        ? barcodeResult.name.trim()
                        : '';
      const fallbackName = resolvedTitle || (barcodeResult.brand ? `${barcodeResult.brand} ${barcodeResult.name}` : barcodeResult.name);
      const itemName = fallbackName?.trim() || 'Unknown Product';
      const imeiNumber = String(payload.imeiNumber ?? '').trim() || barcodeResult.barcode || cleanCode;
      const marketPricing = await extractMarketPricing(barcodeResult, inventoryCurrency);
      const aiInsight = await getOpenAiInsight({
            imei: imeiNumber,
            deviceName: itemName,
            deviceStatus: 'clean',
            riskLabel: 'Low Risk',
            sourceText: JSON.stringify(barcodeResult),
            estimatedMarketValue: marketPricing.expected.amount,
            currency: marketPricing.expected.currency,
      });

      const purchasePrice = parseOptionalNumber(payload.purchasePrice);
      const expectedPrice = marketPricing.expected.amount;
      const salePrice = marketPricing.sale.amount;

      const brand = barcodeResult.brand || undefined;
      const colorVariants = extractColorsFromName(itemName);
      const storageVariants = extractStorageFromName(itemName);

      const productDetails = (() => {
            const parts: string[] = [];
            parts.push(itemName);
            if (brand) parts.push(`Brand: ${brand}`);
            if (colorVariants.length) parts.push(`Color: ${colorVariants.join(', ')}`);
            if (storageVariants.length) parts.push(`Storage: ${storageVariants.join(', ')}`);
            if (barcodeResult.category) parts.push(`Category: ${barcodeResult.category}`);
            if (barcodeResult.description) parts.push(String(barcodeResult.description));
            const rawData = barcodeResult?.rawData;
            if (rawData && typeof rawData === 'object') {
                  const ean = rawData.ean ?? rawData.barcode ?? '';
                  if (ean) parts.push(`EAN: ${ean}`);
            }
            return parts.join('. ');
      })();

      const generateAiDescription = (): string => {
            const conditionUpper = normalizeCondition(payload.currentState).toUpperCase();
            const colorStr = colorVariants.length ? colorVariants.join(', ') : 'N/A';
            const storageStr = storageVariants.length ? storageVariants.join(', ') : 'N/A';
            const aiMessage = aiInsight?.message || 'Device appears consistent with provider records.';

            return `${itemName} by ${brand || 'Unknown'} in ${colorStr}, ${storageStr} storage. Condition: ${conditionUpper}. IMEI: ${imeiNumber}. Estimated value: ${expectedPrice} ${marketPricing.expected.currency}. ${aiMessage}`;
      };

      const aiDescription = generateAiDescription();

      const barcodeImages =
            Array.isArray(barcodeResult.images) && barcodeResult.images.length
                  ? barcodeResult.images
                  : barcodeResult.image
                        ? [barcodeResult.image]
                        : [];

      const primaryBarcodeImage =
            typeof barcodeResult.image === 'string' && barcodeResult.image.trim()
                  ? barcodeResult.image.trim()
                  : barcodeImages[0] || '';

      const result = await createInventory(
            {
                  itemName,
                  brand,
                  color: colorVariants.length ? colorVariants : undefined,
                  storage: storageVariants.length ? storageVariants : undefined,
                  imeiNumber,
                  userId: userObjectId,
                  purchasePrice,
                  expectedPrice,
                  salePrice,
                  currentState: normalizeCondition(payload.currentState),
                  productDetails,
                  aiDescription,
                  images:
                        parseStringArray(payload.images).length
                              ? parseStringArray(payload.images)
                              : parseStringArray(payload.sourceImageUrls).length
                                    ? parseStringArray(payload.sourceImageUrls)
                                    : barcodeImages,
                  sourceImageUrl:
                        typeof payload.sourceImageUrl === 'string' && payload.sourceImageUrl.trim()
                              ? payload.sourceImageUrl.trim()
                              : primaryBarcodeImage,
                  sourceImageUrls: parseStringArray(payload.sourceImageUrls).length
                        ? parseStringArray(payload.sourceImageUrls)
                        : barcodeImages,
                  categoryId: payload.categoryId ? parseObjectId(payload.categoryId, 'categoryId') : undefined,
                  type: normalizeInventoryType(payload.type ?? payload.status),
                  status: normalizeInventoryStatus(
                        payload.status,
                        normalizeInventoryType(payload.type ?? payload.status)
                  ),
            },
            file
      );

      return {
            result,
            productDetails,
            aiDescription,
            barcodeResult,
            aiInsight,
            marketValue: marketPricing,
      };
};

// This function bulk-creates inventory items from a request body barcode list. It validates each item,
// processes them using createInventoryFromBarcode, handles row-level errors individually, and returns a summary.

const createInventoryFromBarcodeBulk = async (payload: unknown, defaultUserId?: string) => {
      const requestBody =
            payload && typeof payload === 'object' && !Array.isArray(payload)
                  ? (payload as Record<string, unknown>)
                  : {};
      const baseUserId = toQueryString(requestBody.userId ?? defaultUserId).trim();
      const baseImeiNumber = toQueryString(requestBody.imeiNumber).trim();
      const basePurchasePrice =
            typeof requestBody.purchasePrice === 'number' || typeof requestBody.purchasePrice === 'string'
                  ? requestBody.purchasePrice
                  : undefined;
      const baseCurrentState = normalizeBulkCurrentState(
            requestBody.currentState ?? requestBody.condition ?? requestBody.state
      );
      const rows = parseBarcodeBulkItems(payload).map((item, index) => ({
            rowNumber: index + 1,
            code: String(item.code ?? item.barcode ?? '').trim(),
            userId: String(item.userId ?? baseUserId ?? '').trim(),
            imeiNumber: String(item.imeiNumber ?? baseImeiNumber ?? '').trim(),
            purchasePrice: item.purchasePrice ?? basePurchasePrice,
            currentState: item.currentState ?? baseCurrentState,
      }));

      if (!rows.length) {
            throw new AppError('At least one barcode is required', 400);
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

const getAllInventory = async (query: Record<string, unknown> = {}) => {
      return await getInventoryWithFilters(query);
};

const getInventoryWithFilters = async (query: Record<string, unknown> = {}) => {
      const filter = buildInventoryFilter(query);
      const groupBy = toQueryString(query.groupBy).trim().toLowerCase();

      const inventories = await Inventory.find(filter).populate('userId').sort({ createdAt: -1 });

      if (groupBy === 'groupkey') {
            return groupInventoryByGroupKey(inventories);
      }

      return inventories;
};

const getSoldInventory = async (query: Record<string, unknown> = {}) => {
      return await getInventoryWithFilters({ ...query, type: 'sold', status: 'sold' });
};

const getInventoryByStatus = async (status: string, query: Record<string, unknown> = {}) => {
      return await getInventoryWithFilters({ ...query, status });
};

const getGroupedInventoryByGroupKey = async (query: Record<string, unknown> = {}) => {
      return await getInventoryWithFilters({ ...query, groupBy: 'groupKey' });
};

const getSingleInventory = async (id: string) => {
      assertValidObjectId(id, 'id');
      return await Inventory.findById(id).populate('userId');
};

const updateInventory = async (id: string, payload: Partial<IInventory>, file?: any, variantFiles: Express.Multer.File[] = []) => {
      assertValidObjectId(id, 'id');

      // Get old inventory to check category change and image fallbacks
      const oldInventory = await Inventory.findById(id);

      const normalizedPayload = syncInventoryState(payload);
      const inventoryImages = parseStringArray(payload.images);
      const sourceImageUrls = parseStringArray(payload.sourceImageUrls);
      const payloadImageUrl =
            typeof payload.image === 'object' && payload.image !== null && typeof payload.image.url === 'string'
                  ? payload.image.url.trim()
                  : '';
      const normalizedSourceImageUrl =
            typeof payload.sourceImageUrl === 'string' && payload.sourceImageUrl.trim()
                  ? payload.sourceImageUrl.trim()
                  : sourceImageUrls[0] || inventoryImages[0] || payloadImageUrl || oldInventory?.sourceImageUrl || oldInventory?.image?.url || oldInventory?.images?.[0];
      const normalizedSalePrice = parseOptionalNumber(payload.salePrice);
      const normalizedExpectedPrice = parseOptionalNumber(payload.expectedPrice);
      if ((payload as any).variants !== undefined) {
            normalizedPayload.variants = (await normalizeVariants((payload as any).variants, variantFiles)) as IInventory['variants'];
      }

      if (normalizedSalePrice !== undefined) {
            normalizedPayload.salePrice = normalizedSalePrice;
      } else if (normalizedExpectedPrice !== undefined) {
            normalizedPayload.salePrice = normalizedExpectedPrice;
      }

      if (normalizedExpectedPrice !== undefined) {
            normalizedPayload.expectedPrice = normalizedExpectedPrice;
      }

      if (normalizedSourceImageUrl) {
            normalizedPayload.sourceImageUrl = normalizedSourceImageUrl;
      }

      if (inventoryImages.length) {
            normalizedPayload.images = inventoryImages;
      } else if (sourceImageUrls.length) {
            normalizedPayload.images = sourceImageUrls;
      } else if (normalizedSourceImageUrl) {
            normalizedPayload.images = [normalizedSourceImageUrl];
      }

      if (file) {
            const cloudinaryResponse = await uploadToCloudinary(file.path);
            if (cloudinaryResponse) {
                  normalizedPayload.image = {
                        public_id: cloudinaryResponse.public_id,
                        url: cloudinaryResponse.secure_url,
                  };
            }
      } else if (normalizedSourceImageUrl) {
            normalizedPayload.image = {
                  public_id: '',
                  url: normalizedSourceImageUrl,
            };
      }

      if (sourceImageUrls.length) {
            normalizedPayload.sourceImageUrls = sourceImageUrls;
      } else if (normalizedSourceImageUrl) {
            normalizedPayload.sourceImageUrls = [normalizedSourceImageUrl];
      }

      const updatedInventory = await Inventory.findByIdAndUpdate(id, normalizedPayload, {
            new: true,
            runValidators: true,
      });

      if (updatedInventory) {
            const oldCategoryId = oldInventory?.categoryId?.toString();
            const newCategoryId = updatedInventory.categoryId?.toString();

            if (oldCategoryId !== newCategoryId) {
                  if (oldCategoryId && Types.ObjectId.isValid(oldCategoryId)) {
                        await categoryService.updateInventoryCategoryCount(
                              new Types.ObjectId(oldCategoryId),
                              updatedInventory.userId
                        );
                  }
                  if (newCategoryId && Types.ObjectId.isValid(newCategoryId)) {
                        await categoryService.updateInventoryCategoryCount(
                              new Types.ObjectId(newCategoryId),
                              updatedInventory.userId
                        );
                  }
            }

            await sendLowStockAlert(updatedInventory);
      }

      return updatedInventory;
};

const deleteInventory = async (id: string) => {
      assertValidObjectId(id, 'id');

      const inventory = await Inventory.findById(id);

      const result = await Inventory.findByIdAndDelete(id);

      // Update category total items if category existed
      if (inventory?.categoryId) {
            await categoryService.updateInventoryCategoryCount(inventory.categoryId, inventory.userId);
      }

      return result;
};

const getMyInventory = async (userId: string, query: Record<string, unknown> = {}) => {
      const shouldPaginate = query.page !== undefined || query.limit !== undefined;

      if (!shouldPaginate) {
            return await Inventory.find({ userId }).populate('userId').sort({ createdAt: -1 });
      }

      const requestedPage = Number.parseInt(String(query.page ?? ''), 10);
      const requestedLimit = Number.parseInt(String(query.limit ?? ''), 10);
      const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 12;
      const search = String(query.search ?? '').trim();
      const categoryId = String(query.categoryId ?? '').trim();
      const filter: FilterQuery<IInventory> = { userId };

      if (categoryId && Types.ObjectId.isValid(categoryId)) {
            filter.categoryId = new Types.ObjectId(categoryId);
      }

      if (search) {
            const searchExpression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                  { itemName: searchExpression },
                  { brand: searchExpression },
                  { imeiNumber: searchExpression },
                  { sku: searchExpression },
            ];
      }

      const [data, total] = await Promise.all([
            Inventory.find(filter).populate('userId').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
            Inventory.countDocuments(filter),
      ]);

      return {
            data,
            meta: {
                  page,
                  limit,
                  total,
                  totalPage: Math.max(1, Math.ceil(total / limit)),
            },
      };
};

const getInventoryByUserId = async (userId: string) => {
      assertValidObjectId(userId, 'userId');

      return await Inventory.find({ userId }).populate('userId').sort({ createdAt: -1 });
};

export default {
      createInventory,
      createInventoryFromBarcode,
      createInventoryFromBarcodeBulk,
      importInventoriesFromCsv,
      getInventoryCsvTemplate,
      getAllInventory,
      getInventoryWithFilters,
      getSoldInventory,
      getInventoryByStatus,
      getGroupedInventoryByGroupKey,
      getSingleInventory,
      updateInventory,
      deleteInventory,
      getMyInventory,
      getInventoryByUserId,
};
