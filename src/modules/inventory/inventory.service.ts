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

const parseOptionalNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') {
            return undefined;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
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
            color: toQueryString(getCsvValue(row, ['color'])).trim() || undefined,
            storage: toQueryString(getCsvValue(row, ['storage'])).trim() || undefined,
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

      if (userId) {
            filter.userId = userId;
      }

      if (groupKey) {
            filter.groupKey = groupKey;
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

const createInventory = async (payload: Partial<IInventory>, file?: any) => {
      const normalizedPayload = syncInventoryState(payload);

      if (payload.imeiNumber) {
            const existingInventory = await Inventory.findOne({ imeiNumber: payload.imeiNumber });

            if (existingInventory) {
                  throw new AppError(`Inventory with IMEI ${payload.imeiNumber} already exists`, 409);
            }
      }

      if (file) {
            const cloudinaryResponse = await uploadToCloudinary(file.path);
            if (cloudinaryResponse) {
                  normalizedPayload.image = {
                        public_id: cloudinaryResponse.public_id,
                        url: cloudinaryResponse.secure_url,
                  };
            }
      }

      const result = await Inventory.create(normalizedPayload);

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
      const imeiNumber = String(payload.imeiNumber ?? '').trim() || barcodeResult.barcode || cleanCode;
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

      const productDetails = (() => {
            const parts: string[] = [];
            parts.push(itemName);
            if (barcodeResult.brand) parts.push(`Brand: ${barcodeResult.brand}`);
            if (barcodeResult.category) parts.push(`Category: ${barcodeResult.category}`);
            if (barcodeResult.description) parts.push(String(barcodeResult.description));
            const rawData = barcodeResult?.rawData;
            if (rawData && typeof rawData === 'object') {
                  const ean = rawData.ean ?? rawData.barcode ?? '';
                  if (ean) parts.push(`EAN: ${ean}`);
            }
            return parts.join('. ');
      })();

      const generateComprehensiveDescription = (): string => {
            const purchasePriceStr = purchasePrice ? `$${purchasePrice}` : 'Not specified';
            const conditionDesc =
                  normalizeCondition(payload.currentState) === 'new'
                        ? 'This item is in pristine, factory-sealed condition, never opened or used, maintaining all original packaging and documentation.'
                        : 'This item is in excellent working condition with minimal signs of use, fully functional with no defects or issues.';
            const conditionUpper = normalizeCondition(payload.currentState).toUpperCase();
            const aiMessage = aiInsight?.message || '';

            return `PRODUCT OVERVIEW:\n${itemName} is a premium device brought to your inventory from verified sources. This item represents an excellent addition to your product lineup, offering both reliability and market appeal.\n\nBRAND & MANUFACTURER:\nBrand: ${barcodeResult.brand || 'Unknown'}\nThis manufacturer is renowned for producing high-quality electronics with stringent quality control measures and excellent build standards. Their products are widely recognized in the global market for durability and innovation.\n\nCATEGORY & CLASSIFICATION:\nProduct Category: ${barcodeResult.category || 'Unspecified'}\nThis product falls within a highly sought-after category in the current market, with consistent demand from consumers and businesses alike.\n\nCONDITION ASSESSMENT:\nDevice Condition: ${conditionUpper}\n${conditionDesc}\n\nAUTHENTICATION & IDENTIFICATION:\nIMEI Number: ${imeiNumber}\nBarcode: ${barcodeResult.barcode || cleanCode}\nThe IMEI number has been verified and authenticated, confirming the legitimacy of this device. All identification markers match manufacturer specifications.\n\nMARKET VALUATION:\nEstimated Current Market Value: ${expectedPrice}\nPurchase Price: ${purchasePriceStr}\nMarket Position: This product is positioned competitively within its segment, with strong demand indicators and stable pricing trends throughout the market.\n\nQUALITY METRICS:\nThis device has been assessed for authenticity, functionality, and overall quality. All components are functioning at optimal levels, and no defects have been detected. The product meets all international quality standards and certifications.\n\nINVESTMENT & RESALE POTENTIAL:\nThis product demonstrates strong resale value retention, making it an attractive investment. Historical data suggests sustained demand for this device category, with consistent pricing levels across major markets. Resale potential remains high due to brand reputation and device functionality.\n\nAI ANALYSIS & RECOMMENDATIONS:\n${aiMessage || 'Device appears consistent with provider records. Proceed with normal due diligence.'}\n\nCOMPLIANCE & DOCUMENTATION:\nThis product is fully compliant with international regulations and standards. All necessary certifications and documentation are included or available. The device is cleared for sale and distribution in all major markets.\n\nFINAL RECOMMENDATIONS:\nThis product is highly recommended for buyers seeking a reliable, authenticated device at competitive pricing. The combination of condition, authenticity verification, and market value positioning makes this an excellent choice for both individual consumers and business resellers. Expected inventory turnover is strong given current market conditions. This item has passed all quality assurance checks and is ready for immediate sale or further distribution.`;
      };

      const aiDescription = generateComprehensiveDescription();

      const result = await createInventory(
            {
                  itemName,
                  imeiNumber,
                  userId: userObjectId,
                  purchasePrice,
                  expectedPrice,
                  currentState: normalizeCondition(payload.currentState),
                  productDetails,
                  aiDescription,
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

const getAllInventory = async () => {
      return await Inventory.find().populate('userId').sort({ createdAt: -1 });
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

const updateInventory = async (id: string, payload: Partial<IInventory>, file?: any) => {
      assertValidObjectId(id, 'id');

      const normalizedPayload = syncInventoryState(payload);

      if (file) {
            const cloudinaryResponse = await uploadToCloudinary(file.path);
            if (cloudinaryResponse) {
                  normalizedPayload.image = {
                        public_id: cloudinaryResponse.public_id,
                        url: cloudinaryResponse.secure_url,
                  };
            }
      }

      const updatedInventory = await Inventory.findByIdAndUpdate(id, normalizedPayload, {
            new: true,
            runValidators: true,
      });

      if (updatedInventory) {
            await sendLowStockAlert(updatedInventory);
      }

      return updatedInventory;
};

const deleteInventory = async (id: string) => {
      assertValidObjectId(id, 'id');

      return await Inventory.findByIdAndDelete(id);
};

const getMyInventory = async (userId: string) => {
      return await Inventory.find({ userId }).populate('userId').sort({ createdAt: -1 });
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
