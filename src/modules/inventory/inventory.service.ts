import AppError from '../../errors/AppError';
import path from 'node:path';
import { Types } from 'mongoose';
import XLSX from 'xlsx';
import { IBarcodeSearchResult } from '../barcode/barcode.interface';
import barcodeService from '../barcode/barcode.service';
import { getOpenAiInsight } from '../deviceCheck/scanInfo.transformer';
import { createNotification } from '../socket/notification.service';
import { IInventory, TInventoryStatus, TInventoryType } from './inventory.interface';
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

      await createNotification({
            to: new Types.ObjectId(String(recipientId)),
            title: 'Low Stock Alert',
            message: `${inventoryItem.itemName} is low on stock. Only ${quantity} item(s) remain and the minimum stock level is ${minStockLevel}.`,
            type: 'LOW_STOCK',
            id: new Types.ObjectId(String(inventoryItem._id)),
      });
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
            raw: false,
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
      const firstCell = String(rows[0]?.[0] ?? '').trim();
      const looksLikeGenericSingleColumnHeader =
            !hasHeaderRow && rows[0]?.length === 1 && /^[a-z]+$/i.test(firstCell) && rows.length > 1;
      const dataRows = hasHeaderRow || looksLikeGenericSingleColumnHeader ? rows.slice(1) : rows;

      return dataRows.map((row, index) => ({
            rowNumber: hasHeaderRow || looksLikeGenericSingleColumnHeader ? index + 2 : index + 1,
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
